<script lang="ts">
  import { iconLabelMap, iconMap, type IconName } from '$lib/components/ui/icon-map';

  type IconSize = 16 | 20 | 24;
  type IconTone = 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

  const toneClassMap: Record<IconTone, string> = {
    default: 'text-content-primary',
    muted: 'text-content-secondary',
    accent: 'text-brand-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
  };

  export let name: IconName;
  export let size: IconSize = 20;
  export let tone: IconTone = 'default';
  export let decorative = true;
  export let style: string | undefined = undefined;

  $: icon = iconMap[name];
  $: computedLabel = iconLabelMap[name];
</script>

<svelte:component
  this={icon}
  stroke={1.75}
  {size}
  class={`inline-block shrink-0 align-middle ${toneClassMap[tone]}`}
  {style}
  aria-hidden={decorative ? 'true' : undefined}
  aria-label={decorative ? undefined : computedLabel}
/>
