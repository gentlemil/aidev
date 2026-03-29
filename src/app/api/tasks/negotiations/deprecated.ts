// import { NEGOTIATIONS_CONFIG as config } from '@/configs/negotiations.config.example'
// import { AIProviders } from '@/lib/ai-models'
import { NextResponse } from 'next/server'
import { fetchCsvAsJson } from '@/lib/fetch-csv-as-json'
import { getCsvFile } from '@/lib/get-csv-file'
import {
  City,
  Connection,
  FilesData,
  Item,
} from '@/features/ai-devs/tasks/negotiations/negotiations.types'

export async function POST(req: Request) {
  // const body = await req.json().catch(() => ({}))
  // const provider: AIProviders = body.provider ?? AIProviders.OPEN_ROUTER
  // const model: string = body.model ?? config.model

  try {
    console.log('[NEGOTIATIONS] running...')

    const data: FilesData = await getData()

    console.log('[JSON DATA]', data)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred when evaluating task.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// --------- helper functions ---------

async function getData(): Promise<FilesData> {
  const data: FilesData = {
    cities: null as unknown as City[],
    connections: null as unknown as Connection[],
    items: null as unknown as Item[],
  }

  const rawCities = await getCsvFile('https://hub.ag3nts.org/dane/s03e04_csv/cities.csv')
  const rawConnections = await getCsvFile('https://hub.ag3nts.org/dane/s03e04_csv/connections.csv')
  const rawItems = await getCsvFile('https://hub.ag3nts.org/dane/s03e04_csv/items.csv')

  data.cities = await fetchCsvAsJson(rawCities)
  data.connections = await fetchCsvAsJson(rawConnections)
  data.items = await fetchCsvAsJson(rawItems)

  return data
}
