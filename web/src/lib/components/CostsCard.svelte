<script lang="ts">
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';

  type CostItem = {
    costId: string;
    amount: string | number;
    currency?: string | null;
    categoryName?: string | null;
    description?: string | null;
    vendor?: string | null;
    incurredAt: string | Date | null;
  };

  type CostSummary = {
    window: 'week' | 'month' | 'year';
    from: string;
    to: string;
    total: string | number;
    currency?: string | null;
    byCategory: Array<{
      categoryId?: string | null;
      categoryName?: string | null;
      total: string | number;
    }>;
  };

  export let costs: CostItem[] = [];
  export let summary: CostSummary | null = null;
  export let poolId: string | null = null;

  const listLimit = 5;
  const summaryWindow: CostSummary['window'] = 'month';
  let costItems = costs;
  let lastCosts = costs;
  let currentSummary = summary;
  let lastSummary = summary;
  let amount = '';
  let currency = 'USD';
  let description = '';
  let vendor = '';
  let incurredAt = '';
  let error = '';
  let success = '';
  let isSubmitting = false;

  $: if (costs !== lastCosts) {
    costItems = costs;
    lastCosts = costs;
  }

  $: if (summary !== lastSummary) {
    currentSummary = summary;
    lastSummary = summary;
  }

  const formatAmount = (value: string | number, currency?: string | null) => {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
    if (Number.isNaN(numeric)) return String(value);
    if (currency) {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(numeric);
    }
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getWindowLabel = (window?: CostSummary['window']) => {
    if (!window) return 'recent';
    if (window === 'week') return 'last 7 days';
    if (window === 'month') return 'last 30 days';
    if (window === 'year') return 'last 12 months';
    return 'recent';
  };

  const buildErrorMessage = async (res: Response, fallback: string) => {
    try {
      const data = await res.json();
      if (typeof data?.message === 'string' && data.message.trim() !== '') {
        return data.message;
      }
      if (typeof data?.error === 'string' && data.error.trim() !== '') {
        return data.error;
      }
    } catch (parseError) {
      // Ignore JSON parsing errors.
    }
    return fallback;
  };

  async function handleSubmit() {
    success = '';
    error = '';

    if (!poolId) {
      error = 'Select a pool before logging a cost.';
      return;
    }

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      error = 'Amount must be greater than 0.';
      return;
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      error = 'Description is required.';
      return;
    }

    const trimmedCurrency = currency.trim();
    if (trimmedCurrency && trimmedCurrency.length !== 3) {
      error = 'Currency must be a 3-letter code.';
      return;
    }

    let incurredAtIso: string | undefined;
    if (incurredAt) {
      const parsedDate = new Date(`${incurredAt}T00:00:00`);
      if (Number.isNaN(parsedDate.getTime())) {
        error = 'Incurred date must be valid.';
        return;
      }
      incurredAtIso = parsedDate.toISOString();
    }

    isSubmitting = true;
    try {
      const res = await api.costs.create(poolId, {
        amount: parsedAmount,
        description: trimmedDescription,
        ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
        ...(trimmedCurrency ? { currency: trimmedCurrency.toUpperCase() } : {}),
        ...(incurredAtIso ? { incurredAt: incurredAtIso } : {}),
      });

      if (!res.ok) {
        error = await buildErrorMessage(res, 'Unable to add cost. Please try again.');
        return;
      }

      success = 'Cost entry added.';
      amount = '';
      description = '';
      vendor = '';
      incurredAt = '';

      try {
        const [listRes, summaryRes] = await Promise.all([
          api.costs.list(poolId, undefined, { limit: listLimit }),
          api.costs.summary(poolId, undefined, { window: summaryWindow }),
        ]);
        if (!listRes.ok) {
          error = await buildErrorMessage(listRes, 'Cost saved, but unable to refresh costs.');
          return;
        }
        const listPayload = await listRes.json();
        costItems = listPayload.items ?? [];
        if (summaryRes.ok) {
          currentSummary = await summaryRes.json();
        } else {
          error = await buildErrorMessage(summaryRes, 'Cost saved, but unable to refresh summary.');
        }
      } catch (refreshError) {
        error = 'Cost saved, but unable to refresh costs.';
      }
    } catch (requestError) {
      error = 'Unable to add cost. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Card status={error ? 'danger' : success ? 'success' : 'default'}>
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-lg font-semibold text-content-primary">Costs</h2>
      <p class="text-xs text-content-secondary">
        {getWindowLabel(currentSummary?.window)}
      </p>
    </div>
    <div class="text-right">
      <div class="text-xl font-semibold text-content-primary">
        {currentSummary
          ? formatAmount(currentSummary.total, currentSummary.currency ?? 'USD')
          : '—'}
      </div>
      <div class="text-xs text-content-secondary">Total spend</div>
    </div>
  </div>

  <form
    class="mt-4 form-grid"
    aria-describedby={error ? 'cost-form-error' : success ? 'cost-form-success' : undefined}
    aria-busy={isSubmitting}
    on:submit|preventDefault={handleSubmit}
  >
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cost-amount">Amount</label>
      <input
        id="cost-amount"
        type="number"
        min="0"
        step="0.01"
        bind:value={amount}
        class="form-control"
        disabled={isSubmitting}
      >
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cost-currency">Currency</label>
      <input
        id="cost-currency"
        type="text"
        bind:value={currency}
        class="form-control"
        disabled={isSubmitting}
        placeholder="USD"
      >
    </div>
    <div class="form-field sm:col-span-2">
      <label class="form-label" data-variant="caps" for="cost-description">Description</label>
      <input
        id="cost-description"
        type="text"
        bind:value={description}
        class="form-control"
        disabled={isSubmitting}
        placeholder="Filter replacement"
      >
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cost-vendor">Vendor</label>
      <input
        id="cost-vendor"
        type="text"
        bind:value={vendor}
        class="form-control"
        disabled={isSubmitting}
        placeholder="Pool supply"
      >
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cost-incurred">Incurred at</label>
      <input
        id="cost-incurred"
        type="date"
        bind:value={incurredAt}
        class="form-control"
        disabled={isSubmitting}
      >
    </div>
    {#if error}
      <p class="form-message sm:col-span-2" data-state="error" role="alert" id="cost-form-error">
        {error}
      </p>
    {/if}
    {#if success}
      <p
        class="form-message sm:col-span-2"
        data-state="success"
        role="status"
        aria-live="polite"
        id="cost-form-success"
      >
        {success}
      </p>
    {/if}
    <button type="submit" class="sm:col-span-2 btn btn-base btn-primary" disabled={isSubmitting}>
      {#if isSubmitting}
        Saving...
      {:else}
        Add cost
      {/if}
    </button>
  </form>

  {#if costItems.length > 0}
    <div class="mt-4 space-y-3">
      {#each costItems as item}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">
              {item.description ?? item.categoryName ?? 'Pool expense'}
            </div>
            <div class="text-xs text-content-secondary/80">
              {item.vendor ?? item.categoryName ?? 'General'}
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-semibold text-content-primary">
              {formatAmount(item.amount, item.currency ?? 'USD')}
            </div>
            <div class="mt-1 text-xs text-content-secondary/80">{formatDate(item.incurredAt)}</div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="mt-3 text-sm text-content-secondary">
      No costs logged yet. Add expenses to track monthly spend.
    </p>
  {/if}
</Card>
