'use client'

import { useState } from 'react'
import { CheckCircle2, Cpu, FileSearch, Loader2, Play, RotateCcw, XCircle } from 'lucide-react'
import { EVALUATION_CONFIG } from '@/configs/evaluation.config'
import { AIProviders, AVAILABLE_MODELS } from '@/lib/ai-models'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type RunStatus = 'idle' | 'running' | 'done' | 'error'

type EvaluationResult = {
  totalCount: number
  typeAnomalyCount: number
  rangeAnomalyCount: number
  noteAnomalyCount: number
  totalAnomalyCount: number
  anomalyIds: string[]
  hubResponse: unknown
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: number
  variant?: 'default' | 'danger' | 'success'
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        variant === 'danger' && 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20',
        variant === 'success' &&
          'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
        variant === 'default' && 'bg-card'
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-bold',
          variant === 'danger' && 'text-red-600 dark:text-red-400',
          variant === 'success' && 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  )
}

export default function EvaluationPage() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hubExpanded, setHubExpanded] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<AIProviders>(AIProviders.OPEN_ROUTER)
  const [selectedModel, setSelectedModel] = useState<string>(EVALUATION_CONFIG.model)

  async function runEvaluation() {
    setRunStatus('running')
    setResult(null)
    setError(null)
    setHubExpanded(false)

    try {
      const response = await fetch('/api/tasks/evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, provider: selectedProvider }),
      })
      const data = await response.json()

      if (!response.ok || data.error) {
        setError(data.error ?? `HTTP ${response.status}`)
        setRunStatus('error')
        return
      }

      setResult(data)
      setRunStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setRunStatus('error')
    }
  }

  const isRunning = runStatus === 'running'

  return (
    <PageContainer>
      <PageHeader
        title="Evaluation Agent"
        description="Downloads sensor readings, detects anomalies programmatically (type/range) and via LLM (operator notes), then submits results to the hub."
      >
        <div className="flex gap-2">
          {(runStatus === 'done' || runStatus === 'error') && (
            <Button variant="outline" size="sm" onClick={runEvaluation}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Re-run
            </Button>
          )}
          <Button
            size="sm"
            onClick={runEvaluation}
            disabled={isRunning}
            className="bg-indigo-600 text-white hover:bg-indigo-500"
          >
            {isRunning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isRunning ? 'Running…' : 'Run Evaluation'}
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
            className="bg-transparent text-xs outline-none disabled:opacity-50"
          >
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
            className="bg-transparent text-xs outline-none disabled:opacity-50"
          >
            {AVAILABLE_MODELS[selectedProvider].map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {runStatus !== 'idle' && (
          <span
            className={cn(
              'ml-auto text-xs font-medium',
              runStatus === 'running' && 'text-amber-600',
              runStatus === 'done' && 'text-emerald-600',
              runStatus === 'error' && 'text-destructive'
            )}
          >
            {runStatus === 'running' ? '● Running' : runStatus === 'done' ? '● Done' : '● Error'}
          </span>
        )}
      </div>

      {/* Idle / loading state */}
      {runStatus === 'idle' && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Press &quot;Run Evaluation&quot; to start. This may take a moment — the agent downloads
            ~10k sensor files and calls LLM for operator note analysis.
          </CardContent>
        </Card>
      )}

      {runStatus === 'running' && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span>Downloading sensors, running validators, analyzing notes with LLM…</span>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total sensors" value={result.totalCount} />
            <StatCard label="Type anomalies" value={result.typeAnomalyCount} variant="danger" />
            <StatCard label="Range anomalies" value={result.rangeAnomalyCount} variant="danger" />
            <StatCard label="Note anomalies" value={result.noteAnomalyCount} variant="danger" />
            <StatCard label="Total anomalies" value={result.totalAnomalyCount} variant="danger" />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Submitted to Hub
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <button
                  onClick={() => setHubExpanded((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Hub response
                  <span>{hubExpanded ? '▲' : '▼'}</span>
                </button>
                {hubExpanded && (
                  <pre className="overflow-x-auto border-t bg-muted/40 px-4 py-3 text-xs">
                    {JSON.stringify(result.hubResponse, null, 2)}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FileSearch className="h-4 w-4 text-indigo-500" />
                Anomalous File IDs ({result.anomalyIds.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {result.anomalyIds.map((id) => (
                  <span
                    key={id}
                    className="rounded bg-red-100 px-2 py-0.5 font-mono text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  >
                    {id}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  )
}
