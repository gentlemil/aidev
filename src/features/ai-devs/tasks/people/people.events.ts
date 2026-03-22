import type { TaggedPerson } from './people.types'

export type StepStatus = 'running' | 'done' | 'error'

export type AgentStreamEvent =
  | { type: 'step'; id: string; status: StepStatus; message: string; detail?: string }
  | {
      type: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  | {
      type: 'result'
      matched: TaggedPerson[]
      allCount: number
      filteredCount: number
      hubResponse: unknown
    }
  | { type: 'error'; message: string }
  | { type: 'done' }
