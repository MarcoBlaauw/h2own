<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';
  import { page } from '$app/stores';
  import {
    fullTestSchema,
    measurementMetadata,
    measurementOrder,
    type FullTestSchema,
    type MeasurementKey,
  } from '$lib/test-measurements';

  let form: Record<MeasurementKey, string> = {
    fc: '', tc: '', ph: '', ta: '', cya: '', ch: '', salt: '', temp: ''
  };
  let collectedAt = '';
  let photoUrl = '';
  let error = '';
  let success = '';
  let isSubmitting = false;
  let fieldErrors: Partial<Record<MeasurementKey | 'collectedAt', string[]>> = {};

  const toDateTimeLocal = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const fieldErrorId = (field: MeasurementKey | 'collectedAt') => `full-test-${field}-error`;

  async function handleSubmit() {
    error = '';
    success = '';
    fieldErrors = {};

    const result = fullTestSchema.safeParse({ ...form, collectedAt: collectedAt ? new Date(collectedAt).toISOString() : '' });
    if (!result.success) {
      const { fieldErrors: nextErrors, formErrors } = result.error.flatten(issue => issue.message);
      fieldErrors = { ...nextErrors };
      const msg = [...formErrors, ...Object.values(nextErrors).flat().filter(Boolean)][0];
      error = msg ?? 'Please review the entered values.';
      return;
    }

    const poolId = $page.params.id;
    if (!poolId) {
      error = 'Pool identifier is missing.';
      return;
    }

    isSubmitting = true;
    try {
      let photoId: string | undefined;
      if (photoUrl.trim()) {
        const confirmRes = await api.photos.confirm({ fileUrl: photoUrl.trim(), poolId });
        if (!confirmRes.ok) {
          error = 'Unable to attach photo. Please verify the URL and try again.';
          return;
        }
        const photo = await confirmRes.json();
        photoId = photo?.photoId;
      }

      const payload: Record<string, number | string> = {};
      for (const key of measurementOrder) {
        const value = result.data[key as keyof FullTestSchema];
        if (typeof value === 'number') payload[key] = value;
      }
      if (result.data.collectedAt) payload.collectedAt = result.data.collectedAt;
      if (photoId) payload.photoId = photoId;

      const res = await api.pools.createTest(poolId, payload);
      if (!res.ok) {
        error = 'Unable to save full test. Please try again.';
        return;
      }

      success = photoId
        ? 'Detailed test saved and photo attached.'
        : 'Detailed test saved successfully.';
      form = { fc: '', tc: '', ph: '', ta: '', cya: '', ch: '', salt: '', temp: '' };
      collectedAt = '';
      photoUrl = '';
      fieldErrors = {};
    } catch {
      error = 'Unable to save full test. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8 space-y-6">
  <Card>
    <h1 class="text-2xl font-semibold text-content-primary">Detailed Test Entry</h1>
    <p class="mt-2 text-sm text-content-secondary">
      Use this sectioned form when you need a complete water profile. For a quick sanitation-only check,
      continue using the fast form on the pool details page.
    </p>
  </Card>

  <Card>
    <h2 class="text-lg font-semibold text-content-primary">Guidance and ranges</h2>
    <div class="mt-3 overflow-x-auto">
      <table class="min-w-full text-left text-sm text-content-secondary">
        <thead>
          <tr>
            <th class="px-2 py-2">Metric</th><th class="px-2 py-2">Units</th><th class="px-2 py-2">Accepted range</th><th class="px-2 py-2">Desired range</th><th class="px-2 py-2">Why it matters</th>
          </tr>
        </thead>
        <tbody>
          {#each measurementOrder as key}
            <tr class="border-t border-border/40">
              <td class="px-2 py-2">{measurementMetadata[key].label}</td>
              <td class="px-2 py-2">{measurementMetadata[key].unit}</td>
              <td class="px-2 py-2">{measurementMetadata[key].acceptedRange.min}–{measurementMetadata[key].acceptedRange.max}</td>
              <td class="px-2 py-2">{measurementMetadata[key].targetRange}</td>
              <td class="px-2 py-2">{measurementMetadata[key].rationale}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Card>

  <Card>
    <form class="form-grid" on:submit|preventDefault={handleSubmit} aria-busy={isSubmitting}>
      <h2 class="sm:col-span-2 text-lg font-semibold text-content-primary">Chemistry measurements</h2>
      {#each measurementOrder as key}
        <div class="form-field">
          <label class="form-label" for={key}>{measurementMetadata[key].label}</label>
          <input
            id={key}
            type="number"
            class="form-control"
            bind:value={form[key]}
            min={measurementMetadata[key].acceptedRange.min}
            max={measurementMetadata[key].acceptedRange.max}
            step={measurementMetadata[key].step ?? 1}
            disabled={isSubmitting}
            aria-invalid={fieldErrors[key]?.length ? 'true' : undefined}
            aria-describedby={fieldErrors[key]?.length ? fieldErrorId(key) : undefined}
          >
          {#if fieldErrors[key]?.[0]}
            <p class="form-message" data-state="error" id={fieldErrorId(key)}>{fieldErrors[key]?.[0]}</p>
          {/if}
        </div>
      {/each}

      <div class="form-field sm:col-span-2">
        <label class="form-label" for="collectedAt">Collection time (optional)</label>
        <input id="collectedAt" type="datetime-local" class="form-control" bind:value={collectedAt} max={toDateTimeLocal(new Date().toISOString())} disabled={isSubmitting}>
      </div>

      <div class="form-field sm:col-span-2">
        <label class="form-label" for="photo-url">Photo URL (optional)</label>
        <input id="photo-url" type="url" class="form-control" bind:value={photoUrl} placeholder="https://example.com/test-strip.jpg" disabled={isSubmitting}>
        <p class="form-message" data-state="info">If provided, the URL is confirmed and attached to the test record.</p>
      </div>

      {#if error}<p class="form-message sm:col-span-2" data-state="error" role="alert">{error}</p>{/if}
      {#if success}<p class="form-message sm:col-span-2" data-state="success" role="status">{success}</p>{/if}

      <div class="sm:col-span-2 flex justify-end">
        <button class="btn btn-base btn-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save detailed test'}</button>
      </div>
    </form>
  </Card>
</div>
