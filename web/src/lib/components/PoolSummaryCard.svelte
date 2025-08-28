<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  export let pool;
</script>

<Card>
  <h2 class="text-lg font-semibold">Pool Summary</h2>
  <div class="mt-4 text-sm text-neutral-600 dark:text-neutral-300">
    <p><strong>Owner:</strong> {pool.owner.email}</p>
    <p><strong>Volume:</strong> {pool.volume} gallons</p>
    <p><strong>Surface:</strong> {pool.surface}</p>
    <p><strong>Sanitizer:</strong> {pool.sanitizer}</p>
    <p><strong>Last Tested:</strong> {new Date(pool.lastTestedAt).toLocaleDateString()}</p>
  </div>
</Card>
