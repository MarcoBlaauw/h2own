<script lang="ts">
  import type { ToolCategory } from '$lib/data/tools';

  export let categories: ToolCategory[] = [];

  function mapLink(category: ToolCategory, link: ToolCategory['links'][number]) {
    return {
      ...link,
      category: category.title,
    };
  }

  type QuickAction = ReturnType<typeof mapLink>;
  let quickActions: QuickAction[] = [];

  $: quickActions = categories.flatMap((category) => category.links.map((link) => mapLink(category, link)));
</script>

{#if quickActions.length > 0}
  <section class="mt-6 rounded-2xl border border-surface-200/70 bg-surface-0/40 p-6 shadow-card dark:border-surface-700/60 dark:bg-surface-900/60">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50">Quick actions</h2>
        <p class="text-sm text-surface-500 dark:text-surface-400">
          Jump straight into any tool — including the latest DNS health checks.
        </p>
      </div>
      <a
        href="/tools"
        class="inline-flex items-center gap-2 rounded-full border border-surface-200/70 px-3 py-1 text-sm font-medium text-surface-600 transition hover:border-primary-300 hover:text-primary-600 focus:outline-none focus-visible:border-primary-300 focus-visible:text-primary-600 dark:border-surface-700/60 dark:text-surface-200 dark:hover:border-primary-500/40 dark:hover:text-primary-200 dark:focus-visible:border-primary-500/40 dark:focus-visible:text-primary-200"
      >
        View all tools
        <span aria-hidden="true">→</span>
      </a>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each quickActions as action (action.slug)}
        <a
          href={action.href}
          class="group relative flex flex-col gap-2 rounded-2xl border border-surface-200/70 bg-surface-50/60 p-4 text-left transition hover:border-primary-300 hover:bg-primary-50/70 focus:outline-none focus-visible:border-primary-300 focus-visible:bg-primary-100/60 dark:border-surface-700/60 dark:bg-surface-900/70 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10 dark:focus-visible:border-primary-500/40 dark:focus-visible:bg-primary-500/20"
        >
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
            <span>{action.category}</span>
            {#if action.badge}
              <span class="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary-700 dark:bg-primary-500/20 dark:text-primary-100">
                {action.badge}
              </span>
            {/if}
          </div>
          <div class="text-base font-semibold text-surface-900 transition group-hover:text-primary-700 dark:text-surface-50 dark:group-hover:text-primary-100">
            {action.title}
          </div>
          {#if action.description}
            <p class="text-sm text-surface-500 dark:text-surface-300">{action.description}</p>
          {/if}
        </a>
      {/each}
    </div>
  </section>
{/if}
