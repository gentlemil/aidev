import { FIND_HIM_CONFIG as config } from '@/configs/find-him.config'
import { FindHimAnswer, LocationsResponse, PowerPlant, ToolDispatcher } from './find-him.types'
import { submitAnswer } from '../../hub'

const apikey: string = process.env.AI_DEVS_KEY ?? ''

// Tool definitions in Chat Completions format
export const findHimToolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'get_power_plants',
      description:
        'Pobiera listę elektrowni atomowych. Każda elektrownia zawiera: city, (rozwiązane po stronie serwera), is_active, power, code (format PWR0000PL).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_survivor_locations',
      description:
        'Pobiera listę współrzędnych (latitude/longitude), w których widziano daną osobę.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Imię osoby' },
          surname: { type: 'string', description: 'Nazwisko osoby' },
        },
        required: ['name', 'surname'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_access_level',
      description:
        'Sprawdza poziom dostępu (accessLevel) danej osoby na podstawie imienia, nazwiska i roku urodzenia.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Imię osoby' },
          surname: { type: 'string', description: 'Nazwisko osoby' },
          birthYear: { type: 'integer', description: 'Rok urodzenia (np. 1987)' },
        },
        required: ['name', 'surname', 'birthYear'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_distance',
      description:
        'Oblicza odległość w km między dwoma punktami geograficznymi (wzór Haversine). Użyj do porównania lokalizacji podejrzanego z lokalizacją elektrowni.',
      parameters: {
        type: 'object',
        properties: {
          lat1: { type: 'number', description: 'Szerokość geograficzna punktu 1' },
          lon1: { type: 'number', description: 'Długość geograficzna punktu 1' },
          lat2: { type: 'number', description: 'Szerokość geograficzna punktu 2' },
          lon2: { type: 'number', description: 'Długość geograficzna punktu 2' },
        },
        required: ['lat1', 'lon1', 'lat2', 'lon2'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'submit_answer',
      description:
        'Wysyła finalną odpowiedź do weryfikacji. Użyj dopiero gdy masz: imię, nazwisko, accessLevel i kod elektrowni.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Imię podejrzanego' },
          surname: { type: 'string', description: 'Nazwisko podejrzanego' },
          accessLevel: {
            type: 'integer',
            description: 'Poziom dostępu z check_access_level',
          },
          powerPlant: {
            type: 'string',
            description: 'Kod elektrowni (format PWR0000PL)',
          },
        },
        required: ['name', 'surname', 'accessLevel', 'powerPlant'],
      },
    },
  },
]

export async function getPowerPlantsLocations() {
  const response = await fetch(config.powerPlantsLocationUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch power plant locations: ${response.status}`)
  }

  const data: LocationsResponse = await response.json()

  const power_plants: PowerPlant[] = Object.entries(data.power_plants).map(([city, rest]) => ({
    city,
    ...rest,
  }))

  return { power_plants }
}

export function calculateDistance({
  lat1,
  lon1,
  lat2,
  lon2,
}: {
  lat1: number
  lon1: number
  lat2: number
  lon2: number
}): { distanceKm: number } {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  return { distanceKm: R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) }
}

export async function getSuspectLocations({ name, surname }: { name: string; surname: string }) {
  const response = await fetch(config.suspectLocationsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey, name, surname }),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch suspect locations: ${response.status}`)
  }

  const locations = await response.json()

  return { name, surname, locations }
}

export async function checkAccessLevel({
  name,
  surname,
  birthYear,
}: {
  name: string
  surname: string
  birthYear: number
}) {
  const response = await fetch(config.accessLevelCheckUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey, name, surname, birthYear }),
  })

  if (!response.ok) {
    throw new Error(`Failed to check access level: ${response.status}`)
  }

  const data = await response.json()

  return { name, surname, accessLevel: data.accessLevel ?? data }
}

export async function verify({ name, surname, accessLevel, powerPlant }: FindHimAnswer) {
  const answer: FindHimAnswer = { name, surname, accessLevel, powerPlant }
  return submitAnswer(config.task, answer)
}

const findHimHandlers: ToolDispatcher = {
  get_power_plants: getPowerPlantsLocations,
  get_survivor_locations: getSuspectLocations,
  check_access_level: checkAccessLevel,
  calculate_distance: calculateDistance,
  submit_answer: verify,
}

export async function execute(tool: string, argsJson: string | Record<string, unknown>) {
  const handler = findHimHandlers[tool as keyof ToolDispatcher]

  if (!handler) {
    throw new Error(`No handler found for tool: ${tool}`)
  }

  const args = typeof argsJson === 'string' ? JSON.parse(argsJson) : argsJson

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (handler as (args: any) => Promise<unknown>)(args)
}
