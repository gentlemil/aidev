// Copy this file to people.config.ts and adjust values for your task.
// people.config.ts is gitignored — never commit your actual config.

export const PEOPLE_CONFIG = {
  // Built from AI_DEVS_KEY env var — no hardcoded secrets
  get csvUrl() {
    return ``
  },
  // Default model sent to the LLM provider (can be overridden from the UI)
  model: '',
  // Hub task identifier used when submitting the answer
  task: '',
  // Filter criteria — adjust to match the current task requirements
  currentYear: 1970,
  minAge: 0,
  maxAge: 0,
  birthPlace: '',
  gender: '',
  // Tags the LLM can assign to job descriptions
  availableJobTags: [] as const,
} as const
