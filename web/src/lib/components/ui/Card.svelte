<script lang="ts">
  export let className = '';
  export let status: 'default' | 'success' | 'warning' | 'danger' | 'info' = 'default';
</script>

<section class={`surface-card ${className}`} data-status={status === 'default' ? undefined : status}>
  <div class="card-body">
    <slot />
  </div>
</section>
