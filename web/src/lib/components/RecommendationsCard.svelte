<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
</script>

<Card>
  <h2 class="text-lg font-semibold text-content-primary">Recommendations</h2>
  <div class="mt-4 space-y-3">
    <div class="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-surface-subtle/95 px-4 py-3 dark:border-border-strong/70 dark:bg-surface-inset/80">
      <div class="space-y-1">
        <div class="font-medium text-content-primary">Add 12 oz liquid chlorine</div>
        <div class="text-xs text-content-secondary/80">Raises FC by ~0.5 ppm</div>
      </div>
      <button class="btn btn-sm btn-primary">Apply</button>
    </div>
  </div>
</Card>
