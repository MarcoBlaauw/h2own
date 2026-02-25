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

  export let poolName: string | null = null;
  export let hasLatestTest = false;
  export let recommendations: {
    primary: Recommendation | null;
    alternatives: Recommendation[];
  } | null = null;
  export let weatherDaily: Array<{
    uvIndex?: number | null;
    rainfallIn?: string | number | null;
    airTempF?: number | null;
  }> = [];
  export let dosingHistoryCount = 0;

  const toNullableNumber = (value: unknown) => {
    if (value === null || value === undefined) return null;
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const latestWeather = weatherDaily?.[0] ?? null;
  const uv = toNullableNumber(latestWeather?.uvIndex);
  const rain = toNullableNumber(latestWeather?.rainfallIn);
  const heat = toNullableNumber(latestWeather?.airTempF);

  const phaseOne = recommendations?.primary
    ? `Dose ${recommendations.primary.amount}${recommendations.primary.unit ? ` ${recommendations.primary.unit}` : ''} ${recommendations.primary.chemicalName}.`
    : hasLatestTest
      ? 'No immediate dosing correction is predicted from the latest test.'
      : 'Run a new water test to generate a targeted stabilization step.';

  const weatherSignals: string[] = [];
  if (uv !== null && uv >= 7) weatherSignals.push('high UV');
  if (rain !== null && rain >= 0.25) weatherSignals.push('recent rain');
  if (heat !== null && heat >= 90) weatherSignals.push('high heat');
  const phaseTwo =
    weatherSignals.length > 0
      ? `Monitor sanitizer drift over the next 24 hours due to ${weatherSignals.join(', ')}.`
      : 'Re-test in 24 hours to confirm the pool remains inside target ranges.';

  const phaseThree =
    dosingHistoryCount > 0
      ? 'Use recent dosing history to build a weekly baseline and avoid over-correction.'
      : 'Start logging dosing actions to improve forecast confidence and reduce guesswork.';

  const assumptions = [
    'Guidance is advisory-only; no chemical actions are auto-applied.',
    'Recommendations assume current pool volume and recent test values are accurate.',
    'Weather adjustments use available daily forecast/sensor context and can change quickly.',
  ];

  const confidence =
    hasLatestTest && recommendations?.primary
      ? 'Medium'
      : hasLatestTest
        ? 'Low'
        : 'Low';
</script>

<Card>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="text-lg font-semibold text-content-primary">AI Maintenance Advisor (Beta)</h2>
      <p class="text-sm text-content-secondary">
        Read-only phased plan for {poolName ?? 'your pool'} based on latest chemistry and context signals.
      </p>
    </div>
    <span class="rounded-full border border-border/60 px-2 py-1 text-xs font-semibold text-content-secondary">
      Confidence: {confidence}
    </span>
  </div>

  <div class="mt-4 grid gap-3 md:grid-cols-3">
    <div class="surface-panel">
      <h3 class="text-sm font-semibold text-content-primary">Phase 1: Stabilize</h3>
      <p class="mt-1 text-sm text-content-secondary">{phaseOne}</p>
    </div>
    <div class="surface-panel">
      <h3 class="text-sm font-semibold text-content-primary">Phase 2: Verify</h3>
      <p class="mt-1 text-sm text-content-secondary">{phaseTwo}</p>
    </div>
    <div class="surface-panel">
      <h3 class="text-sm font-semibold text-content-primary">Phase 3: Maintain</h3>
      <p class="mt-1 text-sm text-content-secondary">{phaseThree}</p>
    </div>
  </div>

  <div class="mt-4 border-t border-border/60 pt-3">
    <h3 class="text-sm font-semibold text-content-primary">Assumptions and safety</h3>
    <ul class="mt-2 list-disc space-y-1 pl-5 text-xs text-content-secondary">
      {#each assumptions as item}
        <li>{item}</li>
      {/each}
    </ul>
  </div>
</Card>
