<script lang="ts">
  export let className = '';
  export let status: 'default' | 'success' | 'warning' | 'danger' | 'info' = 'default';
</script>

<section
  class={`surface-card status-success:ring-1 status-success:ring-success status-success:ring-opacity-25 status-success:border-success status-success:border-opacity-60 status-success:bg-success status-success:bg-opacity-10 status-warning:ring-1 status-warning:ring-warning status-warning:ring-opacity-25 status-warning:border-warning status-warning:border-opacity-60 status-warning:bg-warning status-warning:bg-opacity-10 status-danger:ring-1 status-danger:ring-danger status-danger:ring-opacity-25 status-danger:border-danger status-danger:border-opacity-70 status-danger:bg-danger status-danger:bg-opacity-10 status-info:ring-1 status-info:ring-info status-info:ring-opacity-25 status-info:border-info status-info:border-opacity-60 status-info:bg-info status-info:bg-opacity-10 ${className}`}
  data-status={status === 'default' ? undefined : status}
>
  <div class="card-body">
    <slot />
  </div>
</section>
