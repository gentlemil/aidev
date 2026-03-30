export type StepStatus = 'running' | 'done' | 'error'

export type SaveThemStreamEvent =
  | { type: 'step'; id: string; status: StepStatus; message: string; detail?: string }
  | { type: 'tool'; name: string; args: string; result?: string; requestUrl?: string; requestBody?: string }
  | {
      type: 'llm'
      model: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  | { type: 'map'; cityName: string; grid: string[][]; text: string }
  | { type: 'knowledge'; key: string; value: unknown }
  | { type: 'verify_attempt'; attempt: number; moves: string[]; response: unknown }
  | { type: 'result'; flag: string; hubResponse: unknown }
  | { type: 'error'; message: string }
  | { type: 'done' }
