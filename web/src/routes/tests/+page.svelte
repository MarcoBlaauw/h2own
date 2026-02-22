<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
</script>

<Container>
  <div class="mx-auto w-full max-w-4xl space-y-6 py-8">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold text-content-primary">Tests Hub</h1>
      <p class="text-sm text-content-secondary">
        Choose a fast chemistry update or walk through a full test workflow.
      </p>
    </header>

    <div class="grid gap-4 md:grid-cols-2">
      <Card className="h-full shadow-card">
        <div class="flex h-full flex-col gap-3">
          <h2 class="text-xl font-semibold text-content-primary">Quick Update</h2>
          <p class="text-sm text-content-secondary">
            Log key readings quickly from your dashboard using the streamlined quick test form.
          </p>
          <a href="/" class="btn btn-base btn-primary mt-auto w-fit">Quick Update</a>
        </div>
      </Card>

      <Card className="h-full shadow-card">
        <div class="flex h-full flex-col gap-3">
          <h2 class="text-xl font-semibold text-content-primary">Guided Full Test</h2>
          <p class="text-sm text-content-secondary">
            Open a pool workspace and add a complete test entry with full chemistry details.
          </p>
          <a href="/pools" class="btn btn-base btn-secondary mt-auto w-fit">Guided Full Test</a>
        </div>
      </Card>
    </div>
  </div>
</Container>
