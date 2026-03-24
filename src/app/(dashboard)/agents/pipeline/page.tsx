'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Wrench,
  XCircle,
} from 'lucide-react'
import type { PipelineStreamEvent, StepStatus } from '@/features/ai-devs/tasks/pipeline/pipeline.events'
import type { Suspect, FindHimAnswer } from '@/features/ai-devs/tasks/find-him/find-him.types'
import type { TaggedPerson } from '@/features/ai-devs/tasks/people/people.types'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RunStatus } from '@/types/llm.types'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type LogEntry =
  | { kind: 'step'; stage: 'stage1' | 'stage2'; id: string; status: StepStatus; message: string; detail?: string; ts: Date }
  | { kind: 'retry'; attempt: number; maxAttempts: number; hubResponse: unknown; ts: Date }
  | { kind: 'llm'; stage: 'stage1' | 'stage2'; model: string; promptTokens: number; completionTokens: number; totalTokens: number; ts: Date }
  | { kind: 'tool'; name: string; args: string; ts: Date }
  | { kind: 'handoff'; suspects: Suspect[]; ts: Date }

type LlmStats = { model: string; promptTokens: number; completionTokens: number; totalTokens: number }
type PipelineResult = { answer: FindHimAnswer; hubResponse: unknown }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtNum(n: number) {
  return n.toLocaleString()
}

function formatArgs(args: string) {
  try { return JSON.stringify(JSON.parse(args)) } catch { return args }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StageTag({ stage }: { stage: 'stage1' | 'stage2' }) {
  return (
    <span className={cn(
      'shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase',
      stage === 'stage1'
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    )}>
      {stage === 'stage1' ? 'S1' : 'S2'}
    </span>
  )
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-500" />
  if (status === 'done') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
}

function LogList({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="space-y-1">
      {entries.map((entry, i) => {
        if (entry.kind === 'handoff') {
          return (
            <div key={`handoff-${i}`} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Handoff — {entry.suspects.length} suspect(s) passed to Stage 2
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{fmtTime(entry.ts)}</span>
            </div>
          )
        }

        if (entry.kind === 'retry') {
          return (
            <div key={`retry-${i}`} className="ml-7 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 dark:border-orange-900/40 dark:bg-orange-950/20">
              <RefreshCw className="h-3.5 w-3.5 shrink-0 text-orange-500" />
              <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                Retry {entry.attempt}/{entry.maxAttempts} — hub did not approve
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{fmtTime(entry.ts)}</span>
            </div>
          )
        }

        if (entry.kind === 'llm') {
          return (
            <div key={`llm-${i}`} className="ml-7 flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
              <StageTag stage={entry.stage} />
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
            <div key={`tool-${i}`} className="ml-7 flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-700/40 dark:bg-stone-800/30">
              <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs font-medium">{entry.name}</span>
                <span className="ml-2 truncate font-mono text-xs text-muted-foreground">{formatArgs(entry.args)}</span>
              </div>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{fmtTime(entry.ts)}</span>
            </div>
          )
        }

        // step
        return (
          <div key={`${entry.stage}-${entry.id}-${entry.status}`} className="flex items-start gap-3 py-1.5">
            <StageTag stage={entry.stage} />
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

export default function PipelinePage() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [log, setLog] = useState<LogEntry[]>([])
  const [stage1Stats, setStage1Stats] = useState<LlmStats | null>(null)
  const [stage2Stats, setStage2Stats] = useState<LlmStats | null>(null)
  const [handoffSuspects, setHandoffSuspects] = useState<Suspect[] | null>(null)
  const [stage1Matched, setStage1Matched] = useState<TaggedPerson[] | null>(null)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hubExpanded, setHubExpanded] = useState(false)

  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  function handleEvent(event: PipelineStreamEvent) {
    const now = new Date()

    if (event.type === 'handoff') {
      setHandoffSuspects(event.suspects)
      setLog((prev) => [...prev, { kind: 'handoff', suspects: event.suspects, ts: now }])
      return
    }

    if (event.type === 'done') {
      setRunStatus('done')
      return
    }

    if (event.type === 'error') {
      setError(event.message)
      setRunStatus('error')
      return
    }

    // Wrapped stage events
    const { stage, event: stageEvent } = event

    switch (stageEvent.type) {
      case 'step': {
        const entry: LogEntry = { kind: 'step', stage, ...stageEvent, ts: now }
        setLog((prev) => {
          const idx = prev.findIndex((e) => e.kind === 'step' && e.stage === stage && e.id === stageEvent.id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...entry, ts: prev[idx].ts }
            return updated
          }
          return [...prev, entry]
        })
        if (stageEvent.status === 'error') setRunStatus('error')
        break
      }
      case 'tool': {
        setLog((prev) => [...prev, { kind: 'tool', name: stageEvent.name, args: stageEvent.args, ts: now }])
        break
      }
      case 'llm': {
        const stats: LlmStats = {
          model: stageEvent.model,
          promptTokens: stageEvent.promptTokens,
          completionTokens: stageEvent.completionTokens,
          totalTokens: stageEvent.totalTokens,
        }
        if (stage === 'stage1') setStage1Stats(stats)
        else setStage2Stats(stats)

        setLog((prev) => {
          const idx = prev.findLastIndex((e) => e.kind === 'llm' && e.stage === stage)
          const newEntry: LogEntry = { kind: 'llm', stage, ...stats, ts: idx >= 0 ? prev[idx].ts : now }
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = newEntry
            return updated
          }
          return [...prev, { ...newEntry, ts: now }]
        })
        break
      }
      case 'retry': {
        setLog((prev) => [...prev, { kind: 'retry', attempt: stageEvent.attempt, maxAttempts: stageEvent.maxAttempts, hubResponse: stageEvent.hubResponse, ts: now }])
        break
      }
      case 'result': {
        if (stage === 'stage1') {
          setStage1Matched(stageEvent.matched)
        } else {
          setResult({ answer: stageEvent.answer, hubResponse: stageEvent.hubResponse })
        }
        break
      }
      case 'error': {
        setError(stageEvent.message)
        setRunStatus('error')
        break
      }
    }
  }

  async function runPipeline() {
    setRunStatus('running')
    setLog([])
    setStage1Stats(null)
    setStage2Stats(null)
    setHandoffSuspects(null)
    setStage1Matched(null)
    setResult(null)
    setError(null)
    setHubExpanded(false)

    try {
      const response = await fetch('/api/tasks/pipeline/stream', { method: 'POST' })

      if (!response.ok || !response.body) {
        setError(`HTTP ${response.status}: failed to start pipeline`)
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
          handleEvent(JSON.parse(json) as PipelineStreamEvent)
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
        title="Pipeline"
        description="Stage 1 tags people from CSV and submits to hub (retrying until approved). On success, hands off suspects to Stage 2 which locates the closest one to a nuclear power plant.">
        <div className="flex gap-2">
          {(runStatus === 'done' || runStatus === 'error') && (
            <Button variant="outline" size="sm" onClick={runPipeline}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Re-run
            </Button>
          )}
          <Button
            size="sm"
            onClick={runPipeline}
            disabled={isRunning}
            className="bg-indigo-600 text-white hover:bg-indigo-500">
            {isRunning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isRunning ? 'Running…' : 'Run Pipeline'}
          </Button>
        </div>
      </PageHeader>

      {/* Pipeline overview */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20">
          Stage 1 · gpt-4o-mini · OpenAI · max 15 retries
        </Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/20">
          Stage 2 · gpt-5-mini · OpenRouter
        </Badge>
        {runStatus !== 'idle' && (
          <span className={cn(
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
              {runStatus === 'idle' ? 'Press "Run Pipeline" to start.' : 'Starting…'}
            </p>
          ) : (
            <div ref={logRef} className="max-h-[32rem] overflow-y-auto pr-1">
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
      {(stage1Stats || stage2Stats) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {stage1Stats && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Stage 1 · Token Usage
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <TokenCard label="Prompt" value={stage1Stats.promptTokens} sub="input" />
                <TokenCard label="Completion" value={stage1Stats.completionTokens} sub="output" />
                <TokenCard label="Total" value={stage1Stats.totalTokens} sub={stage1Stats.model} />
              </div>
            </div>
          )}
          {stage2Stats && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-600">
                Stage 2 · Token Usage (cumulative)
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <TokenCard label="Prompt" value={stage2Stats.promptTokens} sub="input" />
                <TokenCard label="Completion" value={stage2Stats.completionTokens} sub="output" />
                <TokenCard label="Total" value={stage2Stats.totalTokens} sub={stage2Stats.model} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Handoff — matched people from Stage 1 */}
      {stage1Matched && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">S1</span>
              Matched People → Stage 2 Suspects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Name', 'Surname', 'Born', 'City', 'Tags'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {stage1Matched.map((p) => (
                  <tr key={`${p.name}-${p.surname}`} className="hover:bg-muted/30">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2">{p.surname}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.born}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.city}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span key={t} className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Final result from Stage 2 */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">S2</span>
              Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suspect</p>
                <p className="mt-1 text-base font-bold">{result.answer.name} {result.answer.surname}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Power Plant</p>
                <p className="mt-1 font-mono text-base font-bold">{result.answer.powerPlant}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Access Level</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{result.answer.accessLevel}</p>
              </div>
              <div className="rounded-lg border bg-emerald-50 p-4 dark:bg-emerald-950/20">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Status</p>
                <p className="mt-1 text-base font-bold text-emerald-700 dark:text-emerald-400">Submitted</p>
              </div>
            </div>
            <div className="rounded-lg border">
              <button
                onClick={() => setHubExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                Hub response
                <span className="text-xs">{hubExpanded ? '▲' : '▼'}</span>
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
