import { z } from "zod"

export const signInSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .min(1, "Email is required")
    .email("Invalid email address"),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
})

export const registerSchema = z
  .object({
    firstName: z
      .string({ required_error: "First name is required" })
      .min(1, "First name is required")
      .max(50, "First name must be 50 characters or less")
      .regex(/^[a-zA-Z\s'-]+$/, "First name contains invalid characters"),
    lastName: z
      .string({ required_error: "Last name is required" })
      .min(1, "Last name is required")
      .max(50, "Last name must be 50 characters or less")
      .regex(/^[a-zA-Z\s'-]+$/, "Last name contains invalid characters"),
    email: z
      .string({ required_error: "Email is required" })
      .min(1, "Email is required")
      .email("Invalid email address"),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string({ required_error: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type SignInInput = z.infer<typeof signInSchema>
export type RegisterInput = z.infer<typeof registerSchema>
