import { BaseLlmProvider, type LlmGenerationInput, type LlmGenerationResult, type LlmProviderConfig } from './provider.js';

export class AnthropicCompatibleProvider extends BaseLlmProvider {
  constructor(
    config: LlmProviderConfig,
    private readonly baseUrl = 'https://api.anthropic.com/v1'
  ) {
    super(config);
  }

  private async generate(input: LlmGenerationInput): Promise<LlmGenerationResult> {
    return this.withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.config.modelId,
            max_tokens: input.maxTokens,
            temperature: input.temperature,
            system: input.systemPrompt,
            messages: [{ role: 'user', content: input.prompt }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic-compatible provider error (${response.status}): ${errorText}`);
        }

        const payload = await response.json() as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const content = payload.content?.find((item) => item.type === 'text')?.text?.trim();
        if (!content) {
          throw new Error('Anthropic-compatible provider returned empty content');
        }

        return {
          content,
          provider: 'anthropic' as const,
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
