<script lang="ts">
  export let className = '';
</script>

<section
  class={`card border border-surface-200/60 bg-surface-50/90 shadow-card backdrop-blur-sm dark:border-surface-700/60 dark:bg-surface-900/80 ${className}`}
>
  <div class="p-5 sm:p-6">
    <slot />
  </div>
</section>
