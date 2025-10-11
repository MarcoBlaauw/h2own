<script lang="ts">
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';
  import type { PageData } from './$types';
  import type { AdminPool } from './+page';

  export let data: PageData;

  let pools: AdminPool[] = data.pools ?? [];
  let loadError: string | null = data.loadError;

  let selectedPoolId: string | null = pools[0]?.id ?? null;

  type UpdateFormState = {
    poolId: string | null;
    name: string;
    volumeGallons: string;
    sanitizerType: string;
    surfaceType: string;
    isActive: boolean;
  };

  type TransferFormState = {
    newOwnerId: string;
  };

  const defaultUpdateForm: UpdateFormState = {
    poolId: null,
    name: '',
    volumeGallons: '',
    sanitizerType: '',
    surfaceType: '',
    isActive: true,
  };

  let updateForm: UpdateFormState = { ...defaultUpdateForm };
  let transferForm: TransferFormState = { newOwnerId: '' };

  let updateErrors: string[] = [];
  let transferErrors: string[] = [];
  let updateMessage: { type: 'success' | 'error'; text: string } | null = null;
  let transferMessage: { type: 'success' | 'error'; text: string } | null = null;

  let updating = false;
  let transferring = false;
  let refreshing = false;

  $: selectedPool = selectedPoolId
    ? pools.find((pool) => pool.id === selectedPoolId) ?? null
    : null;

  $: if (selectedPool && updateForm.poolId !== selectedPool.id) {
    updateForm = formFromPool(selectedPool);
    transferForm = defaultTransferForm(selectedPool);
    updateErrors = [];
    transferErrors = [];
    updateMessage = null;
    transferMessage = null;
  }

  function formFromPool(pool: AdminPool): UpdateFormState {
    return {
      poolId: pool.id,
      name: pool.name,
      volumeGallons: pool.volumeGallons.toString(),
      sanitizerType: pool.sanitizerType ?? '',
      surfaceType: pool.surfaceType ?? '',
      isActive: pool.isActive,
    };
  }

  function defaultTransferForm(pool: AdminPool): TransferFormState {
    const nextMember = pool.members.find((member) => member.userId !== pool.ownerId);
    return {
      newOwnerId: nextMember?.userId ?? '',
    } satisfies TransferFormState;
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    return date.toLocaleString();
  }

  async function refreshPools(preferredId?: string | null) {
    refreshing = true;
    try {
      const response = await api.adminPools.list();
      if (!response.ok) {
        throw new Error(`Refresh failed (${response.status})`);
      }
      const refreshed = (await response.json()) as AdminPool[];
      pools = refreshed;
      if (preferredId && refreshed.some((pool) => pool.id === preferredId)) {
        selectedPoolId = preferredId;
      } else if (selectedPoolId && !refreshed.some((pool) => pool.id === selectedPoolId)) {
        selectedPoolId = refreshed[0]?.id ?? null;
      }
    } catch (error) {
      console.error('Failed to refresh pools', error);
    } finally {
      refreshing = false;
    }
  }

  async function handleUpdate(event: SubmitEvent) {
    event.preventDefault();
    updateErrors = [];
    updateMessage = null;

    if (!selectedPool) {
      return;
    }

    const trimmedName = updateForm.name.trim();
    if (!trimmedName) {
      updateErrors.push('Name is required.');
    }

    const rawVolume = updateForm.volumeGallons;
    const volumeInput = typeof rawVolume === 'number' ? String(rawVolume) : rawVolume ?? '';
    const volumeValue = Number(volumeInput.trim());
    if (Number.isNaN(volumeValue) || volumeValue <= 0) {
      updateErrors.push('Volume must be a positive number.');
    }

    if (updateErrors.length > 0) {
      return;
    }

    const payload: Record<string, unknown> = {};

    if (trimmedName !== selectedPool.name) {
      payload.name = trimmedName;
    }

    if (volumeValue !== selectedPool.volumeGallons) {
      payload.volumeGallons = volumeValue;
    }

    const sanitizer = updateForm.sanitizerType.trim();
    if (sanitizer && sanitizer !== (selectedPool.sanitizerType ?? '')) {
      payload.sanitizerType = sanitizer;
    }

    const surface = updateForm.surfaceType.trim();
    if (surface && surface !== (selectedPool.surfaceType ?? '')) {
      payload.surfaceType = surface;
    }

    if (updateForm.isActive !== selectedPool.isActive) {
      payload.isActive = updateForm.isActive;
    }

    if (Object.keys(payload).length === 0) {
      updateMessage = { type: 'error', text: 'No changes detected.' };
      return;
    }

    updating = true;
    try {
      const response = await api.adminPools.update(selectedPool.id, payload);
      if (!response.ok) {
        updateMessage = {
          type: 'error',
          text: `Update failed (${response.status}).`,
        };
        return;
      }

      updateMessage = { type: 'success', text: 'Pool updated successfully.' };
      await refreshPools(selectedPool.id);
    } catch (error) {
      console.error('Failed to update pool', error);
      updateMessage = {
        type: 'error',
        text: 'Unable to update pool. Please try again later.',
      };
    } finally {
      updating = false;
    }
  }

  async function handleTransfer(event: SubmitEvent) {
    event.preventDefault();
    transferErrors = [];
    transferMessage = null;

    if (!selectedPool) {
      return;
    }

    const newOwnerId = transferForm.newOwnerId.trim();
    if (!newOwnerId) {
      transferErrors.push('A new owner must be selected.');
    } else if (newOwnerId === selectedPool.ownerId) {
      transferErrors.push('The selected user already owns this pool.');
    }

    if (transferErrors.length > 0) {
      return;
    }

    transferring = true;
    try {
      const response = await api.adminPools.transfer(selectedPool.id, { newOwnerId });
      if (!response.ok) {
        transferMessage = {
          type: 'error',
          text: `Transfer failed (${response.status}).`,
        };
        return;
      }

      transferMessage = { type: 'success', text: 'Ownership transferred successfully.' };
      await refreshPools(selectedPool.id);
    } catch (error) {
      console.error('Failed to transfer ownership', error);
      transferMessage = {
        type: 'error',
        text: 'Unable to transfer ownership. Please try again later.',
      };
    } finally {
      transferring = false;
    }
  }
</script>

<svelte:head>
  <title>Admin Pools</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:flex-row">
  <aside class="sm:w-64">
    <Card className="p-4">
      <h2 class="text-lg font-semibold text-content-primary">Pools</h2>
      {#if loadError}
        <div role="alert" class="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}
        </div>
      {/if}
      {#if pools.length === 0}
        <p class="mt-4 text-sm text-content-secondary">No pools found.</p>
      {:else}
        <ul class="mt-3 space-y-2">
          {#each pools as pool}
            <li>
              <button
                class={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedPoolId === pool.id
                    ? 'bg-accent/10 text-accent-strong'
                    : 'bg-surface-strong/40 hover:bg-surface-strong/60'
                }`}
                type="button"
                on:click={() => (selectedPoolId = pool.id)}
              >
                <div class="font-medium">{pool.name}</div>
                <div class="text-xs text-content-secondary">Members: {pool.memberCount}</div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </aside>

  <section class="flex-1 space-y-6">
    {#if selectedPool}
      <Card className="p-5">
        <header class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold text-content-primary">{selectedPool.name}</h2>
            <p class="text-sm text-content-secondary">Pool ID: {selectedPool.id}</p>
          </div>
          <div class="flex flex-wrap gap-3 text-sm text-content-secondary">
            <span>Owner: {selectedPool.owner?.email ?? selectedPool.owner?.id ?? 'Unknown'}</span>
            <span>Status: {selectedPool.isActive ? 'Active' : 'Suspended'}</span>
            <span>Last Test: {formatDate(selectedPool.lastTestedAt)}</span>
          </div>
        </header>

        <div class="mt-4 grid gap-6 lg:grid-cols-2">
          <form class="space-y-4" on:submit|preventDefault={handleUpdate} aria-label="Update pool metadata">
            <h3 class="text-lg font-semibold text-content-primary">Metadata</h3>
            <div class="grid gap-3">
              <label class="text-sm font-medium text-content-secondary" for="pool-name">Name</label>
              <input
                id="pool-name"
                class="input"
                type="text"
                bind:value={updateForm.name}
                required
              />

              <label class="text-sm font-medium text-content-secondary" for="pool-volume">Volume (gallons)</label>
              <input
                id="pool-volume"
                class="input"
                type="number"
                min="1"
                bind:value={updateForm.volumeGallons}
                required
              />

              <label class="text-sm font-medium text-content-secondary" for="pool-sanitizer">Sanitizer</label>
              <input
                id="pool-sanitizer"
                class="input"
                type="text"
                bind:value={updateForm.sanitizerType}
                placeholder="e.g. Chlorine"
              />

              <label class="text-sm font-medium text-content-secondary" for="pool-surface">Surface</label>
              <input
                id="pool-surface"
                class="input"
                type="text"
                bind:value={updateForm.surfaceType}
                placeholder="e.g. Plaster"
              />

              <label class="flex items-center gap-2 text-sm font-medium text-content-secondary">
                <input type="checkbox" bind:checked={updateForm.isActive} />
                Pool is active
              </label>
            </div>

            {#if updateErrors.length > 0}
              <ul class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {#each updateErrors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            {/if}

            {#if updateMessage}
              <div
                class={`rounded-md p-3 text-sm ${
                  updateMessage.type === 'success'
                    ? 'border border-success/40 bg-success/10 text-success'
                    : 'border border-destructive/40 bg-destructive/10 text-destructive'
                }`}
              >
                {updateMessage.text}
              </div>
            {/if}

            <button class="btn btn-primary" type="submit" disabled={updating}>
              {updating ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

          <form class="space-y-4" on:submit|preventDefault={handleTransfer} aria-label="Transfer ownership">
            <h3 class="text-lg font-semibold text-content-primary">Ownership</h3>
            <div class="grid gap-3">
              <label class="text-sm font-medium text-content-secondary" for="pool-transfer-select">
                Transfer to existing member
              </label>
              <select
                id="pool-transfer-select"
                class="input"
                bind:value={transferForm.newOwnerId}
              >
                <option value="">-- Select member --</option>
                {#each selectedPool.members.filter((member) => member.userId !== selectedPool.ownerId) as member}
                  <option value={member.userId}>
                    {member.name ?? member.email ?? member.userId}
                  </option>
                {/each}
              </select>

              <label class="text-sm font-medium text-content-secondary" for="pool-transfer-input">
                Or specify a user ID
              </label>
              <input
                id="pool-transfer-input"
                class="input"
                type="text"
                bind:value={transferForm.newOwnerId}
                placeholder="User ID"
              />
            </div>

            {#if transferErrors.length > 0}
              <ul class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {#each transferErrors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            {/if}

            {#if transferMessage}
              <div
                class={`rounded-md p-3 text-sm ${
                  transferMessage.type === 'success'
                    ? 'border border-success/40 bg-success/10 text-success'
                    : 'border border-destructive/40 bg-destructive/10 text-destructive'
                }`}
              >
                {transferMessage.text}
              </div>
            {/if}

            <button class="btn btn-secondary" type="submit" disabled={transferring}>
              {transferring ? 'Transferring…' : 'Transfer Ownership'}
            </button>
          </form>
        </div>

        <div class="mt-6">
          <h3 class="text-lg font-semibold text-content-primary">Members</h3>
          {#if selectedPool.members.length === 0}
            <p class="mt-2 text-sm text-content-secondary">No members found.</p>
          {:else}
            <div class="mt-3 overflow-x-auto">
              <table class="min-w-full text-left text-sm">
                <thead class="border-b border-border/60 text-xs uppercase tracking-wide text-content-secondary">
                  <tr>
                    <th class="px-3 py-2">Name</th>
                    <th class="px-3 py-2">Email</th>
                    <th class="px-3 py-2">Role</th>
                    <th class="px-3 py-2">User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {#each selectedPool.members as member}
                    <tr class="border-b border-border/40 last:border-b-0">
                      <td class="px-3 py-2">{member.name ?? '—'}</td>
                      <td class="px-3 py-2">{member.email ?? '—'}</td>
                      <td class="px-3 py-2">{member.roleName}</td>
                      <td class="px-3 py-2 font-mono text-xs text-content-secondary">{member.userId}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </Card>

      <div class="flex items-center justify-between text-sm text-content-secondary">
        <span>
          Created {formatDate(selectedPool.createdAt)} · Updated {formatDate(selectedPool.updatedAt)}
        </span>
        {#if refreshing}
          <span>Refreshing…</span>
        {/if}
      </div>
    {:else}
      <Card className="p-6 text-center text-sm text-content-secondary">
        Select a pool to view details.
      </Card>
    {/if}
  </section>
</div>
