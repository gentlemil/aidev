import type { Metadata } from "next"
import { format } from "date-fns"
import { redirect } from "next/navigation"
import { CheckCircle2, Clock } from "lucide-react"
import { getCurrentUserFull } from "@/lib/current-user"
import { getInitials } from "@/lib/utils"
import { PageContainer, PageHeader } from "@/components/layout/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const user = await getCurrentUserFull()
  if (!user) redirect("/login")

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Manage your account and preferences." />

      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your personal account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-800">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div>
              <p className="text-lg font-semibold">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator />

          {/* Fields */}
          <dl className="grid gap-4 sm:grid-cols-2">
            <ProfileField label="First name" value={user.firstName} />
            <ProfileField label="Last name" value={user.lastName} />
            <ProfileField label="Email address" value={user.email} />
            <div className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Account status
              </dt>
              <dd>
                {user.verified ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Unverified
                  </Badge>
                )}
              </dd>
            </div>
          </dl>

          <Separator />

          {/* Timestamps */}
          <dl className="grid gap-4 sm:grid-cols-2">
            <ProfileField
              label="Member since"
              value={format(new Date(user.createdAt), "MMMM d, yyyy")}
            />
            <ProfileField
              label="Last updated"
              value={format(new Date(user.updatedAt), "MMMM d, yyyy 'at' h:mm a")}
            />
            <ProfileField label="User ID" value={user.id} mono />
          </dl>
        </CardContent>
      </Card>

      {/* Future sections placeholder */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Password change and two-factor authentication — coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">Coming soon</Badge>
        </CardContent>
      </Card>
    </PageContainer>
  )
}

function ProfileField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono text-xs text-muted-foreground" : "font-medium"}`}>
        {value}
      </dd>
    </div>
  )
}
