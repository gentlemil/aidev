'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  Play,
  RotateCcw,
  Wrench,
  XCircle,
} from 'lucide-react'
import type {
  SaveThemStreamEvent,
  StepStatus,
} from '@/features/ai-devs/tasks/savethem/savethem.events'
import { AIProviders, AVAILABLE_MODELS } from '@/lib/ai-models'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SAVETHEM_CONFIG as config } from '@/configs/savethem.config'

// ── Types ─────────────────────────────────────────────────────────────────────

type RunStatus = 'idle' | 'running' | 'done' | 'error'

type LlmStats = {
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

type LogEntry =
  | { kind: 'step'; id: string; status: StepStatus; message: string; detail?: string; ts: Date }
  | { kind: 'tool'; name: string; args: string; result?: string; requestUrl?: string; requestBody?: string; ts: Date }
  | {
      kind: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
      ts: Date
    }

type MapState = { cityName: string; grid: string[][]; text: string } | null

type KnowledgeEntry = { key: string; value: unknown; ts: Date }

type VerifyAttempt = { attempt: number; moves: string[]; response: unknown; ts: Date }

// ── Map tile config ───────────────────────────────────────────────────────────

const TILE_STYLE: Record<string, string> = {
  '.': 'bg-stone-100 text-stone-400',
  W: 'bg-blue-200 text-blue-700 font-bold',
  T: 'bg-green-200 text-green-700 font-bold',
  R: 'bg-yellow-100 text-yellow-700 font-bold',
  S: 'bg-emerald-500 text-white font-bold',
  G: 'bg-red-500 text-white font-bold',
}

function tileStyle(char: string) {
  return TILE_STYLE[char] ?? 'bg-muted text-muted-foreground'
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

// ── Sub-components ────────────────────────────────────────────────────────────

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
              className="ml-7 flex flex-wrap items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
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
          const parsedArgs = (() => {
            try { return JSON.parse(entry.args) } catch { return null }
          })()
          const argSummary = (() => {
            if (!parsedArgs) return entry.args
            if (parsedArgs.query) return `query: "${parsedArgs.query}"`
            if (parsedArgs.url && parsedArgs.query !== undefined) return `${parsedArgs.url} · "${parsedArgs.query}"`
            if (parsedArgs.url) return parsedArgs.url
            if (parsedArgs.moves) return `[${parsedArgs.moves.join(', ')}]`
            return JSON.stringify(parsedArgs)
          })()
          const parsedResult = (() => {
            if (!entry.result) return null
            try { return JSON.parse(entry.result) } catch { return null }
          })()
          const isError = parsedResult && 'error' in parsedResult

          return (
            <div
              key={`tool-${i}`}
              className={cn(
                'ml-7 rounded-lg border px-3 py-2',
                isError
                  ? 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-950/20'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20'
              )}>
              {/* Header row */}
              <div className="flex items-start gap-2">
                <Wrench className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', isError ? 'text-red-500' : 'text-emerald-600')} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs font-bold">{entry.name}</span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">{argSummary}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{fmtTime(entry.ts)}</span>
                  </div>
                  {/* Request URL + body */}
                  {entry.requestUrl && (
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-sky-50 px-2 py-1 font-mono text-[10px] text-sky-800 dark:bg-sky-950/30 dark:text-sky-300">
                      {`⬆ ${entry.requestUrl}`}
                      {entry.requestBody ? `\n${entry.requestBody}` : ''}
                    </pre>
                  )}
                  {/* Response block */}
                  {entry.result && (
                    <pre className={cn(
                      'mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded px-2 py-1 font-mono text-[10px]',
                      isError
                        ? 'bg-red-100/60 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-black/5 text-foreground dark:bg-white/5'
                    )}>
                      {`← ${JSON.stringify(parsedResult ?? entry.result, null, 2)}`}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )
        }

        return (
          <div key={`${entry.id}-${entry.status}-${i}`} className="flex items-start gap-3 py-1.5">
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

function MapGrid({
  mapState,
  lastRoute,
}: {
  mapState: MapState
  lastRoute: string[] | null
}) {
  if (!mapState) return null

  // Build a set of (row,col) positions visited by the last route
  const routePositions = new Map<string, number>()
  if (lastRoute) {
    // Find start position
    let row = -1
    let col = -1
    outer: for (let r = 0; r < mapState.grid.length; r++) {
      for (let c = 0; c < mapState.grid[r].length; c++) {
        if (mapState.grid[r][c] === 'S') {
          row = r
          col = c
          break outer
        }
      }
    }

    if (row >= 0) {
      let step = 0
      for (const cmd of lastRoute) {
        if (cmd === 'up') row--
        else if (cmd === 'down') row++
        else if (cmd === 'left') col--
        else if (cmd === 'right') col++
        else continue // vehicle name or dismount — don't advance
        step++
        routePositions.set(`${row},${col}`, step)
      }
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <MapIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{mapState.cityName}</span>
        <span className="text-xs text-muted-foreground">
          {mapState.grid.length}×{mapState.grid[0]?.length ?? 0}
        </span>
      </div>

      <div className="inline-block rounded-lg border bg-muted/20 p-2">
        {mapState.grid.map((row, r) => (
          <div key={r} className="flex">
            {row.map((cell, c) => {
              const routeStep = routePositions.get(`${r},${c}`)
              return (
                <div
                  key={c}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded text-[11px] font-mono',
                    tileStyle(cell),
                    routeStep !== undefined &&
                      cell !== 'S' &&
                      cell !== 'G' &&
                      'ring-2 ring-violet-400 ring-offset-0'
                  )}
                  title={`[${r},${c}] ${cell}`}>
                  {routeStep !== undefined && cell !== 'S' && cell !== 'G' ? (
                    <span className="text-[9px] font-bold text-violet-700">{routeStep}</span>
                  ) : (
                    cell
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(TILE_STYLE).map(([char, cls]) => (
          <div key={char} className="flex items-center gap-1">
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded text-[10px] font-mono',
                cls
              )}>
              {char}
            </div>
            <span className="text-xs text-muted-foreground">
              {char === '.' ? 'open' : char === 'W' ? 'water' : char === 'T' ? 'tree' : char === 'R' ? 'road' : char === 'S' ? 'start' : 'goal'}
            </span>
          </div>
        ))}
        {lastRoute && (
          <div className="flex items-center gap-1">
            <div className="h-5 w-5 rounded ring-2 ring-violet-400" />
            <span className="text-xs text-muted-foreground">route</span>
          </div>
        )}
      </div>
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

export default function SaveThemPage() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [log, setLog] = useState<LogEntry[]>([])
  const [llmStats, setLlmStats] = useState<LlmStats | null>(null)
  const [mapState, setMapState] = useState<MapState>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
  const [verifyAttempts, setVerifyAttempts] = useState<VerifyAttempt[]>([])
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

  const lastRoute =
    verifyAttempts.length > 0 ? verifyAttempts[verifyAttempts.length - 1].moves : null

  function handleEvent(event: SaveThemStreamEvent) {
    const now = new Date()

    switch (event.type) {
      case 'step': {
        const entry: LogEntry = { kind: 'step', ...event, ts: now }
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
            const idx = [...prev]
              .reverse()
              .findIndex(
                (e) => e.kind === 'tool' && e.name === event.name && e.args === event.args
              )
            if (idx >= 0) {
              const realIdx = prev.length - 1 - idx
              const updated = [...prev]
              updated[realIdx] = {
                ...updated[realIdx],
                result: event.result,
                requestUrl: event.requestUrl ?? (updated[realIdx] as { requestUrl?: string }).requestUrl,
                requestBody: event.requestBody ?? (updated[realIdx] as { requestBody?: string }).requestBody,
              } as LogEntry
              return updated
            }
          }
          return [
            ...prev,
            {
              kind: 'tool',
              name: event.name,
              args: event.args,
              result: event.result,
              requestUrl: event.requestUrl,
              requestBody: event.requestBody,
              ts: now,
            },
          ]
        })
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
          const idx = prev.findLastIndex((e) => e.kind === 'llm')
          const newEntry: LogEntry = {
            kind: 'llm',
            model: event.model,
            promptTokens: event.promptTokens,
            completionTokens: event.completionTokens,
            totalTokens: event.totalTokens,
            ts: idx >= 0 ? prev[idx].ts : now,
          }
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = newEntry
            return updated
          }
          return [...prev, newEntry]
        })
        break
      }
      case 'map':
        setMapState({ cityName: event.cityName, grid: event.grid, text: event.text })
        break
      case 'knowledge':
        setKnowledge((prev) => {
          const idx = prev.findIndex((k) => k.key === event.key)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { key: event.key, value: event.value, ts: now }
            return updated
          }
          return [...prev, { key: event.key, value: event.value, ts: now }]
        })
        break
      case 'verify_attempt':
        setVerifyAttempts((prev) => [
          ...prev,
          { attempt: event.attempt, moves: event.moves, response: event.response, ts: now },
        ])
        break
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
    setMapState(null)
    setKnowledge([])
    setVerifyAttempts([])
    setResult(null)
    setError(null)
    setHubExpanded(false)

    try {
      const response = await fetch('/api/tasks/savethem/stream', {
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
          handleEvent(JSON.parse(json) as SaveThemStreamEvent)
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
        title="SaveThem Agent"
        description="Discovers the hub's tools, acquires a terrain map, plans a vehicle route from S to G, and retrieves the flag.">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://hub.ag3nts.org/savethem_preview.html" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </a>
          </Button>
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
            className="bg-violet-600 text-white hover:bg-violet-500">
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
        <Badge variant="outline">tool_search · call_tool · verify_route</Badge>
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
        {AVAILABLE_MODELS[selectedProvider].find((m) => m.value === selectedModel)?.description}
      </span>

      {/* Main grid: log + side panels */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left: Run log */}
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
              <div ref={logRef} className="max-h-[480px] overflow-y-auto pr-1">
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

        {/* Right: Map + Knowledge */}
        <div className="space-y-4">
          {/* Map */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Terrain Map</CardTitle>
            </CardHeader>
            <CardContent>
              {mapState ? (
                <MapGrid mapState={mapState} lastRoute={lastRoute} />
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Map not yet acquired
                </p>
              )}
            </CardContent>
          </Card>

          {/* Knowledge */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Knowledge
                {knowledge.length > 0 && (
                  <span className="font-normal text-muted-foreground">({knowledge.length})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {knowledge.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No knowledge gathered yet
                </p>
              ) : (
                knowledge.map((k, i) => <KnowledgeCard key={i} entry={k} />)
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Verify attempts */}
      {verifyAttempts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Route Attempts
              <span className="ml-2 font-normal text-muted-foreground">
                ({verifyAttempts.length} / {config.maxVerifyAttempts})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {verifyAttempts.map((attempt) => (
              <VerifyAttemptRow key={attempt.attempt} attempt={attempt} />
            ))}
          </CardContent>
        </Card>
      )}

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

// ── Small reusable cards ──────────────────────────────────────────────────────

function KnowledgeCard({ entry }: { entry: KnowledgeEntry }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-lg border text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 font-medium hover:bg-muted/40">
        <span className="truncate font-mono text-[11px]">{entry.key}</span>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
      </button>
      {expanded && (
        <pre className="max-h-48 overflow-y-auto border-t bg-muted/20 px-3 py-2 font-mono text-[11px] whitespace-pre-wrap break-all">
          {JSON.stringify(entry.value, null, 2)}
        </pre>
      )}
    </div>
  )
}

function VerifyAttemptRow({ attempt }: { attempt: VerifyAttempt }) {
  const [expanded, setExpanded] = useState(false)
  const resp = attempt.response as { code?: number; message?: string }
  const isFlag = resp?.message?.includes('FLG:')
  const isOk = resp?.code === 0 || isFlag

  return (
    <div
      className={cn(
        'rounded-lg border text-xs',
        isOk && 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20'
      )}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-muted/30">
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold',
            isOk
              ? 'bg-emerald-200 text-emerald-800'
              : 'bg-muted text-muted-foreground'
          )}>
          #{attempt.attempt}
        </span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          [{attempt.moves.join(', ')}]
        </span>
        <span className={cn('ml-auto shrink-0 font-medium', isOk ? 'text-emerald-600' : 'text-muted-foreground')}>
          {resp?.message?.slice(0, 40) ?? '—'}
        </span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        )}
      </button>
      {expanded && (
        <pre className="border-t bg-muted/20 px-3 py-2 font-mono text-[11px] whitespace-pre-wrap break-all">
          {JSON.stringify(attempt.response, null, 2)}
        </pre>
      )}
    </div>
  )
}
