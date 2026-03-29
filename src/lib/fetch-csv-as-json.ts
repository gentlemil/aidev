export async function getPageFiles(url: string): Promise<string> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }

  return await response.text()
}

export async function fetchCsvAsJson<T>(text: string): Promise<T[]> {
  const lines = text.trim().split('\n')

  const headers = lines[0].split(',').map((header: string) => header.trim())

  return lines.slice(1).map((line: string) => {
    const values = line.split(',').map((value: string) => value.trim())

    return Object.fromEntries(headers.map((header, i) => [header, values[i]])) as T
  })
}
