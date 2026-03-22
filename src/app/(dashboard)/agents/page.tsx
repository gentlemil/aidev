import type { Metadata } from "next"
import { agentRegistry } from "@/features/agents/agent-registry"
import { AgentCard } from "@/components/agents/agent-card"
import { PageContainer, PageHeader } from "@/components/layout/page-container"

export const metadata: Metadata = { title: "Agents" }

export default function AgentsPage() {
  const available = agentRegistry.filter((a) => a.status === "available")
  const rest = agentRegistry.filter((a) => a.status !== "available")

  return (
    <PageContainer>
      <PageHeader
        title="Agent Library"
        description={`${agentRegistry.length} agents · ${available.length} available`}
      />

      {available.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Available now
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coming soon
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {agentRegistry.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">No agents registered yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add agent definitions to{" "}
            <code className="font-mono text-indigo-600">
              src/features/agents/agent-registry.ts
            </code>
          </p>
        </div>
      )}
    </PageContainer>
  )
}
