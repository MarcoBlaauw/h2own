<script lang="ts">
  import Container from "$lib/components/layout/Container.svelte";
  import MetricTile from "$lib/components/MetricTile.svelte";
  import PoolSummaryCard from "$lib/components/PoolSummaryCard.svelte";
  import QuickTestForm from "$lib/components/QuickTestForm.svelte";
  import RecommendationsCard from "$lib/components/RecommendationsCard.svelte";
  import DosingHistoryCard from "$lib/components/DosingHistoryCard.svelte";
  import CostsCard from "$lib/components/CostsCard.svelte";
  import WeatherQualityCard from "$lib/components/WeatherQualityCard.svelte";

  type HighlightedPool = {
    id: string;
    owner?: { email?: string | null } | null;
    volumeGallons?: number | null;
    surfaceType?: string | null;
    sanitizerType?: string | null;
    locationId?: string | null;
    lastTestedAt?: string | Date | null;
  };

  export let data: {
    session?: unknown;
    pools: Array<{ poolId: string }>;
    highlightedPool: HighlightedPool | null;
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
      window: "week" | "month" | "year";
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
      airTempF?: number | null;
      uvIndex?: number | null;
      rainfallIn?: string | number | null;
      windSpeedMph?: number | null;
      humidityPercent?: number | null;
    }>;
    weatherError?: string | null;
  };

  const formatMeasurement = (
    value: string | number | null | undefined,
    suffix: string,
    decimals = 1,
  ) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    const numeric =
      typeof value === "number" ? value : Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
      return "—";
    }
    return `${numeric.toFixed(decimals)}${suffix}`;
  };

  const metrics = (
    data.latestTest
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
            value: formatMeasurement(
              data.latestTest.totalAlkalinityPpm,
              " ppm",
              0,
            ),
            trend: "flat",
            hint: "target 80–120",
          },
          {
            label: "Cyanuric Acid",
            value: formatMeasurement(
              data.latestTest.cyanuricAcidPpm,
              " ppm",
              0,
            ),
            trend: "flat",
            hint: "target 30–50",
          },
          {
            label: "Calcium Hardness",
            value: formatMeasurement(
              data.latestTest.calciumHardnessPpm,
              " ppm",
              0,
            ),
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
      : []
  ) satisfies Array<{
    label: string;
    value: string | number;
    trend?: "flat" | "up" | "down";
    hint?: string;
  }>;
</script>

<Container>
  {#if data.session}
    <!-- Metrics row -->
    <div class="mt-6 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-xl font-semibold text-content-primary">
        Last Test Results
      </h2>
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
        <WeatherQualityCard dailyWeather={data.weatherDaily} error={data.weatherError ?? null} />
      </div>
    </div>
  {:else}
    <div class="bg-surface">
      <section
        class="relative overflow-hidden rounded-3xl border border-border/60 bg-surface-subtle px-6 py-12 shadow-sm sm:px-10"
      >
        <div
          class="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
        ></div>
        <div
          class="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-accent-strong/15 blur-3xl"
        ></div>
        <div class="relative z-10">
          <span
            class="inline-flex items-center rounded-full border border-border/60 bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wide text-content-secondary"
          >
            Pool care, simplified
          </span>
          <h1
            class="mt-6 text-3xl font-semibold text-content-primary sm:text-4xl lg:text-5xl"
          >
            Modern pool insights that keep water crystal-clear in minutes.
          </h1>
          <p class="mt-5 max-w-2xl text-base text-content-secondary sm:text-lg">
            H2Own turns test results into clear actions. Track chemistry,
            schedule reminders, and get smart recommendations without
            spreadsheets or guesswork.
          </p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="/auth/register" class="btn btn-base btn-primary btn-pill">
              Get started free
            </a>
            <a href="/auth/login" class="btn btn-base btn-secondary btn-pill">
              Sign in
            </a>
          </div>
          <div
            class="mt-8 flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-wide text-content-secondary/80"
          >
            <span
              class="rounded-full border border-border/60 bg-surface px-3 py-1"
              >Smart dosing</span
            >
            <span
              class="rounded-full border border-border/60 bg-surface px-3 py-1"
              >Cloud sync</span
            >
            <span
              class="rounded-full border border-border/60 bg-surface px-3 py-1"
              >Seasonal guidance</span
            >
          </div>
        </div>
      </section>

      <section class="mt-12 grid gap-6 md:grid-cols-3">
        {#each [{ title: "Personalized water targets", description: "Set ideal ranges for your pool type and get immediate feedback when values drift." }, { title: "Actionable recommendations", description: "Get clear dosing amounts and predicted outcomes tailored to your last test." }, { title: "Shared access for teams", description: "Invite staff or family to view history, add notes, and stay aligned." }] as item}
          <div
            class="rounded-2xl border border-border/60 bg-surface-subtle p-6 shadow-sm"
          >
            <h3 class="text-lg font-semibold text-content-primary">
              {item.title}
            </h3>
            <p class="mt-3 text-sm text-content-secondary">
              {item.description}
            </p>
          </div>
        {/each}
      </section>

      <section
        class="mt-12 rounded-3xl border border-border/60 bg-surface px-6 py-10 shadow-sm sm:px-10"
      >
        <div class="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h2 class="text-2xl font-semibold text-content-primary">
              Built for busy pool owners and pros.
            </h2>
            <p class="mt-4 text-sm text-content-secondary sm:text-base">
              Whether you manage one backyard pool or a fleet of properties,
              H2Own keeps your essentials in one place with instant visibility.
            </p>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <div
                class="rounded-2xl border border-border/60 bg-surface-subtle p-4"
              >
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80"
                >
                  Average time saved
                </p>
                <p class="mt-2 text-2xl font-semibold text-content-primary">
                  3 hrs/week
                </p>
              </div>
              <div
                class="rounded-2xl border border-border/60 bg-surface-subtle p-4"
              >
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-content-secondary/80"
                >
                  Fewer guesswork doses
                </p>
                <p class="mt-2 text-2xl font-semibold text-content-primary">
                  -42%
                </p>
              </div>
            </div>
          </div>
          <div
            class="rounded-2xl border border-border/60 bg-surface-subtle p-6"
          >
            <h3 class="text-lg font-semibold text-content-primary">
              How it works
            </h3>
            <ol class="mt-4 space-y-4 text-sm text-content-secondary">
              <li class="flex gap-3">
                <span
                  class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent"
                  >1</span
                >
                Log your test results in seconds.
              </li>
              <li class="flex gap-3">
                <span
                  class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent"
                  >2</span
                >
                Review targets, alerts, and trends.
              </li>
              <li class="flex gap-3">
                <span
                  class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent"
                  >3</span
                >
                Follow smart steps to balance faster.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section
        class="mt-12 rounded-3xl border border-border/60 bg-surface-subtle px-6 py-10 text-center shadow-sm sm:px-10"
      >
        <h2 class="text-2xl font-semibold text-content-primary">
          Ready to keep every pool swim-ready?
        </h2>
        <p class="mt-3 text-sm text-content-secondary sm:text-base">
          Create an account, add your pool, and get a personalized action plan
          instantly.
        </p>
        <div class="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/auth/register" class="btn btn-base btn-primary btn-pill">
            Create your account
          </a>
          <a href="/contact" class="btn btn-base btn-secondary btn-pill">
            Talk to our team
          </a>
        </div>
      </section>
    </div>
  {/if}
</Container>
