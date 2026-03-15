<script lang="ts">
  import type { ComponentType } from 'svelte';

  type IconSize = 16 | 20 | 24;

  export let icon: ComponentType | null = null;
  export let label: string | undefined = undefined;
  export let size: IconSize = 20;
  export let strokeWidth = 1.75;
  export let fallbackClass: string | null = null;
  export let className = '';
  export let style: string | undefined = undefined;
</script>

{#if icon}
  <svelte:component
    this={icon}
    size={size}
    stroke={strokeWidth}
    class={`inline-block align-middle shrink-0 ${className}`.trim()}
    {style}
    aria-hidden={label ? undefined : 'true'}
    aria-label={label}
  />
{:else if fallbackClass}
  <i
    class={`wi ${fallbackClass} inline-block align-middle shrink-0 leading-none ${className}`.trim()}
    style={`${style ? `${style}; ` : ''}font-size: ${size}px;`}
    aria-hidden={label ? undefined : 'true'}
    aria-label={label}
  ></i>
{/if}
