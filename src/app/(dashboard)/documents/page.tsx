import type { Metadata } from "next"
import { FileText, Upload, FileSearch, Database } from "lucide-react"
import { PageContainer, PageHeader } from "@/components/layout/page-container"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Documents" }

const plannedFeatures = [
  {
    icon: Upload,
    title: "Document Upload",
    description: "Upload PDF, Word, and plain-text documents for AI processing.",
    status: "Planned",
  },
  {
    icon: FileSearch,
    title: "AI Analysis",
    description: "Run the Document Analyzer agent to extract insights and summaries.",
    status: "Planned",
  },
  {
    icon: Database,
    title: "Structured Extraction",
    description: "Use the Data Extractor agent to pull structured data from any document.",
    status: "Planned",
  },
]

export default function DocumentsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        description="Upload documents and run AI analysis workflows."
      >
        <Button disabled size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Upload document
        </Button>
      </PageHeader>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
          <FileText className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="mb-1 text-base font-semibold">No documents yet</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          Document upload and AI analysis workflows are coming soon. Check the Agent Library for
          available document processing agents.
        </p>
        <Badge variant="secondary">Document workflows coming soon</Badge>
      </div>

      {/* Planned features preview */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What&apos;s coming
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plannedFeatures.map((f) => (
            <Card key={f.title} className="opacity-75">
              <CardHeader className="pb-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {f.status}
                  </Badge>
                </div>
                <CardTitle className="text-sm">{f.title}</CardTitle>
                <CardDescription className="text-xs">{f.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
