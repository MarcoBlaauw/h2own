<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Captcha from '$lib/components/Captcha.svelte';

  let name = '';
  let email = '';
  let password = '';
  let error = '';
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
    if (captchaEnabled && !captchaToken) {
      error = 'Please complete the CAPTCHA challenge.';
      return;
    }
    try {
      const res = await api.auth.register({
        name,
        email,
        password,
        captchaToken: captchaToken || undefined
      });
      if (res.ok) {
        await goto('/auth/login?registered=1', { replaceState: true });
      } else {
        const data = await res.json();
        error = data.message;
      }
    } catch {
      error = 'Unable to reach the server. Please try again.';
    }
  }
</script>

<div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
  <div class="w-full max-w-md">
    <Card className="shadow-card" status={error ? 'danger' : 'default'}>
      <form class="space-y-6" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold text-content-primary">Create your account</h1>
          <p class="text-sm text-content-secondary">Join H2Own to manage your pools</p>
        </div>
        <div class="form-field">
          <label class="form-label" for="name">Name</label>
          <input
            class="form-control"
            id="name"
            type="text"
            placeholder="Name"
            bind:value={name}
          >
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
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            class="btn btn-base btn-primary"
            type="submit"
          >
            Register
          </button>
          <a class="btn btn-base btn-secondary" href="/auth/login">Login</a>
        </div>
      </form>
    </Card>
  </div>
</div>
