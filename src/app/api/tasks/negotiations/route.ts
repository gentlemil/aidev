import { NEGOTIATIONS_CONFIG as config } from '@/configs/negotiations.config.example'
import { AIProviders } from '@/lib/ai-models'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const provider: AIProviders = body.provider ?? AIProviders.OPEN_ROUTER
  const model: string = body.model ?? config.model

  try {
    console.log('[NEGOTIATIONS] running...')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred when evaluating task.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
