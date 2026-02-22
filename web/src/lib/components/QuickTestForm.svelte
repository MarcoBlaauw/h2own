<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';
  import { quickTestSchema, buildSubmission, formatHelperText, testParameterMetadata } from './quick-test-form-helpers.js';
  import type { QuickTestSchema } from './quick-test-form-helpers.js';

  export let poolId: string;

  let fc = '';
  let tc = '';
  let ph = '';
  let ta = '';
  let cya = '';
  let photoUrl = '';
  let error = '';
  let success = '';
  let isSubmitting = false;
  let fieldErrors: Partial<Record<keyof QuickTestSchema, string[]>> = {};

  const fieldErrorId = (field: keyof QuickTestSchema) => `quick-test-${field}-error`;
  const fieldHelperId = (field: keyof QuickTestSchema) => `quick-test-${field}-helper`;

  const formatFieldDescription = (field: keyof QuickTestSchema) =>
    [fieldHelperId(field), fieldMessages[field] ? fieldErrorId(field) : null].filter(Boolean).join(' ');

  $: fieldMessages = {
    fc: fieldErrors.fc?.[0] ?? '',
    tc: fieldErrors.tc?.[0] ?? '',
    ph: fieldErrors.ph?.[0] ?? '',
    ta: fieldErrors.ta?.[0] ?? '',
    cya: fieldErrors.cya?.[0] ?? ''
  };

  $: describedBy =
    [error ? 'quick-test-form-error' : null, success ? 'quick-test-form-success' : null]
      .filter(Boolean)
      .join(' ') || undefined;

  async function handleSubmit() {
    success = '';
    error = '';
    fieldErrors = {};

    const result = quickTestSchema.safeParse({ fc, tc, ph, ta, cya });
    if (!result.success) {
      const { fieldErrors: newFieldErrors, formErrors } = result.error.flatten(issue => issue.message);
      fieldErrors = { ...newFieldErrors };
      const fieldMessagesList = Object.values(newFieldErrors).flat().filter(Boolean);
      const messages = [...formErrors, ...fieldMessagesList].filter(Boolean);
      error = messages.length
        ? `Validation failed: ${messages.join('; ')}`
        : 'Validation failed. Please review the form values and try again.';
      return;
    }
    fieldErrors = {};

    isSubmitting = true;
    const { payload, skipped } = buildSubmission(result.data);
    try {
      let photoId: string | undefined;
      if (photoUrl.trim()) {
        const confirmRes = await api.photos.confirm({
          fileUrl: photoUrl.trim(),
          poolId,
        });
        if (!confirmRes.ok) {
          let message = 'Unable to attach photo. Please check the URL and try again.';
          try {
            const data = await confirmRes.json();
            if (typeof data?.error === 'string' && data.error.trim() !== '') {
              message = data.error;
            }
          } catch (parseError) {
            // Ignore JSON parsing errors.
          }
          error = message;
          return;
        }
        const photo = await confirmRes.json();
        photoId = photo?.photoId;
      }

      const res = await api.tests.create(poolId, { ...payload, ...(photoId ? { photoId } : {}) });
      if (res.ok) {
        success = skipped.length
          ? `Saved test results. No measurement recorded for ${skipped.join(', ')}.`
          : 'Test results saved successfully.';
        if (photoId) {
          success = `${success} Photo attached.`;
        }
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
    } catch (requestError) {
      error = 'Unable to save test results. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Card status={error ? 'danger' : success ? 'success' : 'default'}>
  <h2 class="text-lg font-semibold text-content-primary">Quick Test Update</h2>
  <form
    class="mt-5 form-grid"
    aria-describedby={describedBy}
    aria-busy={isSubmitting}
    on:submit|preventDefault={handleSubmit}
  >
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="fc">{testParameterMetadata.fc.label}</label>
      <input
        id="fc"
        type="number"
        min={testParameterMetadata.fc.acceptedMin}
        max={testParameterMetadata.fc.acceptedMax}
        bind:value={fc}
        class="form-control"
        data-invalid={fieldMessages.fc ? 'true' : undefined}
        aria-invalid={fieldMessages.fc ? 'true' : undefined}
        aria-describedby={formatFieldDescription('fc')}
        disabled={isSubmitting}
      >
      <p class="form-message" data-state="info" id={fieldHelperId('fc')}>
        {formatHelperText('fc')}
      </p>
      {#if fieldMessages.fc}
        <p class="form-message" data-state="error" id={fieldErrorId('fc')} role="alert">
          {fieldMessages.fc}
        </p>
      {/if}
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="tc">{testParameterMetadata.tc.label}</label>
      <input
        id="tc"
        type="number"
        min={testParameterMetadata.tc.acceptedMin}
        max={testParameterMetadata.tc.acceptedMax}
        bind:value={tc}
        class="form-control"
        data-invalid={fieldMessages.tc ? 'true' : undefined}
        aria-invalid={fieldMessages.tc ? 'true' : undefined}
        aria-describedby={formatFieldDescription('tc')}
        disabled={isSubmitting}
      >
      <p class="form-message" data-state="info" id={fieldHelperId('tc')}>
        {formatHelperText('tc')}
      </p>
      {#if fieldMessages.tc}
        <p class="form-message" data-state="error" id={fieldErrorId('tc')} role="alert">
          {fieldMessages.tc}
        </p>
      {/if}
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="ph">{testParameterMetadata.ph.label}</label>
      <input
        id="ph"
        type="number"
        min={testParameterMetadata.ph.acceptedMin}
        max={testParameterMetadata.ph.acceptedMax}
        step="0.1"
        bind:value={ph}
        class="form-control"
        data-invalid={fieldMessages.ph ? 'true' : undefined}
        aria-invalid={fieldMessages.ph ? 'true' : undefined}
        aria-describedby={formatFieldDescription('ph')}
        disabled={isSubmitting}
      >
      <p class="form-message" data-state="info" id={fieldHelperId('ph')}>
        {formatHelperText('ph')}
      </p>
      {#if fieldMessages.ph}
        <p class="form-message" data-state="error" id={fieldErrorId('ph')} role="alert">
          {fieldMessages.ph}
        </p>
      {/if}
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="ta">{testParameterMetadata.ta.label}</label>
      <input
        id="ta"
        type="number"
        min={testParameterMetadata.ta.acceptedMin}
        max={testParameterMetadata.ta.acceptedMax}
        bind:value={ta}
        class="form-control"
        data-invalid={fieldMessages.ta ? 'true' : undefined}
        aria-invalid={fieldMessages.ta ? 'true' : undefined}
        aria-describedby={formatFieldDescription('ta')}
        disabled={isSubmitting}
      >
      <p class="form-message" data-state="info" id={fieldHelperId('ta')}>
        {formatHelperText('ta')}
      </p>
      {#if fieldMessages.ta}
        <p class="form-message" data-state="error" id={fieldErrorId('ta')} role="alert">
          {fieldMessages.ta}
        </p>
      {/if}
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cya">{testParameterMetadata.cya.label}</label>
      <input
        id="cya"
        type="number"
        min={testParameterMetadata.cya.acceptedMin}
        max={testParameterMetadata.cya.acceptedMax}
        bind:value={cya}
        class="form-control"
        data-invalid={fieldMessages.cya ? 'true' : undefined}
        aria-invalid={fieldMessages.cya ? 'true' : undefined}
        aria-describedby={formatFieldDescription('cya')}
        disabled={isSubmitting}
      >
      <p class="form-message" data-state="info" id={fieldHelperId('cya')}>
        {formatHelperText('cya')}
      </p>
      {#if fieldMessages.cya}
        <p class="form-message" data-state="error" id={fieldErrorId('cya')} role="alert">
          {fieldMessages.cya}
        </p>
      {/if}
    </div>
    <div class="form-field sm:col-span-2">
      <label class="form-label" for="photo-url">Photo URL (optional)</label>
      <input
        id="photo-url"
        type="url"
        placeholder="https://example.com/pool-photo.jpg"
        bind:value={photoUrl}
        class="form-control"
        disabled={isSubmitting}
      >
      <p class="form-message" data-state="info">
        Attach a hosted photo URL to this test session.
      </p>
    </div>
    {#if error}
      <p
        class="form-message sm:col-span-2"
        data-state="error"
        role="alert"
        aria-live="polite"
        id="quick-test-form-error"
      >
        {error}
      </p>
    {/if}
    {#if success}
      <p
        class="form-message sm:col-span-2"
        data-state="success"
        role="status"
        aria-live="polite"
        id="quick-test-form-success"
      >
        {success}
      </p>
    {/if}
    <button
      type="submit"
      disabled={isSubmitting}
      class="sm:col-span-2 btn btn-base btn-primary"
    >
      {#if isSubmitting}
        Saving...
      {:else}
        Save
      {/if}
    </button>
  </form>
</Card>
