import type { Metadata } from "next"
import { RegisterForm } from "@/components/auth/register-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Create account",
}

export default function RegisterPage() {
  return (
    <Card className="shadow-md">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>
          Join AgentHub and start automating with AI agents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  )
}
