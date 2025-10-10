<script>
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { env } from '$env/dynamic/public';
  import Footer from '$lib/components/layout/Footer.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  let email = '';
  let password = '';
  let error = '';

  async function handleSubmit() {
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
    <Card className="shadow-card">
      <form class="space-y-6" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold text-surface-900 dark:text-surface-50">Sign in</h1>
          <p class="text-sm text-surface-600 dark:text-surface-300">Access your H2Own dashboard</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-200" for="email">Email</label>
          <input
            class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:ring-surface-700/60 dark:focus:ring-primary-300"
            id="email"
            type="email"
            placeholder="Email"
            bind:value={email}
          >
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-200" for="password">Password</label>
          <input
            class="input preset-filled-surface-50-950 ring-1 ring-surface-200/70 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:ring-surface-700/60 dark:focus:ring-primary-300"
            id="password"
            type="password"
            placeholder="••••••••"
            bind:value={password}
          >
        </div>
        {#if error}
          <p class="text-sm font-medium text-error-600 dark:text-error-400">{error}</p>
        {/if}
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            class="btn btn-base preset-filled-primary-500 shadow-card hover:brightness-110 dark:hover:brightness-95"
            type="submit"
          >
            Sign In
          </button>
          <a
            class="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-300 dark:hover:text-primary-200"
            href="/auth/register"
          >
            Register
          </a>
        </div>
      </form>
    </Card>
  </div>
</div>
