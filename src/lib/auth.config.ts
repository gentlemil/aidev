/**
 * Edge-compatible auth config — no Prisma/DB imports here.
 * Used by middleware (runs on edge runtime).
 * The full config with PrismaAdapter lives in lib/auth.ts.
 */
import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.firstName = ((user as { firstName?: string }).firstName ?? "") as string
        token.lastName = ((user as { lastName?: string }).lastName ?? "") as string
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
      }
      return session
    },
  },
  trustHost: true,
  providers: [],
} satisfies NextAuthConfig
