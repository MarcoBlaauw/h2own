<script lang="ts">
  import { onMount } from 'svelte';

  let isDark = false;

  function applyTheme(value: boolean) {
    isDark = value;
    const root = document.documentElement;
    const body = document.body;

    if (body && body.getAttribute('data-theme') !== 'h2own') {
      body.setAttribute('data-theme', 'h2own');
    }
    root.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch (error) {
      console.warn('Unable to persist theme preference', error);
    }
  }

  onMount(() => {
    const stored = (() => {
      try {
        return localStorage.getItem('theme');
      } catch (error) {
        console.warn('Unable to read stored theme preference', error);
        return null;
      }
    })();

    if (stored === 'dark' || stored === 'light') {
      applyTheme(stored === 'dark');
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  });

  function toggleTheme() {
    applyTheme(!isDark);
  }
</script>

<button
  class="btn btn-icon-base preset-filled-surface-200-800 hover:brightness-110 dark:hover:brightness-95"
  type="button"
  on:click={toggleTheme}
  aria-pressed={isDark}
  aria-label={isDark ? 'Activate light theme' : 'Activate dark theme'}
>
  {#if isDark}
    <span class="text-lg">☀️</span>
  {:else}
    <span class="text-lg">🌙</span>
  {/if}
</button>
