import { runFindHimAgent } from '@/features/ai-devs/tasks/find-him/find-him.agent'
import { AIProviders } from '@/lib/ai-models'
import type { FindHimStreamEvent } from '@/features/ai-devs/tasks/find-him/find-him.events'

const DEFAULT_MODEL = 'openai/gpt-5-mini'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))

  const model: string = (body as { model?: string }).model ?? DEFAULT_MODEL

  const provider: AIProviders =
    (body as { provider?: AIProviders }).provider ?? AIProviders.OPEN_ROUTER

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: FindHimStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        await runFindHimAgent(model, provider, send)
        send({ type: 'done' })
      } catch (e) {
        const message: string = e instanceof Error ? e.message : 'Unknown error'

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
