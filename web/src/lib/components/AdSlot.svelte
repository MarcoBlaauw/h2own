<script lang="ts">
  export let enabled = false;
  export let label = 'Sponsored';
  export let placement = 'dashboard';
</script>

{#if enabled}
  <aside class="rounded-2xl border border-border/60 bg-surface-subtle p-4 shadow-sm" aria-label={`${label} content`}>
    <div class="flex items-center justify-between gap-2">
      <span class="text-[11px] font-semibold uppercase tracking-wide text-content-secondary">{label}</span>
      <span class="text-[11px] text-content-secondary/80">{placement}</span>
    </div>
    <div class="mt-3 rounded-lg border border-dashed border-border/70 bg-surface px-4 py-6 text-sm text-content-secondary">
      Ad slot reserved for non-paying subscribers.
    </div>
  </aside>
{/if}
