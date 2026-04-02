import { OKOEDITOR_CONFIG as config } from '@/configs/okoeditor.config'
import { getPage, loginToOko, getPageAsUser } from './okoeditor.scraper'
import type { OkoEditorStreamEvent, StepStatus } from './okoeditor.events'

const apiKey = process.env.AI_DEVS_KEY ?? ''

function step(
  onEvent: (e: OkoEditorStreamEvent) => void,
  id: string,
  status: StepStatus,
  message: string,
  detail?: string
) {
  console.log(`[okoeditor] [${status.toUpperCase()}] ${id}: ${message}${detail ? ` — ${detail}` : ''}`)
  onEvent({ type: 'step', id, status, message, detail })
}

export async function runOkoEditorAgent(onEvent: (e: OkoEditorStreamEvent) => void): Promise<void> {
  const baseUrl = config.okoBaseUrl

  // ── Step 1: GET / (anonymous) ────────────────────────────────────────────────
  step(onEvent, 'open', 'running', `Opening ${baseUrl}`)
  const { status: openStatus, html: openHtml } = await getPage(baseUrl)
  step(onEvent, 'open', openStatus < 400 ? 'done' : 'error', `GET ${baseUrl}`, `HTTP ${openStatus}`)
  onEvent({
    type: 'response',
    stepId: 'open',
    httpStatus: openStatus,
    htmlLength: openHtml.length,
    bodyPreview: openHtml,
  })

  // ── Step 2: POST login ───────────────────────────────────────────────────────
  step(onEvent, 'login', 'running', 'Logging in', `login=${config.okoLogin}`)
  const { session, cookieRaw, loginResponseBody } = await loginToOko(apiKey)
  step(onEvent, 'login', 'done', 'Login successful — session cookie obtained', cookieRaw.slice(0, 60))
  onEvent({
    type: 'response',
    stepId: 'login',
    httpStatus: 200,
    htmlLength: loginResponseBody.length,
    bodyPreview: loginResponseBody,
  })

  // ── Step 3: GET /incydenty (authenticated) ───────────────────────────────────
  const incydenty = `${baseUrl}/incydenty`
  step(onEvent, 'authenticated', 'running', `Opening ${incydenty} as ${config.okoLogin}`)
  const { status: authStatus, html: authHtml } = await getPageAsUser(incydenty, session)
  step(onEvent, 'authenticated', authStatus < 400 ? 'done' : 'error', `GET ${incydenty} with session`, `HTTP ${authStatus}`)
  onEvent({
    type: 'response',
    stepId: 'authenticated',
    httpStatus: authStatus,
    htmlLength: authHtml.length,
    bodyPreview: authHtml,
  })
}
