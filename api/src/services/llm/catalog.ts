export const LLM_PROVIDER_OPTIONS = ['openai', 'anthropic', 'none'] as const;
export const LLM_MODEL_FAMILY_OPTIONS = ['economy', 'balanced', 'quality'] as const;
export const LLM_FALLBACK_BEHAVIORS = ['computed_preview', 'refuse'] as const;

export type LlmProviderKind = (typeof LLM_PROVIDER_OPTIONS)[number];
export type LlmModelFamily = (typeof LLM_MODEL_FAMILY_OPTIONS)[number];
export type LlmFallbackBehavior = (typeof LLM_FALLBACK_BEHAVIORS)[number];

const DEFAULT_MODEL_BY_PROVIDER: Record<
  Exclude<LlmProviderKind, 'none'>,
  Record<LlmModelFamily, string>
> = {
  openai: {
    economy: 'gpt-4o-mini',
    balanced: 'gpt-4o-mini',
    quality: 'gpt-4o',
  },
  anthropic: {
    economy: 'claude-3-5-haiku-latest',
    balanced: 'claude-3-5-sonnet-latest',
    quality: 'claude-3-5-sonnet-latest',
  },
};

export const resolveDefaultLlmModelId = (
  provider: LlmProviderKind,
  family: LlmModelFamily,
) => {
  if (provider === 'none') return null;
  return DEFAULT_MODEL_BY_PROVIDER[provider][family];
};

export const resolveLlmModelId = (
  provider: LlmProviderKind,
  family: LlmModelFamily,
  explicitModelId?: string | null,
) => {
  const trimmedModelId = explicitModelId?.trim();
  if (trimmedModelId) return trimmedModelId;
  return resolveDefaultLlmModelId(provider, family);
};
