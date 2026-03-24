import type { TaggedPerson } from '../people/people.types'
import type { Suspect, FindHimAnswer } from '../find-him/find-him.types'

export type StepStatus = 'running' | 'done' | 'error'

export type Stage1Event =
  | { type: 'step'; id: string; status: StepStatus; message: string; detail?: string }
  | {
      type: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  | { type: 'retry'; attempt: number; maxAttempts: number; hubResponse: unknown }
  | {
      type: 'result'
      matched: TaggedPerson[]
      allCount: number
      filteredCount: number
      hubResponse: unknown
    }
  | { type: 'error'; message: string }

export type Stage2Event =
  | { type: 'step'; id: string; status: StepStatus; message: string; detail?: string }
  | { type: 'tool'; name: string; args: string }
  | {
      type: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  | { type: 'result'; answer: FindHimAnswer; hubResponse: unknown }
  | { type: 'error'; message: string }

export type PipelineStreamEvent =
  | { stage: 'stage1'; event: Stage1Event }
  | { stage: 'stage2'; event: Stage2Event }
  | { type: 'handoff'; suspects: Suspect[] }
  | { type: 'done' }
  | { type: 'error'; message: string }
