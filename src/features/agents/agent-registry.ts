/**
 * Typed agent registry — static definitions for now.
 * When execution is implemented, each agent will have a corresponding
 * runner in lib/ai/ and a feature module in features/agents/<slug>/.
 */

export type AgentStatus = "available" | "coming_soon" | "beta"

export type AgentCategory =
  | "Documents"
  | "Data"
  | "Content"
  | "Knowledge"
  | "Reports"
  | "Automation"

export interface AgentDefinition {
  id: string
  name: string
  description: string
  slug: string
  status: AgentStatus
  category: AgentCategory
  icon: string
}

export const agentRegistry: AgentDefinition[] = [
  {
    id: "document-analyzer",
    name: "Document Analyzer",
    description:
      "Analyze and extract structured insights from PDF, Word, and plain-text documents using AI.",
    slug: "document-analyzer",
    status: "coming_soon",
    category: "Documents",
    icon: "FileSearch",
  },
  {
    id: "data-extractor",
    name: "Data Extractor",
    description:
      "Extract structured data from unstructured documents, tables, and scanned images.",
    slug: "data-extractor",
    status: "coming_soon",
    category: "Data",
    icon: "Database",
  },
  {
    id: "summarizer",
    name: "Content Summarizer",
    description:
      "Generate concise, accurate summaries from long-form reports, articles, and documents.",
    slug: "summarizer",
    status: "coming_soon",
    category: "Content",
    icon: "AlignLeft",
  },
  {
    id: "classifier",
    name: "Document Classifier",
    description:
      "Automatically classify and tag documents by type, topic, sentiment, or custom taxonomy.",
    slug: "classifier",
    status: "coming_soon",
    category: "Documents",
    icon: "Tags",
  },
  {
    id: "qa-agent",
    name: "Q&A Agent",
    description:
      "Ask natural-language questions about your document collection and get cited, accurate answers.",
    slug: "qa",
    status: "coming_soon",
    category: "Knowledge",
    icon: "MessageSquare",
  },
  {
    id: "report-generator",
    name: "Report Generator",
    description:
      "Generate structured, formatted reports from raw data and document collections on demand.",
    slug: "report-generator",
    status: "coming_soon",
    category: "Reports",
    icon: "BarChart2",
  },
]

export function getAgentBySlug(slug: string): AgentDefinition | undefined {
  return agentRegistry.find((a) => a.slug === slug)
}

export function getAgentsByCategory(category: AgentCategory): AgentDefinition[] {
  return agentRegistry.filter((a) => a.category === category)
}
