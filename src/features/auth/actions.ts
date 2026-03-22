"use server"

import { signIn, signOut } from "@/lib/auth"
import { db } from "@/lib/db"
import { registerSchema, signInSchema } from "@/schemas/auth"
import { AuthError } from "next-auth"
import bcrypt from "bcryptjs"
import type { SignInInput, RegisterInput } from "@/schemas/auth"

export type ActionResult = {
  success?: string
  error?: string
}

export async function loginAction(data: SignInInput): Promise<ActionResult> {
  // Server-side re-validation (defense in depth)
  const parsed = signInSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password" }
        default:
          return { error: "Something went wrong. Please try again." }
      }
    }
    // Re-throw NEXT_REDIRECT and other unexpected errors
    throw error
  }

  return { success: "Logged in successfully" }
}

export async function registerAction(data: RegisterInput): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" }
  }

  const { firstName, lastName, email, password } = parsed.data

  const existingUser = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (existingUser) {
    return { error: "An account with this email already exists" }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await db.user.create({
    data: {
      firstName,
      lastName,
      email: email.toLowerCase(),
      passwordHash,
    },
  })

  // Auto-login after registration
  try {
    await signIn("credentials", {
      email: email.toLowerCase(),
      password,
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Account created but auto-login failed. Please log in manually.",
      }
    }
    throw error
  }

  return { success: "Account created successfully" }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" })
}
