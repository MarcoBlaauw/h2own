<script lang="ts">
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Captcha from '$lib/components/Captcha.svelte';

  let email = '';
  let error = '';
  let success = '';
  let isSubmitting = false;
  let captchaEnabled = false;
  let captchaProvider: 'turnstile' | 'hcaptcha' | null = null;
  let captchaSiteKey = '';
  let captchaToken = '';

  onMount(() => {
    void loadCaptchaConfig();
  });

  async function loadCaptchaConfig() {
    try {
      const res = await api.auth.captchaConfig();
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      captchaEnabled = Boolean(payload?.enabled);
      captchaProvider =
        payload?.provider === 'turnstile' || payload?.provider === 'hcaptcha'
          ? payload.provider
          : null;
      captchaSiteKey = typeof payload?.siteKey === 'string' ? payload.siteKey : '';
    } catch {
      captchaEnabled = false;
    }
  }

  async function handleSubmit() {
    error = '';
    success = '';
    if (captchaEnabled && !captchaToken) {
      error = 'Please complete the CAPTCHA challenge.';
      return;
    }
    isSubmitting = true;

    try {
      const res = await api.auth.forgotUsername({
        email: email.trim(),
        captchaToken: captchaToken || undefined
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = payload?.message ?? 'Unable to submit username reminder request.';
        return;
      }

      success =
        payload?.message ??
        'If an account exists for that email, a username reminder email has been sent.';
    } catch {
      error = 'Unable to submit username reminder request.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
  <div class="w-full max-w-md">
    <Card className="shadow-card" status={error ? 'danger' : success ? 'success' : 'default'}>
      <form class="space-y-6" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold text-content-primary">Forgot username</h1>
          <p class="text-sm text-content-secondary">
            Enter your account email and we will send your sign-in username.
          </p>
        </div>
        <div class="form-field">
          <label class="form-label" for="email">Email</label>
          <input class="form-control" id="email" type="email" bind:value={email} placeholder="Email">
        </div>
        {#if captchaEnabled && captchaProvider && captchaSiteKey}
          <Captcha
            provider={captchaProvider}
            siteKey={captchaSiteKey}
            on:token={(event) => {
              captchaToken = event.detail ?? '';
            }}
          />
        {/if}
        {#if error}
          <p class="form-message" data-state="error">{error}</p>
        {/if}
        {#if success}
          <p class="form-message" data-state="success">{success}</p>
        {/if}
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button class="btn btn-base btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send username'}
          </button>
          <a class="btn btn-base btn-secondary" href="/auth/login">Back to login</a>
        </div>
      </form>
    </Card>
  </div>
</div>
