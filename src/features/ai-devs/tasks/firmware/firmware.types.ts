/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FirmwareAnswer {
  confirmation: string
}

export interface BanInfo {
  command: string
  reason: string
  ttl_seconds?: number
  seconds_left?: number
}

export interface ShellResponse {
  // success fields
  code?: number
  message?: string
  data?: unknown
  path?: string
  // error fields
  error?: string
  ban?: BanInfo | null
  reboot?: boolean
}

export interface ToolDispatcher {
  execute_command: (args: { command: string }) => Promise<ShellResponse>
  submit_answer: (args: FirmwareAnswer) => Promise<any>
}
