import { PEOPLE_CONFIG as config } from '@/configs/people.config'
import { AIProviders, PROVIDER_API } from '@/lib/ai-models'
import { TaggingBatchResult, TaggingUsage } from '@/types/llm.types'
import { TaggingResult } from './people.types'

const TAGGING_SCHEMA = {
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
            items: { type: 'string', enum: config.availableJobTags, minItems: 1 },
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

export async function tagJobsBatch(
  jobs: string[],
  model: string = config.model,
  provider: AIProviders = AIProviders.OPEN_ROUTER
): Promise<TaggingBatchResult> {
  const { url, getKey } = PROVIDER_API[provider]
  const apiKey = getKey()
  const jobList: { id: number; job: string }[] = jobs.map((description: string, index: number) => ({
    id: index,
    job: description,
  }))

  const PROMPT: string = `Tag each job description with relevant tags from the available list.

Available tags: ${JSON.stringify(config.availableJobTags)}

Rules:
- Return a JSON object with a "results" key containing an array of objects.
- Each result object must have exactly two fields: "id" (integer, matching the input id) and "tags" (array of strings from the available tags).
- One job can have multiple tags.
- Every input job must have a corresponding result entry with the same "id".`

  const response = await fetch(url, {
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
        json_schema: {
          name: 'tagging_result',
          strict: true,
          schema: TAGGING_SCHEMA,
        },
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`LLM API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Empty LLM response')
  }

  const usage: TaggingUsage | null = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens as number,
        completionTokens: data.usage.completion_tokens as number,
        totalTokens: data.usage.total_tokens as number,
      }
    : null

  const parsed: { results: TaggingResult[] } = JSON.parse(content) as { results: TaggingResult[] }

  return { results: parsed.results, model, usage }
}
