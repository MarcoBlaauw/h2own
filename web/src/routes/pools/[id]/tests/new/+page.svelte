<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { page } from '$app/stores';
  import GuidedTestForm from '$lib/components/GuidedTestForm.svelte';
</script>

<div class="container mx-auto px-4 py-8 space-y-6">
  <Card>
    <h1 class="text-2xl font-semibold text-content-primary">Detailed Test Entry</h1>
    <p class="mt-2 text-sm text-content-secondary">
      Use this guided flow for complete water chemistry logging. Need speed? The quick form remains available on the pool detail page.
    </p>
  </Card>

  <GuidedTestForm poolId={$page.params.id} />
</div>
