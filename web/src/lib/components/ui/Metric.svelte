<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let hint: string = '';
  export let trend: 'up' | 'down' | 'flat' = 'flat';

  let status: 'success' | 'danger' | 'neutral' = 'neutral';
  let trendLabel = 'Stable';

  $: status = trend === 'up' ? 'success' : trend === 'down' ? 'danger' : 'neutral';
  $: trendLabel = trend === 'flat' ? 'Stable' : trend === 'up' ? 'Rising' : 'Falling';
</script>

<div class="flex items-start justify-between gap-4">
  <div>
    <div class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80 dark:text-content-secondary">{label}</div>
    <div class="mt-1 text-3xl font-semibold tracking-tight text-content-primary dark:text-content-primary">{value}</div>
    {#if hint}
      <div class="mt-1 text-xs text-content-secondary/70">{hint}</div>
    {/if}
  </div>
  <span class="status-chip" data-status={status} aria-live="polite">
    <span class="status-chip__indicator" aria-hidden="true"></span>
    {trendLabel}
  </span>
</div>
