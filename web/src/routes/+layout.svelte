<script>
  import '../app.css';
  import AppHeader from '$lib/components/layout/AppHeader.svelte';
  import Footer from '$lib/components/layout/Footer.svelte';
</script>

<div class="flex flex-col min-h-screen">
  <AppHeader />

  <main class="flex-grow flex flex-col">
    <slot />
  </main>

  <Footer />
</div>
