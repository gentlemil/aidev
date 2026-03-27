import { AIProviders, PROVIDER_API } from '@/lib/ai-models'
import type { SensorEntry } from './evaluation.types'

/**
 * Analyzes operator notes for sensors that passed programmatic checks.
 *
 * Goal: find sensors where the operator CLAIMS there's an error, but data looks fine.
 * These won't be caught by range/type validators — only natural language analysis can find them.
 *
 * Returns file IDs where operator notes indicate a problem.
 */
export async function analyzeOperatorNotes(
  cleanEntries: SensorEntry[],
  provider: AIProviders,
  model: string
): Promise<string[]> {
  // ── Step 1: Build a map of unique notes → list of file IDs ──────────────────
  //
  // Many sensors share identical notes (e.g., "All readings nominal").
  // Instead of sending 10,000 notes to the LLM, we send only unique ones.
  // This drastically reduces token usage and cost.
  //
  // noteToIds["All readings nominal"] = ["0684", "1234", "5678", ...]
  const noteToIds = new Map<string, string[]>()

  for (const entry of cleanEntries) {
    const note = entry.sensor.operator_notes.trim()
    if (!noteToIds.has(note)) {
      noteToIds.set(note, [])
    }
    noteToIds.get(note)!.push(entry.id)
  }

  // ── Step 2: Build an indexed array of unique notes ───────────────────────────
  //
  // LLM will receive notes as a numbered list (0, 1, 2, ...) and respond
  // with just the indices of error notes. This keeps output tokens minimal —
  // instead of repeating full note text, model returns e.g. [2, 7, 14].
  const uniqueNotes = Array.from(noteToIds.keys())

  // ── Step 3: Call LLM with all unique notes in a single request ───────────────
  //
  // We use OpenRouter with gpt-4o-mini — cheap and sufficient for classification.
  // The system prompt instructs the model to classify each note as "ok" or "error".
  // We use json_object response_format to guarantee parseable output.
  const { url, getKey, resolveModel } = PROVIDER_API[provider]

  const SYSTEM_PROMPT = `You are classifying sensor operator notes.
For each note, determine if the operator is reporting a problem, anomaly, malfunction, or any concern (even minor).
Return ONLY a JSON object with key "errorIndices" containing an array of note indices (numbers) where operator reports ANY issue.
If all notes are fine, return { "errorIndices": [] }.`

  // Format notes as numbered list for the model
  const notesList = uniqueNotes.map((note, i) => `${i}: "${note}"`).join('\n')

  const llmResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: resolveModel(model),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Classify these operator notes:\n\n${notesList}` },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!llmResponse.ok) {
    throw new Error(`LLM API error: ${llmResponse.status}`)
  }

  const data = await llmResponse.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty LLM response')

  // ── Step 4: Parse response and map indices back to file IDs ──────────────────
  //
  // Model returned e.g. { "errorIndices": [2, 7] }
  // Index 2 maps to uniqueNotes[2], which maps to a list of file IDs via noteToIds.
  // We collect all file IDs for notes the model flagged as errors.
  const parsed = JSON.parse(content) as { errorIndices: number[] }

  const errorIds: string[] = parsed.errorIndices.flatMap((index) => {
    const note = uniqueNotes[index]
    return note ? (noteToIds.get(note) ?? []) : []
  })

  return [...new Set(errorIds)]
}
