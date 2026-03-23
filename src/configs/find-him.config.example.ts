// Copy this file to find-him.config.ts and adjust values for your task.
// find-him.config.ts is gitignored — never commit your actual config.

export const FIND_HIM_CONFIG = {
  // Built from AI_DEVS_KEY env var — no hardcoded secrets
  get powerPlantsLocationUrl() {
    return ``
  },
  // Hub API endpoints (no key in URL — sent in request body as { apikey })
  get suspectLocationsUrl() {
    return ``
  },
  get accessLevelCheckUrl() {
    return ``
  },
  // Hub task identifier used when submitting the answer
  task: '',
  // Safety limit — agent throws if it exceeds this without finishing
  maxIterations: 15,
} as const
