export type LlmGenerationInput = {
  prompt: string;
  systemPrompt?: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
};

export type LlmGenerationResult = {
  content: string;
  provider: 'openai' | 'anthropic';
  modelId: string;
};

export interface LlmProvider {
  generatePlan(input: LlmGenerationInput): Promise<LlmGenerationResult>;
  generateInterpretation(input: LlmGenerationInput): Promise<LlmGenerationResult>;
}

export type LlmProviderConfig = {
  apiKey: string;
  modelId: string;
  maxRetries: number;
  timeoutMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerCooldownMs: number;
};

type CircuitState = {
  failures: number;
  openedAt: number | null;
};

export abstract class BaseLlmProvider implements LlmProvider {
  private circuit: CircuitState = { failures: 0, openedAt: null };

  constructor(protected readonly config: LlmProviderConfig) {}

  protected canAttempt() {
    if (this.circuit.openedAt === null) return true;
    if (Date.now() - this.circuit.openedAt >= this.config.circuitBreakerCooldownMs) {
      this.circuit = { failures: 0, openedAt: null };
      return true;
    }
    return false;
  }

  protected onSuccess() {
    this.circuit = { failures: 0, openedAt: null };
  }

  protected onFailure() {
    const failures = this.circuit.failures + 1;
    this.circuit = {
      failures,
      openedAt: failures >= this.config.circuitBreakerThreshold ? Date.now() : this.circuit.openedAt,
    };
  }

  protected async withRetry<T>(run: () => Promise<T>) {
    if (!this.canAttempt()) {
      throw new Error('LLM circuit breaker is open');
    }

    let latestError: unknown = null;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        const result = await run();
        this.onSuccess();
        return result;
      } catch (error) {
        latestError = error;
        this.onFailure();
        if (attempt < this.config.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
        }
      }
    }

    throw latestError instanceof Error ? latestError : new Error('LLM request failed');
  }

  abstract generatePlan(input: LlmGenerationInput): Promise<LlmGenerationResult>;
  abstract generateInterpretation(input: LlmGenerationInput): Promise<LlmGenerationResult>;
}
