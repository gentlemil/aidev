import { PIPELINE_CONFIG as config } from '@/configs/pipeline.config'
import { PROVIDER_API } from '@/lib/ai-models'
import { parseCSV } from '@/lib/csv'
import { submitAnswer } from '@/features/ai-devs/hub'
import { getYear } from 'date-fns'
// import type { Person, TaggedPerson, TaggingResult } from '../people/people.types'
import type { Stage1Event } from '../pipeline.events'
import { Person, TaggedPerson, TaggingResult } from '../../people/people.types'

// ── Types ────────────────────────────────────────────────────────────────────

type HubResponse = { code: number; message: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

function isHubSuccess(response: unknown): response is HubResponse {
  const r = response as HubResponse
  return r?.code === 0 && typeof r.message === 'string' && /\{FLG:/i.test(r.message)
}

function filterPeople(people: Person[]): Person[] {
  const { currentYear, minAge, maxAge, birthPlace, gender } = config.stage1

  return people.filter((person) => {
    const age = currentYear - getYear(new Date(person.birthDate))
    return (
      person.gender === gender && person.birthPlace === birthPlace && age >= minAge && age <= maxAge
    )
  })
}

async function tagJobs(
  jobs: string[],
  model: string,
  apiUrl: string,
  apiKey: string
): Promise<{
  results: TaggingResult[]
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null
}> {
  const { availableJobTags } = config.stage1

  const schema = {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number', minimum: 0 },
            tags: {
              type: 'array',
              items: { type: 'string', enum: availableJobTags, minItems: 1 },
            },
          },
          required: ['id', 'tags'],
          additionalProperties: false,
        },
      },
    },
    required: ['results'],
    additionalProperties: false,
  }

  const jobList = jobs.map((description, index) => ({ id: index, job: description }))

  const PROMPT = `Tag each job description with relevant tags from the available list.

Available tags: ${JSON.stringify(availableJobTags)}

Rules:
- Return a JSON object with a "results" key containing an array of objects.
- Each result object must have exactly two fields: "id" (integer, matching the input id) and "tags" (array of strings from the available tags).
- One job can have multiple tags.
- Every input job must have a corresponding result entry with the same "id".`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: JSON.stringify({ jobs: jobList }) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'tagging_result', strict: true, schema },
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LLM API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) throw new Error('Empty LLM response')

  const parsed = JSON.parse(content) as { results: TaggingResult[] }
  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens as number,
        completionTokens: data.usage.completion_tokens as number,
        totalTokens: data.usage.total_tokens as number,
      }
    : null

  return { results: parsed.results, usage }
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function runStage1(onEvent: (event: Stage1Event) => void): Promise<TaggedPerson[]> {
  const { model, provider, maxIterations, task, transportTag } = config.stage1
  const { url: apiUrl, getKey, resolveModel } = PROVIDER_API[provider]
  const apiKey = getKey()
  const resolvedModel = resolveModel(model)

  onEvent({ type: 'step', id: 'stage1-start', status: 'running', message: 'Stage 1 started' })

  // Fetch and parse CSV (deterministic — done once outside the retry loop)
  onEvent({ type: 'step', id: 'csv', status: 'running', message: 'Fetching CSV data…' })

  const csvResponse = await fetch(config.stage1.csvUrl)
  if (!csvResponse.ok) throw new Error(`CSV fetch failed: ${csvResponse.status}`)

  const allPeople: Person[] = parseCSV<Person>(await csvResponse.text(), (row) => ({
    name: row['name'],
    surname: row['surname'],
    gender: row['gender'],
    birthDate: row['birthDate'],
    birthPlace: row['birthPlace'],
    birthCountry: row['birthCountry'],
    job: row['job'],
  }))

  const filtered = filterPeople(allPeople)

  onEvent({
    type: 'step',
    id: 'csv',
    status: 'done',
    message: `CSV loaded — ${allPeople.length} total, ${filtered.length} after filter`,
  })

  if (filtered.length === 0) {
    throw new Error('No people match the filter criteria')
  }

  const jobs = filtered.map((p) => p.job)

  // Retry loop — LLM tagging is non-deterministic so each attempt may differ
  for (let attempt = 0; attempt < maxIterations; attempt++) {
    onEvent({
      type: 'step',
      id: `attempt-${attempt}`,
      status: 'running',
      message: `Attempt ${attempt + 1}/${maxIterations} — tagging jobs with LLM…`,
    })

    const { results: taggingResults, usage } = await tagJobs(jobs, resolvedModel, apiUrl, apiKey)

    if (usage) {
      onEvent({
        type: 'llm',
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      })
    }

    const tagged: TaggedPerson[] = filtered
      .map((person, index) => {
        const result = taggingResults.find((r) => r.id === index)
        return {
          name: person.name,
          surname: person.surname,
          gender: person.gender,
          born: getYear(new Date(person.birthDate)),
          city: person.birthPlace,
          tags: result?.tags ?? [],
        }
      })
      .filter((p) => p.tags.includes(transportTag))

    onEvent({
      type: 'step',
      id: `attempt-${attempt}`,
      status: 'done',
      message: `Tagging done — ${tagged.length} person(s) with "${transportTag}" tag`,
    })

    // Submit to hub
    onEvent({
      type: 'step',
      id: `submit-${attempt}`,
      status: 'running',
      message: 'Submitting to hub…',
    })

    const hubResponse = await submitAnswer(task, tagged)

    onEvent({
      type: 'step',
      id: `submit-${attempt}`,
      status: 'done',
      message: 'Hub responded',
      detail: JSON.stringify(hubResponse),
    })

    if (isHubSuccess(hubResponse)) {
      onEvent({
        type: 'result',
        matched: tagged,
        allCount: allPeople.length,
        filteredCount: filtered.length,
        hubResponse,
      })
      return tagged
    }

    onEvent({
      type: 'retry',
      attempt: attempt + 1,
      maxAttempts: maxIterations,
      hubResponse,
    })
  }

  throw new Error(`Stage 1 exceeded ${maxIterations} attempts without hub approval`)
}
