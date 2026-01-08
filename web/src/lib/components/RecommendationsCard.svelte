<script lang="ts">
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

  export let recommendations: RecommendationPreview | null = null;
  export let hasTest = false;

  const toDoseLabel = (rec: Recommendation) => {
    const unitLabel = rec.unit ? ` ${rec.unit}` : '';
    return `Add ${rec.amount}${unitLabel} ${rec.chemicalName}`;
  };
</script>

<Card>
  <h2 class="text-lg font-semibold text-content-primary">Recommendations</h2>
  <div class="mt-4 space-y-3">
    {#if recommendations?.primary || (recommendations?.alternatives?.length ?? 0) > 0}
      {#if recommendations?.primary}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">{toDoseLabel(recommendations.primary)}</div>
            <div class="text-xs text-content-secondary/80">{recommendations.primary.predictedOutcome}</div>
            <div class="text-xs text-content-secondary/70">{recommendations.primary.reason}</div>
          </div>
          <button class="btn btn-sm btn-primary">Apply</button>
        </div>
      {/if}
      {#each recommendations?.alternatives ?? [] as rec}
        <div class="surface-panel flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="font-medium text-content-primary">{toDoseLabel(rec)}</div>
            <div class="text-xs text-content-secondary/80">{rec.predictedOutcome}</div>
            <div class="text-xs text-content-secondary/70">{rec.reason}</div>
          </div>
          <button class="btn btn-sm btn-tonal">Save for later</button>
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
</Card>
