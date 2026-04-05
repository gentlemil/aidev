import { load } from 'cheerio'
import { OKOEDITOR_CONFIG as config } from '@/configs/okoeditor.config'
import type { LoginResult } from './okoeditor.types'

const FETCH_TIMEOUT_MS = 15_000

// cache: 'no-store' prevents Next.js App Router from caching identical GET URLs
function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { ...init, signal: controller.signal, cache: 'no-store' }).finally(() => clearTimeout(timer))
}

export async function getPage(url: string): Promise<{ status: number; html: string }> {
  console.log('[okoeditor] GET', url)
  const res = await fetchWithTimeout(url)
  const html = await res.text()
  console.log('[okoeditor] GET', url, '→', res.status, '| length:', html.length)
  return { status: res.status, html }
}

export async function loginToOko(apiKey: string): Promise<LoginResult> {
  // Form-encoded POST — this triggers a 302 with two Set-Cookie headers;
  // the second (last) cookie is the authenticated session.
  const body = new URLSearchParams({
    action: 'login',
    login: config.okoLogin,
    password: config.okoPassword,
    access_key: apiKey,
  }).toString()
  console.log('[okoeditor] POST login (form-encoded)', config.okoBaseUrl)

  const res = await fetchWithTimeout(config.okoBaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  })

  // Browser behaviour: when server sends two Set-Cookie with the same name,
  // the LAST one wins. headers.get() only returns the first — use getSetCookie().
  const allCookies = res.headers.getSetCookie()
  const lastCookieRaw = allCookies[allCookies.length - 1] ?? ''
  const responseBody = await res.text().catch(() => '(empty)')
  console.log('[okoeditor] login status:', res.status)
  console.log('[okoeditor] set-cookie headers:', allCookies)
  console.log('[okoeditor] login response body:', responseBody.slice(0, 200))

  const match = lastCookieRaw.match(/oko_session=([^;]+)/)
  if (!match) {
    throw new Error(
      `Login failed — no oko_session in Set-Cookie.\nStatus: ${res.status}\nCookies: ${JSON.stringify(allCookies)}\nBody: ${responseBody.slice(0, 200)}`
    )
  }

  return { session: match[1], cookieRaw: lastCookieRaw, loginResponseBody: responseBody }
}

export async function getPageAsUser(url: string, session: string): Promise<{ status: number; html: string }> {
  console.log('[okoeditor] GET (authenticated)', url, `cookie=oko_session=${session.slice(0, 8)}…`)
  const res = await fetchWithTimeout(url, {
    headers: { Cookie: `oko_session=${session}` },
  })
  const html = await res.text()
  console.log('[okoeditor] GET (authenticated)', url, '→', res.status, '| length:', html.length)
  return { status: res.status, html }
}

function maskedBody(body: Record<string, unknown>): string {
  return JSON.stringify({ ...body, apikey: '*****' }, null, 2)
}

export async function callOkoVerify(answer: Record<string, unknown>): Promise<{
  status: number
  requestUrl: string
  requestBodyMasked: string
  responseBody: string
}> {
  const verifyUrl = process.env.AI_DEVS_VERIFY_URL ?? `${config.okoBaseUrl}/verify`
  const body = {
    apikey: process.env.AI_DEVS_KEY ?? '',
    task: config.task,
    answer,
  }

  const res = await fetchWithTimeout(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const responseBody = await res.text().catch(() => '(empty)')

  return {
    status: res.status,
    requestUrl: `POST ${verifyUrl}`,
    requestBodyMasked: maskedBody(body),
    responseBody,
  }
}

export interface IncidentCandidate {
  id: string
  href: string
}

export interface TaskCandidate {
  id: string
  href: string
}

function extractIncidentIdFromHref(href: string): string | null {
  const match = href.match(/\/incydenty\/([0-9a-f]{32,})/i)
  return match?.[1] ?? null
}

function collectIncidentLinksFromRoot(root: ReturnType<typeof load>): IncidentCandidate[] {
  const incidents = new Map<string, IncidentCandidate>()
  root('a[href]').each((_, el) => {
    const href = root(el).attr('href') ?? ''
    const id = extractIncidentIdFromHref(href)
    if (!id) return
    incidents.set(id, { id, href })
  })
  return Array.from(incidents.values())
}

// Extracts incidents from the "recent hours event register" section first.
// Falls back to all incident links if section is not found.
export function extractRecentIncidentLinks(html: string): IncidentCandidate[] {
  const $ = load(html)
  const sectionHeading = $('h1,h2,h3,h4,h5,h6,p,strong,legend,span,div').filter((_, el) => {
    const text = ($(el).text() ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    return /rejestr.*zdarze[nń].*ostatnich.*godzin/.test(text)
  }).first()

  if (sectionHeading.length > 0) {
    let sectionContainer = sectionHeading.closest('section,article,main,div,table,ul,ol,tbody').first()
    if (sectionContainer.length === 0) {
      sectionContainer = sectionHeading.parent()
    }
    const scoped = collectIncidentLinksFromRoot(load(sectionContainer.html() ?? ''))
    if (scoped.length > 0) {
      console.log('[okoeditor] extractRecentIncidentLinks scoped found:', scoped.length)
      return scoped
    }
  }

  const fallback = collectIncidentLinksFromRoot($)
  console.log('[okoeditor] extractRecentIncidentLinks fallback found:', fallback.length)
  return fallback
}

function extractTaskIdFromHref(href: string): string | null {
  const match = href.match(/\/zadania\/([0-9a-f]{32,})/i)
  return match?.[1] ?? null
}

export function extractTaskLinks(html: string): TaskCandidate[] {
  const $ = load(html)
  const tasks = new Map<string, TaskCandidate>()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const id = extractTaskIdFromHref(href)
    if (!id) return
    tasks.set(id, { id, href })
  })

  const out = Array.from(tasks.values())
  console.log('[okoeditor] extractTaskLinks found:', out.length)
  return out
}
