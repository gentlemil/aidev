export type StepStatus = 'running' | 'done' | 'error'

export type FirmwareStreamEvent =
  | { type: 'step'; id: string; status: StepStatus; message: string; detail?: string }
  | { type: 'tool'; name: string; args: string; result?: string }
  | { type: 'ban'; reason: string; waitSeconds: number }
  | {
      type: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
      cachedTokens: number
    }
  | { type: 'result'; confirmation: string; hubResponse: unknown }
  | { type: 'error'; message: string }
  | { type: 'done' }
