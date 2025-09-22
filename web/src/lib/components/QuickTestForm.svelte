<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { tests } from '$lib/api';
  import { z } from 'zod';

  export let poolId: string;

  let fc = 0;
  let tc = 0;
  let ph = 0;
  let ta = 0;
  let cya = 0;
  let error = '';
  let success = '';

  const testSchema = z.object({
    fc: z.number().min(0),
    tc: z.number().min(0),
    ph: z.number().min(0),
    ta: z.number().min(0),
    cya: z.number().min(0),
  });

  async function handleSubmit() {
    success = '';
    error = '';
    const result = testSchema.safeParse({ fc, tc, ph, ta, cya });
    if (!result.success) {
      error = result.error.errors.map(e => e.message).join(', ');
      return;
    }
    const res = await tests.create(poolId, result.data);
    if (res.ok) {
      success = 'Test results saved successfully.';
    } else {
      const data = await res.json();
      error = data.message;
    }
  }
</script>

<Card>
  <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50">Quick Test Update</h2>
  <form class="mt-5 grid gap-4 sm:grid-cols-2" on:submit|preventDefault={handleSubmit}>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-surface-500/80" for="fc">FC</label>
      <input
        id="fc"
        type="number"
        min="0"
        bind:value={fc}
        class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
    </div>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-surface-500/80" for="tc">TC</label>
      <input
        id="tc"
        type="number"
        min="0"
        bind:value={tc}
        class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
    </div>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-surface-500/80" for="ph">pH</label>
      <input
        id="ph"
        type="number"
        min="0"
        step="0.1"
        bind:value={ph}
        class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
    </div>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-surface-500/80" for="ta">TA</label>
      <input
        id="ta"
        type="number"
        min="0"
        bind:value={ta}
        class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
    </div>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-surface-500/80" for="cya">CYA</label>
      <input
        id="cya"
        type="number"
        min="0"
        bind:value={cya}
        class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
    </div>
    {#if error}
      <p class="sm:col-span-2 text-xs font-medium text-error-500" role="alert" aria-live="polite">{error}</p>
    {/if}
    {#if success}
      <p class="sm:col-span-2 text-xs font-medium text-success-500" role="status" aria-live="polite">{success}</p>
    {/if}
    <button
      type="submit"
      class="sm:col-span-2 btn btn-base preset-filled-primary-500 shadow-card hover:brightness-110"
    >
      Save
    </button>
  </form>
</Card>
