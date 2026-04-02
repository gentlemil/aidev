import { runOkoEditorAgent } from '@/features/ai-devs/tasks/okoeditor/okoeditor.agent'
import type { OkoEditorStreamEvent } from '@/features/ai-devs/tasks/okoeditor/okoeditor.events'

export async function POST() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: OkoEditorStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      try {
        await runOkoEditorAgent(send)
        send({ type: 'done' })
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : String(e) })
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
