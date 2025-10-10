<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  export let pool;

  const displayVolume = (value) => (typeof value === 'number' ? value.toLocaleString() : '—');
  const displayText = (value) => value ?? '—';
  const displayOwner = (owner) => owner?.email ?? 'Unknown';
  const displayLastTested = (value) => {
    if (!value) return 'Never';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return 'Never';
    return date.toLocaleDateString();
  };
</script>

<Card>
  <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50">Pool Summary</h2>
  <dl class="mt-4 grid gap-3 text-sm">
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Owner</dt>
      <dd class="text-right font-medium text-surface-900 dark:text-surface-50">{displayOwner(pool?.owner)}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Volume</dt>
      <dd class="text-right text-surface-600 dark:text-surface-200">{displayVolume(pool?.volumeGallons)} gallons</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Surface</dt>
      <dd class="text-right text-surface-600 dark:text-surface-200">{displayText(pool?.surfaceType)}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Sanitizer</dt>
      <dd class="text-right text-surface-600 dark:text-surface-200">{displayText(pool?.sanitizerType)}</dd>
    </div>
    <div class="flex items-center justify-between gap-3">
      <dt class="text-xs font-semibold uppercase tracking-wide text-surface-500/80">Last tested</dt>
      <dd class="text-right text-surface-600 dark:text-surface-200">{displayLastTested(pool?.lastTestedAt)}</dd>
    </div>
  </dl>
</Card>
