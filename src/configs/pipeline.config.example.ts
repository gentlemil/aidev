// Copy this file to pipeline.config.ts and fill in your values.
// pipeline.config.ts is gitignored — never commit your actual config.

import { AIProviders } from '@/lib/ai-models'

export const PIPELINE_CONFIG = {
  stage1: {
    // Model used for job tagging (Stage 1)
    model: 'gpt-4o-mini',
    provider: AIProviders.OPEN_AI,
    // How many times Stage 1 may retry before giving up
    maxIterations: 15,
    // Hub task identifier for the people task
    task: '',
    // URL of the CSV file with people data
    get csvUrl() {
      return ``
    },
    // Filter criteria — must match the task requirements
    currentYear: 1970,
    minAge: 0,
    maxAge: 0,
    birthPlace: '',
    gender: '',
    // Tags the LLM can assign to job descriptions
    availableJobTags: [] as string[],
    // Tag that qualifies a person to be passed to Stage 2
    transportTag: 'transport',
  },
  stage2: {
    // Model used for the find-him agentic loop (Stage 2)
    model: 'openai/gpt-5-mini',
    provider: AIProviders.OPEN_ROUTER,
    // Safety limit — agent throws if it exceeds this without finishing
    maxIterations: 20,
  },
} as const
