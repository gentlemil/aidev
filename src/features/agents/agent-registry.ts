/**
 * Typed agent registry — static definitions for now.
 * When execution is implemented, each agent will have a corresponding
 * runner in lib/ai/ and a feature module in features/agents/<slug>/.
 */

export type AgentStatus = 'available' | 'coming_soon' | 'beta'

export type AgentCategory =
  | 'Documents'
  | 'Data'
  | 'Content'
  | 'Knowledge'
  | 'Reports'
  | 'Automation'

export interface AgentDefinition {
  id: string
  name: string
  description: string
  slug: string
  status: AgentStatus
  category: AgentCategory
  icon: string
  url?: string
}

export const agentRegistry: AgentDefinition[] = [
  {
    id: 'people-tagger',
    name: 'People Tagger',
    description:
      'Reads a CSV of people, filters by criteria, tags job descriptions with AI, and submits results to the hub.',
    slug: 'people',
    status: 'available',
    category: 'Data',
    icon: 'Users',
    url: '/agents/people',
  },
  {
    id: 'find-him',
    name: 'Find Him',
    description:
      'Locates a suspect from the people list near a nuclear power plant, retrieves their access level, and submits findings to the hub.',
    slug: 'find-him',
    status: 'available',
    category: 'Automation',
    icon: 'MapPin',
    url: '/agents/find-him',
  },
  {
    id: 'pipeline',
    name: 'Pipeline',
    description:
      'Two-stage pipeline: Stage 1 tags people from CSV and submits to hub (with retry), then hands off suspects to Stage 2 which locates the closest one to a nuclear power plant.',
    slug: 'pipeline',
    status: 'available',
    category: 'Automation',
    icon: 'GitMerge',
    url: '/agents/pipeline',
  },
  {
    id: 'evaluation',
    name: 'Evaluation Agent',
    description:
      'Downloads ~10k sensor readings, detects anomalies via type/range validation and LLM-based operator note analysis, then submits results to the hub.',
    slug: 'evaluation',
    status: 'available',
    category: 'Data',
    icon: 'FileSearch',
    url: '/agents/evaluation',
  },
  {
    id: 'firmware',
    name: 'Firmware Agent',
    description:
      'Connects to a virtual Linux machine via shell API, debugs and runs the ECCS cooling system firmware, then submits the confirmation code to the hub.',
    slug: 'firmware',
    status: 'available',
    category: 'Automation',
    icon: 'Cpu',
    url: '/agents/firmware',
  },
  {
    id: 'reactor',
    name: 'Reactor Agent',
    description:
      'Navigates a robot through a 7x5 grid, avoiding vertically moving blocks, to reach the goal and retrieve the flag.',
    slug: 'reactor',
    status: 'available',
    category: 'Automation',
    icon: 'Zap',
    url: '/agents/reactor',
  },
  {
    id: 'negotiations',
    name: 'Negotiations Agent',
    description:
      'Registers a public product-lookup tool so the hub agent can find cities that sell all required parts for the negotiations task.',
    slug: 'negotiations',
    status: 'available',
    category: 'Data',
    icon: 'Database',
    url: '/agents/negotiations',
  },
  {
    id: 'savethem',
    name: 'SaveThem Agent',
    description:
      'Discovers hub tools, acquires a 10×10 terrain map, selects a vehicle, plans a route from S to G, and retrieves the flag.',
    slug: 'savethem',
    status: 'available',
    category: 'Automation',
    icon: 'Navigation',
    url: '/agents/savethem',
  },
  {
    id: 'okoeditor',
    name: 'OKO Editor',
    description:
      'Logs into the OKO monitoring panel, scrapes incident and task IDs with cheerio, then updates records via the Centrala API.',
    slug: 'okoeditor',
    status: 'available',
    category: 'Automation',
    icon: 'Eye',
    url: '/agents/okoeditor',
  },
  // {
  //   id: 'data-extractor',
  //   name: 'Data Extractor',
  //   description: 'Extract structured data from unstructured documents, tables, and scanned images.',
  //   slug: 'data-extractor',
  //   status: 'coming_soon',
  //   category: 'Data',
  //   icon: 'Database',
  // },
]

export function getAgentBySlug(slug: string): AgentDefinition | undefined {
  return agentRegistry.find((a) => a.slug === slug)
}

export function getAgentsByCategory(category: AgentCategory): AgentDefinition[] {
  return agentRegistry.filter((a) => a.category === category)
}
