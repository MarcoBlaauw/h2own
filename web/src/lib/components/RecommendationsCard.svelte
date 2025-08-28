<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
</script>

<Card>
  <h2 class="text-lg font-semibold">Recommendations</h2>
  <div class="mt-4 space-y-2">
    <!-- placeholder list -->
    <div class="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 dark:border-white/10">
      <div>
        <div class="font-medium">Add 12 oz liquid chlorine</div>
        <div class="text-xs text-neutral-500">Raises FC by ~0.5 ppm</div>
      </div>
      <button class="text-sm rounded-lg px-3 py-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">Apply</button>
    </div>
  </div>
</Card>
