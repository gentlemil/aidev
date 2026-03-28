export type StepStatus = 'running' | 'done' | 'error'

export type ReactorStreamEvent =
  | { type: 'step'; id: string; status: StepStatus; message: string; detail?: string }
  | { type: 'tool'; name: string; args: string; result?: string }
  | {
      type: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  | { type: 'result'; flag: string; hubResponse: unknown }
  | { type: 'error'; message: string }
  | { type: 'done' }
