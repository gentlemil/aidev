import type { FindHimAnswer } from './find-him.types'

export type StepStatus = 'running' | 'done' | 'error'

export type FindHimStreamEvent =
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
  | { type: 'done' }
