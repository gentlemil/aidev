import { FIRMWARE_CONFIG as config } from '@/configs/firmware.config'
import { submitAnswer } from '../../hub'
import type { FirmwareAnswer, ShellResponse, ToolDispatcher } from './firmware.types'

export const firmwareToolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'execute_command',
      description:
        'Wykonuje polecenie shell na wirtualnej maszynie Linux. Zwraca stdout/stderr. NIE dotykaj katalogów ani plików poza /opt/firmware/cooler/ — naruszenie czarnej listy natychmiast odcina dostęp.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Polecenie shell do wykonania (np. "ls /opt/firmware/cooler")',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'submit_answer',
      description:
        'Wysyła kod ECCS do weryfikacji. Użyj tylko gdy masz pełen kod w formacie ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.',
      parameters: {
        type: 'object',
        properties: {
          confirmation: {
            type: 'string',
            description: 'Kod potwierdzający w formacie ECCS-...',
          },
        },
        required: ['confirmation'],
      },
    },
  },
]

export async function executeCommand({ command }: { command: string }): Promise<ShellResponse> {
  const response = await fetch(config.virtualMachineUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: process.env.AI_DEVS_KEY,
      cmd: command,
    }),
  })

  // Always parse JSON body — ban/reboot info lives there even on 4xx
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    // Return structured error so agent code can inspect ban info without string-parsing
    return {
      error: `HTTP ${response.status}`,
      code: body?.code,
      message: body?.message,
      ban: body?.ban ?? null,
      reboot: body?.reboot ?? false,
    }
  }

  return body
}

export async function verify({ confirmation }: FirmwareAnswer): Promise<unknown> {
  return submitAnswer(config.task, { confirmation })
}

const firmwareHandlers: ToolDispatcher = {
  execute_command: executeCommand,
  submit_answer: verify,
}

export async function execute(tool: string, argsJson: string | Record<string, unknown>) {
  const handler = firmwareHandlers[tool as keyof ToolDispatcher]

  if (!handler) {
    throw new Error(`No handler found for tool: ${tool}`)
  }

  const args = typeof argsJson === 'string' ? JSON.parse(argsJson) : argsJson

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (handler as (args: any) => Promise<unknown>)(args)
}
