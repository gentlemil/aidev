'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  Play,
  RotateCcw,
  Wrench,
  XCircle,
} from 'lucide-react'
import type { ReactorStreamEvent, StepStatus } from '@/features/ai-devs/tasks/reactor/reactor.events'
import { AIProviders, AVAILABLE_MODELS } from '@/lib/ai-models'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { REACTOR_CONFIG as config } from '@/configs/reactor.config'

// ── Types ─────────────────────────────────────────────────────────────────────

type RunStatus = 'idle' | 'running' | 'done' | 'error'

type LlmStats = {
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

type ReactorLogEntry =
  | { kind: 'step'; id: string; status: StepStatus; message: string; detail?: string; ts: Date }
  | { kind: 'tool'; name: string; args: string; result?: string; ts: Date }
  | { kind: 'llm'; model: string; promptTokens: number; completionTokens: number; totalTokens: number; ts: Date }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtNum(n: number) {
  return n.toLocaleString()
}

function formatArgs(args: string) {
  try {
    const parsed = JSON.parse(args)
    if (parsed.command) return parsed.command
    return JSON.stringify(parsed)
  } catch {
    return args
  }
}

function formatResult(result: string) {
  // Split raw JSON from analysis section
  const parts = result.split('\n\n--- ')
  if (parts.length >= 2) {
    try {
      const json = JSON.parse(parts[0])
      return JSON.stringify(json, null, 2) + '\n\n--- ' + parts.slice(1).join('\n\n--- ')
    } catch {
      return result
    }
  }
  try {
    return JSON.stringify(JSON.parse(result), null, 2)
  } catch {
    return result
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-500" />
  if (status === 'done') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
}

function LogList({ entries }: { entries: ReactorLogEntry[] }) {
  return (
    <div className="space-y-1">
      {entries.map((entry, i) => {
        if (entry.kind === 'llm') {
          return (
            <div
              key={`llm-${i}`}
              className="ml-7 flex flex-wrap items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="font-mono text-xs font-medium text-amber-800 dark:text-amber-400">{entry.model}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {fmtNum(entry.promptTokens)} in / {fmtNum(entry.completionTokens)} out ={' '}
                <span className="font-medium text-foreground">{fmtNum(entry.totalTokens)} tokens</span>
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{fmtTime(entry.ts)}</span>
            </div>
          )
        }

        if (entry.kind === 'tool') {
          return (
            <div
              key={`tool-${i}`}
              className="ml-7 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800/40 dark:bg-emerald-950/20">
              <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium">{entry.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatArgs(entry.args)}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{fmtTime(entry.ts)}</span>
                </div>
                {entry.result && (
                  <pre className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded bg-black/5 px-2 py-1.5 font-mono text-[11px] text-foreground dark:bg-white/5">
                    {formatResult(entry.result)}
                  </pre>
                )}
              </div>
            </div>
          )
        }

        return (
          <div key={`${entry.id}-${entry.status}`} className="flex items-start gap-3 py-1.5">
            <StepIcon status={entry.status} />
            <div className="flex flex-1 items-baseline justify-between gap-4">
              <span className="text-sm">{entry.message}</span>
              <div className="flex shrink-0 items-center gap-3">
                {entry.detail && (
                  <span className="max-w-xs truncate text-xs font-medium text-muted-foreground">{entry.detail}</span>
                )}
                <span className="text-xs text-muted-foreground">{fmtTime(entry.ts)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{fmtNum(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReactorPage() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [log, setLog] = useState<ReactorLogEntry[]>([])
  const [llmStats, setLlmStats] = useState<LlmStats | null>(null)
  const [result, setResult] = useState<{ flag: string; hubResponse: unknown } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hubExpanded, setHubExpanded] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<AIProviders>(config.provider)
  const [selectedModel, setSelectedModel] = useState<string>(config.model)

  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  function handleEvent(event: ReactorStreamEvent) {
    const now = new Date()

    switch (event.type) {
      case 'step': {
        const entry: ReactorLogEntry = { kind: 'step', ...event, ts: now }
        setLog((prev) => {
          const idx = prev.findIndex((e) => e.kind === 'step' && e.id === event.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...entry, ts: prev[idx].ts }
            return updated
          }
          return [...prev, entry]
        })
        if (event.status === 'error') setRunStatus('error')
        break
      }
      case 'tool': {
        setLog((prev) => {
          if (event.result !== undefined) {
            const idx = [...prev].reverse().findIndex(
              (e) => e.kind === 'tool' && e.name === event.name && e.args === event.args
            )
            if (idx >= 0) {
              const realIdx = prev.length - 1 - idx
              const updated = [...prev]
              updated[realIdx] = { ...updated[realIdx], result: event.result } as ReactorLogEntry
              return updated
            }
          }
          return [...prev, { kind: 'tool', name: event.name, args: event.args, result: event.result, ts: now }]
        })
        break
      }
      case 'llm': {
        setLlmStats({ model: event.model, promptTokens: event.promptTokens, completionTokens: event.completionTokens, totalTokens: event.totalTokens })
        setLog((prev) => {
          const idx = prev.findLastIndex((e) => e.kind === 'llm')
          const newEntry: ReactorLogEntry = { kind: 'llm', model: event.model, promptTokens: event.promptTokens, completionTokens: event.completionTokens, totalTokens: event.totalTokens, ts: idx >= 0 ? prev[idx].ts : now }
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = newEntry
            return updated
          }
          return [...prev, newEntry]
        })
        break
      }
      case 'result':
        setResult({ flag: event.flag, hubResponse: event.hubResponse })
        break
      case 'error':
        setError(event.message)
        setRunStatus('error')
        break
      case 'done':
        setRunStatus('done')
        break
    }
  }

  async function runAgent() {
    setRunStatus('running')
    setLog([])
    setLlmStats(null)
    setResult(null)
    setError(null)
    setHubExpanded(false)

    try {
      const response = await fetch('/api/tasks/reactor/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, provider: selectedProvider }),
      })

      if (!response.ok || !response.body) {
        setError(`HTTP ${response.status}: failed to start agent`)
        setRunStatus('error')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6).trim()
          if (!json) continue
          handleEvent(JSON.parse(json) as ReactorStreamEvent)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stream error')
      setRunStatus('error')
    }
  }

  const isRunning = runStatus === 'running'

  return (
    <PageContainer>
      <PageHeader
        title="Reactor Agent"
        description="Navigates a robot through a 7×5 grid, avoiding moving blocks, to reach the goal and retrieve the flag.">
        <div className="flex gap-2">
          {(runStatus === 'done' || runStatus === 'error') && (
            <Button variant="outline" size="sm" onClick={runAgent}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Re-run
            </Button>
          )}
          <Button
            size="sm"
            onClick={runAgent}
            disabled={isRunning}
            className="bg-emerald-600 text-white hover:bg-emerald-500">
            {isRunning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            {isRunning ? 'Running…' : 'Run Agent'}
          </Button>
        </div>
      </PageHeader>

      {/* Config strip */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Config:</span>
        <div className="flex items-center gap-1.5 rounded-md border px-2 py-0.5">
          <select
            value={selectedProvider}
            onChange={(e) => {
              const p = e.target.value as AIProviders
              setSelectedProvider(p)
              setSelectedModel(AVAILABLE_MODELS[p][0].value)
            }}
            disabled={isRunning}
            className="bg-transparent text-xs outline-none disabled:opacity-50">
            {Object.values(AIProviders).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border px-2 py-0.5">
          <Cpu className="h-3 w-3 text-muted-foreground" />
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isRunning}
            className="bg-transparent text-xs outline-none disabled:opacity-50">
            {AVAILABLE_MODELS[selectedProvider].map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <Badge variant="outline">send_command → Hub API</Badge>
        {runStatus !== 'idle' && (
          <span className={cn('ml-auto text-xs font-medium',
            runStatus === 'running' && 'text-amber-600',
            runStatus === 'done' && 'text-emerald-600',
            runStatus === 'error' && 'text-destructive')}>
            {runStatus === 'running' ? '● Running' : runStatus === 'done' ? '● Done' : '● Error'}
          </span>
        )}
      </div>
      <span className="pt-2 text-[12px] italic text-muted-foreground">
        {AVAILABLE_MODELS[selectedProvider].find((m) => m.value === selectedModel)?.description}
      </span>

      {/* Run log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Run Log</CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {runStatus === 'idle' ? 'Press "Run Agent" to start.' : 'Starting…'}
            </p>
          ) : (
            <div ref={logRef} className="max-h-96 overflow-y-auto pr-1">
              <LogList entries={log} />
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token usage */}
      {llmStats && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Token Usage (cumulative)
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Prompt" value={llmStats.promptTokens} sub="input tokens" />
            <StatCard label="Completion" value={llmStats.completionTokens} sub="output tokens" />
            <StatCard label="Total" value={llmStats.totalTokens} sub={`model: ${llmStats.model}`} />
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-emerald-50 p-4 dark:bg-emerald-950/20">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Flag
              </p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {result.flag}
              </p>
            </div>

            <div className="rounded-lg border">
              <button
                onClick={() => setHubExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                Hub response
                {hubExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {hubExpanded && (
                <pre className="overflow-x-auto border-t bg-muted/40 px-4 py-3 text-xs">
                  {JSON.stringify(result.hubResponse, null, 2)}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
