export async function submitAnswer(task: string, answer: unknown): Promise<unknown> {
  const response = await fetch(process.env.AI_DEVS_VERIFY_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: process.env.AI_DEVS_KEY,
      task,
      answer,
    }),
  })

  return response.json()
}
