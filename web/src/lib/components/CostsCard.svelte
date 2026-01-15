<script lang="ts">
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
</script>

<Card>
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-lg font-semibold text-content-primary">Costs</h2>
      <p class="text-xs text-content-secondary">
        {getWindowLabel(summary?.window)}
      </p>
    </div>
    <div class="text-right">
      <div class="text-xl font-semibold text-content-primary">
        {summary ? formatAmount(summary.total, summary.currency ?? 'USD') : '—'}
      </div>
      <div class="text-xs text-content-secondary">Total spend</div>
    </div>
  </div>

  {#if costs.length > 0}
    <div class="mt-4 space-y-3">
      {#each costs as item}
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
