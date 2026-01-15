<script lang="ts">
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
</script>

<Card>
  <h2 class="text-lg font-semibold text-content-primary">Dosing history</h2>
  {#if dosingHistory.length > 0}
    <div class="mt-4 space-y-3">
      {#each dosingHistory as item}
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
