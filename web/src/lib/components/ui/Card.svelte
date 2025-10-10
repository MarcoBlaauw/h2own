<script lang="ts">
  export let className = '';
</script>

<section class={`card ${className}`}>
  <div class="p-5 sm:p-6">
    <slot />
  </div>
</section>
