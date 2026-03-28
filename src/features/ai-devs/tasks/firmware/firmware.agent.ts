import { firmwareToolDefinitions, execute } from './firmware.tools'
import { AIProviders, PROVIDER_API } from '@/lib/ai-models'
import type { FirmwareStreamEvent } from './firmware.events'
import type { BanInfo, ShellResponse } from './firmware.types'

const MAX_ITERATIONS = 20
const MAX_TOOL_OUTPUT_CHARS = 2000
// UI gets slightly more for readability, but still capped to avoid freezing the browser
const MAX_UI_OUTPUT_CHARS = 4000
// Sliding window: keep system[0] + user[1] + last N messages.
// Must be even so we never split an assistant/tool pair.
const MAX_CONTEXT_MESSAGES = 24

const ECCS_PATTERN = /ECCS-[0-9a-fA-F]{40}/g

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractBan(result: unknown): BanInfo | null {
  const r = result as ShellResponse
  if (!r?.ban) return null
  return r.ban
}

/**
 * Sanitise before adding to message context.
 * 1. ECCS found anywhere → return only the code (handles binary noise)
 * 2. Short enough         → pass through
 * 3. Too long             → head + tail + truncation note
 */
function sanitiseToolResult(raw: string): string {
  const matches = raw.match(ECCS_PATTERN)
  if (matches?.length) {
    return JSON.stringify({ eccs_code: matches[0], note: 'ECCS code extracted from output' })
  }
  if (raw.length <= MAX_TOOL_OUTPUT_CHARS) return raw

  const head = raw.slice(0, Math.floor(MAX_TOOL_OUTPUT_CHARS * 0.7))
  const tail = raw.slice(-Math.floor(MAX_TOOL_OUTPUT_CHARS * 0.3))
  return (
    head +
    `\n...[truncated — original ${raw.length} chars, head ${head.length} + tail ${tail.length}]...\n` +
    tail
  )
}

/**
 * Sliding-window trim.
 * Always keeps messages[0] (system) and messages[1] (user).
 * Drops oldest messages from index 2 onward, but advances the cut to the
 * next 'assistant' boundary so we never start with an orphaned tool result.
 */
function trimContext(messages: Record<string, unknown>[]): void {
  if (messages.length <= MAX_CONTEXT_MESSAGES) return

  const history = messages.slice(2)
  let dropCount = messages.length - MAX_CONTEXT_MESSAGES

  // Advance past any leading tool results to land on an assistant message
  while (dropCount < history.length && (history[dropCount] as { role?: string }).role === 'tool') {
    dropCount++
  }

  const trimmed = history.slice(dropCount)
  messages.splice(2, messages.length - 2, ...trimmed)
}

// ── System prompt ─────────────────────────────────────────────────────────────

// All facts discovered during prior runs are baked in here so the agent
// doesn't waste iterations re-discovering them.
// cache_control marks this as ephemeral — Anthropic caches it after the first
// call, subsequent iterations pay ~10x fewer tokens for the prompt.
const SYSTEM_PROMPT = `Jesteś agentem uruchamiającym system chłodzenia na wirtualnej maszynie.

DOSTĘPNE KOMENDY (tylko te, żadnych innych):
ls, cat, cd, pwd, rm, editline, find, history, whoami, date, uptime, help
Uwaga: VM akceptuje też ścieżki jako komendy (np. /opt/firmware/cooler/cooler.bin admin1).

ZEBRANE FAKTY — nie odkrywaj ponownie, zacznij od sekwencji:
- settings.ini linia 2: #SAFETY_CHECK=pass  → trzeba odkomentować
- settings.ini linia 10: enabled=false       → trzeba zmienić na true  (sekcja [cooling])
- Plik blokujący: /opt/firmware/cooler/cooler-is-blocked.lock — trzeba usunąć
- Hasło do uruchomienia: admin1 (z /home/operator/notes/pass.txt)
- Logi błędów: /opt/firmware/cooler/logs/error.log (dostępne)

SEKWENCJA (bez odchyleń):
1. editline /opt/firmware/cooler/settings.ini 2 SAFETY_CHECK=pass
2. editline /opt/firmware/cooler/settings.ini 10 enabled=true
3. rm /opt/firmware/cooler/cooler-is-blocked.lock
4. /opt/firmware/cooler/cooler.bin admin1   ← uruchom binarny jako komendę z hasłem
5. Jeśli brak kodu: sprawdź find *.txt, ls /tmp/, cat /opt/firmware/cooler/logs/error.log

ZASADY KRYTYCZNE:
- NIE wywołuj "reboot" — niszczy WSZYSTKIE zmiany (VM odbudowuje FS z dysku)
- NIE otwieraj: .env, storage.cfg, /root/ — natychmiastowy ban + reset VM
- Jeśli [VM_REBOOTED] w kontekście → powtórz sekwencję od kroku 1

FORMAT KODU: ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Po uzyskaniu kodu → submit_answer.`

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function runFirmwareAgent(
  model: string,
  provider: AIProviders,
  onEvent: (event: FirmwareStreamEvent) => void
): Promise<void> {
  const { url: apiUrl, getKey, resolveModel } = PROVIDER_API[provider]
  const apiKey = getKey()
  const resolvedModel = resolveModel(model)

  // Known forbidden paths — injected into every tool result.
  // Does NOT include logs/ — it's gitignored but not VM-blacklisted.
  const bannedPaths = new Set<string>([
    '/opt/firmware/cooler/.env',
    '/opt/firmware/cooler/storage.cfg',
    '/opt/firmware/cooler/.git',
    '/root',
  ])

  const messages: Record<string, unknown>[] = [
    {
      role: 'system',
      content: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    },
    {
      role: 'user',
      content:
        `Uruchom firmware /opt/firmware/cooler/cooler.bin i uzyskaj kod ECCS.\n` +
        `[BLACKLISTED — do NOT access: ${[...bannedPaths].join(', ')}]`,
    },
  ]

  let cumulativePrompt = 0
  let cumulativeCompletion = 0
  let cumulativeTotal = 0
  let cumulativeCached = 0

  onEvent({ type: 'step', id: 'agent', status: 'running', message: 'Agent started…' })

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Trim context before calling LLM to keep token count bounded
    trimContext(messages)

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
        tools: firmwareToolDefinitions,
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
      cumulativeCached +=
        data.usage.prompt_tokens_details?.cached_tokens ?? data.usage.cache_read_input_tokens ?? 0
      onEvent({
        type: 'llm',
        model,
        promptTokens: cumulativePrompt,
        completionTokens: cumulativeCompletion,
        totalTokens: cumulativeTotal,
        cachedTokens: cumulativeCached,
      })
    }

    // No tool calls → agent finished
    if (!message.tool_calls?.length) {
      onEvent({
        type: 'step',
        id: `iter-${i}`,
        status: 'done',
        message: `Iteration ${i + 1} — agent finished`,
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

      onEvent({ type: 'tool', name: fnName, args: fnArgs })

      let result: unknown
      try {
        result = await execute(fnName, fnArgs)
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) }
      }

      const rawResult = JSON.stringify(result)
      // UI-safe result: capped at MAX_UI_OUTPUT_CHARS to avoid freezing the browser.
      // The full rawResult is only used for ECCS extraction and ban parsing above.
      const uiResult =
        rawResult.length <= MAX_UI_OUTPUT_CHARS
          ? rawResult
          : rawResult.slice(0, MAX_UI_OUTPUT_CHARS) +
            `...[+${rawResult.length - MAX_UI_OUTPUT_CHARS} chars truncated]`

      // ── Ban handling ──────────────────────────────────────────────────────
      const ban = extractBan(result)
      if (ban) {
        const waitSecs = (ban.ttl_seconds ?? ban.seconds_left ?? 5) + 2

        // Track the forbidden path so subsequent tool results warn the agent
        const forbidden = ban.command?.split(' ').find((p) => p.startsWith('/'))
        if (forbidden) bannedPaths.add(forbidden)

        onEvent({
          type: 'step',
          id: `ban-${i}`,
          status: 'running',
          message: `Banned — ${ban.reason ?? 'security policy'}. Waiting ${waitSecs}s…`,
        })
        await sleep(waitSecs * 1000)
        onEvent({ type: 'step', id: `ban-${i}`, status: 'done', message: `Ban lifted` })
      }

      // ── Reboot detection ──────────────────────────────────────────────────
      // A ban with reboot:true means the VM reset its filesystem — all our
      // editline/rm changes are gone. Inject a [VM_REBOOTED] marker so the
      // agent knows to restart the fix sequence without calling reboot itself.
      const r = result as ShellResponse
      const vmRebooted = r?.reboot === true || (r as { code?: number })?.code === 100

      // ── Emit for UI (capped — never the full binary payload) ─────────────
      onEvent({ type: 'tool', name: fnName, args: fnArgs, result: uiResult })

      // ── submit_answer ─────────────────────────────────────────────────────
      if (fnName === 'submit_answer') {
        const args = typeof fnArgs === 'string' ? JSON.parse(fnArgs) : fnArgs
        onEvent({ type: 'result', confirmation: args.confirmation, hubResponse: result })
        onEvent({ type: 'step', id: 'agent', status: 'done', message: 'Answer submitted' })
      }

      // ── Sanitise + blacklist note before adding to context ────────────────
      const contextResult = sanitiseToolResult(rawResult)
      const rebootNote = vmRebooted
        ? '\n[VM_REBOOTED] VM filesystem was reset. All editline and rm changes are gone. Restart fix sequence from step 1.'
        : ''
      const bannedNote = `\n[BLACKLISTED — do NOT access: ${[...bannedPaths].join(', ')}]`

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: contextResult + rebootNote + bannedNote,
      })
    }
  }

  throw new Error(`Agent exceeded ${MAX_ITERATIONS} iterations without finishing`)
}
