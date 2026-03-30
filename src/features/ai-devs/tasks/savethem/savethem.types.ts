export interface HubToolInfo {
  name: string
  url: string
  description: string
  parameter: string
  score: number
  matched_keywords: string[]
}

export interface ToolSearchResponse {
  code: number
  message: string
  query: string
  tools: HubToolInfo[]
}

export interface MapResponse {
  code: number
  message: string
  cityName?: string
  map?: string[][]
  text?: string
}

export interface VehicleResponse {
  code: number
  message: string
  name?: string
  note?: string
  consumption?: { fuel: number; food: number }
}

export interface VerifyResponse {
  code: number
  message: string
}

export type HubApiResponse =
  | ToolSearchResponse
  | MapResponse
  | VehicleResponse
  | VerifyResponse
  | Record<string, unknown>

export type MoveCommand =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'dismount'
  | string // vehicle name or other hub-defined commands
