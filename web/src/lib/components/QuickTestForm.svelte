<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';
  import { quickTestSchema, buildSubmission } from './quick-test-form-helpers.js';

  export let poolId: string;

  let fc = '';
  let tc = '';
  let ph = '';
  let ta = '';
  let cya = '';
  let error = '';
  let success = '';

  async function handleSubmit() {
    success = '';
    error = '';
    const result = quickTestSchema.safeParse({ fc, tc, ph, ta, cya });
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message).filter(Boolean);
      error = messages.length
        ? `Validation failed: ${messages.join('; ')}`
        : 'Validation failed. Please review the form values and try again.';
      return;
    }
    const { payload, skipped } = buildSubmission(result.data);
    const res = await api.tests.create(poolId, payload);
    if (res.ok) {
      success = skipped.length
        ? `Saved test results. No measurement recorded for ${skipped.join(', ')}.`
        : 'Test results saved successfully.';
    } else {
      let message = 'Unable to save test results. Please try again.';
      try {
        const data = await res.json();
        const details = Array.isArray(data?.details)
          ? data.details.filter((detail): detail is string => typeof detail === 'string' && detail.trim() !== '')
          : [];

        if (typeof data?.message === 'string' && data.message.trim() !== '') {
          message = data.message;
        } else if (typeof data?.error === 'string' && data.error.trim() !== '') {
          message = details.length ? `${data.error}: ${details.join(' ')}` : data.error;
        } else if (details.length) {
          message = details.join(' ');
        }
      } catch (parseError) {
        // Ignore JSON parsing errors and fall back to the default message.
      }

      error = message;
    }
  }
</script>

<Card>
  <h2 class="text-lg font-semibold text-content-primary">Quick Test Update</h2>
  <form class="mt-5 grid gap-4 sm:grid-cols-2" on:submit|preventDefault={handleSubmit}>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80" for="fc">FC</label>
      <input
        id="fc"
        type="number"
        min="0"
        bind:value={fc}
        class="input"
      >
    </div>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80" for="tc">TC</label>
      <input
        id="tc"
        type="number"
        min="0"
        bind:value={tc}
        class="input"
      >
    </div>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80" for="ph">pH</label>
      <input
        id="ph"
        type="number"
        min="0"
        step="0.1"
        bind:value={ph}
        class="input"
      >
    </div>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80" for="ta">TA</label>
      <input
        id="ta"
        type="number"
        min="0"
        bind:value={ta}
        class="input"
      >
    </div>
    <div class="space-y-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80" for="cya">CYA</label>
      <input
        id="cya"
        type="number"
        min="0"
        bind:value={cya}
        class="input"
      >
    </div>
    {#if error}
      <p class="sm:col-span-2 text-xs font-medium text-danger" role="alert" aria-live="polite">{error}</p>
    {/if}
    {#if success}
      <p class="sm:col-span-2 text-xs font-medium text-success" role="status" aria-live="polite">{success}</p>
    {/if}
    <button
      type="submit"
      class="sm:col-span-2 btn btn-base btn-primary"
    >
      Save
    </button>
  </form>
</Card>
