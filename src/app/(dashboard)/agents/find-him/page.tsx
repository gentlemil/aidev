'use client'

import { PageContainer, PageHeader } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function FindHimPage() {
  // TODO
  return (
    <PageContainer>
      <PageHeader
        title="Find Him"
        description="Locates a suspect from the people list near a nuclear power plant, retrieves their access level, and submits findings to the hub."></PageHeader>

      {/* Config strip */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Config:</span>
        {/* TODO */}
        <Badge variant="outline">CSV source</Badge>
        <Badge variant="outline">
          Get Power Plants → Get Suspects Location → Compare → Point Someone → Submit
        </Badge>
        {/* TODO */}
      </div>
      {/* Run log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Run Log</CardTitle>
        </CardHeader>
        <CardContent>{/* TODO */}</CardContent>
      </Card>
      {/* TODO */}
    </PageContainer>
  )
}
