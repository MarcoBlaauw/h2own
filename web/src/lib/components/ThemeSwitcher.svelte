<script lang="ts">
  import { onMount } from 'svelte';

  let isDark = false;

  onMount(() => {
    isDark = document.documentElement.classList.contains('dark');
  });

  function toggleTheme() {
    isDark = !isDark;
    document.documentElement.classList.toggle('dark', isDark);
  }
</script>

<button on:click={toggleTheme} class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
  {#if isDark}
    <span>☀️</span>
  {:else}
    <span>🌙</span>
  {/if}
</button>
