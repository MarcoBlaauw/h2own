<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
</script>

<Card>
  <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50">Recommendations</h2>
  <div class="mt-4 space-y-3">
    <div class="flex items-center justify-between gap-4 rounded-xl border border-surface-200/70 bg-surface-50/85 px-4 py-3 dark:border-surface-700/60 dark:bg-surface-900/70">
      <div class="space-y-1">
        <div class="font-medium text-surface-900 dark:text-surface-50">Add 12 oz liquid chlorine</div>
        <div class="text-xs text-surface-500/80">Raises FC by ~0.5 ppm</div>
      </div>
      <button class="btn btn-sm preset-filled-primary-500 shadow-card hover:brightness-110">Apply</button>
    </div>
  </div>
</Card>
