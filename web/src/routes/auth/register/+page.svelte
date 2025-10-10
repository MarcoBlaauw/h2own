<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import Card from '$lib/components/ui/Card.svelte';

  let name = '';
  let email = '';
  let password = '';
  let error = '';

  async function handleSubmit() {
    const res = await api.auth.register({ name, email, password });
    if (res.ok) {
      await goto('/auth/login');
    } else {
      const data = await res.json();
      error = data.message;
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
          <a
            class="text-sm font-medium text-accent hover:text-accent-strong"
            href="/auth/login"
          >
            Login
          </a>
        </div>
      </form>
    </Card>
  </div>
</div>
