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
