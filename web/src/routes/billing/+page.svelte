<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';

  export let data;

  let message: { type: 'error' | 'success'; text: string } | null = null;
  let requestingPortal = false;

  async function requestPortal() {
    requestingPortal = true;
    message = null;
    try {
      const res = await api.billing.createPortalSession();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        message = { type: 'error', text: body.message ?? body.error ?? 'Unable to start billing portal session.' };
        return;
      }
      message = { type: 'success', text: body.message ?? 'Billing portal placeholder acknowledged.' };
    } catch (error) {
      message = { type: 'error', text: 'Unable to start billing portal session.' };
    } finally {
      requestingPortal = false;
    }
  }
</script>

<Container>
  <section class="mx-auto w-full max-w-4xl space-y-6 py-6">
    <header>
      <h1 class="text-2xl font-semibold text-content-primary">Billing</h1>
      <p class="text-sm text-content-secondary">
        Billing integration is planned. This page reserves the feature contract and navigation slot.
      </p>
    </header>

    <Card>
      <div class="space-y-2 text-sm">
        <p class="text-content-primary">Feature status: {data.payload?.featureStatus ?? 'placeholder'}</p>
        <p class="text-content-secondary">Billing status: {data.payload?.status ?? 'not_configured'}</p>
        <p class="text-content-secondary">
          Capabilities: read={String(data.payload?.capabilities?.read ?? false)} · manage={String(data.payload?.capabilities?.manage ?? false)}
        </p>
      </div>

      <div class="mt-4">
        <button class="btn btn-primary" on:click={requestPortal} disabled={requestingPortal || !data.payload?.capabilities?.manage}>
          {requestingPortal ? 'Requesting...' : 'Open billing portal'}
        </button>
      </div>

      {#if message}
        <p class={`mt-3 text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>{message.text}</p>
      {/if}
    </Card>
  </section>
</Container>
