import { REACTOR_CONFIG as config } from '@/configs/reactor.config'
import { reactorToolDefinitions, execute } from './reactor.tools'
import { AIProviders, PROVIDER_API } from '@/lib/ai-models'
import type { ReactorStreamEvent } from './reactor.events'
import type { EnrichedResponse } from './reactor.types'

const MAX_ITERATIONS = config.maxIterations

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an agent playing a robot navigation game on a 7-column x 5-row grid.

RULES:
- The robot moves along row 5 (bottom row), starting at column 1. Goal is column 7.
- Available commands: right (move +1 col), left (move -1 col), wait (stay in place).
- Each command also moves ALL blocks by 1 step in their direction (simultaneously).
- A block occupying row 5 in the robot's column AFTER the command = collision = game over.
- Use "reset" after a collision to restart the game. Use "start" only once at the beginning.

COLLISION RULE (critical):
After any command, check if the robot's NEW column will have a block at row 5.
- "right": will column+1 have a block at row 5 after blocks move?
- "wait":  will current column have a block at row 5 after blocks move?
- "left":  will column-1 have a block at row 5 after blocks move?
A block is at row 5 when its bottom_row >= 5.

BLOCK MOVEMENT:
- direction "down": top_row+1, bottom_row+1 each step; reverses to "up" when bottom_row would exceed 5.
- direction "up": top_row-1, bottom_row-1 each step; reverses to "down" when top_row would go below 1.

STRATEGY:
- Always prefer moving right (toward goal at column 7).
- Wait only when right is unsafe.
- The tool result includes a pre-computed safety analysis — trust it.

After each send_command call you will receive a JSON with:
- "data": raw API response (board, blocks, player position, reached_goal)
- "boardState": compact per-column block summary
- "availableMoves": pre-computed list of safe moves for this step (e.g. ["right", "wait"])

Always pick from availableMoves. Prefer "right". If availableMoves is empty, call reset.`

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function runReactorAgent(
  model: string,
  provider: AIProviders,
  onEvent: (event: ReactorStreamEvent) => void
): Promise<void> {
  const { url: apiUrl, getKey, resolveModel } = PROVIDER_API[provider]
  const apiKey = getKey()
  const resolvedModel = resolveModel(model)

  const messages: Record<string, unknown>[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        'Start the game and navigate the robot from column 1 to the goal at column 7. Call send_command("start") first.',
    },
  ]

  let cumulativePrompt = 0
  let cumulativeCompletion = 0
  let cumulativeTotal = 0

  onEvent({ type: 'step', id: 'agent', status: 'running', message: 'Agent started…' })

  for (let i = 0; i < MAX_ITERATIONS; i++) {
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
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        tools: reactorToolDefinitions,
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

    // No tool calls → agent finished unexpectedly
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

    // FIX #3: push the original assistant message (with tool_calls) as-is
    messages.push(message)

    for (const toolCall of message.tool_calls) {
      // FIX #2: correct path to function name/arguments in OpenAI format
      const fnName: string = toolCall.function.name
      const fnArgs: string = toolCall.function.arguments

      onEvent({ type: 'tool', name: fnName, args: fnArgs })

      let result: EnrichedResponse
      try {
        result = await execute(fnName, fnArgs)
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e)
        const errContent = JSON.stringify({ error: errMsg })
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: errContent })
        onEvent({ type: 'tool', name: fnName, args: fnArgs, result: errContent })
        continue
      }

      const toolContent = JSON.stringify(result)
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolContent })
      onEvent({ type: 'tool', name: fnName, args: fnArgs, result: toolContent })

      // Check for game end: flag in message or reached_goal
      if (result.data.code === 0 || result.data.reached_goal) {
        const flag = result.data.message ?? ''
        onEvent({ type: 'result', flag, hubResponse: result.data })
        onEvent({
          type: 'step',
          id: 'agent',
          status: 'done',
          message: `Goal reached! Flag: ${flag}`,
        })
        return
      }
    }
  }

  throw new Error(`Agent exceeded ${MAX_ITERATIONS} iterations without reaching the goal`)
}
