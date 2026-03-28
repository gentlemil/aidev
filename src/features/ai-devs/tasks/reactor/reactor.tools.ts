import { REACTOR_CONFIG as config } from '@/configs/reactor.config'
import {
  Block,
  EnrichedResponse,
  ReactorResponse,
  RobotCommand,
  ToolDispatcher,
} from './reactor.types'

const apikey: string = process.env.AI_DEVS_KEY ?? ''

export const reactorToolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'send_command',
      description:
        'Wysyła komendę do gry. Komendy ruchu: left, right, wait. Komendy zarządzania: start (inicjalizacja), reset (po zderzeniu z blokiem).',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            enum: ['left', 'right', 'wait', 'start', 'reset'], // czy ten enum jest prawidlowy?
          },
        },
        required: ['command'],
      },
    },
  },
]

// ── Tool implementation ───────────────────────────────────────────────────────

export async function sendCommand({
  command,
}: {
  command: RobotCommand
}): Promise<EnrichedResponse> {
  const response = await fetch(process.env.AI_DEVS_VERIFY_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey,
      task: config.task,
      answer: { command },
    }),
  })

  if (!response.ok) {
    throw new Error(`[Failed] to send command: ${response.status}`)
  }

  const data: ReactorResponse = await response.json()

  // Game won — no board state in response, skip analysis
  if (data.code === 0) {
    return { data, boardState: {}, availableMoves: [] }
  }

  return analyzeBoard(data)
}

function analyzeBoard(response: ReactorResponse): EnrichedResponse {
  const { player, goal, blocks } = response

  /**
   * Available moves remaining in the current direction before bouncing:
   * - "down": steps until bottom_row reaches 5
   * - "up":   steps until top_row reaches 1
   */
  const availableMovesInDirection = (block: Block) => {
    return block.direction === 'down' ? 5 - block.bottom_row : block.top_row - 1
  }

  /**
   * Returns the next bottom_row for a block after 1 step.
   * Handles boundary bounce: if block would go out of bounds, it reverses direction.
   */
  const nextBottomRow = (block: Block) => {
    if (block.direction === 'down') {
      const next = block.bottom_row + 1
      // If it would hit the bottom boundary, bounce: move up instead
      return next > 5 ? block.bottom_row - 1 : next
    } else {
      return block.bottom_row - 1
    }
  }

  // Index blocks by column (1–7), columns without a block are null
  const blocksByCol: any = {}
  for (let col = 1; col <= 7; col++) {
    const block = blocks?.find((b) => b.col === col)
    blocksByCol[col] = block
      ? {
          bottom_row: block.bottom_row,
          direction: block.direction,
          available_moves_number: availableMovesInDirection(block),
        }
      : null
  }

  const boardState = {
    player_position: { col: player?.col, row: player?.row },
    goal_position: { col: goal?.col, row: goal?.row },
    blocks: blocksByCol,
  }

  // Determine safe moves: a move is safe if the destination column's block
  // will NOT have bottom_row === 5 after the simultaneous step.
  const isColSafeAfterStep = (col: any) => {
    const block = blocks?.find((b) => b.col === col)
    if (!block) return true // no block in that column → always safe
    return nextBottomRow(block) !== 5
  }

  const moves = []
  if (player!.col < 7 && isColSafeAfterStep(player!.col + 1)) moves.push('right')
  if (player!.col > 1 && isColSafeAfterStep(player!.col - 1)) moves.push('left')
  if (isColSafeAfterStep(player!.col)) moves.push('wait')

  return { data: response, boardState, availableMoves: moves }
}

const reactorHandlers: ToolDispatcher = {
  send_command: sendCommand,
}

export async function execute(tool: string, argsJson: unknown): Promise<EnrichedResponse> {
  const handler = reactorHandlers[tool as keyof ToolDispatcher]

  if (!handler) {
    throw new Error(`No handler found for tool: ${tool}`)
  }

  const args = typeof argsJson === 'string' ? JSON.parse(argsJson) : argsJson

  return (handler as (args: { command: RobotCommand }) => Promise<EnrichedResponse>)(args)
}
