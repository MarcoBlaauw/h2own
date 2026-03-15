<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  type UpcomingEvent = {
    id: string;
    title: string;
    dueLabel: string;
    detail: string;
    emphasis?: 'default' | 'warning' | 'info';
  };

  export let events: UpcomingEvent[] = [];
  export let poolName: string | null = null;
</script>

<Card>
  <div class="flex items-start justify-between gap-3">
    <div>
      <h2 class="text-lg font-semibold text-content-primary flex items-center gap-2"><Icon name="maintenance" size={20} tone="muted" /> Upcoming Maintenance</h2>
      <p class="text-sm text-content-secondary">
        Near-term pool tasks for {poolName ?? 'your active pool'} based on recent tests, weather, and recommendations.
      </p>
    </div>
  </div>

  {#if events.length === 0}
    <p class="mt-4 text-sm text-content-secondary">
      No upcoming items yet. Add a pool test to start building your maintenance timeline.
    </p>
  {:else}
    <div class="mt-4 space-y-3">
      {#each events as event}
        <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-content-primary">{event.title}</h3>
            <span class="rounded-full border border-border/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
              {event.dueLabel}
            </span>
          </div>
          <p class="mt-2 text-sm text-content-secondary">{event.detail}</p>
        </div>
      {/each}
    </div>
  {/if}
</Card>
