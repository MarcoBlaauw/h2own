<script lang="ts">
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

  const providersWithBaseUrl = new Set(['tomorrow_io', 'google_maps']);

  const stateByProvider = new Map<
    string,
    {
      enabled: boolean;
      cacheTtlSeconds: string;
      rateLimitCooldownSeconds: string;
      baseUrl: string;
      apiKey: string;
      clearApiKey: boolean;
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
    const nextConfig = providersWithBaseUrl.has(integration.provider)
      ? { ...currentConfig, baseUrl: form.baseUrl.trim() || null }
      : currentConfig;

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

                {#if providersWithBaseUrl.has(integration.provider)}
                  <label class="text-sm sm:col-span-2">
                    <span class="mb-1 block font-medium text-content-secondary">Base URL</span>
                    <input class="input" type="url" placeholder="https://..." bind:value={form.baseUrl} />
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
