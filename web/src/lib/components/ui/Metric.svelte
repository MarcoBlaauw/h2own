<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let hint: string = '';
  export let trend: 'up' | 'down' | 'flat' = 'flat';
</script>

<div class="flex items-start justify-between gap-4">
  <div>
    <div class="text-xs font-semibold uppercase tracking-wide text-surface-500/90 dark:text-surface-400/90">{label}</div>
    <div class="mt-1 text-3xl font-semibold tracking-tight text-surface-950 dark:text-surface-50">{value}</div>
    {#if hint}
      <div class="mt-1 text-xs text-surface-500/80 dark:text-surface-400/80">{hint}</div>
    {/if}
  </div>
  <span
    class={`rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide ${
      trend === 'up'
        ? 'preset-filled-success-500'
        : trend === 'down'
          ? 'preset-filled-error-500'
          : 'preset-filled-surface-200-800'
    }`}
    aria-live="polite"
  >
    {trend === 'flat' ? 'Stable' : trend === 'up' ? 'Rising' : 'Falling'}
  </span>
</div>
