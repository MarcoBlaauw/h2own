<script lang="ts">
  import AppHeader from "$lib/components/layout/AppHeader.svelte";
  import Container from "$lib/components/layout/Container.svelte";
  import MetricTile from "$lib/components/MetricTile.svelte";
  import PoolSummaryCard from "$lib/components/PoolSummaryCard.svelte";
  import QuickTestForm from "$lib/components/QuickTestForm.svelte";
  import RecommendationsCard from "$lib/components/RecommendationsCard.svelte";

  export let data;

  const metrics = [
    {
      label: "Free Chlorine",
      value: "3.0 ppm",
      trend: "flat",
      hint: "target 3–5",
    },
    { label: "pH", value: "7.6", trend: "up", hint: "target 7.4–7.6" },
    {
      label: "Total Alkalinity",
      value: "90 ppm",
      trend: "down",
      hint: "target 80–120",
    },
    {
      label: "Cyanuric Acid",
      value: "40 ppm",
      trend: "flat",
      hint: "target 30–50",
    },
    {
      label: "Calcium Hardness",
      value: "250 ppm",
      trend: "flat",
      hint: "target 200–400",
    },
    {
      label: "Phosphates",
      value: "100 ppb",
      trend: "flat",
      hint: "target < 125",
    },
  ] satisfies Array<{
    label: string;
    value: string | number;
    trend?: "flat" | "up" | "down";
    hint?: string;
  }>;
</script>

<Container>
  {#if data.session}
    <!-- Metrics row -->
    <h2 class="text-xl font-semibold mt-6">Last Test Results</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
      {#each metrics as m}
        <MetricTile {...m} />
      {/each}
    </div>

    <!-- Main grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      <div class="lg:col-span-2">
        {#if data.pools.length > 0}
          <PoolSummaryCard pool={data.pools[0]} />
        {/if}
      </div>

      {#if data.pools.length > 0}
        <QuickTestForm poolId={data.pools[0].id} />
      {/if}

      <div class="lg:col-span-3">
        <RecommendationsCard />
      </div>
    </div>
  {:else}
    <div class="text-center mt-10">
      <h1 class="text-2xl">Welcome to H2Own</h1>
      <p class="mt-4">
        Please <a href="/auth/login" class="text-brand-600 hover:underline"
          >sign in</a
        >
        or
        <a href="/auth/register" class="text-brand-600 hover:underline"
          >register</a
        > to manage your pools.
      </p>
    </div>
  {/if}
</Container>
