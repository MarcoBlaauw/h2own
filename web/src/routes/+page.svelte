<script lang="ts">
  import Container from "$lib/components/layout/Container.svelte";
  import MetricTile from "$lib/components/MetricTile.svelte";
  import PoolSummaryCard from "$lib/components/PoolSummaryCard.svelte";
  import QuickTestForm from "$lib/components/QuickTestForm.svelte";
  import RecommendationsCard from "$lib/components/RecommendationsCard.svelte";

  type HighlightedPool = {
    id: string;
    owner?: { email?: string | null } | null;
    volumeGallons?: number | null;
    surfaceType?: string | null;
    sanitizerType?: string | null;
    lastTestedAt?: string | Date | null;
  };

  export let data: {
    session?: unknown;
    pools: Array<{ poolId: string }>;
    highlightedPool: HighlightedPool | null;
    latestTest: {
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
  };

  const formatMeasurement = (value: string | number | null | undefined, suffix: string, decimals = 1) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
      return '—';
    }
    return `${numeric.toFixed(decimals)}${suffix}`;
  };

  const metrics = (data.latestTest
    ? [
        {
          label: "Free Chlorine",
          value: formatMeasurement(data.latestTest.freeChlorinePpm, " ppm"),
          trend: "flat",
          hint: "target 3–5",
        },
        {
          label: "pH",
          value: formatMeasurement(data.latestTest.phLevel, "", 1),
          trend: "flat",
          hint: "target 7.4–7.6",
        },
        {
          label: "Total Alkalinity",
          value: formatMeasurement(data.latestTest.totalAlkalinityPpm, " ppm", 0),
          trend: "flat",
          hint: "target 80–120",
        },
        {
          label: "Cyanuric Acid",
          value: formatMeasurement(data.latestTest.cyanuricAcidPpm, " ppm", 0),
          trend: "flat",
          hint: "target 30–50",
        },
        {
          label: "Calcium Hardness",
          value: formatMeasurement(data.latestTest.calciumHardnessPpm, " ppm", 0),
          trend: "flat",
          hint: "target 200–400",
        },
        {
          label: "Salt",
          value: formatMeasurement(data.latestTest.saltPpm, " ppm", 0),
          trend: "flat",
          hint: "target 2700–3400",
        },
      ]
    : []) satisfies Array<{
    label: string;
    value: string | number;
    trend?: "flat" | "up" | "down";
    hint?: string;
  }>;
</script>

<Container>
  {#if data.session}
    <!-- Metrics row -->
    <h2 class="mt-6 text-xl font-semibold text-content-primary">Last Test Results</h2>
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

    <!-- Main grid -->
    <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        {#if data.highlightedPool}
          <PoolSummaryCard pool={data.highlightedPool} />
        {:else}
          <p class="text-sm text-content-secondary">No pools available yet.</p>
        {/if}
      </div>

      {#if data.highlightedPool}
        <QuickTestForm poolId={data.highlightedPool.id} />
      {/if}

      <div class="lg:col-span-3">
        <RecommendationsCard recommendations={data.recommendations} hasTest={Boolean(data.latestTest)} />
      </div>
    </div>
  {:else}
    <div class="mt-10 text-center">
      <h1 class="text-2xl font-semibold text-content-primary">Welcome to H2Own</h1>
      <p class="mt-4 text-content-secondary">
        Please <a href="/auth/login" class="font-medium text-accent hover:text-accent-strong underline-offset-2 hover:underline"
          >sign in</a
        >
        or
        <a href="/auth/register" class="font-medium text-accent hover:text-accent-strong underline-offset-2 hover:underline"
          >register</a
        > to manage your pools.
      </p>
    </div>
  {/if}
</Container>
