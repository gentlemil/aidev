/**
 * Auth.js v5 middleware — uses the edge-safe auth config (no Prisma).
 * Protects dashboard routes and redirects authenticated users away from auth pages.
 */
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

const AUTH_ROUTES = ["/login", "/register"]
const PROTECTED_ROUTES = ["/dashboard", "/agents", "/documents", "/settings"]

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const isAuthRoute = AUTH_ROUTES.some((r) => nextUrl.pathname.startsWith(r))
  const isProtectedRoute = PROTECTED_ROUTES.some((r) => nextUrl.pathname.startsWith(r))

  // Redirect authenticated users away from /login and /register
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  // Redirect unauthenticated users to /login
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
