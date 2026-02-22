<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';
  import { page } from '$app/stores';
  import {
    fullTestSchema,
    measurementMetadata,
    type FullTestSchema,
    type MeasurementKey,
  } from '$lib/test-measurements';

  type Section = { title: string; description: string; fields: MeasurementKey[] };

  const sections: Section[] = [
    {
      title: 'Step 1 · Sanitizer readings',
      description: 'Capture chlorine and stabilizer readings first to understand sanitation effectiveness.',
      fields: ['fc', 'tc', 'cya'],
    },
    {
      title: 'Step 2 · Water balance',
      description: 'Enter pH, alkalinity, and hardness to evaluate corrosion/scale risk.',
      fields: ['ph', 'ta', 'ch'],
    },
    {
      title: 'Step 3 · Salt and temperature',
      description: 'Add environmental and generator-support values.',
      fields: ['salt', 'temp'],
    },
  ];

  let form: Record<MeasurementKey, string> = {
    fc: '',
    tc: '',
    ph: '',
    ta: '',
    cya: '',
    ch: '',
    salt: '',
    temp: '',
  };
  let collectedAt = '';
  let photoUrl = '';
  let error = '';
  let success = '';
  let isSubmitting = false;
  let fieldErrors: Partial<Record<MeasurementKey | 'collectedAt', string[]>> = {};

  const fieldErrorId = (field: MeasurementKey | 'collectedAt') => `full-test-${field}-error`;

  const toDateTimeLocal = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => `${n}`.padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  async function handleSubmit() {
    error = '';
    success = '';
    fieldErrors = {};

    const result = fullTestSchema.safeParse({
      ...form,
      collectedAt: collectedAt ? new Date(collectedAt).toISOString() : '',
    });
    if (!result.success) {
      const { fieldErrors: nextErrors, formErrors } = result.error.flatten(issue => issue.message);
      fieldErrors = { ...nextErrors };
      error = [...formErrors, ...Object.values(nextErrors).flat().filter(Boolean)][0] ?? 'Please review the entered values.';
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
      for (const [key, value] of Object.entries(result.data) as [keyof FullTestSchema, unknown][]) {
        if (typeof value === 'number' || typeof value === 'string') payload[key] = value;
      }
      if (photoId) payload.photoId = photoId;

      const res = await api.pools.createTest(poolId, payload);
      if (!res.ok) {
        error = 'Unable to save full test. Please try again.';
        return;
      }

      success = photoId ? 'Detailed test saved and photo attached.' : 'Detailed test saved successfully.';
      form = { fc: '', tc: '', ph: '', ta: '', cya: '', ch: '', salt: '', temp: '' };
      collectedAt = '';
      photoUrl = '';
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
      Use this guided flow for complete water chemistry logging. Need speed? The quick form remains available on the pool detail page.
    </p>
  </Card>

  <Card>
    <h2 class="text-lg font-semibold text-content-primary">Validation limits, targets, and rationale</h2>
    <div class="mt-3 overflow-x-auto">
      <table class="min-w-full text-left text-sm text-content-secondary">
        <thead>
          <tr>
            <th class="px-2 py-2">Metric</th>
            <th class="px-2 py-2">Units</th>
            <th class="px-2 py-2">Accepted range</th>
            <th class="px-2 py-2">Desired range</th>
            <th class="px-2 py-2">Why it matters</th>
          </tr>
        </thead>
        <tbody>
          {#each Object.entries(measurementMetadata) as [key, meta]}
            <tr class="border-t border-border/40">
              <td class="px-2 py-2">{meta.label}</td>
              <td class="px-2 py-2">{meta.unit}</td>
              <td class="px-2 py-2">{meta.acceptedRange.min}–{meta.acceptedRange.max}</td>
              <td class="px-2 py-2">{meta.targetRange}</td>
              <td class="px-2 py-2">{meta.rationale}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Card>

  <Card>
    <form class="space-y-6" on:submit|preventDefault={handleSubmit} aria-busy={isSubmitting}>
      {#each sections as section}
        <section class="space-y-3">
          <h2 class="text-lg font-semibold text-content-primary">{section.title}</h2>
          <p class="text-sm text-content-secondary">{section.description}</p>
          <div class="form-grid">
            {#each section.fields as key}
              <div class="form-field">
                <label class="form-label" for={key}>{measurementMetadata[key].label} ({measurementMetadata[key].unit})</label>
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
                  <p class="form-message" data-state="error" id={fieldErrorId(key)} role="alert">{fieldErrors[key]?.[0]}</p>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/each}

      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-content-primary">Step 4 · Metadata and evidence (optional)</h2>
        <div class="form-grid">
          <div class="form-field sm:col-span-2">
            <label class="form-label" for="collectedAt">Collection time (optional)</label>
            <input
              id="collectedAt"
              type="datetime-local"
              class="form-control"
              bind:value={collectedAt}
              max={toDateTimeLocal(new Date().toISOString())}
              disabled={isSubmitting}
            >
          </div>

          <div class="form-field sm:col-span-2">
            <label class="form-label" for="photo-url">Photo URL (optional)</label>
            <input
              id="photo-url"
              type="url"
              class="form-control"
              bind:value={photoUrl}
              placeholder="https://example.com/test-strip.jpg"
              disabled={isSubmitting}
            >
            <p class="form-message" data-state="info">
              Photo flow: provide a hosted URL, we confirm it through the photos endpoint, then attach the returned `photoId` to the test create request.
            </p>
          </div>
        </div>
      </section>

      {#if error}<p class="form-message" data-state="error" role="alert">{error}</p>{/if}
      {#if success}<p class="form-message" data-state="success" role="status">{success}</p>{/if}

      <div class="flex justify-end">
        <button class="btn btn-base btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save detailed test'}
        </button>
      </div>
    </form>
  </Card>
</div>
