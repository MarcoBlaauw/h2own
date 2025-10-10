<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  const storageKey = 'theme';
  const inlineInitializer = `(function(){try{if(typeof window==='undefined')return;var root=document.documentElement;if(!root)return;var stored=localStorage.getItem('${storageKey}');if(stored==='dark'){root.classList.add('dark');return;}if(stored==='light'){root.classList.remove('dark');return;}if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){root.classList.add('dark');}}catch(e){}})();`;

  let isDark = false;

  function setPreference(value: boolean, persist = true) {
    if (!browser) return;
    isDark = value;
    document.documentElement.classList.toggle('dark', value);

    if (!persist) return;

    try {
      localStorage.setItem(storageKey, value ? 'dark' : 'light');
    } catch (error) {
      console.warn('Unable to persist theme preference', error);
    }
  }

  function hasStoredPreference() {
    if (!browser) return false;
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch (error) {
      console.warn('Unable to read stored theme preference', error);
      return false;
    }
  }

  onMount(() => {
    if (!browser) return;

    isDark = document.documentElement.classList.contains('dark');

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (hasStoredPreference()) return;
      setPreference(event.matches, false);
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  });

  function toggleTheme() {
    setPreference(!isDark);
  }
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html `<script>${inlineInitializer}<\/script>`}
</svelte:head>

<button
  class="btn btn-icon-base btn-tonal"
  type="button"
  on:click={toggleTheme}
  aria-pressed={isDark}
  aria-label={isDark ? 'Activate light theme' : 'Activate dark theme'}
>
  {#if isDark}
    <span aria-hidden="true">☀️</span>
  {:else}
    <span aria-hidden="true">🌙</span>
  {/if}
</button>
