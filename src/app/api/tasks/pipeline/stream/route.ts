import { runPipeline } from '@/features/ai-devs/tasks/pipeline/pipeline.orchestrator'
import type { PipelineStreamEvent } from '@/features/ai-devs/tasks/pipeline/pipeline.events'

export async function POST() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PipelineStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        await runPipeline(send)
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
