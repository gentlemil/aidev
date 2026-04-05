import { AIProviders, PROVIDER_API } from '@/lib/ai-models'
import { load } from 'cheerio'

export interface IncidentAnalysis {
  incidentId: string
  mentionsSkolwin: boolean
  mentionsVehiclesOrPeople: boolean
  shouldEdit: boolean
  reasoning: string
}

export interface TaskAnalysis {
  taskId: string
  mentionsSkolwin: boolean
  reasoning: string
}

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    mentionsSkolwin: { type: 'boolean' },
    mentionsVehiclesOrPeople: { type: 'boolean' },
    reasoning: { type: 'string' },
  },
  required: ['mentionsSkolwin', 'mentionsVehiclesOrPeople', 'reasoning'],
  additionalProperties: false,
}

const REWRITE_SCHEMA = {
  type: 'object',
  properties: {
    content: { type: 'string' },
  },
  required: ['content'],
  additionalProperties: false,
}

const TASK_SCHEMA = {
  type: 'object',
  properties: {
    mentionsSkolwin: { type: 'boolean' },
    reasoning: { type: 'string' },
  },
  required: ['mentionsSkolwin', 'reasoning'],
  additionalProperties: false,
}

function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function regexAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

const SKOLWIN_PATTERNS = [/\bskolwin\b/i]

const PEOPLE_PATTERNS = [
  /\bludzie\b/i,
  /\bludzi\b/i,
  /\bosob(?:a|y|ie|om|ami)?\b/i,
  /\bczlowiek(?:a|iem|owi|u)?\b/i,
  /\bmezczyzn(?:a|y|ie|om|ami)?\b/i,
  /\bkobiet(?:a|y|ie|om|ami)?\b/i,
  /\bperson\b/i,
  /\bpeople\b/i,
  /\bhuman(?:s)?\b/i,
]

const VEHICLE_PATTERNS = [
  /\bpojazd(?:y|em|ami|ow)?\b/i,
  /\bsamochod(?:y|em|ami|ow)?\b/i,
  /\baut(?:o|a|em|ami)?\b/i,
  /\bciezarowk(?:a|i|e|ami|ach)?\b/i,
  /\btruck(?:s)?\b/i,
  /\bcar(?:s)?\b/i,
  /\bvehicle(?:s)?\b/i,
  /\bvan(?:s)?\b/i,
]

export async function analyzeIncident(
  incidentId: string,
  html: string,
  model = 'openai/gpt-4o-mini',
  provider = AIProviders.OPEN_ROUTER
): Promise<IncidentAnalysis> {
  const { url, getKey, resolveModel } = PROVIDER_API[provider]
  const textOnlyFull = load(html).text().replace(/\s+/g, ' ').trim()
  const normalizedText = normalizeForSearch(textOnlyFull)
  const deterministicMentionsSkolwin = regexAny(normalizedText, SKOLWIN_PATTERNS)
  const deterministicMentionsVehiclesOrPeople = regexAny(normalizedText, [
    ...PEOPLE_PATTERNS,
    ...VEHICLE_PATTERNS,
  ])

  // Keep prompt size bounded while still giving enough context for nuanced phrasing.
  const textOnly = textOnlyFull.slice(0, 20_000)
  const htmlSnippet = html.slice(0, 6000)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: resolveModel(model),
      messages: [
        {
          role: 'system',
          content: `You analyze security incident reports (HTML pages).
Determine:
1. Does the report mention the city "Skolwin"? (look for the word Skolwin anywhere in the text)
2. Does the report mention vehicles (pojazdy, samochody, ciężarówki, auta, truck, car, vehicle) OR people (ludzie, ludzi, osoby, człowiek, mężczyzna, kobieta, person, people)?
Treat indirect language like "istnieje szansa, że ... przebywają ludzie" as a positive mention of people.

Respond with JSON matching the schema exactly.`,
        },
        {
          role: 'user',
          content: `Incident ID: ${incidentId}\n\nPage content (TEXT):\n${textOnly}\n\nPage content (HTML snippet):\n${htmlSnippet}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'incident_analysis', strict: true, schema: ANALYSIS_SCHEMA },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM call failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const parsed = JSON.parse(data.choices[0].message.content) as {
    mentionsSkolwin: boolean
    mentionsVehiclesOrPeople: boolean
    reasoning: string
  }

  // Hybrid strategy: LLM output + deterministic keyword detection reduces false negatives.
  const mentionsSkolwin = parsed.mentionsSkolwin || deterministicMentionsSkolwin
  const mentionsVehiclesOrPeople =
    parsed.mentionsVehiclesOrPeople || deterministicMentionsVehiclesOrPeople

  return {
    incidentId,
    mentionsSkolwin,
    mentionsVehiclesOrPeople,
    shouldEdit: mentionsSkolwin && mentionsVehiclesOrPeople,
    reasoning: `${parsed.reasoning} | deterministic: Skolwin=${deterministicMentionsSkolwin}, vehicles_or_people=${deterministicMentionsVehiclesOrPeople}`,
  }
}

export async function generateAnimalIncidentDescription(
  incidentId: string,
  html: string,
  model = 'openai/gpt-4o-mini',
  provider = AIProviders.OPEN_ROUTER
): Promise<string> {
  const { url, getKey, resolveModel } = PROVIDER_API[provider]
  const textOnly = load(html).text().replace(/\s+/g, ' ').trim().slice(0, 12_000)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: resolveModel(model),
      messages: [
        {
          role: 'system',
          content: `Rewrite incident report content in Polish.
Goal:
- Keep city context (Skolwin), but make it about animals.
- Remove/avoid mentions of people, persons, citizens, vehicles, cars, trucks.
- Keep it realistic, neutral, and concise (1-2 sentences).
- Output only JSON with field "content".`,
        },
        {
          role: 'user',
          content: `Incident ID: ${incidentId}\n\nOriginal report text:\n${textOnly}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'incident_rewrite', strict: true, schema: REWRITE_SCHEMA },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM rewrite failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const parsed = JSON.parse(data.choices[0].message.content) as { content: string }
  return parsed.content.trim()
}

export async function analyzeTaskForSkolwin(
  taskId: string,
  html: string,
  model = 'gpt-4.1',
  provider = AIProviders.OPEN_AI
): Promise<TaskAnalysis> {
  const { url, getKey, resolveModel } = PROVIDER_API[provider]
  const textOnly = load(html).text().replace(/\s+/g, ' ').trim()
  const normalized = normalizeForSearch(textOnly)
  const deterministic = regexAny(normalized, SKOLWIN_PATTERNS)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: resolveModel(model),
      messages: [
        {
          role: 'system',
          content: `You analyze a task/note page from an operations panel.
Decide if this task is related to city "Skolwin" (directly or indirectly).
Respond as strict JSON with fields: mentionsSkolwin, reasoning.`,
        },
        {
          role: 'user',
          content: `Task ID: ${taskId}\n\nTask page text:\n${textOnly.slice(0, 14_000)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'task_analysis', strict: true, schema: TASK_SCHEMA },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM task analysis failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const parsed = JSON.parse(data.choices[0].message.content) as {
    mentionsSkolwin: boolean
    reasoning: string
  }

  const mentionsSkolwin = parsed.mentionsSkolwin || deterministic
  return {
    taskId,
    mentionsSkolwin,
    reasoning: `${parsed.reasoning} | deterministic: Skolwin=${deterministic}`,
  }
}
