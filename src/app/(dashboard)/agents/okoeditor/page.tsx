'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Play, RotateCcw, XCircle } from 'lucide-react'
import type { OkoEditorStreamEvent, StepStatus } from '@/features/ai-devs/tasks/okoeditor/okoeditor.events'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type RunStatus = 'idle' | 'running' | 'done' | 'error'

type StepEntry = {
  id: string
  status: StepStatus
  message: string
  detail?: string
  response?: { httpStatus: number; htmlLength: number; bodyPreview: string }
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-500" />
  if (status === 'done') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
}

function StepCard({ entry }: { entry: StepEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border">
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <StepIcon status={entry.status} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{entry.message}</p>
          {entry.detail && (
            <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">{entry.detail}</p>
          )}
        </div>
        {entry.response && (
          <span className={cn(
            'shrink-0 rounded px-2 py-0.5 font-mono text-xs font-bold',
            entry.response.httpStatus < 400 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          )}>
            HTTP {entry.response.httpStatus}
          </span>
        )}
      </div>

      {/* Response preview */}
      {entry.response && (
        <>
          <div className="border-t px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              HTML length: <strong>{entry.response.htmlLength.toLocaleString()}</strong> chars
            </span>
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-violet-600 hover:underline">
              {expanded ? 'Hide' : 'Show'} HTML preview
            </button>
          </div>
          {expanded && (
            <pre className="border-t bg-muted/30 px-4 py-3 font-mono text-[11px] whitespace-pre-wrap break-all">
              {entry.response.bodyPreview}
            </pre>
          )}
        </>
      )}
    </div>
  )
}

export default function OkoEditorPage() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [steps, setSteps] = useState<StepEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  function upsertStep(patch: Partial<StepEntry> & { id: string }) {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === patch.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], ...patch }
        return updated
      }
      return [...prev, { status: 'running', message: '', ...patch }]
    })
  }

  function handleEvent(event: OkoEditorStreamEvent) {
    switch (event.type) {
      case 'step':
        upsertStep({ id: event.id, status: event.status, message: event.message, detail: event.detail })
        if (event.status === 'error') setRunStatus('error')
        break
      case 'response':
        upsertStep({
          id: event.stepId,
          response: { httpStatus: event.httpStatus, htmlLength: event.htmlLength, bodyPreview: event.bodyPreview },
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
    setSteps([])
    setError(null)

    try {
      const response = await fetch('/api/tasks/okoeditor/stream', { method: 'POST' })
      if (!response.ok || !response.body) {
        setError(`HTTP ${response.status}`)
        setRunStatus('error')
        return
      }

      const reader = response.body.getReader()
      readerRef.current = reader
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
          if (json) handleEvent(JSON.parse(json) as OkoEditorStreamEvent)
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
        title="OKO Editor"
        description="Opens the OKO panel, logs in as Zofia, and shows the authenticated response.">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://oko.ag3nts.org" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              OKO Panel
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
            {isRunning
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Running…</>
              : <><Play className="mr-1.5 h-3.5 w-3.5" />Run</>}
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            Steps
            {runStatus !== 'idle' && (
              <span className={cn('text-xs font-medium',
                isRunning && 'text-amber-600',
                runStatus === 'done' && 'text-emerald-600',
                runStatus === 'error' && 'text-destructive')}>
                {isRunning ? '● Running' : runStatus === 'done' ? '● Done' : '● Error'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isRunning ? 'Starting…' : 'Press Run to start.'}
            </p>
          ) : (
            steps.map(s => <StepCard key={s.id} entry={s} />)
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <pre className="whitespace-pre-wrap break-all font-mono text-xs">{error}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}
