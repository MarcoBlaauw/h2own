<script lang="ts">
  import { page } from '$app/stores';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { auth } from '$lib/api';
  import { goto } from '$app/navigation';
  import { toolCategories } from '$lib/data/tools';

  async function handleLogout() {
    await auth.logout();
    await goto('/auth/login');
  }

  let mobileMenuOpen = false;

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
</script>

<header
  class="sticky top-0 z-40 border-b border-surface-200/70 bg-surface-50/80 backdrop-blur supports-[backdrop-filter]:bg-surface-50/60 dark:border-surface-700/60 dark:bg-surface-950/80"
>
  <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
    <a href="/" class="flex items-center gap-3">
      <div class="size-8 rounded-xl preset-filled-primary-500 shadow-card"></div>
      <span class="text-lg font-semibold tracking-tight text-surface-900 dark:text-surface-50">H2Own</span>
    </a>

    <nav
      class="hidden flex-1 items-center justify-center gap-6 text-sm font-medium text-surface-600 dark:text-surface-300 md:flex"
      aria-label="Primary"
    >
      {#each toolCategories as category}
        <div class="group relative">
          <a
            href={`/tools/${category.slug}`}
            class="flex items-center gap-1 transition hover:text-primary-600 focus:outline-none focus-visible:text-primary-600 dark:hover:text-primary-300 dark:focus-visible:text-primary-300"
            aria-haspopup="true"
          >
            <span>{category.title}</span>
            <span
              aria-hidden="true"
              class="text-xs text-surface-400 transition group-hover:text-primary-500 group-focus-within:text-primary-500 dark:text-surface-500 dark:group-hover:text-primary-300 dark:group-focus-within:text-primary-300"
            >
              ▾
            </span>
          </a>
          <div
            class="pointer-events-none absolute left-1/2 top-full z-30 hidden w-72 -translate-x-1/2 translate-y-3 flex-col gap-3 rounded-2xl border border-surface-200/70 bg-surface-50 p-4 text-left shadow-xl transition group-hover:pointer-events-auto group-hover:flex group-focus-within:pointer-events-auto group-focus-within:flex dark:border-surface-700/60 dark:bg-surface-900"
          >
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-surface-500/80 dark:text-surface-400">
                {category.title}
              </p>
              {#if category.description}
                <p class="mt-1 text-xs text-surface-500 dark:text-surface-400">{category.description}</p>
              {/if}
            </div>
            <div class="flex flex-col gap-2">
              {#each category.links as link}
                <a
                  href={link.href}
                  class="rounded-xl border border-transparent px-3 py-2 text-sm text-surface-600 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:border-primary-300 focus-visible:bg-primary-100/60 focus-visible:text-primary-700 dark:text-surface-200 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10 dark:hover:text-primary-200 dark:focus-visible:border-primary-500/40 dark:focus-visible:bg-primary-500/20 dark:focus-visible:text-primary-100"
                >
                  <div class="flex items-center justify-between gap-3">
                    <span class="font-semibold text-surface-900 dark:text-surface-100">{link.title}</span>
                    {#if link.badge}
                      <span class="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-500/20 dark:text-primary-200">
                        {link.badge}
                      </span>
                    {/if}
                  </div>
                  {#if link.description}
                    <p class="mt-1 text-xs text-surface-500 dark:text-surface-400">{link.description}</p>
                  {/if}
                </a>
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </nav>

    <div class="ml-auto flex items-center gap-3 text-sm text-surface-600 dark:text-surface-300">
      <button
        class="rounded-md border border-surface-200/70 px-3 py-1 text-sm font-medium transition hover:border-primary-300 hover:text-primary-600 focus:outline-none focus-visible:border-primary-300 focus-visible:text-primary-600 dark:border-surface-700/60 dark:hover:border-primary-500/40 dark:hover:text-primary-200 dark:focus-visible:border-primary-500/40 dark:focus-visible:text-primary-200 md:hidden"
        on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-nav"
      >
        {mobileMenuOpen ? 'Close' : 'Menu'}
      </button>
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
  {#if mobileMenuOpen}
    <div
      id="mobile-nav"
      class="border-t border-surface-200/70 bg-surface-50 py-4 shadow-inner dark:border-surface-700/60 dark:bg-surface-950 md:hidden"
    >
      <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
        {#each toolCategories as category}
          <div class="space-y-2">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-surface-500/80 dark:text-surface-400">
                {category.title}
              </p>
              {#if category.description}
                <p class="text-sm text-surface-500 dark:text-surface-400">{category.description}</p>
              {/if}
            </div>
            <div class="space-y-2">
              {#each category.links as link}
                <a
                  href={link.href}
                  class="block rounded-lg border border-surface-200/70 px-3 py-2 text-sm font-medium text-surface-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:border-primary-300 focus-visible:bg-primary-100/60 focus-visible:text-primary-700 dark:border-surface-700/60 dark:text-surface-200 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10 dark:hover:text-primary-200 dark:focus-visible:border-primary-500/40 dark:focus-visible:bg-primary-500/20 dark:focus-visible:text-primary-100"
                  on:click={closeMobileMenu}
                >
                  <div class="flex items-center justify-between gap-3">
                    <span>{link.title}</span>
                    {#if link.badge}
                      <span class="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-500/20 dark:text-primary-200">
                        {link.badge}
                      </span>
                    {/if}
                  </div>
                  {#if link.description}
                    <p class="mt-1 text-xs text-surface-500 dark:text-surface-400">{link.description}</p>
                  {/if}
                </a>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</header>
