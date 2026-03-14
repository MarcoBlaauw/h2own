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

      if (body.url) {
        window.location.href = body.url;
        return;
      }

      message = { type: 'success', text: body.message ?? 'Billing portal request acknowledged.' };
    } catch {
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
      <p class="text-sm text-content-secondary">Manage your plan, payment status, and invoice history.</p>
    </header>

    <Card>
      <div class="space-y-2 text-sm">
        <p class="text-content-primary">Feature status: {data.payload?.featureStatus ?? 'placeholder'}</p>
        <p class="text-content-secondary">Billing status: {data.payload?.status ?? 'not_configured'}</p>
        <p class="text-content-secondary">Payment status: {data.payload?.paymentStatus ?? 'unknown'}</p>
        <p class="text-content-secondary">Plan tier: {data.payload?.plan?.tier ?? 'free'}</p>
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

    <Card>
      <h2 class="text-base font-semibold text-content-primary">Invoice history</h2>
      {#if (data.payload?.invoices?.length ?? 0) === 0}
        <p class="mt-2 text-sm text-content-secondary">No invoices found.</p>
      {:else}
        <div class="mt-3 overflow-x-auto">
          <table class="table w-full text-sm">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Issued</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {#each data.payload.invoices as invoice}
                <tr>
                  <td>
                    {#if invoice.hostedUrl}
                      <a class="link" href={invoice.hostedUrl} target="_blank" rel="noopener noreferrer">{invoice.id}</a>
                    {:else}
                      {invoice.id}
                    {/if}
                  </td>
                  <td>{invoice.status}</td>
                  <td>{(invoice.amountCents / 100).toFixed(2)} {invoice.currency?.toUpperCase?.() ?? 'USD'}</td>
                  <td>{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : '—'}</td>
                  <td>{invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  </section>
</Container>
