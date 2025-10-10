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

<header class="sticky top-0 z-40 border-b border-border/60 bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75 dark:border-border-strong/60">
  <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <div class="flex items-center gap-6">
      <a href="/" class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-xl bg-accent shadow-card"></div>
        <span class="text-lg font-semibold tracking-tight text-content-primary dark:text-content-primary">H2Own</span>
      </a>
      {#if isAdmin}
        <nav class="hidden items-center gap-4 text-sm font-medium text-content-secondary sm:flex">
          <a
            href="/admin/chemicals"
            class={`transition-colors ${
              adminChemicalsActive
                ? 'text-accent-strong dark:text-accent-strong'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Chemicals
          </a>
        </nav>
      {/if}
    </div>
    <div class="flex items-center gap-3 text-sm text-content-secondary">
      {#if isAdmin}
        <a
          href="/admin/chemicals"
          class={`sm:hidden btn btn-sm btn-tonal ${adminChemicalsActive ? 'font-semibold text-accent-strong' : ''}`}
        >
          Chemicals
        </a>
      {/if}
      <ThemeSwitcher />
      {#if $page.data.session}
        <span class="hidden sm:inline-block">Hi, {$page.data.session.user.email}</span>
        <button on:click={handleLogout} class="btn btn-sm btn-primary">
          Logout
        </button>
      {:else}
        <a href="/auth/login" class="btn btn-sm btn-secondary">Login</a>
        <a href="/auth/register" class="btn btn-sm btn-primary">Register</a>
      {/if}
    </div>
  </div>
</header>
