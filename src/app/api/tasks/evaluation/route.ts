import { NextResponse } from 'next/server'
import { EVALUATION_CONFIG as config } from '@/configs/evaluation.config'
import { AIProviders } from '@/lib/ai-models'
import { submitAnswer } from '@/features/ai-devs/hub'
import { analyzeOperatorNotes } from '@/features/ai-devs/tasks/evaluation/evaluation.agent'
import AdmZip from 'adm-zip'
import type { Sensor, SensorEntry } from '@/features/ai-devs/tasks/evaluation/evaluation.types'
import {
  isValidSensorByType,
  isValidSensorByParameters,
} from '@/features/ai-devs/tasks/evaluation/evaluation.validators'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const provider: AIProviders = body.provider ?? AIProviders.OPEN_ROUTER
  const model: string = body.model ?? config.model

  try {
    // 1. Download ZIP and unpack in memory
    const response = await fetch(config.sensorsZipFile)
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to download evaluation data.' }, { status: 500 })
    }
    const zip = new AdmZip(Buffer.from(await response.arrayBuffer()))

    // 2. Parse each JSON file, keep file ID alongside sensor data
    const sensorEntries: SensorEntry[] = zip
      .getEntries()
      .filter((file) => file.entryName.endsWith('.json'))
      .map((entry) => ({
        id: entry.entryName.replace('.json', ''),
        sensor: JSON.parse(entry.getData().toString()) as Sensor,
      }))

    // 3. Programmatic anomalies — no LLM needed
    //    a) type anomalies: active sensor with 0, or inactive field with non-zero value
    const typeAnomalyIds = sensorEntries
      .filter((e: SensorEntry) => !isValidSensorByType(e.sensor))
      .map((e: SensorEntry) => e.id)

    //    b) range anomalies: values outside defined bounds (only for type-valid sensors)
    const rangeAnomalyIds = sensorEntries
      .filter(
        (e: SensorEntry) => isValidSensorByType(e.sensor) && !isValidSensorByParameters(e.sensor)
      )
      .map((e) => e.id)

    // 4. LLM anomalies — analyze operator_notes for sensors that passed all programmatic checks
    //    These are sensors where the only possible anomaly is the operator claiming there's a problem
    //    while the numeric data looks fine.
    const programmaticAnomalySet = new Set([...typeAnomalyIds, ...rangeAnomalyIds])
    const cleanEntries = sensorEntries.filter((e) => !programmaticAnomalySet.has(e.id))
    const noteAnomalyIds = await analyzeOperatorNotes(cleanEntries, provider, model)

    // 5. Combine all anomaly IDs (deduplicated) and submit to hub
    const allAnomalyIds = [...new Set([...typeAnomalyIds, ...rangeAnomalyIds, ...noteAnomalyIds])]
    const hubResponse = await submitAnswer(config.task, { recheck: allAnomalyIds })

    return NextResponse.json({
      success: true,
      totalCount: sensorEntries.length,
      typeAnomalyCount: typeAnomalyIds.length,
      rangeAnomalyCount: rangeAnomalyIds.length,
      noteAnomalyCount: noteAnomalyIds.length,
      totalAnomalyCount: allAnomalyIds.length,
      anomalyIds: allAnomalyIds,
      hubResponse,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred when evaluating task.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
