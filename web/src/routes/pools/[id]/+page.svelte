<script lang="ts">
  import { api } from '$lib/api';
  import { page } from '$app/stores';
  import { invalidateAll } from '$app/navigation';
  import Card from '$lib/components/ui/Card.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  let fc = '';
  let tc = '';
  let ph = '';

  const toNumberOrUndefined = (value: string) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  async function handleSubmit() {
    const poolId = $page.params.id;
    if (!poolId) return;

    const payload: Record<string, number> = {};
    const fcValue = toNumberOrUndefined(fc);
    const tcValue = toNumberOrUndefined(tc);
    const phValue = toNumberOrUndefined(ph);

    if (fcValue !== undefined) payload.fc = fcValue;
    if (tcValue !== undefined) payload.tc = tcValue;
    if (phValue !== undefined) payload.ph = phValue;

    await api.tests.create(poolId, payload);
    await invalidateAll();
  }

  async function handleRoleChange(userId: string | undefined, role: string) {
    const poolId = $page.params.id;
    if (!poolId || !userId) return;
    await api.members.update(poolId, userId, { role });
    await invalidateAll();
  }

  async function handleRemoveMember(userId: string | undefined) {
    const poolId = $page.params.id;
    if (!poolId || !userId) return;
    await api.members.del(poolId, userId);
    await invalidateAll();
  }

  const formatCc = (test) => {
    if (typeof test.totalChlorine !== 'number' || typeof test.freeChlorine !== 'number') {
      return 'N/A';
    }
    const value = Math.max(0, test.totalChlorine - test.freeChlorine);
    return value.toFixed(2);
  };
</script>

<div class="container mx-auto px-4 py-8 space-y-6">
  {#if data.pool}
    <h1 class="text-3xl font-semibold text-surface-900 dark:text-surface-50">{data.pool.name}</h1>
    <p class="text-base text-surface-600 dark:text-surface-300">{data.pool.volumeGallons} gallons</p>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="shadow-card h-full">
        <div class="space-y-4">
          <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-50">Members</h2>
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm text-surface-700 dark:text-surface-200">
              <thead class="border-b border-surface-200/70 text-xs font-semibold uppercase tracking-wide text-surface-500/80 dark:border-surface-700/60 dark:text-surface-300">
                <tr>
                  <th class="px-3 py-2">User</th>
                  <th class="px-3 py-2">Role</th>
                  <th class="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-surface-100/70 dark:divide-surface-800/80">
                {#if data.pool.members?.length > 0}
                  {#each data.pool.members as member}
                    <tr>
                      <td class="px-3 py-3 text-surface-800 dark:text-surface-100">{member.user?.email ?? 'Unknown user'}</td>
                      <td class="px-3 py-3">
                        <select
                          class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:ring-surface-700/60 dark:focus:ring-primary-300"
                          bind:value={member.roleName}
                          on:change={() => handleRoleChange(member.user?.id, member.roleName)}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </td>
                      <td class="px-3 py-3">
                        <button
                          on:click={() => handleRemoveMember(member.user?.id)}
                          class="btn btn-sm preset-outline-error-500 hover:brightness-110 dark:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!member.user?.id}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  {/each}
                {:else}
                  <tr>
                    <td colspan="3" class="px-3 py-6 text-center text-surface-500 dark:text-surface-400">No members found.</td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <Card className="shadow-card h-full">
        <div class="space-y-4">
          <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-50">Tests</h2>
          {#if data.pool.tests?.length > 0}
            <ul class="space-y-4 text-sm text-surface-700 dark:text-surface-200">
              {#each data.pool.tests as test}
                <li class="rounded-lg border border-surface-200/70 bg-surface-50/40 p-4 dark:border-surface-700/60 dark:bg-surface-900/40">
                  <p>
                    FC: {test.freeChlorine ?? 'N/A'}, TC: {test.totalChlorine ?? 'N/A'}, pH: {test.ph ?? 'N/A'}, CC: {formatCc(test)}
                  </p>
                  <p class="text-xs text-surface-500 dark:text-surface-400">
                    Tested on {new Date(test.testedAt).toLocaleString()} by {test.tester?.email ?? 'Unknown'}
                  </p>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm text-surface-500 dark:text-surface-400">No tests found.</p>
          {/if}
        </div>
      </Card>
      <Card className="shadow-card h-full md:col-span-2">
        <form class="grid gap-4 sm:grid-cols-2" on:submit|preventDefault={handleSubmit}>
          <h2 class="sm:col-span-2 text-xl font-semibold text-surface-900 dark:text-surface-50">Add New Test</h2>
          <div class="space-y-2">
            <label class="text-sm font-medium text-surface-700 dark:text-surface-200" for="fc">Free Chlorine (FC)</label>
            <input
              class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:ring-surface-700/60 dark:focus:ring-primary-300"
              id="fc"
              type="number"
              bind:value={fc}
            >
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-surface-700 dark:text-surface-200" for="tc">Total Chlorine (TC)</label>
            <input
              class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:ring-surface-700/60 dark:focus:ring-primary-300"
              id="tc"
              type="number"
              bind:value={tc}
            >
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-surface-700 dark:text-surface-200" for="ph">pH</label>
            <input
              class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:ring-surface-700/60 dark:focus:ring-primary-300"
              id="ph"
              type="number"
              bind:value={ph}
            >
          </div>
          <div class="sm:col-span-2 flex justify-end">
            <button class="btn btn-base preset-filled-primary-500 shadow-card hover:brightness-110 dark:hover:brightness-95" type="submit">
              Add Test
            </button>
          </div>
        </form>
      </Card>
    </div>
  {:else}
    <p class="text-surface-600 dark:text-surface-400">Pool not found.</p>
  {/if}
</div>
