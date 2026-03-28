'use client'

import { Construction } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent } from '@/components/ui/card'

export default function NegotiationsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Negotiations Agent"
        description="Work in progress — this agent is not yet implemented."
      />

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Construction className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Work in progress</p>
          <p className="max-w-sm text-xs text-muted-foreground/70">
            This agent is currently under development. Check back later for updates.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
