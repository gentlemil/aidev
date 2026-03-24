import { PIPELINE_CONFIG as config } from '@/configs/pipeline.config'
import { findHimToolDefinitions, execute } from '../../find-him/find-him.tools'
import { AIProviders, PROVIDER_API } from '@/lib/ai-models'
import type { Suspect } from '../../find-him/find-him.types'
import type { Stage2Event } from '../pipeline.events'

const SYSTEM_PROMPT = `Jesteś agentem, który namierza podejrzane osoby w pobliżu elektrowni atomowych.

Masz do dyspozycji narzędzia:
- get_power_plants — pobiera listę elektrowni z nazwami miast i kodami (bez koordynatów)
- get_survivor_locations — pobiera listę lokalizacji (latitude/longitude) danej osoby
- calculate_distance — oblicza odległość w km między dwoma punktami (Haversine)
- check_access_level — sprawdza poziom dostępu osoby
- submit_answer — wysyła finalną odpowiedź

Twoje zadanie krok po kroku:
1. Pobierz listę elektrowni (get_power_plants). Elektrownie mają tylko nazwy miast — użyj swojej wiedzy geograficznej, aby ustalić ich przybliżone koordynaty (latitude/longitude).
2. Dla każdej podejrzanej osoby pobierz jej lokalizacje (get_survivor_locations).
3. Dla każdej pary (lokalizacja osoby, elektrownia) użyj calculate_distance, aby obliczyć odległość.
   Znajdź osobę, która miała lokalizację NAJBLIŻEJ którejkolwiek elektrowni.
4. Dla tej osoby sprawdź poziom dostępu (check_access_level).
5. Wyślij odpowiedź (submit_answer) z imieniem, nazwiskiem, accessLevel i kodem elektrowni.

WAŻNE: Szukasz osoby z NAJMNIEJSZĄ odległością do jakiejkolwiek elektrowni.`

export async function runStage2(
  suspects: Suspect[],
  onEvent: (event: Stage2Event) => void
): Promise<void> {
  const { model, provider, maxIterations } = config.stage2
  const { url: apiUrl, getKey, resolveModel } = PROVIDER_API[provider as AIProviders]
  const apiKey = getKey()
  const resolvedModel = resolveModel(model)

  const messages: Record<string, unknown>[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Oto lista podejrzanych osób:\n${JSON.stringify(suspects, null, 2)}\n\nZnajdź osobę najbliżej elektrowni, sprawdź jej poziom dostępu i wyślij odpowiedź.`,
    },
  ]

  let cumulativePrompt = 0
  let cumulativeCompletion = 0
  let cumulativeTotal = 0

  onEvent({ type: 'step', id: 'stage2-start', status: 'running', message: 'Stage 2 started' })

  for (let i = 0; i < maxIterations; i++) {
    onEvent({
      type: 'step',
      id: `iter-${i}`,
      status: 'running',
      message: `Iteration ${i + 1} — calling LLM…`,
    })

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        tools: findHimToolDefinitions,
        tool_choice: 'auto',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`LLM API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const message = data.choices?.[0]?.message

    if (!message) throw new Error('No message returned from LLM')

    if (data.usage) {
      cumulativePrompt += data.usage.prompt_tokens ?? 0
      cumulativeCompletion += data.usage.completion_tokens ?? 0
      cumulativeTotal += data.usage.total_tokens ?? 0
      onEvent({
        type: 'llm',
        model,
        promptTokens: cumulativePrompt,
        completionTokens: cumulativeCompletion,
        totalTokens: cumulativeTotal,
      })
    }

    if (!message.tool_calls || message.tool_calls.length === 0) {
      onEvent({
        type: 'step',
        id: `iter-${i}`,
        status: 'done',
        message: `Iteration ${i + 1} — agent finished`,
        detail: message.content ?? undefined,
      })
      onEvent({ type: 'step', id: 'stage2-start', status: 'done', message: 'Stage 2 completed' })
      return
    }

    onEvent({
      type: 'step',
      id: `iter-${i}`,
      status: 'done',
      message: `Iteration ${i + 1} — ${message.tool_calls.length} tool call(s)`,
    })

    messages.push(message)

    for (const toolCall of message.tool_calls) {
      const fnName: string = toolCall.function.name
      const fnArgs: string = toolCall.function.arguments

      onEvent({ type: 'tool', name: fnName, args: fnArgs })

      let result: unknown
      try {
        result = await execute(fnName, fnArgs)
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) }
      }

      if (fnName === 'submit_answer') {
        const args = typeof fnArgs === 'string' ? JSON.parse(fnArgs) : fnArgs
        onEvent({
          type: 'result',
          answer: {
            name: args.name,
            surname: args.surname,
            accessLevel: args.accessLevel,
            powerPlant: args.powerPlant,
          },
          hubResponse: result,
        })
        onEvent({ type: 'step', id: 'stage2-start', status: 'done', message: 'Answer submitted' })
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }
  }

  throw new Error(`Stage 2 exceeded ${maxIterations} iterations without finishing`)
}
