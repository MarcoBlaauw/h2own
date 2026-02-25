<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Container from '$lib/components/layout/Container.svelte';
  import MetricTile from '$lib/components/MetricTile.svelte';
  import PoolSummaryCard from '$lib/components/PoolSummaryCard.svelte';
  import QuickTestForm from '$lib/components/QuickTestForm.svelte';
  import RecommendationsCard from '$lib/components/RecommendationsCard.svelte';
  import DosingHistoryCard from '$lib/components/DosingHistoryCard.svelte';
  import CostsCard from '$lib/components/CostsCard.svelte';
  import WeatherQualityCard from '$lib/components/WeatherQualityCard.svelte';
  import AdSlot from '$lib/components/AdSlot.svelte';
  import AiMaintenanceAdvisorCard from '$lib/components/AiMaintenanceAdvisorCard.svelte';
  import { api } from '$lib/api';
  import { page } from '$app/stores';

  type HighlightedPool = {
    id: string;
    name?: string;
    owner?: { email?: string | null } | null;
    volumeGallons?: number | null;
    surfaceType?: string | null;
    sanitizerType?: string | null;
    locationId?: string | null;
    lastTestedAt?: string | Date | null;
  };

  export let data: {
    pools: Array<{ poolId: string; name?: string }>;
    highlightedPool: HighlightedPool | null;
    defaultPoolId?: string | null;
    latestTest: {
      sessionId?: string;
      freeChlorinePpm?: string | null;
      phLevel?: string | null;
      totalAlkalinityPpm?: number | null;
      cyanuricAcidPpm?: number | null;
      calciumHardnessPpm?: number | null;
      saltPpm?: number | null;
    } | null;
    recommendations: {
      primary: {
        chemicalId: string;
        chemicalName: string;
        amount: number;
        unit: string | null;
        reason: string;
        predictedOutcome: string;
      } | null;
      alternatives: Array<{
        chemicalId: string;
        chemicalName: string;
        amount: number;
        unit: string | null;
        reason: string;
        predictedOutcome: string;
      }>;
    } | null;
    recommendationHistory: Array<{
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
    }>;
    dosingHistory: Array<{
      actionId: string;
      chemicalId: string;
      chemicalName?: string | null;
      amount: string | number;
      unit: string | null;
      addedAt: string | Date | null;
      reason?: string | null;
      additionMethod?: string | null;
    }>;
    costs: Array<{
      costId: string;
      amount: string | number;
      currency?: string | null;
      categoryName?: string | null;
      description?: string | null;
      vendor?: string | null;
      incurredAt: string | Date | null;
    }>;
    costSummary: {
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
    } | null;
    weatherDaily: Array<{
      weatherId: string;
      locationId: string;
      recordedAt: string;
      createdAt?: string | null;
      sunriseTime?: string | null;
      sunsetTime?: string | null;
      visibilityMi?: string | number | null;
      cloudCoverPercent?: string | number | null;
      cloudBaseKm?: string | number | null;
      cloudCeilingKm?: string | number | null;
      airTempF?: number | null;
      temperatureApparentF?: number | null;
      uvIndex?: number | null;
      uvHealthConcern?: number | null;
      ezHeatStressIndex?: number | null;
      rainfallIn?: string | number | null;
      windSpeedMph?: number | null;
      windDirectionDeg?: number | null;
      windGustMph?: number | null;
      humidityPercent?: number | null;
    }>;
    weatherError?: string | null;
  };

  const formatMeasurement = (
    value: string | number | null | undefined,
    suffix: string,
    decimals = 1,
  ) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
      return '—';
    }
    return `${numeric.toFixed(decimals)}${suffix}`;
  };

  const metrics = (
    data.latestTest
      ? [
          {
            label: 'Free Chlorine',
            value: formatMeasurement(data.latestTest.freeChlorinePpm, ' ppm'),
            trend: 'flat',
            hint: 'target 3–5',
          },
          {
            label: 'pH',
            value: formatMeasurement(data.latestTest.phLevel, '', 1),
            trend: 'flat',
            hint: 'target 7.4–7.6',
          },
          {
            label: 'Total Alkalinity',
            value: formatMeasurement(data.latestTest.totalAlkalinityPpm, ' ppm', 0),
            trend: 'flat',
            hint: 'target 80–120',
          },
          {
            label: 'Cyanuric Acid',
            value: formatMeasurement(data.latestTest.cyanuricAcidPpm, ' ppm', 0),
            trend: 'flat',
            hint: 'target 30–50',
          },
          {
            label: 'Calcium Hardness',
            value: formatMeasurement(data.latestTest.calciumHardnessPpm, ' ppm', 0),
            trend: 'flat',
            hint: 'target 200–400',
          },
          {
            label: 'Salt',
            value: formatMeasurement(data.latestTest.saltPpm, ' ppm', 0),
            trend: 'flat',
            hint: 'target 2700–3400',
          },
        ]
      : []
  ) satisfies Array<{
    label: string;
    value: string | number;
    trend?: 'flat' | 'up' | 'down';
    hint?: string;
  }>;

  let showQuickModal = false;
  let showGuidedModal = false;
  let selectedPoolId =
    data.highlightedPool?.id ??
    (typeof data.defaultPoolId === 'string' ? data.defaultPoolId : '') ??
    '';
  let isGuidedSubmitting = false;
  let guidedError = '';
  let guidedSuccess = '';
  let guided = {
    fc: '',
    tc: '',
    ph: '',
    ta: '',
    cya: '',
    ch: '',
    salt: '',
    temp: '',
  };

  $: adsEnabledForOverview = Boolean($page.data.session?.monetization?.adsEnabled);

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  async function handleGuidedSubmit() {
    if (!data.highlightedPool?.id) return;
    guidedError = '';
    guidedSuccess = '';
    isGuidedSubmitting = true;
    try {
      const payload = {
        fc: parseOptionalNumber(guided.fc),
        tc: parseOptionalNumber(guided.tc),
        ph: parseOptionalNumber(guided.ph),
        ta: parseOptionalNumber(guided.ta),
        cya: parseOptionalNumber(guided.cya),
        ch: parseOptionalNumber(guided.ch),
        salt: parseOptionalNumber(guided.salt),
        temp: parseOptionalNumber(guided.temp),
      };
      const res = await api.tests.create(data.highlightedPool.id, payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        guidedError = body.message ?? body.error ?? `Unable to save guided test (${res.status}).`;
        return;
      }
      guidedSuccess = 'Guided test saved.';
      await invalidateAll();
    } catch {
      guidedError = 'Unable to save guided test.';
    } finally {
      isGuidedSubmitting = false;
    }
  }

  function closeModals() {
    showQuickModal = false;
    showGuidedModal = false;
  }

  async function handlePoolSelectionChange() {
    if (!selectedPoolId) return;
    await api.me.updatePreferences({ defaultPoolId: selectedPoolId }).catch(() => null);
    await goto(`/overview?poolId=${selectedPoolId}`, { invalidateAll: true });
  }
</script>

<Container>
  <header class="mt-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold text-content-primary">Pool Overview</h1>
      <p class="text-sm text-content-secondary">
        Active pool dashboard and testing workflows.
      </p>
    </div>
    <div class="min-w-[220px]">
      <label class="text-xs font-semibold uppercase tracking-wide text-content-secondary" for="overview-pool-selector">Pool</label>
      <select id="overview-pool-selector" class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={selectedPoolId} on:change={handlePoolSelectionChange}>
        {#each data.pools as pool}
          <option value={pool.poolId}>{pool.name ?? pool.poolId}</option>
        {/each}
      </select>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-sm btn-primary" on:click={() => (showQuickModal = true)} disabled={!data.highlightedPool}>
        Quick test
      </button>
      <button class="btn btn-sm btn-secondary" on:click={() => (showGuidedModal = true)} disabled={!data.highlightedPool}>
        Guided full test
      </button>
    </div>
  </header>

  <div class="mt-6 flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-xl font-semibold text-content-primary">Last Test Results</h2>
    {#if data.latestTest?.sessionId}
      <a class="text-sm font-semibold text-accent hover:text-accent-strong" href={`/tests/${data.latestTest.sessionId}`}>
        View test details
      </a>
    {/if}
  </div>
  {#if data.latestTest}
    <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each metrics as m}
        <MetricTile {...m} />
      {/each}
    </div>
  {:else}
    <p class="mt-3 text-sm text-content-secondary">
      No test results yet. Add a new test to populate metrics.
    </p>
  {/if}

  <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="lg:col-span-2">
      {#if data.highlightedPool}
        <PoolSummaryCard pool={data.highlightedPool} />
      {:else}
        <p class="text-sm text-content-secondary">No pools available yet.</p>
      {/if}
    </div>

    <div class="lg:col-span-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <RecommendationsCard
        recommendations={data.recommendations}
        hasTest={Boolean(data.latestTest)}
        poolId={data.highlightedPool?.id}
        recommendationHistory={data.recommendationHistory}
      />
      <DosingHistoryCard
        dosingHistory={data.dosingHistory}
        poolId={data.highlightedPool?.id ?? null}
      />
    </div>
    <div class="lg:col-span-3">
      <CostsCard
        costs={data.costs}
        summary={data.costSummary}
        poolId={data.highlightedPool?.id ?? null}
      />
    </div>
    <div class="lg:col-span-3">
      <AiMaintenanceAdvisorCard
        poolName={data.highlightedPool?.name ?? null}
        hasLatestTest={Boolean(data.latestTest)}
        recommendations={data.recommendations}
        weatherDaily={data.weatherDaily}
        dosingHistoryCount={data.dosingHistory.length}
      />
    </div>
    <div class="lg:col-span-3">
      <WeatherQualityCard dailyWeather={data.weatherDaily} error={data.weatherError ?? null} />
    </div>
    <div class="lg:col-span-3">
      <AdSlot enabled={adsEnabledForOverview} placement="overview_footer" />
    </div>
  </div>
</Container>

{#if showQuickModal && data.highlightedPool}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Quick test dialog">
    <div
      class="w-full max-w-2xl rounded-xl border border-border p-4 shadow-card"
      style="background-color: rgb(var(--color-bg-raised)); opacity: 1;"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-content-primary">Quick Test</h2>
        <button class="btn btn-sm btn-tonal" on:click={closeModals}>Close</button>
      </div>
      <QuickTestForm poolId={data.highlightedPool.id} />
    </div>
  </div>
{/if}

{#if showGuidedModal && data.highlightedPool}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Guided test dialog">
    <div
      class="w-full max-w-2xl rounded-xl border border-border p-4 shadow-card"
      style="background-color: rgb(var(--color-bg-raised)); opacity: 1;"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-content-primary">Guided Full Test</h2>
        <button class="btn btn-sm btn-tonal" on:click={closeModals}>Close</button>
      </div>
      <form class="form-grid" on:submit|preventDefault={handleGuidedSubmit}>
        <label class="form-field">
          <span class="form-label">Free Chlorine (ppm)</span>
          <input class="form-control" type="number" step="0.1" bind:value={guided.fc} />
        </label>
        <label class="form-field">
          <span class="form-label">Total Chlorine (ppm)</span>
          <input class="form-control" type="number" step="0.1" bind:value={guided.tc} />
        </label>
        <label class="form-field">
          <span class="form-label">pH</span>
          <input class="form-control" type="number" step="0.1" bind:value={guided.ph} />
        </label>
        <label class="form-field">
          <span class="form-label">Total Alkalinity (ppm)</span>
          <input class="form-control" type="number" step="1" bind:value={guided.ta} />
        </label>
        <label class="form-field">
          <span class="form-label">Cyanuric Acid (ppm)</span>
          <input class="form-control" type="number" step="1" bind:value={guided.cya} />
        </label>
        <label class="form-field">
          <span class="form-label">Calcium Hardness (ppm)</span>
          <input class="form-control" type="number" step="1" bind:value={guided.ch} />
        </label>
        <label class="form-field">
          <span class="form-label">Salt (ppm)</span>
          <input class="form-control" type="number" step="1" bind:value={guided.salt} />
        </label>
        <label class="form-field">
          <span class="form-label">Water Temp (F)</span>
          <input class="form-control" type="number" step="0.1" bind:value={guided.temp} />
        </label>
        {#if guidedError}
          <p class="form-message sm:col-span-2" data-state="error">{guidedError}</p>
        {/if}
        {#if guidedSuccess}
          <p class="form-message sm:col-span-2" data-state="success">{guidedSuccess}</p>
        {/if}
        <div class="sm:col-span-2">
          <button class="btn btn-base btn-primary w-full" type="submit" disabled={isGuidedSubmitting}>
            {isGuidedSubmitting ? 'Saving...' : 'Save guided test'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
