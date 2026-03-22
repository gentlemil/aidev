import { TaggedPerson, TaggingResult } from '@/features/ai-devs/tasks/people/people.types'
import { StepStatus } from '@/features/ai-devs/tasks/people/people.events'

export type TaggingUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type TaggingBatchResult = {
  results: TaggingResult[]
  model: string
  usage: TaggingUsage | null
}

export type RunStatus = 'idle' | 'running' | 'done' | 'error'

export type LogEntry =
  | { kind: 'step'; id: string; status: StepStatus; message: string; detail?: string; ts: Date }
  | {
      kind: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
      ts: Date
    }

export interface LlmStats {
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface RunResult {
  matched: TaggedPerson[]
  allCount: number
  filteredCount: number
  hubResponse: unknown
}
