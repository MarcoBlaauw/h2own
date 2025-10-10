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
          <h1 class="text-2xl font-semibold text-content-primary">Sign in</h1>
          <p class="text-sm text-content-secondary">Access your H2Own dashboard</p>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-content-secondary" for="email">Email</label>
          <input
            class="input"
            id="email"
            type="email"
            placeholder="Email"
            bind:value={email}
          >
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-content-secondary" for="password">Password</label>
          <input
            class="input"
            id="password"
            type="password"
            placeholder="••••••••"
            bind:value={password}
          >
        </div>
        {#if error}
          <p class="text-sm font-medium text-danger">{error}</p>
        {/if}
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            class="btn btn-base btn-primary"
            type="submit"
          >
            Sign In
          </button>
          <a
            class="text-sm font-medium text-accent hover:text-accent-strong"
            href="/auth/register"
          >
            Register
          </a>
        </div>
      </form>
    </Card>
  </div>
</div>
