import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      firstName: string
      lastName: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    firstName?: string
    lastName?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    firstName: string
    lastName: string
  }
}
