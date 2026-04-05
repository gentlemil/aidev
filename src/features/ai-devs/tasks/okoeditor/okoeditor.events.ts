export type StepStatus = 'running' | 'done' | 'error'

export type OkoEditorStreamEvent =
  | { type: 'step'; id: string; status: StepStatus; message: string; detail?: string }
  | { type: 'response'; stepId: string; httpStatus: number; bodyPreview: string; htmlLength: number }
  | { type: 'incident'; incidentId: string; mentionsSkolwin: boolean; mentionsVehiclesOrPeople: boolean; shouldEdit: boolean; reasoning: string }
  | { type: 'task'; taskId: string; mentionsSkolwin: boolean; matched: boolean; reasoning: string }
  | { type: 'summary'; idsToEdit: string[] }
  | { type: 'verify'; stepId: string; requestUrl: string; requestBody: string; responseStatus: number; responseBody: string }
  | { type: 'error'; message: string }
  | { type: 'done' }
