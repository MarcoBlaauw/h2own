<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  export let data;
</script>

<Container>
  <section class="mx-auto w-full max-w-4xl space-y-6 py-6">
    <header>
      <h1 class="text-2xl font-semibold text-content-primary">Messages</h1>
      <p class="text-sm text-content-secondary">
        Direct messaging is planned. This page reserves the feature contract and navigation slot.
      </p>
    </header>

    <Card>
      <div class="space-y-2 text-sm">
        <p class="text-content-primary">Feature status: {data.payload?.featureStatus ?? 'placeholder'}</p>
        <p class="text-content-secondary">
          Conversations loaded: {data.payload?.conversations?.length ?? 0}
        </p>
        <p class="text-content-secondary">
          Capabilities: read={String(data.payload?.capabilities?.read ?? false)} · send={String(data.payload?.capabilities?.send ?? false)}
        </p>
      </div>
    </Card>
  </section>
</Container>
