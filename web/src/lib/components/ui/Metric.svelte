<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let hint: string = '';
  export let trend: 'up' | 'down' | 'flat' = 'flat';
</script>

<div class="flex items-baseline justify-between">
  <div>
    <div class="text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
    <div class="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
    {#if hint}
      <div class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</div>
    {/if}
  </div>
  <div class="text-xs rounded-full px-2 py-1 font-medium
    {trend === 'up'   ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : ''}
    {trend === 'down' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : ''}
    {trend === 'flat' ? 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' : ''}">
    {trend}
  </div>
</div>
