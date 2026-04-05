import { OKOEDITOR_CONFIG as config } from '@/configs/okoeditor.config'
import {
  callOkoVerify,
  getPage,
  loginToOko,
  getPageAsUser,
  extractRecentIncidentLinks,
  extractTaskLinks,
} from './okoeditor.scraper'
import {
  analyzeIncident,
  analyzeTaskForSkolwin,
  generateAnimalIncidentDescription,
} from './okoeditor.analyzer'
import type { OkoEditorStreamEvent, StepStatus } from './okoeditor.events'

const apiKey = process.env.AI_DEVS_KEY ?? ''

function step(
  onEvent: (e: OkoEditorStreamEvent) => void,
  id: string,
  status: StepStatus,
  message: string,
  detail?: string
) {
  console.log(
    `[okoeditor] [${status.toUpperCase()}] ${id}: ${message}${detail ? ` — ${detail}` : ''}`
  )
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
  step(
    onEvent,
    'login',
    'done',
    'Login successful — session cookie obtained',
    cookieRaw.slice(0, 60)
  )
  onEvent({
    type: 'response',
    stepId: 'login',
    httpStatus: 200,
    htmlLength: loginResponseBody.length,
    bodyPreview: loginResponseBody,
  })

  // ── Step 3: GET / (authenticated) ────────────────────────────────────────────
  step(onEvent, 'authenticated', 'running', `Opening ${baseUrl} as ${config.okoLogin}`)
  const { status: authStatus, html: authHtml } = await getPageAsUser(baseUrl, session)
  step(
    onEvent,
    'authenticated',
    authStatus < 400 ? 'done' : 'error',
    `GET ${baseUrl} with session`,
    `HTTP ${authStatus}`
  )
  onEvent({
    type: 'response',
    stepId: 'authenticated',
    httpStatus: authStatus,
    htmlLength: authHtml.length,
    bodyPreview: authHtml,
  })

  if (authStatus >= 400) return

  // ── Step 4: Extract incident links ───────────────────────────────────────────
  const recentIncidents = extractRecentIncidentLinks(authHtml)
  const incidentIds = recentIncidents.map((incident) => incident.id)
  step(
    onEvent,
    'extract',
    'done',
    `Found ${recentIncidents.length} incident(s) in recent-hours register`,
    incidentIds.join(', ').slice(0, 80) || '(none)'
  )

  if (incidentIds.length === 0) {
    onEvent({ type: 'summary', idsToEdit: [] })
    onEvent({ type: 'done' })
    return
  }

  // ── Step 5: Fetch + analyze each incident ────────────────────────────────────
  step(onEvent, 'analyze', 'running', `Analyzing ${incidentIds.length} incident(s) with LLM…`)
  const idsToEdit: string[] = []
  const incidentHtmlById = new Map<string, string>()

  for (const incident of recentIncidents) {
    const id = incident.id
    const incidentUrl = new URL(incident.href, baseUrl).toString()
    const { html: incidentHtml } = await getPageAsUser(incidentUrl, session)
    incidentHtmlById.set(id, incidentHtml)
    const analysis = await analyzeIncident(id, incidentHtml)
    onEvent({
      type: 'incident',
      incidentId: id,
      mentionsSkolwin: analysis.mentionsSkolwin,
      mentionsVehiclesOrPeople: analysis.mentionsVehiclesOrPeople,
      shouldEdit: analysis.shouldEdit,
      reasoning: analysis.reasoning,
    })
    if (analysis.shouldEdit) idsToEdit.push(id)
  }

  step(onEvent, 'analyze', 'done', `Analysis complete — ${idsToEdit.length} incident(s) to edit`)
  onEvent({ type: 'summary', idsToEdit })

  if (idsToEdit.length === 0) {
    step(onEvent, 'edit-skolwin', 'error', 'No Skolwin incident matched edit criteria')
    onEvent({ type: 'done' })
    return
  }

  // ── Step 6: Rewrite Skolwin incident as animals + send update ───────────────
  const skolwinIncidentId = idsToEdit[0]
  const skolwinIncidentHtml = incidentHtmlById.get(skolwinIncidentId) ?? ''
  step(onEvent, 'edit-skolwin', 'running', `Rewriting incident ${skolwinIncidentId} to animals`)
  const skolwinAnimalsContent = await generateAnimalIncidentDescription(
    skolwinIncidentId,
    skolwinIncidentHtml
  )
  const skolwinAnimalsTitle = 'MOVE04 W Skolwin widziano zwierzeta'
  const skolwinUpdate = await callOkoVerify({
    page: 'incydenty',
    id: skolwinIncidentId,
    action: 'update',
    title: skolwinAnimalsTitle,
    content: skolwinAnimalsContent,
  })
  onEvent({
    type: 'verify',
    stepId: 'edit-skolwin',
    requestUrl: skolwinUpdate.requestUrl,
    requestBody: skolwinUpdate.requestBodyMasked,
    responseStatus: skolwinUpdate.status,
    responseBody: skolwinUpdate.responseBody,
  })
  step(
    onEvent,
    'edit-skolwin',
    skolwinUpdate.status < 400 ? 'done' : 'error',
    `Updated incident ${skolwinIncidentId} to animals`,
    `HTTP ${skolwinUpdate.status}`
  )

  // ── Step 7: Diversion update on a different incident (Komarowo) ─────────────
  const diversionIncident = recentIncidents.find((incident) => incident.id !== skolwinIncidentId)
  if (!diversionIncident) {
    step(onEvent, 'edit-komarowo', 'error', 'No second incident available for Komarowo diversion')
    onEvent({ type: 'done' })
    return
  }

  const komarowoContent =
    'W okolicach miasta Komarowo wykryto ruch ludzi, co wskazuje na nową aktywność w tym rejonie.'
  step(
    onEvent,
    'edit-komarowo',
    'running',
    `Updating incident ${diversionIncident.id} with Komarowo diversion`
  )
  const komarowoUpdate = await callOkoVerify({
    page: 'incydenty',
    id: diversionIncident.id,
    action: 'update',
    content: komarowoContent,
  })
  onEvent({
    type: 'verify',
    stepId: 'edit-komarowo',
    requestUrl: komarowoUpdate.requestUrl,
    requestBody: komarowoUpdate.requestBodyMasked,
    responseStatus: komarowoUpdate.status,
    responseBody: komarowoUpdate.responseBody,
  })
  step(
    onEvent,
    'edit-komarowo',
    komarowoUpdate.status < 400 ? 'done' : 'error',
    `Updated incident ${diversionIncident.id} with Komarowo report`,
    `HTTP ${komarowoUpdate.status}`
  )

  // ── Step 8: Open /zadania and preview HTML ──────────────────────────────────
  const tasksUrl = `${baseUrl}/zadania`
  step(onEvent, 'tasks-open', 'running', `Opening ${tasksUrl}`)
  const { status: tasksStatus, html: tasksHtml } = await getPageAsUser(tasksUrl, session)
  step(
    onEvent,
    'tasks-open',
    tasksStatus < 400 ? 'done' : 'error',
    `GET ${tasksUrl} with session`,
    `HTTP ${tasksStatus}`
  )
  onEvent({
    type: 'response',
    stepId: 'tasks-open',
    httpStatus: tasksStatus,
    htmlLength: tasksHtml.length,
    bodyPreview: tasksHtml,
  })
  if (tasksStatus >= 400) {
    onEvent({ type: 'done' })
    return
  }

  // ── Step 9: Scan tasks until first Skolwin match ────────────────────────────
  const tasks = extractTaskLinks(tasksHtml)
  step(
    onEvent,
    'tasks-scan',
    'running',
    `Scanning ${tasks.length} task(s) until first Skolwin match`
  )
  let skolwinTaskId: string | null = null

  for (const task of tasks) {
    const taskUrl = new URL(task.href, baseUrl).toString()
    const { html: taskHtml } = await getPageAsUser(taskUrl, session)
    const analysis = await analyzeTaskForSkolwin(task.id, taskHtml)
    onEvent({
      type: 'task',
      taskId: task.id,
      mentionsSkolwin: analysis.mentionsSkolwin,
      matched: analysis.mentionsSkolwin,
      reasoning: analysis.reasoning,
    })
    if (analysis.mentionsSkolwin) {
      skolwinTaskId = task.id
      break
    }
  }

  step(
    onEvent,
    'tasks-scan',
    skolwinTaskId ? 'done' : 'error',
    skolwinTaskId ? `Found Skolwin task: ${skolwinTaskId}` : 'No Skolwin task found'
  )
  if (!skolwinTaskId) {
    onEvent({ type: 'done' })
    return
  }

  // ── Step 10: Update matched task via /verify ────────────────────────────────
  step(onEvent, 'task-update', 'running', `Updating zadania/${skolwinTaskId}`)
  const taskUpdate = await callOkoVerify({
    page: 'zadania',
    id: skolwinTaskId,
    action: 'update',
    content: 'Widzino bobry w okolicy!',
    done: 'YES',
  })
  onEvent({
    type: 'verify',
    stepId: 'task-update',
    requestUrl: taskUpdate.requestUrl,
    requestBody: taskUpdate.requestBodyMasked,
    responseStatus: taskUpdate.status,
    responseBody: taskUpdate.responseBody,
  })
  step(
    onEvent,
    'task-update',
    taskUpdate.status < 400 ? 'done' : 'error',
    `Updated task ${skolwinTaskId}`,
    `HTTP ${taskUpdate.status}`
  )

  // ── Step 11: Final action done ───────────────────────────────────────────────
  step(onEvent, 'verify-done', 'running', 'Calling /verify with action=done')
  const doneResponse = await callOkoVerify({ action: 'done' })
  onEvent({
    type: 'verify',
    stepId: 'verify-done',
    requestUrl: doneResponse.requestUrl,
    requestBody: doneResponse.requestBodyMasked,
    responseStatus: doneResponse.status,
    responseBody: doneResponse.responseBody,
  })
  step(
    onEvent,
    'verify-done',
    doneResponse.status < 400 ? 'done' : 'error',
    'Final verification sent',
    `HTTP ${doneResponse.status}`
  )

  onEvent({ type: 'done' })
}
