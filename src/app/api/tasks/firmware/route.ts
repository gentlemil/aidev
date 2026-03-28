import { runFirmwareAgent } from '@/features/ai-devs/tasks/firmware/firmware.agent'
import { FIRMWARE_CONFIG as config } from '@/configs/firmware.config'
import { AIProviders } from '@/lib/ai-models'
import { NextResponse } from 'next/server'
import type { FirmwareStreamEvent } from '@/features/ai-devs/tasks/firmware/firmware.events'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const model: string = (body as { model?: string }).model ?? config.model

    const provider: AIProviders =
      (body as { provider?: AIProviders }).provider ?? AIProviders.OPEN_ROUTER

    let confirmation: string | null = null
    let hubResponse: unknown = null

    await runFirmwareAgent(model, provider, (event: FirmwareStreamEvent) => {
      if (event.type === 'result') {
        confirmation = event.confirmation
        hubResponse = event.hubResponse
      }
    })

    return NextResponse.json({ success: true, confirmation, hubResponse })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
