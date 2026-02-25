<script lang="ts">
  import { api } from '$lib/api';
  import { goto, invalidateAll } from '$app/navigation';
  import Card from '$lib/components/ui/Card.svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import Captcha from '$lib/components/Captcha.svelte';

  let email = '';
  let password = '';
  let error = '';
  let success = '';
  let warning = '';
  let captchaEnabled = false;
  let captchaProvider: 'turnstile' | 'hcaptcha' | null = null;
  let captchaSiteKey = '';
  let captchaToken = '';

  onMount(() => {
    if (!browser) {
      return;
    }

    const current = get(page);
    if (current.url.searchParams.has('registered')) {
      success = 'Account created successfully. You can sign in using your new password.';

      const clean = new URL(current.url);
      clean.searchParams.delete('registered');
      history.replaceState({}, '', `${clean.pathname}${clean.search}${clean.hash}`);
    }

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
    warning = '';
    if (captchaEnabled && !captchaToken) {
      error = 'Please complete the CAPTCHA challenge.';
      return;
    }
    try {
      const res = await api.auth.login({ email, password, captchaToken: captchaToken || undefined });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await invalidateAll();
        await goto('/overview', { invalidateAll: true });
      } else if (res.status === 423 && data?.lockout) {
        const search = new URLSearchParams({
          email,
          offense: String(data.lockout.offenseLevel ?? ''),
          until: String(data.lockout.until ?? ''),
          remaining: String(data.lockout.remainingSeconds ?? ''),
          support: data.lockout.supportRequired ? '1' : '0'
        });
        await goto(`/auth/lockout?${search.toString()}`, { replaceState: true });
      } else {
        error = data?.message ?? 'Unable to sign in.';
        warning = data?.warning ?? '';
      }
    } catch {
      error = 'Unable to reach the server. Please try again.';
    }
  }
</script>

<div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
  <div class="w-full max-w-md">
    <Card className="shadow-card" status={error ? 'danger' : success ? 'success' : 'default'}>
      <form class="space-y-6" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold text-content-primary">Sign in</h1>
          <p class="text-sm text-content-secondary">Access your H2Own dashboard</p>
        </div>
        <div class="form-field">
          <label class="form-label" for="email">Email</label>
          <input
            class="form-control"
            id="email"
            type="email"
            placeholder="Email"
            bind:value={email}
          >
        </div>
        <div class="form-field">
          <label class="form-label" for="password">Password</label>
          <input
            class="form-control"
            id="password"
            type="password"
            placeholder="••••••••"
            bind:value={password}
          >
        </div>
        <div class="flex flex-wrap gap-4 text-sm">
          <a class="font-medium text-accent hover:text-accent-strong" href="/auth/forgot-password">
            Forgot password?
          </a>
          <a class="font-medium text-accent hover:text-accent-strong" href="/auth/forgot-username">
            Forgot username?
          </a>
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
        {#if warning}
          <p class="form-message" data-state="default">{warning}</p>
        {/if}
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            class="btn btn-base btn-primary"
            type="submit"
          >
            Sign In
          </button>
          <a class="btn btn-base btn-secondary" href="/auth/register">Register</a>
        </div>
      </form>
    </Card>
  </div>
</div>
