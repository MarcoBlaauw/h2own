<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
</script>

<Container>
  <section class="mx-auto w-full max-w-4xl space-y-6 py-8">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold text-content-primary">Inventory</h1>
      <p class="text-sm text-content-secondary">
        Inventory workflows are staged next. This placeholder reserves the module path and navigation.
      </p>
    </header>

    <Card className="shadow-card">
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-content-primary">Coming next</h2>
        <p class="text-sm text-content-secondary">
          Shared chemical/equipment inventory tracking, stock alerts, and usage forecasting will be added in a follow-up phase.
        </p>
      </div>
    </Card>
  </section>
</Container>
