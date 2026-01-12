<script>
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import Card from '$lib/components/ui/Card.svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';

  let email = '';
  let password = '';
  let error = '';
  let success = '';

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
  });

  async function handleSubmit() {
    error = '';
    success = '';
    const res = await api.auth.login({ email, password });
    if (res.ok) {
      await goto('/profile');
    } else {
      const data = await res.json();
      error = data.message;
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
        {#if error}
          <p class="form-message" data-state="error">{error}</p>
        {/if}
        {#if success}
          <p class="form-message" data-state="success">{success}</p>
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
