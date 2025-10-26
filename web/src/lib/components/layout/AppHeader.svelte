<script lang="ts">
  import { page } from '$app/stores';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let isAdmin = false;

  const marketingLinks = [
    { href: '/#smart', label: 'Smart' },
    { href: '/#how-we-do', label: 'How We Do Things' },
    { href: '/#who-we-are', label: 'Who We Are' },
    { href: '/#contact', label: 'Contact' },
  ];

  const adminLinks = [
    { href: '/admin/pools', label: 'Pools' },
    { href: '/admin/chemicals', label: 'Chemicals' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/api-tokens', label: 'API tokens' },
    { href: '/admin/audit-log', label: 'Audit log' },
  ];

  function isActive(href: string) {
    const path = $page.url.pathname;
    return path === href || path.startsWith(`${href}/`);
  }

  async function handleLogout() {
    await api.auth.logout();
    await goto('/auth/login');
  }

  $: isAdmin = $page.data.session?.user?.role === 'admin';
</script>

<header class="sticky top-0 z-40 border-b border-border/60 bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75 dark:border-border-strong/60">
  <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <div class="flex items-center gap-6">
      <a href="/" class="flex items-center gap-3">
        <img
          src="https://www.compliancetechnologygroup.com/wp-content/uploads/2015/11/index.png"
          alt="Compliance Technology Group logo"
          class="h-10 w-auto"
          loading="lazy"
          decoding="async"
        />
        <span class="hidden text-lg font-semibold tracking-tight text-content-primary dark:text-content-primary sm:inline">
          Compliance Technology Group
        </span>
      </a>
      {#if $page.data.session}
        {#if isAdmin}
          <nav class="hidden items-center gap-4 text-sm font-medium text-content-secondary sm:flex">
            {#each adminLinks as link}
              <a
                href={link.href}
                class={`transition-colors ${
                  isActive(link.href)
                    ? 'text-accent-strong dark:text-accent-strong'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                {link.label}
              </a>
            {/each}
          </nav>
        {/if}
      {:else}
        <nav class="hidden items-center gap-6 text-sm font-medium text-content-secondary sm:flex">
          {#each marketingLinks as link}
            <a href={link.href} class="transition-colors hover:text-content-primary">{link.label}</a>
          {/each}
        </nav>
      {/if}
    </div>
    <div class="flex items-center gap-3 text-sm text-content-secondary">
      {#if $page.data.session}
        {#if isAdmin}
          <div class="flex gap-2 sm:hidden">
            {#each adminLinks as link}
              <a
                href={link.href}
                class={`btn btn-sm btn-tonal ${
                  isActive(link.href) ? 'font-semibold text-accent-strong' : ''
                }`}
              >
                {link.label}
              </a>
            {/each}
          </div>
        {/if}
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
