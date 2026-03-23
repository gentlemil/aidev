import { runFindHimAgent } from '@/features/ai-devs/tasks/find-him/find-him.agent'
import { getPowerPlantsLocations } from '@/features/ai-devs/tasks/find-him/find-him.tools'
import { AIProviders } from '@/lib/ai-models'
import { NextResponse } from 'next/server'
import type { FindHimStreamEvent } from '@/features/ai-devs/tasks/find-him/find-him.events'
import type { FindHimAnswer } from '@/features/ai-devs/tasks/find-him/find-him.types'

export async function GET() {
  try {
    const data = await getPowerPlantsLocations()

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

const DEFAULT_MODEL = `openai/gpt-5-mini`

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const model: string = (body as { model?: string }).model ?? DEFAULT_MODEL

    const provider: AIProviders =
      (body as { provider?: AIProviders }).provider ?? AIProviders.OPEN_ROUTER

    let finalAnswer: FindHimAnswer | null = null
    let hubResponse: unknown = null

    await runFindHimAgent(model, provider, (event: FindHimStreamEvent) => {
      if (event.type === 'result') {
        finalAnswer = event.answer
        hubResponse = event.hubResponse
      }
    })

    return NextResponse.json({ success: true, answer: finalAnswer, hubResponse })
  } catch (error) {
    const message: string = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
