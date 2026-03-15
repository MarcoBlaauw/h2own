<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';
  import type { PageData } from './$types';
  import type { AdminIntegration } from './+page';

  export let data: PageData;

  let integrations: AdminIntegration[] = data.integrations ?? [];
  let loadError: string | null = data.loadError;
  let isLoading = false;
  let busyProvider: string | null = null;
  let statusMessage: { type: 'success' | 'error'; text: string } | null = null;

  const providersWithBaseUrl = ['tomorrow_io', 'google_maps'] as const;
  const hasBaseUrlProvider = (provider: string) =>
    providersWithBaseUrl.includes(provider as (typeof providersWithBaseUrl)[number]);
  const llmProviders = ['openai', 'anthropic', 'none'] as const;
  const llmModelFamilies = ['economy', 'balanced', 'quality'] as const;
  const llmFallbackBehaviors = ['computed_preview', 'refuse'] as const;
  const isLlmProvider = (provider: string) => provider === 'llm';

  const stateByProvider = new SvelteMap<
    string,
    {
      enabled: boolean;
      cacheTtlSeconds: string;
      rateLimitCooldownSeconds: string;
      baseUrl: string;
      apiKey: string;
      clearApiKey: boolean;
      llmProvider: string;
      llmModelFamily: string;
      llmModelId: string;
      llmMaxTokens: string;
      llmTemperature: string;
      llmTimeoutMs: string;
      llmMaxRetries: string;
      llmCircuitBreakerThreshold: string;
      llmCircuitBreakerCooldownMs: string;
      llmFallbackBehavior: string;
    }
  >();

  function hydrateFormState(items: AdminIntegration[]) {
    stateByProvider.clear();
    for (const item of items) {
      const baseUrl = typeof item.config?.baseUrl === 'string' ? item.config.baseUrl : '';
      stateByProvider.set(item.provider, {
        enabled: item.enabled,
        cacheTtlSeconds: item.cacheTtlSeconds?.toString() ?? '',
        rateLimitCooldownSeconds: item.rateLimitCooldownSeconds?.toString() ?? '',
        baseUrl,
        apiKey: '',
        clearApiKey: false,
        llmProvider: typeof item.config?.provider === 'string' ? item.config.provider : 'none',
        llmModelFamily:
          typeof item.config?.modelFamily === 'string' ? item.config.modelFamily : 'balanced',
        llmModelId: typeof item.config?.modelId === 'string' ? item.config.modelId : '',
        llmMaxTokens:
          item.config?.maxTokens === null || item.config?.maxTokens === undefined
            ? ''
            : String(item.config.maxTokens),
        llmTemperature:
          item.config?.temperature === null || item.config?.temperature === undefined
            ? ''
            : String(item.config.temperature),
        llmTimeoutMs:
          item.config?.timeoutMs === null || item.config?.timeoutMs === undefined
            ? ''
            : String(item.config.timeoutMs),
        llmMaxRetries:
          item.config?.maxRetries === null || item.config?.maxRetries === undefined
            ? ''
            : String(item.config.maxRetries),
        llmCircuitBreakerThreshold:
          item.config?.circuitBreakerThreshold === null ||
          item.config?.circuitBreakerThreshold === undefined
            ? ''
            : String(item.config.circuitBreakerThreshold),
        llmCircuitBreakerCooldownMs:
          item.config?.circuitBreakerCooldownMs === null ||
          item.config?.circuitBreakerCooldownMs === undefined
            ? ''
            : String(item.config.circuitBreakerCooldownMs),
        llmFallbackBehavior:
          typeof item.config?.fallbackBehavior === 'string'
            ? item.config.fallbackBehavior
            : 'computed_preview',
      });
    }
  }

  hydrateFormState(integrations);

  function formStateFor(provider: string) {
    if (!stateByProvider.has(provider)) {
      stateByProvider.set(provider, {
        enabled: true,
        cacheTtlSeconds: '',
        rateLimitCooldownSeconds: '',
        baseUrl: '',
        apiKey: '',
        clearApiKey: false,
        llmProvider: 'none',
        llmModelFamily: 'balanced',
        llmModelId: '',
        llmMaxTokens: '',
        llmTemperature: '',
        llmTimeoutMs: '',
        llmMaxRetries: '',
        llmCircuitBreakerThreshold: '',
        llmCircuitBreakerCooldownMs: '',
        llmFallbackBehavior: 'computed_preview',
      });
    }

    return stateByProvider.get(provider)!;
  }

  function formatDate(value: string | null) {
    if (!value) return 'N/A';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  function normalizePositiveInteger(value: string | number) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }

  function normalizeNonNegativeInteger(value: string | number) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
  }

  function normalizeDecimal(value: string | number) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  async function refreshIntegrations() {
    isLoading = true;
    statusMessage = null;
    try {
      const response = await api.adminIntegrations.list();
      if (!response.ok) {
        loadError = `Failed to load integrations (${response.status})`;
        integrations = [];
        return;
      }
      integrations = (await response.json()) as AdminIntegration[];
      hydrateFormState(integrations);
      loadError = null;
    } catch (error) {
      console.error('Failed to refresh integrations', error);
      integrations = [];
      loadError = 'Unable to refresh integrations. Please try again later.';
    } finally {
      isLoading = false;
    }
  }

  async function saveIntegration(integration: AdminIntegration) {
    const form = formStateFor(integration.provider);
    const cacheTtlSeconds = normalizePositiveInteger(form.cacheTtlSeconds);
    const rateLimitCooldownSeconds = normalizePositiveInteger(form.rateLimitCooldownSeconds);

    const currentConfig = asRecord(integration.config);
    const nextConfig = { ...currentConfig };

    if (hasBaseUrlProvider(integration.provider) || isLlmProvider(integration.provider)) {
      nextConfig.baseUrl = form.baseUrl.trim() || null;
    }

    if (isLlmProvider(integration.provider)) {
      nextConfig.provider = form.llmProvider;
      nextConfig.modelFamily = form.llmModelFamily;
      nextConfig.modelId = form.llmModelId.trim() || null;
      nextConfig.maxTokens = normalizePositiveInteger(form.llmMaxTokens);
      nextConfig.temperature = normalizeDecimal(form.llmTemperature);
      nextConfig.timeoutMs = normalizePositiveInteger(form.llmTimeoutMs);
      nextConfig.maxRetries = normalizeNonNegativeInteger(form.llmMaxRetries);
      nextConfig.circuitBreakerThreshold = normalizePositiveInteger(form.llmCircuitBreakerThreshold);
      nextConfig.circuitBreakerCooldownMs = normalizePositiveInteger(form.llmCircuitBreakerCooldownMs);
      nextConfig.fallbackBehavior = form.llmFallbackBehavior;
    }

    const payload: Record<string, unknown> = {
      enabled: form.enabled,
      cacheTtlSeconds,
      rateLimitCooldownSeconds,
      config: nextConfig,
    };

    if (form.clearApiKey) {
      payload.apiKey = null;
    } else if (form.apiKey.trim()) {
      payload.apiKey = form.apiKey.trim();
    }

    busyProvider = integration.provider;
    statusMessage = null;
    try {
      const response = await api.adminIntegrations.update(integration.provider, payload);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        statusMessage = {
          type: 'error',
          text: body?.error ?? `Failed to update ${integration.displayName}.`,
        };
        return;
      }

      const updated = (await response.json()) as AdminIntegration;
      integrations = integrations.map((item) =>
        item.provider === integration.provider ? updated : item
      );
      hydrateFormState(integrations);
      statusMessage = {
        type: 'success',
        text: `${integration.displayName} settings updated.`,
      };
    } catch (error) {
      console.error('Failed to update integration', error);
      statusMessage = {
        type: 'error',
        text: `Unable to update ${integration.displayName}. Please try again later.`,
      };
    } finally {
      busyProvider = null;
    }
  }
</script>

<svelte:head>
  <title>Admin · Integrations</title>
</svelte:head>

<Container>
  <div class="mx-auto w-full max-w-6xl space-y-6 py-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-content-primary">Integrations</h1>
        <p class="text-sm text-content-secondary">
          Manage provider credentials, cache limits, and runtime health status.
        </p>
      </div>
      <button class="btn btn-tonal" type="button" on:click={refreshIntegrations} disabled={isLoading}>
        {#if isLoading}Refreshing…{:else}Refresh{/if}
      </button>
    </div>

    {#if statusMessage}
      <div
        role="status"
        class={`rounded-md border p-3 text-sm ${
          statusMessage.type === 'success'
            ? 'border-success/40 bg-success/5 text-success'
            : 'border-error/40 bg-error/5 text-error'
        }`}
      >
        {statusMessage.text}
      </div>
    {/if}

    {#if loadError}
      <div class="rounded-md border border-error/40 bg-error/5 p-3 text-sm text-error">{loadError}</div>
    {/if}

    <div class="grid gap-4">
      {#if integrations.length === 0}
        <Card className="p-4 text-sm text-content-secondary">No integrations found.</Card>
      {:else}
        {#each integrations as integration}
          <Card className="space-y-4 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold text-content-primary">{integration.displayName}</h2>
                <p class="text-xs text-content-secondary font-mono">{integration.provider}</p>
              </div>
              <div class="text-right text-xs text-content-secondary">
                <p>Last code: {integration.lastResponseCode ?? 'N/A'}</p>
                <p>Last response: {formatDate(integration.lastResponseAt)}</p>
                <p>Last success: {formatDate(integration.lastSuccessAt)}</p>
                <p>Next allowed: {formatDate(integration.nextAllowedRequestAt)}</p>
              </div>
            </div>

            {#key `${integration.provider}-${integration.updatedAt}`}
              {@const form = formStateFor(integration.provider)}
              <form
                class="grid gap-4 sm:grid-cols-2"
                on:submit|preventDefault={() => saveIntegration(integration)}
              >
                <label class="text-sm sm:col-span-2">
                  <span class="mb-1 block font-medium text-content-secondary">Enabled</span>
                  <input type="checkbox" bind:checked={form.enabled} />
                </label>

                <label class="text-sm">
                  <span class="mb-1 block font-medium text-content-secondary">Cache TTL (seconds)</span>
                  <input class="input" type="number" min="1" bind:value={form.cacheTtlSeconds} />
                </label>

                <label class="text-sm">
                  <span class="mb-1 block font-medium text-content-secondary">Rate-limit cooldown (seconds)</span>
                  <input class="input" type="number" min="1" bind:value={form.rateLimitCooldownSeconds} />
                </label>

                {#if hasBaseUrlProvider(integration.provider)}
                  <label class="text-sm sm:col-span-2">
                    <span class="mb-1 block font-medium text-content-secondary">Base URL</span>
                    <input class="input" type="url" placeholder="https://..." bind:value={form.baseUrl} />
                  </label>
                {/if}

                {#if isLlmProvider(integration.provider)}
                  <label class="text-sm">
                    <span class="mb-1 block font-medium text-content-secondary">LLM provider</span>
                    <select class="input" bind:value={form.llmProvider}>
                      {#each llmProviders as option}
                        <option value={option}>{option}</option>
                      {/each}
                    </select>
                  </label>

                  <label class="text-sm">
                    <span class="mb-1 block font-medium text-content-secondary">Model family</span>
                    <select class="input" bind:value={form.llmModelFamily}>
                      {#each llmModelFamilies as option}
                        <option value={option}>{option}</option>
                      {/each}
                    </select>
                  </label>

                  <label class="text-sm sm:col-span-2">
                    <span class="mb-1 block font-medium text-content-secondary">Model ID override</span>
                    <input
                      class="input"
                      type="text"
                      placeholder="Leave blank to use the default model for the selected provider/family"
                      bind:value={form.llmModelId}
                    />
                  </label>

                  <label class="text-sm sm:col-span-2">
                    <span class="mb-1 block font-medium text-content-secondary">Base URL override</span>
                    <input
                      class="input"
                      type="url"
                      placeholder="Optional. Leave blank to use the provider default API base."
                      bind:value={form.baseUrl}
                    />
                  </label>

                  <label class="text-sm">
                    <span class="mb-1 block font-medium text-content-secondary">Max tokens</span>
                    <input class="input" type="number" min="128" bind:value={form.llmMaxTokens} />
                  </label>

                  <label class="text-sm">
                    <span class="mb-1 block font-medium text-content-secondary">Temperature</span>
                    <input class="input" type="number" min="0" max="1" step="0.1" bind:value={form.llmTemperature} />
                  </label>

                  <label class="text-sm">
                    <span class="mb-1 block font-medium text-content-secondary">Timeout (ms)</span>
                    <input class="input" type="number" min="1000" bind:value={form.llmTimeoutMs} />
                  </label>

                  <label class="text-sm">
                    <span class="mb-1 block font-medium text-content-secondary">Max retries</span>
                    <input class="input" type="number" min="0" bind:value={form.llmMaxRetries} />
                  </label>

                  <label class="text-sm">
                    <span class="mb-1 block font-medium text-content-secondary">Circuit threshold</span>
                    <input class="input" type="number" min="1" bind:value={form.llmCircuitBreakerThreshold} />
                  </label>

                  <label class="text-sm">
                    <span class="mb-1 block font-medium text-content-secondary">Circuit cooldown (ms)</span>
                    <input class="input" type="number" min="1000" bind:value={form.llmCircuitBreakerCooldownMs} />
                  </label>

                  <label class="text-sm sm:col-span-2">
                    <span class="mb-1 block font-medium text-content-secondary">Fallback behavior</span>
                    <select class="input" bind:value={form.llmFallbackBehavior}>
                      {#each llmFallbackBehaviors as option}
                        <option value={option}>{option}</option>
                      {/each}
                    </select>
                  </label>
                {/if}

                <label class="text-sm sm:col-span-2">
                  <span class="mb-1 block font-medium text-content-secondary">API key</span>
                  <input class="input" type="password" placeholder="Leave blank to keep current key" bind:value={form.apiKey} />
                  <p class="mt-1 text-xs text-content-secondary">
                    Current key: {integration.credentials?.apiKeyPreview ?? 'Not set'}
                  </p>
                </label>

                <label class="text-sm sm:col-span-2">
                  <span class="inline-flex items-center gap-2">
                    <input type="checkbox" bind:checked={form.clearApiKey} />
                    <span class="font-medium text-content-secondary">Clear stored API key</span>
                  </span>
                </label>

                <div class="sm:col-span-2 flex items-center justify-between">
                  <p class="text-xs text-content-secondary truncate">
                    Last text: {integration.lastResponseText ?? 'N/A'}
                  </p>
                  <button
                    class="btn btn-primary"
                    type="submit"
                    disabled={busyProvider === integration.provider}
                  >
                    {#if busyProvider === integration.provider}Saving…{:else}Save{/if}
                  </button>
                </div>
              </form>
            {/key}
          </Card>
        {/each}
      {/if}
    </div>
  </div>
</Container>
