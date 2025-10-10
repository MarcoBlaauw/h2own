<script lang="ts">
  import { page } from '$app/stores';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let isAdmin = false;
  let adminChemicalsActive = false;

  async function handleLogout() {
    await api.auth.logout();
    await goto('/auth/login');
  }

  $: isAdmin = $page.data.session?.user?.role === 'admin';
  $: adminChemicalsActive = $page.url.pathname.startsWith('/admin/chemicals');
</script>

<header
  class="sticky top-0 z-40 border-b border-surface-200/70 bg-surface-50/80 backdrop-blur supports-[backdrop-filter]:bg-surface-50/60 dark:border-surface-700/60 dark:bg-surface-950/80"
>
  <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <div class="flex items-center gap-6">
      <a href="/" class="flex items-center gap-3">
        <div class="size-8 rounded-xl preset-filled-primary-500 shadow-card"></div>
        <span class="text-lg font-semibold tracking-tight text-surface-900 dark:text-surface-50">H2Own</span>
      </a>
      {#if isAdmin}
        <nav class="hidden items-center gap-4 text-sm font-medium text-surface-600 dark:text-surface-300 sm:flex">
          <a
            href="/admin/chemicals"
            class={`transition-colors hover:text-primary-600 dark:hover:text-primary-300 ${
              adminChemicalsActive ? 'text-primary-600 dark:text-primary-300' : ''
            }`}
          >
            Chemicals
          </a>
        </nav>
      {/if}
    </div>
    <div class="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-300">
      {#if isAdmin}
        <a
          href="/admin/chemicals"
          class={`sm:hidden btn btn-sm preset-tonal-primary-500 ${
            adminChemicalsActive ? 'font-semibold' : ''
          }`}
        >
          Chemicals
        </a>
      {/if}
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
