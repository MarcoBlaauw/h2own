<script lang="ts">
  export let className = '';
</script>

<section class={`rounded-2xl bg-white shadow-card ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 ${className}`}>
  <div class="p-4 sm:p-6">
    <slot />
  </div>
</section>
