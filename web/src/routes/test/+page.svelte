<script>
  import Card from '$lib/components/ui/Card.svelte';
  import Metric from '$lib/components/ui/Metric.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';
  import AppHeader from '$lib/components/layout/AppHeader.svelte';
  import Container from '$lib/components/layout/Container.svelte';
</script>

<AppHeader />

<Container>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">Component Test Page</h1>

    <h2 class="text-xl font-bold mt-8 mb-4">Card</h2>
    <Card>
      <p>This is a card.</p>
    </Card>

    <h2 class="text-xl font-bold mt-8 mb-4">Metric</h2>
    <div class="grid grid-cols-3 gap-4">
      <Card>
        <Metric label="Uptime" value="99.9%" trend="up" />
      </Card>
      <Card>
        <Metric label="Errors" value="12" trend="down" />
      </Card>
      <Card>
        <Metric label="Latency" value="120ms" trend="flat" />
      </Card>
    </div>

    <h2 class="text-xl font-bold mt-8 mb-4">Skeleton</h2>
    <Card>
      <Skeleton lines={5} />
    </Card>
  </div>
</Container>
