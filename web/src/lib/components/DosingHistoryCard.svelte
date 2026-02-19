<script lang="ts">
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';

  type DosingEvent = {
    actionId: string;
    chemicalId: string;
    chemicalName?: string | null;
    amount: string | number;
    unit: string | null;
    addedAt: string | Date | null;
    reason?: string | null;
    additionMethod?: string | null;
  };

  export let dosingHistory: DosingEvent[] = [];
  export let poolId: string | null = null;

  const listLimit = 5;
  let historyItems = dosingHistory;
  let lastDosingHistory = dosingHistory;
  let chemicalId = '';
  let amount = '';
  let unit = 'oz';
  let addedAt = '';
  let error = '';
  let success = '';
  let isSubmitting = false;

  $: if (dosingHistory !== lastDosingHistory) {
    historyItems = dosingHistory;
    lastDosingHistory = dosingHistory;
  }

  const formatAmount = (amount: string | number | null | undefined, unit?: string | null) => {
    if (amount === null || amount === undefined) return '—';
    const numeric = typeof amount === 'number' ? amount : Number.parseFloat(amount);
    const value = Number.isNaN(numeric) ? String(amount) : numeric.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    return `${value}${unit ? ` ${unit}` : ''}`;
  };

  const formatDate = (value?: string | Date | null) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
      error = 'Select a pool before logging dosing.';
      return;
    }

    const trimmedChemicalId = chemicalId.trim();
    if (!trimmedChemicalId) {
      error = 'Chemical ID is required.';
      return;
    }

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      error = 'Amount must be greater than 0.';
      return;
    }

    const trimmedUnit = unit.trim();
    if (!trimmedUnit) {
      error = 'Unit is required.';
      return;
    }

    let addedAtIso: string | undefined;
    if (addedAt) {
      const parsedDate = new Date(addedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        error = 'Timestamp must be a valid date and time.';
        return;
      }
      addedAtIso = parsedDate.toISOString();
    }

    isSubmitting = true;
    try {
      const res = await api.dosing.create(poolId, {
        chemicalId: trimmedChemicalId,
        amount: parsedAmount,
        unit: trimmedUnit,
        ...(addedAtIso ? { addedAt: addedAtIso } : {}),
      });

      if (!res.ok) {
        error = await buildErrorMessage(res, 'Unable to log dosing event. Please try again.');
        return;
      }

      success = 'Dosing event logged.';
      chemicalId = '';
      amount = '';
      addedAt = '';

      try {
        const listRes = await api.dosing.list(poolId, undefined, { limit: listLimit });
        if (!listRes.ok) {
          error = await buildErrorMessage(
            listRes,
            'Dosing saved, but unable to refresh history.'
          );
          return;
        }
        const payload = await listRes.json();
        historyItems = payload.items ?? [];
      } catch (listError) {
        error = 'Dosing saved, but unable to refresh history.';
      }
    } catch (requestError) {
      error = 'Unable to log dosing event. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Card status={error ? 'danger' : success ? 'success' : 'default'}>
  <h2 class="text-lg font-semibold text-content-primary">Dosing history</h2>
  <form
    class="mt-4 form-grid"
    aria-describedby={error ? 'dosing-form-error' : success ? 'dosing-form-success' : undefined}
    aria-busy={isSubmitting}
    on:submit|preventDefault={handleSubmit}
  >
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="dosing-chemical">Chemical ID</label>
      <input
        id="dosing-chemical"
        type="text"
        bind:value={chemicalId}
        class="form-control"
        disabled={isSubmitting}
        placeholder="UUID"
      >
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="dosing-amount">Amount</label>
      <input
        id="dosing-amount"
        type="number"
        min="0"
        step="0.01"
        bind:value={amount}
        class="form-control"
        disabled={isSubmitting}
      >
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="dosing-unit">Unit</label>
      <input
        id="dosing-unit"
        type="text"
        bind:value={unit}
        class="form-control"
        disabled={isSubmitting}
        placeholder="oz"
      >
    </div>
    <div class="form-field">
      <label class="form-label" data-variant="caps" for="dosing-added-at">Added at</label>
      <input
        id="dosing-added-at"
        type="datetime-local"
        bind:value={addedAt}
        class="form-control"
        disabled={isSubmitting}
      >
    </div>
    {#if error}
      <p class="form-message sm:col-span-2" data-state="error" role="alert" id="dosing-form-error">
        {error}
      </p>
    {/if}
    {#if success}
      <p
        class="form-message sm:col-span-2"
        data-state="success"
        role="status"
        aria-live="polite"
        id="dosing-form-success"
      >
        {success}
      </p>
    {/if}
    <button type="submit" class="sm:col-span-2 btn btn-base btn-primary" disabled={isSubmitting}>
      {#if isSubmitting}
        Logging...
      {:else}
        Log dosing
      {/if}
    </button>
  </form>
  {#if historyItems.length > 0}
    <div class="mt-4 space-y-3">
      {#each historyItems as item}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">
              {item.chemicalName ?? 'Chemical added'}
            </div>
            {#if item.reason}
              <div class="text-xs text-content-secondary/80">{item.reason}</div>
            {:else if item.additionMethod}
              <div class="text-xs text-content-secondary/80">{item.additionMethod}</div>
            {/if}
          </div>
          <div class="text-right">
            <div class="text-sm font-semibold text-content-primary">
              {formatAmount(item.amount, item.unit ?? undefined)}
            </div>
            <div class="mt-1 text-xs text-content-secondary/80">
              {formatDate(item.addedAt)}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="mt-3 text-sm text-content-secondary">
      No dosing events yet. Add chemicals to start tracking history.
    </p>
  {/if}
</Card>
