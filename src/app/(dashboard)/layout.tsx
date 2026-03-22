import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { AppShell } from "@/components/layout/app-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth — middleware already redirects, but guard here too
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <AppShell
      user={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      }}
    >
      {children}
    </AppShell>
  )
}
