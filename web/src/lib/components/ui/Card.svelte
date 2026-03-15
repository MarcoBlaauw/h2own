<script lang="ts">
  export let className = '';
  export let status: 'default' | 'success' | 'warning' | 'danger' | 'info' = 'default';
  export let variant: 'default' | 'elevated' | 'subtle' | 'actionable' = 'default';
  export let density: 'comfortable' | 'compact' = 'comfortable';

  const statusLabel = (value: typeof status) => value.charAt(0).toUpperCase() + value.slice(1);

  $: hasHeader = Boolean($$slots.header || $$slots.actions);
  $: hasFooter = Boolean($$slots.footer);
</script>

<section
  class={`surface-card ${className}`}
  data-status={status === 'default' ? undefined : status}
  data-variant={variant}
  data-density={density}
>
  {#if hasHeader}
    <header class="card-header">
      {#if $$slots.header}
        <div class="card-header__main">
          <slot name="header" />
        </div>
      {/if}
      {#if status !== 'default'}
        <span class="card-status-badge" data-status={status}>{statusLabel(status)}</span>
      {/if}
      {#if $$slots.actions}
        <div class="card-header__actions">
          <slot name="actions" />
        </div>
      {/if}
    </header>
  {/if}

  <div class={`card-body ${hasHeader ? 'card-body--with-header' : ''} ${hasFooter ? 'card-body--with-footer' : ''}`}>
    <slot />
  </div>

  {#if hasFooter}
    <footer class="card-footer">
      <slot name="footer" />
    </footer>
  {/if}

  {#if status !== 'default'}
    <span class="card-status-accent" data-status={status} aria-hidden="true"></span>
  {/if}
</section>
