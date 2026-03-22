import { FIND_HIM_CONFIG as config } from '@/configs/find-him.config'
import { LocationsResponse } from '@/features/ai-devs/tasks/find-him/find-him.types'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const powerPlantsLocationsResponse: Response = await fetch(`${config.powerPlantsLocationUrl}`)

    if (!powerPlantsLocationsResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch locations: ${powerPlantsLocationsResponse.status}` },
        { status: 500 }
      )
    }

    const locations: LocationsResponse = await powerPlantsLocationsResponse.json()

    console.log(locations.power_plants)

    // TODO

    return NextResponse.json(locations.power_plants)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// curl -X POST http://localhost:3000/api/tasks/find-him
