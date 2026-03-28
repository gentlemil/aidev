export const NEGOTIATIONS_CONFIG = {
  knowledgeBaseUrl: 'https://hub.ag3nts.org/dane/s03e04_csv',
  publicBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
  toolPath: '/api/tools/negotiations',
  task: 'negotiations',
} as const
