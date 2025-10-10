<script lang="ts">
  import { page } from '$app/stores';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  async function handleLogout() {
    await api.auth.logout();
    await goto('/auth/login');
  }
</script>

<header
  class="sticky top-0 z-40 border-b border-surface-200/70 bg-surface-50/80 backdrop-blur supports-[backdrop-filter]:bg-surface-50/60 dark:border-surface-700/60 dark:bg-surface-950/80"
>
  <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <a href="/" class="flex items-center gap-3">
      <div class="size-8 rounded-xl preset-filled-primary-500 shadow-card"></div>
      <span class="text-lg font-semibold tracking-tight text-surface-900 dark:text-surface-50">H2Own</span>
    </a>
    <div class="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-300">
      <ThemeSwitcher />
      {#if $page.data.session}
        <span class="hidden sm:inline-block">Hi, {$page.data.session.user.email}</span>
        <button
          on:click={handleLogout}
          class="btn btn-sm preset-filled-primary-500 shadow-card hover:brightness-110 dark:hover:brightness-95"
        >
          Logout
        </button>
      {:else}
        <a href="/auth/login" class="btn btn-sm preset-filled-surface-200-800 hover:brightness-110">Login</a>
        <a href="/auth/register" class="btn btn-sm preset-filled-primary-500 shadow-card hover:brightness-110">Register</a>
      {/if}
    </div>
  </div>
</header>
