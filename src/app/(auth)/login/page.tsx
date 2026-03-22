import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Sign in",
}

export default function LoginPage() {
  return (
    <Card className="shadow-md">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your AgentHub account</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
