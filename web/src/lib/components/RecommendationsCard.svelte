<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';

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

  type SavedRecommendation = {
    recommendationId: string;
    type: string;
    title: string;
    description?: string | null;
    payload?: Record<string, unknown> | null;
    status: string;
    createdAt: string;
    userFeedback?: string | null;
  };

  export let poolId = '';
  export let latestTestId: string | undefined;
  export let recommendations: RecommendationPreview | null = null;
  export let hasTest = false;
  export let savedRecommendations: SavedRecommendation[] = [];

  let errorMessage = '';
  let successMessage = '';
  let pendingActions: Record<string, boolean> = {};

  const toDoseLabel = (rec: Recommendation) => {
    const unitLabel = rec.unit ? ` ${rec.unit}` : '';
    return `Add ${rec.amount}${unitLabel} ${rec.chemicalName}`;
  };

  const getSavedChemicalId = (saved: SavedRecommendation) => {
    if (!saved.payload || typeof saved.payload !== 'object') {
      return null;
    }
    const maybeChemicalId = (saved.payload as { chemicalId?: unknown }).chemicalId;
    return typeof maybeChemicalId === 'string' ? maybeChemicalId : null;
  };

  const findSavedByChemical = (rec: Recommendation) =>
    savedRecommendations.find((saved) => getSavedChemicalId(saved) === rec.chemicalId);

  const setPending = (key: string, value: boolean) => {
    pendingActions = { ...pendingActions, [key]: value };
  };

  const parseErrorMessage = async (res: Response, fallback: string) => {
    try {
      const data = await res.json();
      if (typeof data?.error === 'string' && data.error.trim() !== '') {
        return data.error;
      }
      if (typeof data?.message === 'string' && data.message.trim() !== '') {
        return data.message;
      }
    } catch (err) {
      // Ignore JSON parsing errors and fall back to the default message.
    }
    return fallback;
  };

  const buildPayload = (rec: Recommendation) => ({
    chemicalId: rec.chemicalId,
    chemicalName: rec.chemicalName,
    amount: rec.amount,
    unit: rec.unit,
    reason: rec.reason,
    predictedOutcome: rec.predictedOutcome,
  });

  async function handleCreate(rec: Recommendation, status: 'pending' | 'applied') {
    errorMessage = '';
    successMessage = '';
    if (!poolId) {
      errorMessage = 'Pool context is missing. Please refresh and try again.';
      return;
    }
    const key = `${rec.chemicalId}-${status}`;
    if (pendingActions[key]) return;
    setPending(key, true);
    try {
      const payload = buildPayload(rec);
      const res = await api.recommendations.create(poolId, {
        type: 'chemical_dose',
        title: toDoseLabel(rec),
        description: rec.reason,
        payload,
        status,
        linkedTestId: latestTestId,
        userAction: {
          source: 'dashboard',
          action: status === 'applied' ? 'apply' : 'save',
        },
      });
      if (res.ok) {
        const saved = await res.json();
        savedRecommendations = [saved, ...savedRecommendations];
        successMessage =
          status === 'applied'
            ? 'Recommendation marked as applied.'
            : 'Recommendation saved for later.';
      } else {
        errorMessage = await parseErrorMessage(res, 'Unable to save recommendation. Please try again.');
      }
    } catch (err) {
      errorMessage = 'Unable to save recommendation. Please try again.';
    } finally {
      setPending(key, false);
    }
  }

  function handlePrimaryApply() {
    if (!recommendations?.primary) {
      return;
    }
    void handleCreate(recommendations.primary, 'applied');
  }

  async function handleStatusUpdate(recommendationId: string, status: 'applied' | 'dismissed') {
    errorMessage = '';
    successMessage = '';
    if (!poolId) {
      errorMessage = 'Pool context is missing. Please refresh and try again.';
      return;
    }
    const key = `${recommendationId}-${status}`;
    if (pendingActions[key]) return;
    setPending(key, true);
    try {
      const res = await api.recommendations.update(poolId, recommendationId, { status });
      if (res.ok) {
        const updated = await res.json();
        savedRecommendations = savedRecommendations.map((item) =>
          item.recommendationId === recommendationId ? updated : item
        );
        successMessage = status === 'applied' ? 'Recommendation marked as applied.' : 'Recommendation dismissed.';
      } else {
        errorMessage = await parseErrorMessage(res, 'Unable to update recommendation. Please try again.');
      }
    } catch (err) {
      errorMessage = 'Unable to update recommendation. Please try again.';
    } finally {
      setPending(key, false);
    }
  }
</script>

<Card>
  <h2 class="text-lg font-semibold text-content-primary">Recommendations</h2>
  <div class="mt-4 space-y-3">
    {#if errorMessage}
      <p class="text-sm text-rose-500" role="alert">{errorMessage}</p>
    {:else if successMessage}
      <p class="text-sm text-emerald-500" role="status">{successMessage}</p>
    {/if}
    {#if recommendations?.primary || (recommendations?.alternatives?.length ?? 0) > 0}
      {#if recommendations?.primary}
        {@const savedPrimary = findSavedByChemical(recommendations.primary)}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">{toDoseLabel(recommendations.primary)}</div>
            <div class="text-xs text-content-secondary/80">{recommendations.primary.predictedOutcome}</div>
            <div class="text-xs text-content-secondary/70">{recommendations.primary.reason}</div>
          </div>
          {#if savedPrimary}
            <span class="text-xs font-medium text-content-secondary">Saved ({savedPrimary.status})</span>
          {:else}
            <button
              class="btn btn-sm btn-primary"
              disabled={pendingActions[`${recommendations.primary.chemicalId}-applied`]}
              on:click={handlePrimaryApply}
            >
              Apply
            </button>
          {/if}
        </div>
      {/if}
      {#each recommendations?.alternatives ?? [] as rec}
        {@const savedAlt = findSavedByChemical(rec)}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">{toDoseLabel(rec)}</div>
            <div class="text-xs text-content-secondary/80">{rec.predictedOutcome}</div>
            <div class="text-xs text-content-secondary/70">{rec.reason}</div>
          </div>
          {#if savedAlt}
            <span class="text-xs font-medium text-content-secondary">Saved ({savedAlt.status})</span>
          {:else}
            <button
              class="btn btn-sm btn-tonal"
              disabled={pendingActions[`${rec.chemicalId}-pending`]}
              on:click={() => handleCreate(rec, 'pending')}
            >
              Save for later
            </button>
          {/if}
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
  {#if savedRecommendations.length}
    <div class="mt-6 space-y-3">
      <h3 class="text-sm font-semibold text-content-primary">Saved recommendations</h3>
      {#each savedRecommendations as saved}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="text-sm font-medium text-content-primary">{saved.title}</div>
            {#if saved.description}
              <div class="text-xs text-content-secondary/80">{saved.description}</div>
            {/if}
            <div class="text-xs text-content-secondary/70">Status: {saved.status}</div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="btn btn-xs btn-primary"
              disabled={saved.status === 'applied' || pendingActions[`${saved.recommendationId}-applied`]}
              on:click={() => handleStatusUpdate(saved.recommendationId, 'applied')}
            >
              Mark applied
            </button>
            <button
              class="btn btn-xs btn-tonal"
              disabled={saved.status === 'dismissed' || pendingActions[`${saved.recommendationId}-dismissed`]}
              on:click={() => handleStatusUpdate(saved.recommendationId, 'dismissed')}
            >
              Dismiss
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Card>
