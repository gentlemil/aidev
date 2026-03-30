import { SAVETHEM_CONFIG as config } from '@/configs/savethem.config'
import type { MapResponse, VerifyResponse } from './savethem.types'
import type { SaveThemStreamEvent } from './savethem.events'

const apikey: string = process.env.AI_DEVS_KEY ?? ''

function maskedBody(body: Record<string, unknown>): string {
  return JSON.stringify({ ...body, apikey: '*****' }, null, 2)
}

export interface ExecuteResult {
  result: unknown
  requestUrl: string
  requestBody: string
}

// ── Map state (set when agent receives map from hub) ──────────────────────────

let currentMap: string[][] | null = null

export function setCurrentMap(map: string[][]) {
  currentMap = map
}

export function resetCurrentMap() {
  currentMap = null
}

// ── Route validation ──────────────────────────────────────────────────────────

const DIRECTIONS = new Set(['up', 'down', 'left', 'right'])

export interface ValidationResult {
  valid: boolean
  errors: string[]
  trace: Array<{ step: number; row: number; col: number; tile: string; mode: 'vehicle' | 'foot' }>
}

export function validateRoute(moves: string[]): ValidationResult {
  if (!currentMap) return { valid: true, errors: [], trace: [] }

  const grid = currentMap
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  // Locate start tile
  let row = -1
  let col = -1
  outer: for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 'S') { row = r; col = c; break outer }
    }
  }

  if (row < 0) return { valid: false, errors: ['Start tile S not found on map'], trace: [] }

  const errors: string[] = []
  const trace: ValidationResult['trace'] = []

  // Determine initial mode: first command is a vehicle name if it's not a direction and not dismount
  let onVehicle = false
  let stepIdx = 0

  if (moves.length > 0 && !DIRECTIONS.has(moves[0]) && moves[0] !== 'dismount') {
    onVehicle = true
    stepIdx = 1 // skip vehicle name
  }

  for (let i = stepIdx; i < moves.length; i++) {
    const cmd = moves[i]

    if (cmd === 'dismount') {
      if (!onVehicle) {
        errors.push(`Step ${i + 1}: "dismount" used but agent is already on foot`)
      }
      onVehicle = false
      continue
    }

    if (!DIRECTIONS.has(cmd)) {
      errors.push(`Step ${i + 1}: unknown command "${cmd}"`)
      continue
    }

    const prevRow = row
    const prevCol = col

    if (cmd === 'up') row--
    else if (cmd === 'down') row++
    else if (cmd === 'left') col--
    else if (cmd === 'right') col++

    // Bounds check
    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      errors.push(`Step ${i + 1}: move "${cmd}" from [${prevRow},${prevCol}] goes out of bounds → [${row},${col}]`)
      row = prevRow; col = prevCol // stop tracing further
      break
    }

    const tile = grid[row][col]
    const mode: 'vehicle' | 'foot' = onVehicle ? 'vehicle' : 'foot'

    trace.push({ step: i + 1, row, col, tile, mode })

    if (tile === 'R') {
      errors.push(`Step ${i + 1}: tile [${row},${col}] is R (rocks) — impassable for everyone`)
    } else if (tile === 'W' && onVehicle) {
      errors.push(`Step ${i + 1}: tile [${row},${col}] is W (water) — vehicle cannot cross, must dismount first`)
    }
  }

  return { valid: errors.length === 0, errors, trace }
}

// ── Tool definitions (sent to LLM) ───────────────────────────────────────────

export const saveThemToolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'tool_search',
      description:
        'Search the hub for available tools and endpoints. Use this to discover what APIs are available for getting maps, vehicle info, game rules, etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language query, e.g. "map", "vehicles", "movement rules"',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'call_tool',
      description:
        'Call a hub API endpoint discovered via tool_search. Provide the url (e.g. "/api/maps") and a query string.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The endpoint URL from tool_search result, e.g. "/api/maps" or "/api/books"',
          },
          query: {
            type: 'string',
            description: 'The query to send to the endpoint',
          },
        },
        required: ['url', 'query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'verify_route',
      description:
        'Submit your planned route for verification. Start with a vehicle name or go on foot directly. Use "dismount" to switch from vehicle to on-foot mid-route. Max 10 attempts.',
      parameters: {
        type: 'object',
        properties: {
          moves: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Commands: optional vehicle name first, then "up"/"down"/"left"/"right", optionally "dismount" to continue on foot.',
          },
        },
        required: ['moves'],
      },
    },
  },
]

// ── Tool implementations ──────────────────────────────────────────────────────

async function toolSearch(query: string): Promise<ExecuteResult> {
  const url = `${config.hubBaseUrl}/api/toolsearch`
  const body = { apikey, query }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`tool_search failed: ${response.status}`)

  return { result: await response.json(), requestUrl: `POST ${url}`, requestBody: maskedBody(body) }
}

async function callTool(url: string, query: string): Promise<ExecuteResult> {
  if (!url.startsWith('/api/')) throw new Error(`Invalid tool URL: must start with /api/`)

  const fullUrl = `${config.hubBaseUrl}${url}`
  const body = { apikey, query }

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`call_tool(${url}) failed: ${response.status}`)

  return { result: await response.json(), requestUrl: `POST ${fullUrl}`, requestBody: maskedBody(body) }
}

let verifyAttempts = 0

export function resetVerifyAttempts() {
  verifyAttempts = 0
}

async function verifyRoute(
  moves: string[],
  onEvent: (event: SaveThemStreamEvent) => void
): Promise<ExecuteResult> {
  verifyAttempts++

  if (verifyAttempts > config.maxVerifyAttempts) {
    throw new Error(`Maximum verify attempts (${config.maxVerifyAttempts}) exceeded`)
  }

  const url = process.env.AI_DEVS_VERIFY_URL!
  const body = { apikey, task: config.task, answer: moves }
  const requestUrl = `POST ${url}`
  const requestBody = maskedBody(body)

  // Pre-flight validation against known map
  const validation = validateRoute(moves)
  if (!validation.valid) {
    const preflightResult = {
      error: 'Route rejected by local validator — not sent to hub',
      validation_errors: validation.errors,
      trace: validation.trace,
      hint: 'Fix the listed errors and call verify_route again with a corrected route.',
    }
    onEvent({ type: 'verify_attempt', attempt: verifyAttempts, moves, response: preflightResult })
    verifyAttempts-- // don't count rejected routes against the limit
    return { result: preflightResult, requestUrl: '(blocked — local validation failed)', requestBody }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorData: unknown
    try { errorData = await response.json() } catch { errorData = { error: `HTTP ${response.status}` } }
    onEvent({ type: 'verify_attempt', attempt: verifyAttempts, moves, response: errorData })
    return { result: errorData, requestUrl, requestBody }
  }

  const data: VerifyResponse = await response.json()
  onEvent({ type: 'verify_attempt', attempt: verifyAttempts, moves, response: data })

  return { result: data, requestUrl, requestBody }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function createExecutor(onEvent: (event: SaveThemStreamEvent) => void) {
  return async function execute(tool: string, argsJson: unknown): Promise<ExecuteResult> {
    const args = typeof argsJson === 'string' ? JSON.parse(argsJson) : argsJson

    switch (tool) {
      case 'tool_search':
        return toolSearch(args.query)

      case 'call_tool': {
        const execResult = await callTool(args.url, args.query)
        const mapResult = execResult.result as MapResponse

        if (mapResult.map && Array.isArray(mapResult.map)) {
          setCurrentMap(mapResult.map)
          onEvent({
            type: 'map',
            cityName: mapResult.cityName ?? 'unknown',
            grid: mapResult.map,
            text: mapResult.text ?? '',
          })
        }

        if ('note' in (execResult.result as object) && typeof (execResult.result as Record<string, unknown>).note === 'string') {
          onEvent({
            type: 'knowledge',
            key: `vehicle:${(execResult.result as Record<string, unknown>).name ?? args.query}`,
            value: execResult.result,
          })
        }

        if ('code' in (execResult.result as object) && !mapResult.map && !('note' in (execResult.result as object))) {
          onEvent({
            type: 'knowledge',
            key: `${args.url}:${args.query}`,
            value: execResult.result,
          })
        }

        return execResult
      }

      case 'verify_route':
        return verifyRoute(args.moves, onEvent)

      default:
        throw new Error(`Unknown tool: ${tool}`)
    }
  }
}
