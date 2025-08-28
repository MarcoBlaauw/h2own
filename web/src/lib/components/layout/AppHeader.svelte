<script lang="ts">
  import { page } from '$app/stores';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { auth } from '$lib/api';
  import { goto } from '$app/navigation';

  async function handleLogout() {
    await auth.logout();
    await goto('/auth/login');
  }
</script>

<header class="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-neutral-950/80">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
    <a href="/" class="flex items-center gap-3">
      <div class="size-7 rounded-lg bg-brand-600"></div>
      <span class="font-semibold">H2Own</span>
    </a>
    <div class="flex items-center space-x-4">
      <ThemeSwitcher />
      {#if $page.data.session}
        <span>Hi, {$page.data.session.user.email}</span>
        <button on:click={handleLogout} class="text-gray-600 dark:text-gray-300 hover:text-brand-600">Logout</button>
      {:else}
        <a href="/auth/login" class="text-gray-600 dark:text-gray-300 hover:text-brand-600">Login</a>
        <a href="/auth/register" class="text-gray-600 dark:text-gray-300 hover:text-brand-600">Register</a>
      {/if}
    </div>
  </div>
</header>
