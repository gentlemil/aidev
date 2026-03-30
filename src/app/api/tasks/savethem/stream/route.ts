import { runSaveThemAgent } from '@/features/ai-devs/tasks/savethem/savethem.agent'
import { SAVETHEM_CONFIG as config } from '@/configs/savethem.config'
import { AIProviders } from '@/lib/ai-models'
import type { SaveThemStreamEvent } from '@/features/ai-devs/tasks/savethem/savethem.events'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))

  const model: string = (body as { model?: string }).model ?? config.model
  const provider: AIProviders =
    (body as { provider?: AIProviders }).provider ?? config.provider

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SaveThemStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        await runSaveThemAgent(model, provider, send)
        send({ type: 'done' })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
