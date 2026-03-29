'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Play, RefreshCw } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ToolCallLog } from '@/features/ai-devs/tasks/negotiations/negotiations.types'

type Phase = 'idle' | 'registering' | 'registered' | 'checking' | 'done' | 'error'

export default function NegotiationsPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [registerResponse, setRegisterResponse] = useState<object | null>(null)
  const [checkResponse, setCheckResponse] = useState<object | null>(null)
  const [calls, setCalls] = useState<ToolCallLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [regExpanded, setRegExpanded] = useState(false)
  const [checkExpanded, setCheckExpanded] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callsRef = useRef<HTMLDivElement>(null)

  // Poll for tool calls while registered
  useEffect(() => {
    if (phase === 'registered') {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/tasks/negotiations')
          const data = await res.json()
          setCalls(data.calls ?? [])
        } catch {}
      }, 2000)
    } else {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [phase])

  // Auto-scroll call log
  useEffect(() => {
    if (callsRef.current) {
      callsRef.current.scrollTop = callsRef.current.scrollHeight
    }
  }, [calls])

  const register = useCallback(async () => {
    setPhase('registering')
    setError(null)
    setRegisterResponse(null)
    setCheckResponse(null)
    setCalls([])

    try {
      const res = await fetch('/api/tasks/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register' }),
      })
      const data = await res.json()
      setRegisterResponse(data.hubResponse)
      setPhase('registered')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
      setPhase('error')
    }
  }, [])

  const checkResult = useCallback(async () => {
    setPhase('checking')
    setError(null)

    try {
      const res = await fetch('/api/tasks/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' }),
      })
      const data = await res.json()
      setCheckResponse(data.hubResponse)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed')
      setPhase('error')
    }
  }, [])

  const isRegistering = phase === 'registering'
  const isChecking = phase === 'checking'
  const isRegistered = phase === 'registered' || phase === 'checking' || phase === 'done'

  return (
    <PageContainer>
      <PageHeader
        title="Negotiations Agent"
        description="Registers a search tool with the hub. The hub's agent uses it to find cities selling required items for a wind turbine.">
        <div className="flex gap-2">
          {isRegistered && (
            <Button variant="outline" size="sm" onClick={checkResult} disabled={isChecking}>
              {isChecking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isChecking ? 'Checking…' : 'Check Result'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={register}
            disabled={isRegistering || isChecking}
            className="bg-amber-600 text-white hover:bg-amber-500">
            {isRegistering ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isRegistering ? 'Registering…' : 'Register Tools'}
          </Button>
        </div>
      </PageHeader>

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status:</span>
        {phase === 'idle' && <Badge variant="outline">Idle</Badge>}
        {phase === 'registering' && (
          <Badge variant="outline" className="text-amber-600">
            Registering…
          </Badge>
        )}
        {phase === 'registered' && (
          <Badge variant="outline" className="text-emerald-600">
            Registered — waiting for hub agent
          </Badge>
        )}
        {phase === 'checking' && (
          <Badge variant="outline" className="text-amber-600">
            Checking result…
          </Badge>
        )}
        {phase === 'done' && (
          <Badge variant="outline" className="text-emerald-600">
            Done
          </Badge>
        )}
        {phase === 'error' && (
          <Badge variant="outline" className="text-destructive">
            Error
          </Badge>
        )}
        {calls.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {calls.length} tool call{calls.length !== 1 ? 's' : ''} received
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Register hub response */}
      {registerResponse && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Tools Registered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <button
                onClick={() => setRegExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                Hub response
                {regExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {regExpanded && (
                <pre className="overflow-x-auto border-t bg-muted/40 px-4 py-3 text-xs">
                  {JSON.stringify(registerResponse, null, 2)}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tool call log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Tool Calls from Hub Agent
            {calls.length > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">({calls.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {phase === 'idle'
                ? 'Register tools first to start receiving calls.'
                : 'Waiting for hub agent to call the tool…'}
            </p>
          ) : (
            <div ref={callsRef} className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {calls.map((call, i) => (
                <div key={i} className="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono text-muted-foreground">
                      {new Date(call.ts).toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                    {call.matchedItem && (
                      <Badge variant="outline" className="text-[10px]">
                        {call.matchedItem}
                      </Badge>
                    )}
                  </div>
                  <p className="mb-1 text-muted-foreground">
                    <span className="font-medium text-foreground">params:</span> {call.params}
                  </p>
                  <p>
                    <span className="font-medium">output:</span> {call.output}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check result */}
      {checkResponse && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <button
                onClick={() => setCheckExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                Hub response
                {checkExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {checkExpanded && (
                <pre className="overflow-x-auto border-t bg-muted/40 px-4 py-3 text-xs">
                  {JSON.stringify(checkResponse, null, 2)}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
