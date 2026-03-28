export type RobotCommand = 'left' | 'right' | 'wait' | 'start' | 'reset'
export type BlockDirection = 'down' | 'up'

export interface ToolDispatcher {
  send_command: (arg: { command: RobotCommand }) => Promise<EnrichedResponse>
}

export interface Block {
  col: number
  top_row: number
  bottom_row: number
  direction: BlockDirection
}

export interface ReactorResponse {
  code: number
  message: string
  board?: string[][]
  player?: { col: number; row: number }
  goal?: { col: number; row: number }
  blocks?: Block[]
  reached_goal?: boolean
}

export interface EnrichedResponse {
  data: ReactorResponse
  availableMoves: string[]
  boardState: Record<string, unknown>
}
