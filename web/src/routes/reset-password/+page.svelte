<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Captcha from '$lib/components/Captcha.svelte';

  let token = '';
  let password = '';
  let confirmPassword = '';
  let error = '';
  let success = '';
  let isSubmitting = false;
  let captchaEnabled = false;
  let captchaProvider: 'turnstile' | 'hcaptcha' | null = null;
  let captchaSiteKey = '';
  let captchaToken = '';

  $: token = $page.url.searchParams.get('token') ?? '';

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

  const parseError = async (res: Response) => {
    const contentType = res.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.details) && payload.details.length > 0) {
        const first = payload.details[0];
        if (typeof first?.message === 'string' && first.message.trim()) {
          return first.message;
        }
      }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    } else {
      const text = await res.text().catch(() => '');
      if (text.trim()) {
        return `Unable to reset password (HTTP ${res.status}).`;
      }
    }

    return `Unable to reset password (HTTP ${res.status}).`;
  };

  async function handleSubmit() {
    error = '';
    success = '';

    if (!token) {
      error = 'Reset token is missing from the URL.';
      return;
    }

    if (password.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }

    if (password !== confirmPassword) {
      error = 'Passwords do not match.';
      return;
    }
    if (captchaEnabled && !captchaToken) {
      error = 'Please complete the CAPTCHA challenge.';
      return;
    }

    isSubmitting = true;
    try {
      const res = await api.auth.resetPassword({
        token,
        password,
        captchaToken: captchaToken || undefined
      });

      if (!res.ok) {
        error = await parseError(res);
        return;
      }

      const payload = await res.json().catch(() => ({}));
      success = payload?.message ?? 'Password has been reset.';
      password = '';
      confirmPassword = '';
    } catch (requestError) {
      error =
        requestError instanceof Error
          ? `Unable to reach the server. ${requestError.message}`
          : 'Unable to reach the server.';
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
          <h1 class="text-2xl font-semibold text-content-primary">Choose a new password</h1>
          <p class="text-sm text-content-secondary">
            Set a new password for your account.
          </p>
          <ul class="list-disc space-y-1 pl-5 text-xs text-content-secondary">
            <li>Password must be at least 8 characters.</li>
          </ul>
        </div>
        <div class="form-field">
          <label class="form-label" for="password">New password</label>
          <input
            class="form-control"
            id="password"
            type="password"
            autocomplete="new-password"
            bind:value={password}
            placeholder="••••••••"
          >
        </div>
        <div class="form-field">
          <label class="form-label" for="confirmPassword">Confirm password</label>
          <input
            class="form-control"
            id="confirmPassword"
            type="password"
            autocomplete="new-password"
            bind:value={confirmPassword}
            placeholder="••••••••"
          >
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
            {isSubmitting ? 'Resetting...' : 'Reset password'}
          </button>
          <a class="btn btn-base btn-secondary" href="/auth/login">Back to login</a>
        </div>
      </form>
    </Card>
  </div>
</div>
