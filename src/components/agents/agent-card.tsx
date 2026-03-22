import {
  AlignLeft,
  BarChart2,
  Database,
  FileSearch,
  MessageSquare,
  Tags,
  type LucideProps,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AgentDefinition } from "@/features/agents/agent-registry"

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  FileSearch,
  Database,
  AlignLeft,
  Tags,
  MessageSquare,
  BarChart2,
}

const statusConfig = {
  available: { label: "Available", variant: "success" as const },
  beta: { label: "Beta", variant: "info" as const },
  coming_soon: { label: "Coming soon", variant: "secondary" as const },
}

interface AgentCardProps {
  agent: AgentDefinition
}

export function AgentCard({ agent }: AgentCardProps) {
  const Icon = iconMap[agent.icon] ?? FileSearch
  const status = statusConfig[agent.status]

  return (
    <Card className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <CardTitle className="mt-3 text-base">{agent.name}</CardTitle>
        <CardDescription className="text-sm">{agent.description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{agent.category}</span>
          {agent.status === "available" ? (
            <span className="text-xs font-medium text-amber-700 group-hover:underline">
              Open →
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not yet available</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
