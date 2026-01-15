<script lang="ts">
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';

  type Recommendation = {
    chemicalId: string;
    chemicalName: string;
    amount: number;
    unit: string | null;
    reason: string;
    predictedOutcome: string;
  };

  type RecommendationPreview = {
    primary: Recommendation | null;
    alternatives: Recommendation[];
  };

  type RecommendationHistoryItem = {
    recommendationId: string;
    type: string;
    title: string;
    description?: string | null;
    status: string;
    payload?: {
      chemicalId?: string;
      chemicalName?: string;
      amount?: number;
      unit?: string | null;
      predictedOutcome?: string;
    } | null;
    createdAt: string;
  };

  export let recommendations: RecommendationPreview | null = null;
  export let hasTest = false;
  export let poolId: string | null = null;
  export let recommendationHistory: RecommendationHistoryItem[] = [];

  const toDoseLabel = (rec: Recommendation) => {
    const unitLabel = rec.unit ? ` ${rec.unit}` : '';
    return `Add ${rec.amount}${unitLabel} ${rec.chemicalName}`;
  };

  const getActionKey = (rec: Recommendation, action: 'applied' | 'saved') =>
    `${rec.chemicalId}-${action}`;

  const formatStatus = (status: string) => status.replace(/_/g, ' ');

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  let historyItems = recommendationHistory;
  let actionError: string | null = null;
  let actionState: Record<string, { loading: boolean; status?: 'applied' | 'saved' }> = {};

  $: if (recommendationHistory !== historyItems) {
    historyItems = recommendationHistory;
  }

  const isActionComplete = (rec: Recommendation, action: 'applied' | 'saved') => {
    const key = getActionKey(rec, action);
    if (actionState[key]?.status) {
      return true;
    }
    return historyItems.some((item) => {
      if (item.status !== action) return false;
      return item.payload?.chemicalId === rec.chemicalId;
    });
  };

  const isActionBusy = (rec: Recommendation, action: 'applied' | 'saved') => {
    const key = getActionKey(rec, action);
    return Boolean(actionState[key]?.loading);
  };

  const getActionLabel = (rec: Recommendation, action: 'applied' | 'saved') => {
    const key = getActionKey(rec, action);
    if (actionState[key]?.loading) {
      return action === 'applied' ? 'Applying...' : 'Saving...';
    }
    if (isActionComplete(rec, action)) {
      return action === 'applied' ? 'Applied' : 'Saved';
    }
    return action === 'applied' ? 'Apply' : 'Save for later';
  };

  const handleAction = async (rec: Recommendation, action: 'applied' | 'saved') => {
    if (!poolId || isActionComplete(rec, action)) {
      return;
    }
    const key = getActionKey(rec, action);
    actionState = { ...actionState, [key]: { loading: true } };
    actionError = null;

    const body = {
      type: 'dosing',
      title: toDoseLabel(rec),
      description: rec.reason,
      payload: {
        chemicalId: rec.chemicalId,
        chemicalName: rec.chemicalName,
        amount: rec.amount,
        unit: rec.unit,
        predictedOutcome: rec.predictedOutcome,
      },
      status: action,
      userAction: { source: 'dashboard', action },
    };

    try {
      const res = await api.recommendations.create(poolId, body);
      if (!res.ok) {
        actionError = `Failed to ${action} recommendation (${res.status}).`;
        actionState = { ...actionState, [key]: { loading: false } };
        return;
      }
      const created = await res.json();
      historyItems = [created, ...historyItems];
      actionState = { ...actionState, [key]: { loading: false, status: action } };
    } catch (err) {
      actionError = `Failed to ${action} recommendation.`;
      actionState = { ...actionState, [key]: { loading: false } };
    }
  };
</script>

<Card>
  <h2 class="text-lg font-semibold text-content-primary">Recommendations</h2>
  <div class="mt-4 space-y-3">
  {#if recommendations?.primary || (recommendations?.alternatives?.length ?? 0) > 0}
    {#if recommendations?.primary}
      {@const primary = recommendations.primary}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">{toDoseLabel(primary)}</div>
            <div class="text-xs text-content-secondary/80">{primary.predictedOutcome}</div>
            <div class="text-xs text-content-secondary/70">{primary.reason}</div>
          </div>
          <button
            class="btn btn-sm btn-primary"
            disabled={
              !poolId ||
              isActionComplete(primary, 'applied') ||
              isActionBusy(primary, 'applied')
            }
            on:click={() => handleAction(primary, 'applied')}
          >
            {getActionLabel(primary, 'applied')}
          </button>
        </div>
      {/if}
      {#each recommendations?.alternatives ?? [] as rec}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">{toDoseLabel(rec)}</div>
            <div class="text-xs text-content-secondary/80">{rec.predictedOutcome}</div>
            <div class="text-xs text-content-secondary/70">{rec.reason}</div>
          </div>
          <button
            class="btn btn-sm btn-tonal"
            disabled={!poolId || isActionComplete(rec, 'saved') || isActionBusy(rec, 'saved')}
            on:click={() => handleAction(rec, 'saved')}
          >
            {getActionLabel(rec, 'saved')}
          </button>
        </div>
      {/each}
    {:else if hasTest}
      <p class="text-sm text-content-secondary">
        Your latest test is within target ranges. No recommendations needed right now.
      </p>
    {:else}
      <p class="text-sm text-content-secondary">
        Add a test to get tailored recommendations for your pool.
      </p>
    {/if}
  </div>
  {#if actionError}
    <p class="mt-3 text-sm text-danger" role="alert">{actionError}</p>
  {/if}
  {#if historyItems.length > 0}
    <div class="mt-6 border-t border-border/60 pt-4">
      <div class="flex items-center justify-between text-sm font-semibold text-content-primary">
        <span>Recent activity</span>
        <span class="text-xs font-normal text-content-secondary">
          {historyItems.length} saved/applied
        </span>
      </div>
      <div class="mt-3 space-y-3">
        {#each historyItems as item}
          <div class="flex items-start justify-between gap-4 text-sm">
            <div class="space-y-1">
              <div class="font-medium text-content-primary">{item.title}</div>
              {#if item.description}
                <div class="text-xs text-content-secondary/80">{item.description}</div>
              {/if}
            </div>
            <div class="text-right">
              <span
                class="inline-flex rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-content-secondary"
              >
                {formatStatus(item.status)}
              </span>
              <div class="mt-1 text-xs text-content-secondary/80">{formatDate(item.createdAt)}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</Card>
