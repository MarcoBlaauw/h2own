<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { api } from '$lib/api';
  import { goto, invalidateAll } from '$app/navigation';

  let isAuthenticated = false;
  let greetingName = 'there';
  let avatarInitial = 'U';
  let notificationsUnreadCount = 0;
  let userMenuEl: HTMLDetailsElement | null = null;
  let lastPathname = '';
  let lastNotificationsFetchKey = '';

  const userLinks = [
    { href: '/pools', label: 'My Pools' },
    { href: '/overview', label: 'Pool Overview' },
    { href: '/inventory', label: 'Inventory' },
  ];

  function isActive(href: string) {
    const path = $page.url.pathname;
    return path === href || path.startsWith(`${href}/`);
  }

  function closeUserMenu() {
    if (userMenuEl?.open) {
      userMenuEl.open = false;
    }
  }

  function handleMenuSelection() {
    closeUserMenu();
  }

  async function handleLogout() {
    closeUserMenu();
    await api.auth.logout();
    await invalidateAll();
    await goto('/auth/login', { invalidateAll: true });
  }

  async function refreshNotificationsSummary() {
    if (!isAuthenticated || !browser) {
      notificationsUnreadCount = 0;
      return;
    }

    try {
      const res = await api.notifications.summary();
      if (!res.ok) return;
      const body = (await res.json()) as { unreadCount?: number };
      notificationsUnreadCount = Number(body.unreadCount ?? 0);
    } catch {
      // Ignore background summary fetch failures.
    }
  }

  const deriveGreetingName = (session: any) => {
    const nickname = session?.user?.nickname;
    if (typeof nickname === 'string' && nickname.trim()) {
      return nickname.trim();
    }

    const firstName = session?.user?.firstName;
    if (typeof firstName === 'string' && firstName.trim()) {
      return firstName.trim();
    }

    const rawName = session?.user?.name;
    if (typeof rawName === 'string' && rawName.trim()) {
      return rawName.trim().split(/\s+/)[0] ?? 'there';
    }

    const email = session?.user?.email;
    if (typeof email === 'string' && email.includes('@')) {
      return email.split('@')[0] || 'there';
    }

    return 'there';
  };

  const isAdminPanelRole = (role: string | null | undefined) => {
    return role === 'admin' || role === 'business';
  };

  $: isAuthenticated = Boolean($page.data.session?.user);
  $: greetingName = deriveGreetingName($page.data.session);
  $: avatarInitial = greetingName.charAt(0).toUpperCase() || 'U';
  $: {
    const pathname = $page.url.pathname;
    if (pathname !== lastPathname) {
      lastPathname = pathname;
      closeUserMenu();
    }
  }
  $: {
    const key = `${isAuthenticated ? 'auth' : 'guest'}:${$page.url.pathname}:${$page.url.search}`;
    if (key !== lastNotificationsFetchKey) {
      lastNotificationsFetchKey = key;
      if (browser) {
        void refreshNotificationsSummary();
      }
    }
  }
  $: if (browser && !isAuthenticated) {
    document.documentElement.classList.remove('dark');
    try {
      localStorage.setItem('theme', 'light');
    } catch {
      // Ignore storage write failures; we still enforce light theme for guests.
    }
  }

  onMount(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!userMenuEl?.open) return;
      const target = event.target as Node | null;
      if (target && !userMenuEl.contains(target)) {
        closeUserMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeUserMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<header class="sticky top-0 z-40 border-b border-border/60 bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75 dark:border-border-strong/60">
  <div class="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-start">
      <a href={isAuthenticated ? '/overview' : '/'} class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-xl bg-accent shadow-card"></div>
        <span class="text-lg font-semibold tracking-tight text-content-primary dark:text-content-primary">H2Own</span>
      </a>
    </div>
    <div class="hidden items-center justify-center sm:flex">
      {#if isAuthenticated}
        <nav class="flex items-center gap-4 text-sm font-medium text-content-secondary">
          {#each userLinks as link}
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
    </div>
    <div class="flex items-center justify-end gap-3 text-sm text-content-secondary">
      {#if isAuthenticated}
        <div class="flex gap-2 sm:hidden">
          {#each userLinks as link}
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
      {#if isAuthenticated}
        <a href="/notifications" class="relative btn btn-icon-base btn-tonal" aria-label="Notifications">
          <span aria-hidden="true">🔔</span>
          {#if notificationsUnreadCount > 0}
            <span
              class="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
              aria-label={`${notificationsUnreadCount} unread notifications`}
            >
              {notificationsUnreadCount > 99 ? '99+' : notificationsUnreadCount}
            </span>
          {/if}
        </a>
        <details class="relative" bind:this={userMenuEl}>
          <summary class="btn btn-icon-base btn-tonal cursor-pointer list-none" aria-label="Open user menu">
            <span aria-hidden="true">☰</span>
          </summary>
          <div
            class="absolute right-0 mt-2 w-72 rounded-xl border border-border p-3 shadow-card"
            style="background-color: rgb(var(--color-bg-raised)); opacity: 1;"
          >
            <div class="space-y-2 text-sm text-center">
              <div class="flex items-center justify-center gap-3 rounded-lg bg-surface-strong/20 px-3 py-2">
                <div class="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-contrast">
                  {avatarInitial}
                </div>
                <div class="font-medium text-content-primary">User avatar</div>
              </div>
              <div class="rounded-lg bg-surface-strong/20 px-3 py-2 text-content-primary text-center">
                Hi {greetingName}!
              </div>
              <a
                href="/profile"
                class="block rounded-lg px-3 py-2 text-content-secondary hover:bg-surface-strong/30 hover:text-content-primary text-center"
                on:click={handleMenuSelection}
              >
                Profile
              </a>
              <a
                href="/preferences"
                class="block rounded-lg px-3 py-2 text-content-secondary hover:bg-surface-strong/30 hover:text-content-primary text-center"
                on:click={handleMenuSelection}
              >
                Preferences
              </a>
              <a
                href="/security"
                class="block rounded-lg px-3 py-2 text-content-secondary hover:bg-surface-strong/30 hover:text-content-primary text-center"
                on:click={handleMenuSelection}
              >
                Security
              </a>
              <a
                href="/messages"
                class="block rounded-lg px-3 py-2 text-content-secondary hover:bg-surface-strong/30 hover:text-content-primary text-center"
                on:click={handleMenuSelection}
              >
                Messages
              </a>
              <a
                href="/billing"
                class="block rounded-lg px-3 py-2 text-content-secondary hover:bg-surface-strong/30 hover:text-content-primary text-center"
                on:click={handleMenuSelection}
              >
                Billing
              </a>
              <a
                href="/integrations"
                class="block rounded-lg px-3 py-2 text-content-secondary hover:bg-surface-strong/30 hover:text-content-primary text-center"
                on:click={handleMenuSelection}
              >
                Integrations
              </a>
              {#if isAdminPanelRole($page.data.session?.user?.role)}
                <a
                  href="/admin"
                  class="block rounded-lg px-3 py-2 text-content-secondary hover:bg-surface-strong/30 hover:text-content-primary text-center"
                  on:click={handleMenuSelection}
                >
                  Admin panel
                </a>
              {/if}
              <div class="flex items-center justify-center gap-3 rounded-lg px-3 py-2">
                <span class="text-content-secondary">Theme switcher</span>
                <ThemeSwitcher />
              </div>
              <button on:click={handleLogout} class="btn btn-sm btn-primary w-full">
                Logout
              </button>
            </div>
          </div>
        </details>
      {:else}
        <a href="/auth/login" class="btn btn-sm btn-secondary">Login</a>
        <a href="/auth/register" class="btn btn-sm btn-primary">Register</a>
      {/if}
    </div>
  </div>
</header>
