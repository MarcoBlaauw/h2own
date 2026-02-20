<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { PageData } from './$types';
  import type { AdminApiToken } from './+page';

  export let data: PageData;

  let tokens: AdminApiToken[] = data.tokens ?? [];
  let loadError: string | null = data.loadError;
  let isLoading = false;
  let creating = false;
  let newTokenName = '';
  let createError: string | null = null;
  let statusMessage: { type: 'success' | 'error'; text: string } | null = null;
  let preview: { name: string; value: string } | null = null;
  const busyTokens = new SvelteSet<string>();

  function formatDate(value: string | null, fallback = 'Never') {
    if (!value) return fallback;
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      console.error('Failed to format date', error);
      return value;
    }
  }

  async function refreshTokens() {
    isLoading = true;
    try {
      const response = await api.apiTokens.list();
      if (!response.ok) {
        loadError = `Failed to load API tokens (${response.status})`;
        tokens = [];
        return;
      }

      tokens = (await response.json()) as AdminApiToken[];
      loadError = null;
    } catch (error) {
      console.error('Failed to refresh API tokens', error);
      loadError = 'Unable to refresh API tokens. Please try again later.';
      tokens = [];
    } finally {
      isLoading = false;
    }
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = newTokenName.trim();
    if (!trimmed) {
      createError = 'Token name is required.';
      return;
    }

    creating = true;
    createError = null;
    statusMessage = null;

    try {
      const response = await api.apiTokens.create({ name: trimmed });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        createError = payload?.message ?? payload?.error ?? 'Failed to create API token.';
        return;
      }

      const result = await response.json();
      preview = { name: result.name, value: result.preview };
      statusMessage = {
        type: 'success',
        text: `New token "${result.name}" created. Copy the value below—it will not be shown again.`,
      };
      newTokenName = '';
      await refreshTokens();
    } catch (error) {
      console.error('Failed to create API token', error);
      createError = 'Unable to create API token. Please try again later.';
    } finally {
      creating = false;
    }
  }

  function dismissPreview() {
    preview = null;
  }

  async function revokeToken(token: AdminApiToken) {
    if (token.revoked) return;
    busyTokens.add(token.tokenId);
    statusMessage = null;
    try {
      const response = await api.apiTokens.revoke(token.tokenId);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        statusMessage = {
          type: 'error',
          text: payload?.message ?? payload?.error ?? 'Failed to revoke token.',
        };
        return;
      }

      statusMessage = { type: 'success', text: `Token "${token.name}" revoked.` };
      await refreshTokens();
    } catch (error) {
      console.error('Failed to revoke token', error);
      statusMessage = { type: 'error', text: 'Unable to revoke token. Please try again later.' };
    } finally {
      busyTokens.delete(token.tokenId);
    }
  }
</script>

<svelte:head>
  <title>Admin · API tokens</title>
</svelte:head>

<Container>
<div class="mx-auto w-full max-w-6xl space-y-6 py-6">
  <div>
    <h1 class="text-2xl font-semibold text-content-primary">API token management</h1>
    <p class="text-sm text-content-secondary">
      Generate credentials for integrations and revoke compromised keys.
    </p>
  </div>

  <Card className="space-y-6">
    <form class="flex flex-col gap-4 sm:flex-row" on:submit={handleCreate}>
      <label class="flex-1 text-sm">
        <span class="mb-1 block font-medium text-content-secondary">Token name</span>
        <input
          class="input"
          placeholder="e.g., Zapier bridge"
          bind:value={newTokenName}
          required
          minlength={1}
          maxlength={120}
        />
      </label>
      <div class="flex items-end gap-2">
        <button class="btn btn-primary" type="submit" disabled={creating}>
          {#if creating}
            Creating…
          {:else}
            Create token
          {/if}
        </button>
        <button
          class="btn btn-tonal"
          type="button"
          on:click={refreshTokens}
          disabled={isLoading}
        >
          {#if isLoading}
            Refreshing…
          {:else}
            Refresh
          {/if}
        </button>
      </div>
    </form>

    {#if createError}
      <div class="rounded-md border border-error/40 bg-error/5 p-3 text-sm text-error">{createError}</div>
    {/if}

    {#if preview}
      <div class="space-y-3 rounded-md border border-accent/40 bg-accent/5 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-accent-strong">
              Token created: {preview.name}
            </p>
            <p class="text-xs text-content-secondary">
              This preview is only shown once. Store it somewhere secure before closing this alert.
            </p>
          </div>
          <button class="btn btn-sm btn-tonal" type="button" on:click={dismissPreview}>
            Dismiss
          </button>
        </div>
        <code class="block overflow-x-auto rounded bg-surface-strong/80 p-3 text-sm">{preview.value}</code>
      </div>
    {/if}

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

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-border/60 text-sm">
        <thead class="bg-surface-strong/40 text-xs uppercase tracking-wide text-content-tertiary">
          <tr>
            <th class="px-4 py-3 text-left font-semibold">Name</th>
            <th class="px-4 py-3 text-left font-semibold">Created</th>
            <th class="px-4 py-3 text-left font-semibold">Last used</th>
            <th class="px-4 py-3 text-left font-semibold">Status</th>
            <th class="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/40">
          {#if tokens.length === 0}
            <tr>
              <td colspan="5" class="px-4 py-6 text-center text-content-secondary">
                {#if loadError}
                  Unable to display API tokens.
                {:else}
                  No API tokens yet.
                {/if}
              </td>
            </tr>
          {:else}
            {#each tokens as token}
              <tr class={token.revoked ? 'bg-surface/60 text-content-secondary line-through' : ''}>
                <td class="px-4 py-3">
                  <div class="font-medium text-content-primary">{token.name}</div>
                  <div class="text-xs text-content-secondary">{token.tokenId}</div>
                </td>
                <td class="px-4 py-3">{formatDate(token.createdAt)}</td>
                <td class="px-4 py-3">{formatDate(token.lastUsedAt)}</td>
                <td class="px-4 py-3">
                  {#if token.revoked}
                    <span class="rounded-full bg-error/10 px-2 py-1 text-xs font-semibold text-error">Revoked</span>
                  {:else}
                    <span class="rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">Active</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    class="btn btn-sm btn-tonal"
                    type="button"
                    on:click={() => revokeToken(token)}
                    disabled={token.revoked || busyTokens.has(token.tokenId)}
                  >
                    {#if token.revoked}
                      Revoked
                    {:else if busyTokens.has(token.tokenId)}
                      Revoking…
                    {:else}
                      Revoke
                    {/if}
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </Card>
</div>
</Container>
