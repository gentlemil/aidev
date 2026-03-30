import { SAVETHEM_CONFIG as config } from '@/configs/savethem.config'
import { saveThemToolDefinitions, createExecutor, resetVerifyAttempts, resetCurrentMap } from './savethem.tools'
import { AIProviders, PROVIDER_API } from '@/lib/ai-models'
import type { SaveThemStreamEvent } from './savethem.events'

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an agent navigating a rescue mission on a 10x10 grid map.

## GOAL
Navigate from the START position (S) to the GOAL position (G) and retrieve the flag.

## AVAILABLE TOOLS
- tool_search(query) — discover available hub endpoints
- call_tool(url, query) — call a discovered endpoint
- verify_route(moves[]) — submit your planned route (max 10 attempts total)

## PHASE 1 — GATHER KNOWLEDGE
Do all of this before planning any route:
1. Call the maps endpoint with query "Skolwin" to get the terrain grid
2. Call the books endpoint multiple times with different queries to get:
   - Map legend (query: "map legend terrain symbols")
   - Movement rules (query: "movement rules vehicle terrain")
   - Vehicle names (query: "vehicle names available transport") — the books often mention specific vehicle names
3. Call the vehicles endpoint for each vehicle name you found in books.
   IMPORTANT: The vehicles endpoint requires the EXACT vehicle name as query (e.g. "rocket").
   Generic queries like "all vehicles" or "list vehicles" will return 404.
   Only query vehicles whose names you found in the books notes.

## MAP FORMAT
The map is a 2D array. Row 0 = TOP, row 9 = BOTTOM. Col 0 = LEFT, col 9 = RIGHT.

Known tile meanings (ALWAYS verify from books endpoint):
- S = start position
- G = goal position
- . = open terrain (passable by everyone)
- W = water (passable ON FOOT; most vehicles cannot cross)
- T = tree (check books for rules)
- R = rocks — IMPASSABLE for all movement, cannot be crossed by anyone

## MOVEMENT COMMANDS
Route is an ordered array of string commands:
- "up" = move to row−1
- "down" = move to row+1
- "left" = move to col−1
- "right" = move to col+1

## VEHICLE USAGE
To use a vehicle, the FIRST element of the array must be the vehicle name.
The vehicle name is NOT a direction — it means "mount this vehicle at the start position".

ON-FOOT ONLY (no vehicle):
  ["up", "right", "right", "up", "right"]
  ← NO vehicle name, NO dismount. Just directions.

VEHICLE ONLY (ride the whole way):
  ["rocket", "up", "right", "right", "up", "right"]
  ← vehicle name FIRST, then directions. NO dismount needed at the end.

VEHICLE + ON FOOT (mixed — only when vehicle is blocked mid-route):
  ["rocket", "right", "right", "up", "dismount", "up", "up", "right"]
  ← vehicle name FIRST → ride → "dismount" when blocked → continue on foot.

RULES:
- "dismount" is ONLY valid AFTER you have named a vehicle at the start AND are still riding it.
- NEVER use "dismount" if you did not start with a vehicle name.
- NEVER use "dismount" in an on-foot route.
- After "dismount" all subsequent commands are on-foot.

## STRATEGY
1. Collect the map, legend, and at least one vehicle description
2. Locate S and G coordinates precisely (row, col)
3. Identify all R tiles (impassable — plan around them) and W tiles (water — walkable on foot)
4. Decide: pure on-foot route, pure vehicle route, or mixed
5. Trace every step manually — count each tile move
6. Submit with verify_route
7. If verify returns an error: analyze the error, fix the route, try again
8. NEVER stop without attempting at least one verify_route call
9. You have up to 10 verify attempts — use them

## CRITICAL RULES
- R tiles block ALL movement — route around them completely
- W tiles are passable ON FOOT but check each vehicle's rules
- Always count steps carefully before submitting — wrong step counts cause 400 errors
- After a failed verify, adjust only the parts that are wrong — do not start over unnecessarily

## HANDLING VALIDATOR ERRORS
When verify_route returns a response with "validation_errors", the route was NOT sent to the hub.
You must fix it and call verify_route again. This does NOT count against your 10 attempts.

The response contains:
- "validation_errors": list of errors with step number and coordinates, e.g.:
    "Step 11: tile [3,6] is W (water) — vehicle cannot cross, must dismount first"
- "trace": your full path as [{step, row, col, tile, mode}] — use this to visualise the route

HOW TO FIX EACH ERROR TYPE:

1. "tile [R,C] is W (water) — vehicle cannot cross, must dismount first"
   → Find which step in your moves[] array corresponds to that step number
   → Insert "dismount" ONE step BEFORE that step in the array
   → All subsequent moves will now be on-foot and can cross water
   Example fix: moves had [..., "right", "right", "up", ...]  ← step 11 lands on W
   Fixed:       [..., "right", "dismount", "right", "up", ...] ← dismount before the W tile

2. "tile [R,C] is R (rocks) — impassable for everyone"
   → You cannot cross that tile at all — reroute around it entirely
   → Look at the trace to see where you went wrong and find an alternative path

3. "dismount used but agent is already on foot"
   → Remove the "dismount" command from the route
   → If you are not using a vehicle, the route should have no vehicle name and no "dismount"

4. "move goes out of bounds"
   → You moved off the edge of the map — correct the direction at that step

WORKFLOW AFTER VALIDATOR ERROR:
1. Read "validation_errors" — note each step number and the error type
2. Use "trace" to see your exact path tile by tile
3. Apply the fix for the specific error type above
4. Call verify_route again with the corrected moves[]`

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function runSaveThemAgent(
  model: string,
  provider: AIProviders,
  onEvent: (event: SaveThemStreamEvent) => void
): Promise<void> {
  const { url: apiUrl, getKey, resolveModel } = PROVIDER_API[provider]
  const apiKey = getKey()
  const resolvedModel = resolveModel(model)
  const execute = createExecutor(onEvent)

  resetVerifyAttempts()
  resetCurrentMap()

  const messages: Record<string, unknown>[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        'Start the rescue mission. The target city is Skolwin. First gather all necessary information (map for Skolwin, legend, vehicles), then plan and submit a route from S to G.',
    },
  ]

  let cumulativePrompt = 0
  let cumulativeCompletion = 0
  let cumulativeTotal = 0

  onEvent({ type: 'step', id: 'agent', status: 'running', message: 'Agent started…' })

  for (let i = 0; i < config.maxIterations; i++) {
    onEvent({
      type: 'step',
      id: `iter-${i}`,
      status: 'running',
      message: `Iteration ${i + 1} — calling LLM… (${messages.length} messages)`,
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
        tools: saveThemToolDefinitions,
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

    // No tool calls → agent finished
    if (!message.tool_calls?.length) {
      onEvent({
        type: 'step',
        id: `iter-${i}`,
        status: 'done',
        message: `Iteration ${i + 1} — agent finished (no tool calls)`,
        detail: message.content ?? undefined,
      })
      onEvent({ type: 'step', id: 'agent', status: 'done', message: 'Agent completed' })
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

      let execResult: { result: unknown; requestUrl: string; requestBody: string }

      try {
        execResult = await execute(fnName, fnArgs)
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e)
        const errorResult = { error: errMsg }
        onEvent({
          type: 'tool',
          name: fnName,
          args: fnArgs,
          result: JSON.stringify(errorResult),
        })
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(errorResult) })
        continue
      }

      const toolContent = JSON.stringify(execResult.result)
      onEvent({
        type: 'tool',
        name: fnName,
        args: fnArgs,
        result: toolContent,
        requestUrl: execResult.requestUrl,
        requestBody: execResult.requestBody,
      })
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolContent })

      // Check for flag in verify_route response
      if (fnName === 'verify_route') {
        const verifyResult = execResult.result as { code?: number; message?: string }
        const msg = verifyResult.message ?? ''
        if (msg.includes('FLG:') || verifyResult.code === 0) {
          onEvent({ type: 'result', flag: msg, hubResponse: execResult.result })
          onEvent({ type: 'step', id: 'agent', status: 'done', message: `Flag retrieved: ${msg}` })
          return
        }
      }
    }
  }

  throw new Error(`Agent exceeded ${config.maxIterations} iterations without retrieving the flag`)
}
