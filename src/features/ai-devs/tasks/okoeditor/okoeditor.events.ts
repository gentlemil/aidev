export type StepStatus = 'running' | 'done' | 'error'

export type OkoEditorStreamEvent =
  | { type: 'step'; id: string; status: StepStatus; message: string; detail?: string }
  | { type: 'response'; stepId: string; httpStatus: number; bodyPreview: string; htmlLength: number }
  | { type: 'error'; message: string }
  | { type: 'done' }
