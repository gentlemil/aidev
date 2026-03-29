import { NextResponse } from 'next/server'
import { submitAnswer } from '@/features/ai-devs/hub'
import { fetchCsvAsJson } from '@/lib/fetch-csv-as-json'
import { getCsvFile } from '@/lib/get-csv-file'
import { NEGOTIATIONS_CONFIG as config } from '@/configs/negotiations.config'
import {
  City,
  Connection,
  FilesData,
  Item,
  ItemWithEmbedding,
  ToolCallLog,
} from '@/features/ai-devs/tasks/negotiations/negotiations.types'

// ---- module-level cache ----

let cachedData: FilesData | null = null
let cachedEmbeddings: ItemWithEmbedding[] | null = null

// Pre-warm cache in background on module load
;(async () => {
  try {
    const data = await getDataCached()
    await getEmbeddingsCached(data.items)
  } catch (e) {
    console.error('[NEGOTIATIONS] Pre-warm failed:', e)
  }
})()

const callLog: ToolCallLog[] = []

// ---- GET — return call log ----

export async function GET() {
  return NextResponse.json({ calls: callLog })
}

// ---- POST — management actions + tool calls from hub agent ----

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))

  // Management: register tools with hub
  if (body.action === 'register') {
    const toolUrl = `${config.publicBaseUrl}${config.toolPath}`
    const hubResponse = await submitAnswer(config.task, {
      tools: [
        {
          URL: toolUrl,
          description:
            'Use this tool to find cities that sell a specific item. Pass a natural language description of the item in "params" (e.g. "wind turbine blade" or "I need a 10m copper cable"). Returns a comma-separated list of city names that have the item for sale.',
        },
      ],
    })
    return NextResponse.json({ hubResponse })
  }

  // Management: check result from hub
  if (body.action === 'check') {
    const hubResponse = await submitAnswer(config.task, { action: 'check' })
    return NextResponse.json({ hubResponse })
  }

  // Tool call from hub agent: { params: "..." }
  console.log('[NEGOTIATIONS] incoming body:', JSON.stringify(body))

  try {
    const query: string = body?.params

    if (!query || typeof query !== 'string') {
      callLog.push({
        ts: new Date().toISOString(),
        params: JSON.stringify(body),
        matchedItem: null,
        output: 'Missing params',
      })
      return NextResponse.json({ output: 'Missing params' }, { status: 400 })
    }

    const data = await getDataCached()
    const embeddings = await getEmbeddingsCached(data.items)
    const bestItem = await findBestItem(query, embeddings)

    if (!bestItem) {
      const output = 'No matching item found'
      callLog.push({ ts: new Date().toISOString(), params: query, matchedItem: null, output })
      return NextResponse.json({ output })
    }

    const cities = findCitiesByItemCode(bestItem.code, data)
    const output = cities.length > 0 ? cities.join(', ') : `No cities found for: ${bestItem.name}`

    callLog.push({
      ts: new Date().toISOString(),
      params: query,
      matchedItem: bestItem.name,
      output,
    })

    return NextResponse.json({ output })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ output: `Error: ${message}` }, { status: 500 })
  }
}

// ---- data loading with cache ----

async function getDataCached(): Promise<FilesData> {
  if (cachedData) return cachedData

  const [rawCities, rawConnections, rawItems] = await Promise.all([
    getCsvFile('https://hub.ag3nts.org/dane/s03e04_csv/cities.csv'),
    getCsvFile('https://hub.ag3nts.org/dane/s03e04_csv/connections.csv'),
    getCsvFile('https://hub.ag3nts.org/dane/s03e04_csv/items.csv'),
  ])

  cachedData = {
    cities: await fetchCsvAsJson<City>(rawCities),
    connections: await fetchCsvAsJson<Connection>(rawConnections),
    items: await fetchCsvAsJson<Item>(rawItems),
  }

  return cachedData
}

// ---- embeddings with cache (batch: one API call for all items) ----

async function getEmbeddingsCached(items: Item[]): Promise<ItemWithEmbedding[]> {
  if (cachedEmbeddings) return cachedEmbeddings

  console.log(`[NEGOTIATIONS] Computing embeddings for ${items.length} items (batch)...`)

  const embeddings = await getEmbeddingsBatch(items.map((i) => i.name))

  cachedEmbeddings = items.map((item, idx) => ({ item, embedding: embeddings[idx] }))

  console.log('[NEGOTIATIONS] Embeddings ready.')
  return cachedEmbeddings
}

// ---- batch embeddings via OpenAI API (single call for N texts) ----

const EMBEDDING_CHUNK_SIZE = 500

async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += EMBEDDING_CHUNK_SIZE) {
    const chunk = texts.slice(i, i + EMBEDDING_CHUNK_SIZE)

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: chunk }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(`Embedding API error: ${response.status} — ${JSON.stringify(err)}`)
    }

    const json = await response.json()
    const embeddings = (json.data as { index: number; embedding: number[] }[])
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding)

    results.push(...embeddings)
  }

  return results
}

// ---- single embedding ----

async function getEmbedding(text: string): Promise<number[]> {
  const [embedding] = await getEmbeddingsBatch([text])
  return embedding
}

// ---- cosine similarity ----

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dot / (magA * magB)
}

// ---- find best matching item ----

async function findBestItem(query: string, embeddings: ItemWithEmbedding[]): Promise<Item | null> {
  const queryEmbedding = await getEmbedding(query)

  const scored = embeddings.map(({ item, embedding }) => ({
    item,
    score: cosineSimilarity(queryEmbedding, embedding),
  }))

  const best = scored.sort((a, b) => b.score - a.score)[0]

  console.log(
    `[NEGOTIATIONS] query="${query}" → best="${best?.item.name}" (score=${best?.score.toFixed(3)})`
  )

  return best?.item ?? null
}

// ---- deterministic city lookup ----

function findCitiesByItemCode(itemCode: string, data: FilesData): string[] {
  const cityCodes = data.connections
    .filter((c: Connection) => c.itemCode === itemCode)
    .map((c: Connection) => c.cityCode)

  return data.cities.filter((c: City) => cityCodes.includes(c.code)).map((c: City) => c.name)
}
