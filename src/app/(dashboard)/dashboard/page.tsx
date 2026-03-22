import type { Metadata } from "next"
import { Bot, FileText, Activity, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getCurrentUser } from "@/lib/current-user"
import { PageContainer, PageHeader } from "@/components/layout/page-container"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { agentRegistry } from "@/features/agents/agent-registry"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const user = await getCurrentUser()

  const stats = [
    {
      label: "Available Agents",
      value: agentRegistry.filter((a) => a.status === "available").length,
      total: agentRegistry.length,
      icon: Bot,
      color: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "Coming Soon",
      value: agentRegistry.filter((a) => a.status === "coming_soon").length,
      total: agentRegistry.length,
      icon: Activity,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Documents",
      value: 0,
      total: null,
      icon: FileText,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? "there"}`}
        description="Here's what's happening on your platform."
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <div className={`rounded-lg p-2 ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
              {s.total !== null && (
                <p className="mt-1 text-xs text-muted-foreground">of {s.total} total</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick access */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Library</CardTitle>
            <CardDescription>
              Explore available AI agents and see what&apos;s coming soon.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentRegistry.slice(0, 3).map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.category}</p>
                </div>
                <span
                  className={`text-xs font-medium ${
                    agent.status === "available" ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  {agent.status === "available" ? "Ready" : "Soon"}
                </span>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/agents">
                View all agents <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
            <CardDescription>
              Upload and analyze documents with AI-powered agents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-10 text-center">
              <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No documents yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Document upload coming soon
              </p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href="/documents">Go to Documents</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
