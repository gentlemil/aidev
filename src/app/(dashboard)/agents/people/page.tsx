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
  XCircle,
} from 'lucide-react'
import type { AgentStreamEvent, StepStatus } from '@/features/ai-devs/tasks/people/people.events'
import type { TaggedPerson } from '@/features/ai-devs/tasks/people/people.types'
import { PEOPLE_CONFIG } from '@/configs/people.config'
import { AIProviders, AVAILABLE_MODELS } from '@/lib/ai-models'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LlmStats, LogEntry, RunResult, RunStatus } from '@/types/llm.types'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Sub-components ───────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running')
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-500" />
  if (status === 'done')
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
}

function LogList({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="space-y-1">
      {entries.map((entry, i) => {
        if (entry.kind === 'llm') {
          return (
            <div
              key={`llm-${i}`}
              className="ml-7 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="font-mono text-xs font-medium text-amber-800">{entry.model}</span>
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

        return (
          <div key={`${entry.id}-${entry.status}`} className="flex items-start gap-3 py-1.5">
            <StepIcon status={entry.status} />
            <div className="flex flex-1 items-baseline justify-between gap-4">
              <span className="text-sm">{entry.message}</span>
              <div className="flex shrink-0 items-center gap-3">
                {entry.detail && (
                  <span className="text-xs font-medium text-muted-foreground">{entry.detail}</span>
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

function ResultsTable({ people }: { people: TaggedPerson[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {['Name', 'Born', 'City', 'Gender', 'Tags'].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {people.map((p, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td className="px-4 py-2.5 font-medium">
                {p.name} {p.surname}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{p.born}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{p.city}</td>
              <td className="px-4 py-2.5 capitalize text-muted-foreground">{p.gender}</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {p.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PeopleTaggerPage() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [log, setLog] = useState<LogEntry[]>([])
  const [llmStats, setLlmStats] = useState<LlmStats | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hubExpanded, setHubExpanded] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<AIProviders>(AIProviders.OPEN_ROUTER)
  const [selectedModel, setSelectedModel] = useState<string>(PEOPLE_CONFIG.model)

  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  function handleEvent(event: AgentStreamEvent) {
    const now = new Date()

    switch (event.type) {
      case 'step': {
        const entry: LogEntry = { kind: 'step', ...event, ts: now }
        setLog((prev) => {
          const idx = prev.findIndex((e) => e.kind === 'step' && e.id === event.id)
          if (idx >= 0) {
            // Preserve original timestamp, just update status/detail
            const updated = [...prev]
            updated[idx] = { ...entry, ts: prev[idx].ts }
            return updated
          }
          return [...prev, entry]
        })
        if (event.status === 'error') setRunStatus('error')
        break
      }
      case 'llm': {
        setLlmStats({
          model: event.model,
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          totalTokens: event.totalTokens,
        })
        setLog((prev) => [
          ...prev,
          {
            kind: 'llm',
            model: event.model,
            promptTokens: event.promptTokens,
            completionTokens: event.completionTokens,
            totalTokens: event.totalTokens,
            ts: now,
          },
        ])
        break
      }
      case 'result':
        setResult({
          matched: event.matched,
          allCount: event.allCount,
          filteredCount: event.filteredCount,
          hubResponse: event.hubResponse,
        })
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
      const response = await fetch('/api/tasks/people/stream', {
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

        // Process complete SSE lines from the buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep incomplete trailing line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6).trim()
          if (!json) continue
          handleEvent(JSON.parse(json) as AgentStreamEvent)
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
        title="People Tagger"
        description="Fetch a CSV, filter people by criteria, tag jobs with AI, and submit to the hub.">
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
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <Badge variant="outline">CSV source</Badge>
        <Badge variant="outline">Filter → Tag → Submit</Badge>
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
            <div ref={logRef} className="max-h-72 overflow-y-auto pr-1">
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
            Token Usage
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

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Results</CardTitle>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{fmtNum(result.allCount)} total</span>
                <span>·</span>
                <span>{fmtNum(result.filteredCount)} filtered</span>
                <span>·</span>
                <span className="font-semibold text-emerald-600">
                  {result.matched.length} with transport tag
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.matched.length > 0 ? (
              <ResultsTable people={result.matched} />
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No people matched the transport tag.
              </p>
            )}

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
