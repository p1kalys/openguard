/**
 * Provider name constants
 */

/**
 * Standard provider names
 */
export const PROVIDER_NAMES = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  GROQ: 'groq',
  MISTRAL: 'mistral',
  OPENROUTER: 'openrouter',
} as const;

/**
 * Provider name type
 */
export type ProviderName = typeof PROVIDER_NAMES[keyof typeof PROVIDER_NAMES];

/**
 * Provider display names
 */
export const PROVIDER_DISPLAY_NAMES: Record<ProviderName, string> = {
  [PROVIDER_NAMES.OPENAI]: 'OpenAI',
  [PROVIDER_NAMES.ANTHROPIC]: 'Anthropic',
  [PROVIDER_NAMES.GEMINI]: 'Google Gemini',
  [PROVIDER_NAMES.GROQ]: 'Groq',
  [PROVIDER_NAMES.MISTRAL]: 'Mistral',
  [PROVIDER_NAMES.OPENROUTER]: 'OpenRouter',
};

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: ProviderName): string {
  return PROVIDER_DISPLAY_NAMES[provider] || provider;
}

/**
 * Default models per provider
 */
export const DEFAULT_MODELS: Record<ProviderName, string> = {
  [PROVIDER_NAMES.OPENAI]: 'gpt-4o-mini',
  [PROVIDER_NAMES.ANTHROPIC]: 'claude-3-5-sonnet-20241022',
  [PROVIDER_NAMES.GEMINI]: 'gemini-1.5-flash',
  [PROVIDER_NAMES.GROQ]: 'llama3-8b-8192',
  [PROVIDER_NAMES.MISTRAL]: 'mistral-tiny',
  [PROVIDER_NAMES.OPENROUTER]: 'meta-llama/llama-3.1-8b-instruct:free',
};
