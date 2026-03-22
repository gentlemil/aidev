import { auth } from "./auth"
import { db } from "./db"

/**
 * Returns the session user (fast — reads from JWT).
 * Use when you only need id/name/email from the token.
 */
export async function getCurrentUser() {
  const session = await auth()
  return session?.user ?? null
}

/**
 * Returns the full user record from the database.
 * Use on pages that need fresh DB data (e.g. Settings).
 */
export async function getCurrentUserFull() {
  const session = await auth()
  if (!session?.user?.id) return null

  return db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      verified: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

/**
 * Returns the session user or throws — use in layouts/pages
 * that are already protected by middleware.
 */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")
  return user
}
