export async function getCsvFile(url: string): Promise<string> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }

  return await response.text()
}
