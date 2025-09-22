<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  export let pool;
</script>

<Card>
  <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50">Pool Summary</h2>
  <dl class="mt-4 grid gap-3 text-sm">
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Owner</dt>
      <dd class="text-right font-medium text-surface-900 dark:text-surface-50">{pool.owner.email}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Volume</dt>
      <dd class="text-right text-surface-600 dark:text-surface-200">{pool.volume} gallons</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Surface</dt>
      <dd class="text-right text-surface-600 dark:text-surface-200">{pool.surface}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Sanitizer</dt>
      <dd class="text-right text-surface-600 dark:text-surface-200">{pool.sanitizer}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Last tested</dt>
      <dd class="text-right text-surface-600 dark:text-surface-200">{new Date(pool.lastTestedAt).toLocaleDateString()}</dd>
    </div>
  </dl>
</Card>
