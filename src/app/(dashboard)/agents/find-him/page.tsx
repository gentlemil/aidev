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
import type {
  FindHimStreamEvent,
  StepStatus,
} from '@/features/ai-devs/tasks/find-him/find-him.events'
import type { FindHimAnswer } from '@/features/ai-devs/tasks/find-him/find-him.types'
import { suspects } from '@/features/ai-devs/tasks/find-him/find-him.consts'
import { AIProviders, AVAILABLE_MODELS } from '@/lib/ai-models'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LlmStats, RunStatus } from '@/types/llm.types'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type FindHimLogEntry =
  | { kind: 'step'; id: string; status: StepStatus; message: string; detail?: string; ts: Date }
  | { kind: 'tool'; name: string; args: string; ts: Date }
  | {
      kind: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
      ts: Date
    }

type FindHimResult = {
  answer: FindHimAnswer
  hubResponse: unknown
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function fmtNum(n: number) {
  return n.toLocaleString()
}

function formatArgs(args: string) {
  try {
    return JSON.stringify(JSON.parse(args))
  } catch {
    return args
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running')
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-500" />
  if (status === 'done')
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
}

function LogList({ entries }: { entries: FindHimLogEntry[] }) {
  return (
    <div className="space-y-1">
      {entries.map((entry, i) => {
        if (entry.kind === 'llm') {
          return (
            <div
              key={`llm-${i}`}
              className="ml-7 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="font-mono text-xs font-medium text-amber-800 dark:text-amber-400">
                {entry.model}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {fmtNum(entry.promptTokens)} in / {fmtNum(entry.completionTokens)} out ={' '}
                <span className="font-medium text-foreground">
                  {fmtNum(entry.totalTokens)} tokens
                </span>
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{fmtTime(entry.ts)}</span>
            </div>
          )
        }

        if (entry.kind === 'tool') {
          return (
            <div
              key={`tool-${i}`}
              className="ml-7 flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-700/40 dark:bg-stone-800/30">
              <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs font-medium">{entry.name}</span>
                <span className="ml-2 truncate font-mono text-xs text-muted-foreground">
                  {formatArgs(entry.args)}
                </span>
              </div>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {fmtTime(entry.ts)}
              </span>
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
                  <span className="max-w-xs truncate text-xs font-medium text-muted-foreground">
                    {entry.detail}
                  </span>
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

function TokenCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{fmtNum(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = 'openai/gpt-4o-mini'

export default function FindHimPage() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [log, setLog] = useState<FindHimLogEntry[]>([])
  const [llmStats, setLlmStats] = useState<LlmStats | null>(null)
  const [result, setResult] = useState<FindHimResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hubExpanded, setHubExpanded] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<AIProviders>(AIProviders.OPEN_ROUTER)
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL)
  const [powerPlants, setPowerPlants] = useState<
    { city: string; code: string; power: string; is_active: boolean }[]
  >([])

  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/tasks/find-him')
      .then((r) => r.json())
      .then((data) => setPowerPlants(data.power_plants ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  function handleEvent(event: FindHimStreamEvent) {
    const now = new Date()

    switch (event.type) {
      case 'step': {
        const entry: FindHimLogEntry = { kind: 'step', ...event, ts: now }
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
        setLog((prev) => [...prev, { kind: 'tool', name: event.name, args: event.args, ts: now }])
        break
      }
      case 'llm': {
        setLlmStats({
          model: event.model,
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          totalTokens: event.totalTokens,
        })
        setLog((prev) => {
          // Update existing llm entry if present, otherwise append
          const idx = prev.findLastIndex((e) => e.kind === 'llm')
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = {
              kind: 'llm',
              model: event.model,
              promptTokens: event.promptTokens,
              completionTokens: event.completionTokens,
              totalTokens: event.totalTokens,
              ts: prev[idx].ts,
            }
            return updated
          }
          return [
            ...prev,
            {
              kind: 'llm',
              model: event.model,
              promptTokens: event.promptTokens,
              completionTokens: event.completionTokens,
              totalTokens: event.totalTokens,
              ts: now,
            },
          ]
        })
        break
      }
      case 'result':
        setResult({ answer: event.answer, hubResponse: event.hubResponse })
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
      const response = await fetch('/api/tasks/find-him/stream', {
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
          handleEvent(JSON.parse(json) as FindHimStreamEvent)
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
        title="Find Him"
        description="Locates a suspect from the people list near a nuclear power plant, retrieves their access level, and submits findings to the hub.">
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
            className="bg-amber-600 text-white hover:bg-amber-500">
            {isRunning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
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
              <option key={p} value={p}>
                {p}
              </option>
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
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <Badge variant="outline">Suspects list</Badge>
        <Badge variant="outline">
          Get Plants → Get Locations → Compare → Check Access → Submit
        </Badge>
        {runStatus !== 'idle' && (
          <span
            className={cn(
              'ml-auto text-xs font-medium',
              runStatus === 'running' && 'text-amber-600',
              runStatus === 'done' && 'text-emerald-600',
              runStatus === 'error' && 'text-destructive'
            )}>
            {runStatus === 'running' ? '● Running' : runStatus === 'done' ? '● Done' : '● Error'}
          </span>
        )}
      </div>
      <span className="pt-2 text-[12px] italic text-muted-foreground">
        {
          AVAILABLE_MODELS[selectedProvider].find((model) => model.value === selectedModel)
            ?.description
        }
      </span>
      {/* Data tables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Suspects</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Name', 'Surname', 'Born'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {suspects.map((s) => (
                  <tr key={`${s.name}-${s.surname}`} className="hover:bg-muted/30">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2">{s.surname}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.born}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Power Plants</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['City', 'Code', 'Power', 'Active'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {powerPlants.map((p) => (
                  <tr key={p.code} className="hover:bg-muted/30">
                    <td className="px-4 py-2">{p.city}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.power}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          p.is_active ? 'text-emerald-500' : 'text-muted-foreground'
                        )}>
                        {p.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
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
            <TokenCard label="Prompt" value={llmStats.promptTokens} sub="input tokens" />
            <TokenCard label="Completion" value={llmStats.completionTokens} sub="output tokens" />
            <TokenCard
              label="Total"
              value={llmStats.totalTokens}
              sub={`model: ${llmStats.model}`}
            />
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suspect
                </p>
                <p className="mt-1 text-base font-bold">
                  {result.answer.name} {result.answer.surname}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Power Plant
                </p>
                <p className="mt-1 font-mono text-base font-bold">{result.answer.powerPlant}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Access Level
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-600">
                  {result.answer.accessLevel}
                </p>
              </div>
              <div className="rounded-lg border bg-emerald-50 p-4 dark:bg-emerald-950/20">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Status
                </p>
                <p className="mt-1 text-base font-bold text-emerald-700 dark:text-emerald-400">
                  Submitted
                </p>
              </div>
            </div>

            {/* Hub response collapsible */}
            <div className="rounded-lg border">
              <button
                onClick={() => setHubExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                Hub response
                {hubExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
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
