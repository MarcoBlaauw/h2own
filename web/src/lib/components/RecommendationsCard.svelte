<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
</script>

<Card>
  <h2 class="text-lg font-semibold text-content-primary">Recommendations</h2>
  <div class="mt-4 space-y-3">
    <div class="surface-panel flex items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="font-medium text-content-primary">Add 12 oz liquid chlorine</div>
        <div class="text-xs text-content-secondary/80">Raises FC by ~0.5 ppm</div>
      </div>
      <button class="btn btn-sm btn-primary">Apply</button>
    </div>
  </div>
</Card>
