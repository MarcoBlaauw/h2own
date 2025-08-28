<script lang="ts">
  export let lines = 3;
</script>

<div class="animate-pulse space-y-2">
  {#each Array(lines) as _, i}
    <div class="h-3 rounded bg-neutral-200 dark:bg-neutral-800 w-{i === 0 ? '3/4' : i === lines - 1 ? '1/2' : 'full'}"></div>
  {/each}
</div>
