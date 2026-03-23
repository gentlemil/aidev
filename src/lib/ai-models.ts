export enum AIProviders {
  OPEN_AI = 'OpenAI',
  OPEN_ROUTER = 'OpenRouter',
  LM_STUDIO = 'LM Studio',
}

export const PROVIDER_API: Record<
  AIProviders,
  { url: string; getKey: () => string; resolveModel: (model: string) => string }
> = {
  [AIProviders.OPEN_AI]: {
    url: 'https://api.openai.com/v1/chat/completions',
    getKey: () => process.env.OPENAI_API_KEY ?? '',
    // OpenAI API expects bare model name, strip "openai/" prefix if present
    resolveModel: (model) => model.replace(/^openai\//, ''),
  },
  [AIProviders.OPEN_ROUTER]: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    getKey: () => process.env.OPENROUTER_API_KEY ?? '',
    // OpenRouter expects "provider/model" format — pass as-is
    resolveModel: (model) => model,
  },
  [AIProviders.LM_STUDIO]: {
    url: 'http://localhost:1234/v1/chat/completions',
    getKey: () => '',
    // LM Studio uses local model identifiers without prefix
    resolveModel: (model) => model,
  },
}

export const AVAILABLE_MODELS = {
  [AIProviders.OPEN_AI]: [
    {
      label: 'GPT-4.1-nano (the cheapest)',
      value: 'gpt-4.1-nano',
      description:
        'GPT-4.1-nano is the smallest GPT-4.1 variant, optimized for cost-efficiency and basic tasks.',
    },
    {
      label: 'GPT-4o mini (cheap + vision)',
      value: 'gpt-4o-mini',
      description:
        'GPT-4o mini is a fast and inexpensive multimodal model with vision support, good for UI analysis, OCR, and lightweight agents.',
    },
    {
      label: 'GPT-4.1-mini (cheap default)',
      value: 'gpt-4.1-mini',
      description:
        'GPT-4.1-mini is a balanced low-cost model suitable for chat, coding, and general-purpose agents.',
    },
    {
      label: 'GPT-4.1 (general purpose)',
      value: 'gpt-4.1',
      description:
        'GPT-4.1 is a high-quality general-purpose model with strong coding, reasoning, and long-context capabilities.',
    },
    {
      label: 'o4-mini (cheap reasoning)',
      value: 'o4-mini-2025-04-16',
      description:
        'o4-mini is a lightweight reasoning model designed for planning, tool use, and agent workflows at lower cost.',
    },
    {
      label: 'o3 (strong reasoning)',
      value: 'o3-2025-04-16',
      description:
        'o3 is a powerful reasoning model optimized for complex logic, deep analysis, and advanced agent tasks.',
    },
  ],
  [AIProviders.OPEN_ROUTER]: [
    {
      label: 'GPT-4o mini (OpenAI, cheap + vision)',
      value: 'openai/gpt-4o-mini',
      description:
        'Fast and inexpensive multimodal model from OpenAI with vision support, good for lightweight agents and UI analysis.',
    },
    {
      label: 'GPT-4o (OpenAI, strong vision)',
      value: 'openai/gpt-4o',
      description:
        'Powerful multimodal model with strong vision, reasoning, and coding capabilities.',
    },
    {
      label: 'Claude 3.5 Sonnet (Anthropic, high quality)',
      value: 'anthropic/claude-3.5-sonnet',
      description:
        'High-quality model from Anthropic with strong reasoning, coding, and long-context performance.',
    },
    {
      label: 'Gemini 1.5 Pro (Google, long context + vision)',
      value: 'google/gemini-1.5-pro',
      description:
        'Google multimodal model with very long context window, excellent for documents, images, and complex tasks.',
    },
    {
      label: 'Qwen 2.5 72B Instruct (ZAI, strong open model)',
      value: 'zai/qwen-2.5-72b-instruct',
      description:
        'Large open-weight model with strong reasoning and coding ability, good alternative to proprietary models.',
    },
    {
      label: 'Mistral Large (Mistral, balanced)',
      value: 'mistralai/mistral-large',
      description:
        'Balanced high-quality model from Mistral, suitable for chat, coding, and general-purpose agents.',
    },
    {
      label: 'GPT-5 Mini (faster, more cost-efficient variant of GPT-5)',
      value: 'openai/gpt-5-mini',
      description:
        'The smallest variant of the upcoming GPT-5 series, optimized for cost-efficiency and basic tasks.',
    },
  ],
  [AIProviders.LM_STUDIO]: [
    {
      label: 'Qwen 2.5 Coder 7B Instruct (LM Studio, strong coding)',
      value: 'qwen2.5-coder-7b-instruct',
      description:
        'High-quality coding model from LM Studio, optimized for programming tasks and code generation.',
    },
    {
      label: 'Meta Llama 3.1 8B Instruct (LM Studio, balanced)',
      value: 'meta-llama-3.1-8b-instruct',
      description:
        'Balanced model from Meta available in LM Studio, good for chat, coding, and general tasks.',
    },
  ],
}
