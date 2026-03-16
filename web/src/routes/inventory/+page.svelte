<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import {
    formatMeasurementValue,
    getMeasurementUnitOptions,
    getPreferredDisplayUnit,
    type MeasurementSystem,
  } from '$lib/constants/measurement-units';
  import Container from '$lib/components/layout/Container.svelte';
  import CostsCard from '$lib/components/CostsCard.svelte';

  export let data = {
    session: null,
    inventory: { items: [] },
    transactions: { items: [] },
    costs: { items: [], summary: null },
    pools: [],
    chemicals: [],
    productCategories: [],
    vendors: [],
    preferences: null,
    selectedPoolId: null,
  };

  let inventoryItems = data.inventory?.items ?? [];
  let transactions = data.transactions?.items ?? [];
  let costs = data.costs?.items ?? [];
  let costSummary = data.costs?.summary ?? null;
  let selectedPoolId = data.selectedPoolId ?? '';
  const measurementSystem: MeasurementSystem =
    data.preferences?.measurementSystem === 'metric' ? 'metric' : 'imperial';

  let transactionPoolId = selectedPoolId;
  let selectedCategoryId = inventoryItems[0]?.categoryId ?? data.chemicals?.[0]?.categoryId ?? '';
  let productId = '';
  let transactionType = 'restock';
  let quantityDelta = '';
  let unit = 'package';
  let vendorId = '';
  let unitPrice = '';
  let note = '';
  let transactionError = '';
  let transactionSuccess = '';
  let transactionBusy = false;

  let savingStockId: string | null = null;
  let stockMessage: string | null = null;

  type ParsedPackage = {
    totalUnits: number;
    baseUnit: string;
    display: string;
  };

  const normalizeBaseUnit = (raw: string) => {
    const normalized = raw.trim().toLowerCase();
    switch (normalized) {
      case 'gallon':
      case 'gallons':
      case 'gal':
        return 'gal';
      case 'liter':
      case 'liters':
      case 'litre':
      case 'litres':
      case 'l':
        return 'l';
      case 'pound':
      case 'pounds':
      case 'lb':
      case 'lbs':
        return 'lb';
      case 'ounce':
      case 'ounces':
      case 'oz':
        return 'oz';
      case 'fluid ounce':
      case 'fluid ounces':
      case 'fl oz':
      case 'oz_fl':
        return 'fl_oz';
      case 'gram':
      case 'grams':
      case 'g':
        return 'g';
      case 'kilogram':
      case 'kilograms':
      case 'kg':
        return 'kg';
      default:
        return 'item';
    }
  };

  const parsePackageSize = (value: string | null | undefined): ParsedPackage | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    const multiMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*([a-z][a-z_\s.]*)$/i);
    if (multiMatch) {
      const packageCount = Number(multiMatch[1]);
      const perPackage = Number(multiMatch[2]);
      if (!Number.isFinite(packageCount) || !Number.isFinite(perPackage)) return null;
      return {
        totalUnits: packageCount * perPackage,
        baseUnit: normalizeBaseUnit(multiMatch[3]),
        display: value,
      };
    }

    const singleMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*([a-z][a-z_\s.]*)$/i);
    if (singleMatch) {
      const totalUnits = Number(singleMatch[1]);
      if (!Number.isFinite(totalUnits)) return null;
      const rawUnit = singleMatch[2].trim();
      return {
        totalUnits,
        baseUnit: /cartridge|brush|bag|bucket|tablet|tab|stick|net|hose|pole|kit|item|part/i.test(rawUnit)
          ? 'item'
          : normalizeBaseUnit(rawUnit),
        display: value,
      };
    }

    return null;
  };

  $: filteredCatalogItems = (data.chemicals ?? []).filter((item) =>
    selectedCategoryId ? item.categoryId === selectedCategoryId : true,
  );

  $: if (!productId || !filteredCatalogItems.some((item) => item.productId === productId)) {
    productId = filteredCatalogItems[0]?.productId ?? '';
  }

  $: selectedProduct = (data.chemicals ?? []).find((item) => item.productId === productId) ?? null;

  $: selectedVendorPrice =
    selectedProduct?.vendorPrices?.find((entry) => entry.vendorId === vendorId) ??
    selectedProduct?.primaryPrice ??
    null;
  $: selectedPackage = parsePackageSize(selectedVendorPrice?.packageSize ?? null);

  const uniqueUnitOptions = (options: Array<{ value: string; label: string }>) => {
    const seen = new Set<string>();
    return options.filter((option) => {
      if (!option.value || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  };

  $: baseUnitOptions = getMeasurementUnitOptions(
    selectedPackage?.baseUnit ?? selectedProduct?.doseUnit ?? selectedVendorPrice?.unitLabel ?? 'item',
    measurementSystem,
    'inventory',
  );

  $: transactionUnitOptions = uniqueUnitOptions([
    selectedPackage
      ? {
          value: 'package',
          label: `package (${selectedPackage.display})`,
        }
      : null,
    ...baseUnitOptions,
  ].filter((option): option is { value: string; label: string } => Boolean(option)));

  $: if (!transactionUnitOptions.some((option) => option.value === unit)) {
    unit = transactionUnitOptions[0]?.value ?? 'item';
  }

  $: if (selectedProduct?.primaryVendor?.vendorId && !vendorId) {
    vendorId = selectedProduct.primaryVendor.vendorId;
  }

  $: derivedTransaction =
    selectedPackage && unit === 'package'
      ? {
          quantity:
            Number.isFinite(Number(quantityDelta)) && Number(quantityDelta) > 0
              ? Number(quantityDelta) * selectedPackage.totalUnits
              : null,
          unit: selectedPackage.baseUnit,
          derivedUnitPrice:
            Number.isFinite(Number(unitPrice)) && Number(unitPrice) > 0
              ? Number(unitPrice) / selectedPackage.totalUnits
              : null,
        }
      : {
          quantity:
            Number.isFinite(Number(quantityDelta)) && Number(quantityDelta) > 0
              ? Number(quantityDelta)
              : null,
          unit,
          derivedUnitPrice:
            Number.isFinite(Number(unitPrice)) && Number(unitPrice) > 0
              ? Number(unitPrice)
              : null,
        };

  const formatAmount = (value: string | number | null | undefined, currency = 'USD') => {
    if (value === null || value === undefined || value === '') return '—';
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  };

  async function changePoolFilter(poolId: string) {
    const url = new URL(page.url);
    if (poolId) {
      url.searchParams.set('poolId', poolId);
    } else {
      url.searchParams.delete('poolId');
    }
    await goto(`${url.pathname}${url.search}`, { invalidateAll: true });
  }

  async function submitTransaction() {
    transactionBusy = true;
    transactionError = '';
    transactionSuccess = '';

    const parsedQuantity = Number(quantityDelta);
    if (!productId || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      transactionError = 'Select a product and enter a positive quantity.';
      transactionBusy = false;
      return;
    }

    const normalizedQuantity =
      selectedPackage && unit === 'package' ? parsedQuantity * selectedPackage.totalUnits : parsedQuantity;
    const normalizedUnit =
      selectedPackage && unit === 'package' ? selectedPackage.baseUnit : unit;
    const normalizedUnitPrice =
      unitPrice && Number(unitPrice) > 0
        ? unit === 'package' && selectedPackage
          ? Number(unitPrice) / selectedPackage.totalUnits
          : Number(unitPrice)
        : null;

    const signedQuantity =
      transactionType === 'decrement'
        ? -Math.abs(normalizedQuantity)
        : normalizedQuantity;
    const body: Record<string, unknown> = {
      productId,
      transactionType,
      quantityDelta: signedQuantity,
      unit: normalizedUnit,
      ...(transactionPoolId ? { poolId: transactionPoolId } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(normalizedUnitPrice ? { unitPrice: normalizedUnitPrice } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };

    try {
      const res = await api.inventory.createTransaction(body);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        transactionError = payload?.message ?? payload?.error ?? 'Unable to save inventory activity.';
        return;
      }

      transactionSuccess = 'Inventory activity saved.';
      quantityDelta = '';
      unitPrice = '';
      note = '';
      await goto(window.location.pathname + window.location.search, { invalidateAll: true });
    } finally {
      transactionBusy = false;
    }
  }

  async function saveStockSettings(item) {
    savingStockId = item.stockId;
    stockMessage = null;
    const res = await api.inventory.updateStock(item.stockId, {
      reorderPoint: Number(item.reorderPoint ?? 0),
      leadTimeDays: Number(item.leadTimeDays ?? 0),
      preferredVendorId: item.preferredVendorId || null,
      preferredUnitPrice: item.preferredUnitPrice ? Number(item.preferredUnitPrice) : null,
      preferredCurrency: item.preferredCurrency || 'USD',
    });
    stockMessage = res.ok ? 'Inventory settings updated.' : 'Unable to update inventory settings.';
    savingStockId = null;
  }
</script>

<Container>
  <section class="mx-auto w-full max-w-6xl space-y-6 py-8">
    <div class="surface-frame flex flex-col gap-4 rounded-3xl p-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-2">
        <h1 class="text-3xl font-semibold text-content-primary">Inventory</h1>
        <p class="text-sm text-content-secondary">
          Shared chemical and supply inventory, low-stock alerts, vendor pricing, and account-wide spend.
        </p>
      </div>
      <label class="form-field min-w-[220px]">
        <span class="form-label" data-variant="caps">Pool filter</span>
        <select class="form-control" bind:value={selectedPoolId} on:change={(event) => changePoolFilter(event.currentTarget.value)}>
          <option value="">All pools</option>
          {#each data.pools ?? [] as pool}
            <option value={pool.poolId}>{pool.name}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div class="surface-frame rounded-2xl p-4">
        <div class="text-xs uppercase tracking-[0.18em] text-content-secondary">Tracked products</div>
        <div class="mt-2 text-3xl font-semibold text-content-primary">{inventoryItems.length}</div>
      </div>
      <div class="surface-frame rounded-2xl p-4">
        <div class="text-xs uppercase tracking-[0.18em] text-content-secondary">Low stock</div>
        <div class="mt-2 text-3xl font-semibold text-content-primary">
          {inventoryItems.filter((item) => item.lowStock).length}
        </div>
      </div>
      <div class="surface-frame rounded-2xl p-4">
        <div class="text-xs uppercase tracking-[0.18em] text-content-secondary">30-day spend</div>
        <div class="mt-2 text-3xl font-semibold text-content-primary">
          {costSummary ? formatAmount(costSummary.total, costSummary.currency ?? 'USD') : '—'}
        </div>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section class="surface-frame rounded-3xl p-6">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-content-primary">Stock health</h2>
            <p class="text-sm text-content-secondary">Owner-shared inventory with usage forecasting and preferred vendor settings.</p>
          </div>
          {#if stockMessage}
            <p class="text-sm text-content-secondary">{stockMessage}</p>
          {/if}
        </div>

        {#if inventoryItems.length}
          <div class="mt-4 space-y-4">
            {#each inventoryItems as item}
              <div class="surface-frame rounded-2xl p-4">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div class="space-y-1">
                    <div class="text-lg font-semibold text-content-primary">{item.productName}</div>
                    <div class="text-sm text-content-secondary">
                      {item.productBrand ?? 'Generic'} · {item.itemClass ?? 'chemical'} · {item.productType ?? 'catalog_item'}
                    </div>
                    {#if item.productSku}
                      <div class="text-sm text-content-secondary">SKU {item.productSku}</div>
                    {/if}
                    <div class="text-sm text-content-secondary">
                      On hand {formatMeasurementValue(item.quantityOnHand, item.unit, measurementSystem, 'inventory')} · 30d use {formatMeasurementValue(item.usage?.consumedLast30Days, item.unit, measurementSystem, 'inventory')}
                    </div>
                    <div class="text-sm text-content-secondary">
                      Forecast depletion {item.usage?.forecastedDepletionDate ? new Date(item.usage.forecastedDepletionDate).toLocaleDateString() : 'n/a'}
                    </div>
                  </div>
                  <div class:text-danger-700={item.lowStock} class="text-sm font-medium">
                    {item.lowStock ? 'Low stock' : 'In range'}
                  </div>
                </div>

                <div class="mt-4 grid gap-3 md:grid-cols-4">
                  <label class="form-field">
                    <span class="form-label" data-variant="caps">Reorder point</span>
                    <input class="form-control" type="number" step="0.001" bind:value={item.reorderPoint} />
                  </label>
                  <label class="form-field">
                    <span class="form-label" data-variant="caps">Lead time days</span>
                    <input class="form-control" type="number" min="0" bind:value={item.leadTimeDays} />
                  </label>
                  <label class="form-field">
                    <span class="form-label" data-variant="caps">Preferred vendor</span>
                    <select class="form-control" bind:value={item.preferredVendorId}>
                      <option value="">Select vendor</option>
                      {#each data.vendors ?? [] as vendor}
                        <option value={vendor.vendorId}>{vendor.name}</option>
                      {/each}
                    </select>
                  </label>
                  <label class="form-field">
                    <span class="form-label" data-variant="caps">Preferred unit price</span>
                    <input class="form-control" type="number" min="0" step="0.01" bind:value={item.preferredUnitPrice} />
                  </label>
                </div>

                <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div class="text-sm text-content-secondary">
                    Catalog price {item.catalogPrice ? formatAmount(item.catalogPrice.unitPrice, item.catalogPrice.currency ?? 'USD') : '—'}
                    {#if item.catalogPrice?.vendorName}
                      · {item.catalogPrice.vendorName}
                    {/if}
                    {#if item.catalogPrice && item.catalogPriceIsStale}
                      · stale
                    {/if}
                  </div>
                  <button class="btn btn-base btn-secondary" disabled={savingStockId === item.stockId} on:click={() => saveStockSettings(item)}>
                    {savingStockId === item.stockId ? 'Saving...' : 'Save settings'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="mt-4 text-sm text-content-secondary">No inventory items tracked yet.</p>
        {/if}
      </section>

      <div class="space-y-6">
        <section class="surface-frame rounded-3xl p-6">
          <h2 class="text-xl font-semibold text-content-primary">Record inventory activity</h2>
          <p class="mt-1 text-sm text-content-secondary">
            Restocks and adjustments create tracked inventory items. Start by choosing a catalog category and product.
          </p>
          <div class="mt-4 grid gap-3">
            <label class="form-field">
              <span class="form-label" data-variant="caps">Pool attribution</span>
              <select class="form-control" bind:value={transactionPoolId}>
                <option value="">No pool attribution</option>
                {#each data.pools ?? [] as pool}
                  <option value={pool.poolId}>{pool.name}</option>
                {/each}
              </select>
            </label>
            <label class="form-field">
              <span class="form-label" data-variant="caps">Catalog category</span>
              <select class="form-control" bind:value={selectedCategoryId}>
                <option value="">All catalog categories</option>
                {#each data.productCategories ?? [] as category}
                  <option value={category.categoryId}>{category.name}</option>
                {/each}
              </select>
            </label>
            <label class="form-field">
              <span class="form-label" data-variant="caps">Catalog item</span>
              <select class="form-control" bind:value={productId}>
                <option value="">Select catalog item</option>
                {#each filteredCatalogItems as chemical}
                  <option value={chemical.productId}>
                    {(chemical.brand ? `${chemical.brand} ` : '') + chemical.name}
                  </option>
                {/each}
              </select>
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="form-field">
                <span class="form-label" data-variant="caps">Activity</span>
                <select class="form-control" bind:value={transactionType}>
                  <option value="restock">Restock</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="decrement">Manual decrement</option>
                </select>
              </label>
              <label class="form-field">
                <span class="form-label" data-variant="caps">Quantity</span>
                <input class="form-control" type="number" min="0" step="0.001" bind:value={quantityDelta} />
              </label>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="form-field">
                <span class="form-label" data-variant="caps">Unit</span>
                <select class="form-control" bind:value={unit}>
                  {#if transactionUnitOptions.length}
                    {#each transactionUnitOptions as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  {:else}
                    <option value="package">package</option>
                  {/if}
                </select>
                {#if selectedPackage}
                  <p class="mt-1 text-xs text-content-secondary">
                    {#if unit === 'package'}
                      1 package = {formatMeasurementValue(selectedPackage.totalUnits, selectedPackage.baseUnit, measurementSystem, 'inventory')}
                    {:else}
                      Current vendor package basis: {selectedPackage.display}
                    {/if}
                  </p>
                {/if}
              </label>
              <label class="form-field">
                <span class="form-label" data-variant="caps">Vendor</span>
                <select class="form-control" bind:value={vendorId}>
                  <option value="">Select vendor</option>
                  {#each data.vendors ?? [] as vendor}
                    <option value={vendor.vendorId}>{vendor.name}</option>
                  {/each}
                </select>
              </label>
            </div>
            <label class="form-field">
              <span class="form-label" data-variant="caps">{unit === 'package' ? 'Purchase price' : 'Unit price'}</span>
              <input class="form-control" type="number" min="0" step="0.01" bind:value={unitPrice} />
              {#if selectedPackage && unit === 'package' && derivedTransaction.derivedUnitPrice}
                <p class="mt-1 text-xs text-content-secondary">
                  Derived unit price: {formatAmount(derivedTransaction.derivedUnitPrice, 'USD')} per {getPreferredDisplayUnit(selectedPackage.baseUnit, measurementSystem, 'inventory') ?? selectedPackage.baseUnit}
                </p>
              {/if}
            </label>
            <label class="form-field">
              <span class="form-label" data-variant="caps">Note</span>
              <textarea class="form-control min-h-[90px]" bind:value={note}></textarea>
            </label>
            {#if transactionError}
              <p class="form-message" data-state="error">{transactionError}</p>
            {/if}
            {#if transactionSuccess}
              <p class="form-message" data-state="success">{transactionSuccess}</p>
            {/if}
            <button class="btn btn-base btn-primary" disabled={transactionBusy} on:click={submitTransaction}>
              {transactionBusy ? 'Saving...' : 'Save inventory activity'}
            </button>
          </div>
        </section>

        <section class="surface-frame rounded-3xl p-6">
          <h2 class="text-xl font-semibold text-content-primary">Recent inventory activity</h2>
          {#if transactions.length}
            <div class="mt-4 space-y-3">
              {#each transactions as item}
                <div class="rounded-2xl border border-border/70 px-4 py-3">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <div class="font-medium text-content-primary">{item.productName}</div>
                      <div class="text-sm text-content-secondary">
                        {item.transactionType} · {formatMeasurementValue(item.quantityDelta, item.unit, measurementSystem, 'inventory')}
                      </div>
                    </div>
                    <div class="text-right text-sm text-content-secondary">
                      <div>{item.vendorName ?? '—'}</div>
                      <div>{new Date(item.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="mt-4 text-sm text-content-secondary">No inventory activity yet.</p>
          {/if}
        </section>
      </div>
    </div>

    <CostsCard
      costs={costs}
      summary={costSummary}
      mode="account"
      pools={data.pools ?? []}
      selectedPoolId={selectedPoolId || null}
      productCategories={data.productCategories ?? []}
      products={data.chemicals ?? []}
    />
  </section>
</Container>
