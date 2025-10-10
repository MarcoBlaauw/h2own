<script lang="ts">
  export let lines = 3;
</script>

<div class="skeleton-stack" role="presentation" aria-hidden="true">
  {#each Array.from({ length: Math.max(1, lines) }) as _, index}
    <div
      class="skeleton-line"
      data-variant={index === 0 ? 'medium' : index === lines - 1 ? 'short' : 'full'}
    ></div>
  {/each}
</div>
