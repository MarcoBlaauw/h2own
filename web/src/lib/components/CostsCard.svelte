<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  type CostItem = {
    costId: string;
    poolId?: string | null;
    poolName?: string | null;
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
    byPool?: Array<{
      poolId?: string | null;
      poolName?: string | null;
      total: string | number;
    }>;
  };

  export let costs: CostItem[] = [];
  export let summary: CostSummary | null = null;
  export let poolId: string | null = null;
  export let mode: 'pool' | 'account' = 'pool';
  export let pools: Array<{ poolId: string; name: string }> = [];
  export let selectedPoolId: string | null = null;
  export let productCategories: Array<{ categoryId: string; name: string }> = [];
  export let products: Array<{
    productId: string;
    categoryId?: string | null;
    name?: string | null;
    brand?: string | null;
    primaryVendor?: { name?: string | null } | null;
  }> = [];

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
  let selectedCatalogCategoryId = '';
  let selectedCatalogProductId = '';
  let logPoolId = poolId ?? selectedPoolId ?? '';
  let error = '';
  let success = '';
  let isSubmitting = false;

  $: filteredCatalogProducts = products.filter((product) =>
    selectedCatalogCategoryId ? product.categoryId === selectedCatalogCategoryId : true,
  );

  $: if (selectedCatalogProductId && !filteredCatalogProducts.some((product) => product.productId === selectedCatalogProductId)) {
    selectedCatalogProductId = '';
  }

  $: if (costs !== lastCosts) {
    costItems = costs;
    lastCosts = costs;
  }

  $: if (summary !== lastSummary) {
    currentSummary = summary;
    lastSummary = summary;
  }

  $: if (mode === 'pool') {
    logPoolId = poolId ?? '';
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
    } catch {
      // Ignore JSON parsing errors.
    }
    return fallback;
  };

  function applyCatalogProduct(productId: string) {
    selectedCatalogProductId = productId;
    const selected = products.find((product) => product.productId === productId);
    if (!selected) return;
    description = selected.name ?? description;
    if (selected.primaryVendor?.name) {
      vendor = selected.primaryVendor.name;
    }
  }

  async function refreshAccountCosts(poolFilter?: string | null) {
    const res = await api.inventory.costs(undefined, {
      ...(poolFilter ? { poolId: poolFilter } : {}),
      limit: listLimit,
      window: summaryWindow,
    });
    if (!res.ok) {
      error = await buildErrorMessage(res, 'Unable to refresh costs.');
      return;
    }
    const payload = await res.json();
    costItems = payload.items ?? [];
    currentSummary = payload.summary ?? null;
  }

  async function refreshPoolCosts(targetPoolId: string) {
    const [listRes, summaryRes] = await Promise.all([
      api.costs.list(targetPoolId, undefined, { limit: listLimit }),
      api.costs.summary(targetPoolId, undefined, { window: summaryWindow }),
    ]);
    if (!listRes.ok) {
      error = await buildErrorMessage(listRes, 'Unable to refresh costs.');
      return;
    }
    const listPayload = await listRes.json();
    costItems = listPayload.items ?? [];
    if (summaryRes.ok) {
      currentSummary = await summaryRes.json();
    }
  }

  async function handleSubmit() {
    success = '';
    error = '';

    const targetPoolId = mode === 'pool' ? poolId : logPoolId || null;
    if (!targetPoolId) {
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
      const res = await api.costs.create(targetPoolId, {
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

      if (mode === 'account') {
        await refreshAccountCosts(selectedPoolId);
      } else {
        await refreshPoolCosts(targetPoolId);
      }
    } catch {
      error = 'Unable to add cost. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  async function handlePoolFilterChange(nextPoolId: string) {
    const url = new URL(page.url);
    if (nextPoolId) {
      url.searchParams.set('poolId', nextPoolId);
    } else {
      url.searchParams.delete('poolId');
    }
    await goto(`${url.pathname}${url.search}`, { invalidateAll: true });
  }
</script>

<Card status={error ? 'danger' : success ? 'success' : 'default'}>
  <svelte:fragment slot="header">
    <div class="card-heading">
      <span class="card-icon-badge" data-shape="circle">
        <Icon name="costs" size={20} tone="muted" />
      </span>
      <div class="card-title-group">
        <h2 class="card-title">Costs</h2>
        <p class="card-subtitle">{getWindowLabel(currentSummary?.window)}</p>
      </div>
    </div>
  </svelte:fragment>

  <svelte:fragment slot="actions">
    <div class="flex items-end gap-4">
      {#if mode === 'account'}
        <label class="form-field min-w-[180px]">
          <span class="form-label" data-variant="caps">View pool</span>
          <select class="form-control" bind:value={selectedPoolId} on:change={(event) => handlePoolFilterChange(event.currentTarget.value)}>
            <option value="">All pools</option>
            {#each pools as option}
              <option value={option.poolId}>{option.name}</option>
            {/each}
          </select>
        </label>
      {/if}
      <div class="text-right">
        <div class="text-xl font-semibold text-content-primary">
          {currentSummary ? formatAmount(currentSummary.total, currentSummary.currency ?? 'USD') : '—'}
        </div>
        <div class="text-xs text-content-secondary">Total spend</div>
      </div>
    </div>
  </svelte:fragment>

  <form
    class="form-grid"
    aria-describedby={error ? 'cost-form-error' : success ? 'cost-form-success' : undefined}
    aria-busy={isSubmitting}
    on:submit|preventDefault={handleSubmit}
  >
    {#if mode === 'account'}
      <div class="form-field sm:col-span-2">
        <label class="form-label" data-variant="caps" for="cost-pool">Log against pool</label>
        <select id="cost-pool" class="form-control" bind:value={logPoolId} disabled={isSubmitting}>
          <option value="">Select pool</option>
          {#each pools as option}
            <option value={option.poolId}>{option.name}</option>
          {/each}
        </select>
      </div>
    {/if}
    <div class="form-field sm:col-span-2">
      <label class="form-label" data-variant="caps" for="cost-catalog-category">Catalog category</label>
      <select id="cost-catalog-category" class="form-control" bind:value={selectedCatalogCategoryId} disabled={isSubmitting}>
        <option value="">Optional catalog category</option>
        {#each productCategories as category}
          <option value={category.categoryId}>{category.name}</option>
        {/each}
      </select>
    </div>
    <div class="form-field sm:col-span-2">
      <label class="form-label" data-variant="caps" for="cost-catalog-item">Catalog item</label>
      <select
        id="cost-catalog-item"
        class="form-control"
        bind:value={selectedCatalogProductId}
        disabled={isSubmitting}
        on:change={(event) => applyCatalogProduct(event.currentTarget.value)}
      >
        <option value="">Optional catalog item</option>
        {#each filteredCatalogProducts as product}
          <option value={product.productId}>{product.brand ? `${product.brand} ` : ''}{product.name}</option>
        {/each}
      </select>
      <p class="mt-1 text-xs text-content-secondary">Selecting a catalog item pre-fills the description and vendor.</p>
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cost-amount">Amount</label>
      <input id="cost-amount" type="number" min="0" step="0.01" bind:value={amount} class="form-control" disabled={isSubmitting}>
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cost-currency">Currency</label>
      <input id="cost-currency" type="text" bind:value={currency} class="form-control" disabled={isSubmitting} placeholder="USD">
    </div>
    <div class="form-field sm:col-span-2">
      <label class="form-label" data-variant="caps" for="cost-description">Description</label>
      <input id="cost-description" type="text" bind:value={description} class="form-control" disabled={isSubmitting} placeholder="Filter replacement">
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cost-vendor">Vendor</label>
      <input id="cost-vendor" type="text" bind:value={vendor} class="form-control" disabled={isSubmitting} placeholder="Pool supply">
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="cost-incurred">Incurred at</label>
      <input id="cost-incurred" type="date" bind:value={incurredAt} class="form-control" disabled={isSubmitting}>
    </div>
    {#if error}
      <p class="form-message sm:col-span-2" data-state="error" role="alert" id="cost-form-error">{error}</p>
    {/if}
    {#if success}
      <p class="form-message sm:col-span-2" data-state="success" role="status" aria-live="polite" id="cost-form-success">{success}</p>
    {/if}
    <button
      type="submit"
      class="sm:col-span-2 btn btn-base btn-primary"
      disabled={isSubmitting}
      data-loading={isSubmitting ? 'true' : undefined}
      aria-busy={isSubmitting}
    >
      <span class="btn__spinner" aria-hidden="true"></span>
      <span class="btn__content">
        <span class="btn__label">{isSubmitting ? 'Saving cost...' : 'Add cost'}</span>
      </span>
    </button>
  </form>

  {#if costItems.length > 0}
    <div class="mt-4 space-y-3">
      {#each costItems as item}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">{item.description ?? item.categoryName ?? 'Pool expense'}</div>
            <div class="text-xs text-content-secondary/80">
              {item.poolName ? `${item.poolName} · ` : ''}{item.vendor ?? item.categoryName ?? 'General'}
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-semibold text-content-primary">{formatAmount(item.amount, item.currency ?? 'USD')}</div>
            <div class="mt-1 text-xs text-content-secondary/80">{formatDate(item.incurredAt)}</div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="mt-3 text-sm text-content-secondary">No costs logged yet. Add expenses to track monthly spend.</p>
  {/if}
</Card>
