import { BaseLlmProvider, type LlmGenerationInput, type LlmGenerationResult, type LlmProviderConfig } from './provider.js';

export class OpenAiCompatibleProvider extends BaseLlmProvider {
  constructor(
    config: LlmProviderConfig,
    private readonly baseUrl = 'https://api.openai.com/v1'
  ) {
    super(config);
  }

  private async generate(input: LlmGenerationInput): Promise<LlmGenerationResult> {
    return this.withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.config.modelId,
            temperature: input.temperature,
            max_tokens: input.maxTokens,
            messages: [
              input.systemPrompt ? { role: 'system', content: input.systemPrompt } : null,
              { role: 'user', content: input.prompt },
            ].filter(Boolean),
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI-compatible provider error (${response.status}): ${errorText}`);
        }
        const payload = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content?.trim();
        if (!content) {
          throw new Error('OpenAI-compatible provider returned empty content');
        }
        return {
          content,
          provider: 'openai' as const,
          modelId: this.config.modelId,
        };
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  generatePlan(input: LlmGenerationInput): Promise<LlmGenerationResult> {
    return this.generate(input);
  }

  generateInterpretation(input: LlmGenerationInput): Promise<LlmGenerationResult> {
    return this.generate(input);
  }
}
