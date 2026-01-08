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

  const marketingPillars = [
    {
      id: "smart",
      title: "SMART compliance platform",
      summary:
        "A system that grows and adapts to constantly changing regulations and business needs so you always know where you stand.",
      highlights: [
        "Tracks regulatory updates without manual reconfiguration.",
        "Aligns compliance tasks with the structure of your organization.",
        "Delivers dashboards that keep every stakeholder informed.",
      ],
      link: "/smart",
      cta: "Explore SMART",
    },
    {
      id: "how-we-do",
      title: "Configured for the way you work",
      summary:
        "A system configured to meet your needs so your team spends less time doing paperwork and more time supporting operations.",
      highlights: [
        "Tailored workflows mirror your forms, approvals, and reporting.",
        "Automated reminders keep inspections and testing on schedule.",
        "Centralized documentation reduces duplicate data entry and errors.",
      ],
      link: "/how-we-do-things",
      cta: "See how we deliver",
    },
    {
      id: "who-we-are",
      title: "People committed to your success",
      summary: "Partnering with a team committed to your success so you have experts beside you at every step.",
      highlights: [
        "Dedicated specialists guide implementation and ongoing optimization.",
        "Responsive support teams that understand compliance challenges.",
        "Long-term partnership to evolve with your business goals.",
      ],
      link: "/who-we-are",
      cta: "Meet the team",
    },
  ] satisfies Array<{
    id: string;
    title: string;
    summary: string;
    highlights: string[];
    link: string;
    cta: string;
  }>;

  const primaryPillarLink = marketingPillars[0]?.link ?? "/smart";
  const primaryPillarCta = marketingPillars[0]?.cta ?? "Learn more";

  const contactInfo = {
    addressLines: ["3233 Florida Ave", "Kenner, LA 70065"],
    phone: {
      display: "1-866-494-2841",
      href: "tel:18664942841",
    },
  } as const;
</script>

{#if data.session}
  <Container>
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
  </Container>
{:else}
  <div class="flex flex-1 flex-col">
    <section class="relative overflow-hidden bg-gradient-to-b from-accent/15 via-surface-subtle to-surface pb-16 pt-20 sm:pb-24 sm:pt-24">
      <Container>
        <div class="grid items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
          <div class="space-y-6 text-left">
            <p class="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Compliance Technology Group</p>
            <h1 class="text-4xl font-semibold leading-tight text-content-primary sm:text-5xl">
              Confidence in compliance for your water systems
            </h1>
            <p class="text-lg text-content-secondary">
              Being able to answer the question, “Am I in compliance now?”&nbsp;… That’s smart.
            </p>
            <div class="flex flex-wrap gap-3">
              <a href="/auth/register" class="btn btn-base btn-primary">Get started</a>
              <a href="/auth/login" class="btn btn-base btn-secondary">Sign in</a>
              <a href={primaryPillarLink} class="btn btn-base btn-tonal">{primaryPillarCta}</a>
            </div>
          </div>
          <div class="surface-card space-y-5 p-6">
            <h2 class="text-lg font-semibold text-content-primary">What makes our platform SMART</h2>
            <ul class="space-y-4 text-sm text-content-secondary">
              {#each marketingPillars as pillar}
                <li class="flex items-start gap-3">
                  <span class="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-accent"></span>
                  <span>{pillar.summary}</span>
                </li>
              {/each}
            </ul>
            <a href="/smart" class="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-strong">
              Learn more about SMART
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </Container>
    </section>

    {#each marketingPillars as pillar, index}
      <section id={pillar.id} class={`py-16 sm:py-20 ${index % 2 === 1 ? 'bg-surface-subtle/70' : 'bg-surface'}`}>
        <Container>
          <div class="grid items-start gap-10 lg:grid-cols-2">
            <div class={`space-y-6 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
              <h2 class="text-3xl font-semibold text-content-primary sm:text-4xl">{pillar.title}</h2>
              <p class="text-lg text-content-secondary">{pillar.summary}</p>
              <a href={pillar.link} class="btn btn-base btn-tonal w-fit">{pillar.cta}</a>
            </div>
            <div class={`surface-card space-y-4 p-6 text-sm text-content-secondary ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
              <h3 class="text-base font-semibold text-content-primary">Key outcomes</h3>
              <ul class="space-y-3">
                {#each pillar.highlights as highlight}
                  <li class="flex items-start gap-3">
                    <span class="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-accent"></span>
                    <span>{highlight}</span>
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        </Container>
      </section>
    {/each}

    <section id="contact" class="bg-surface-subtle/80 py-16 sm:py-20">
      <Container>
        <div class="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div class="space-y-6">
            <h2 class="text-3xl font-semibold text-content-primary sm:text-4xl">
              Let’s talk and find out if we are right for each other.
            </h2>
            <p class="text-lg text-content-secondary">
              Tell us about your compliance goals and we’ll align the SMART platform and our team to support your next inspection, audit,
              or expansion.
            </p>
            <div class="flex flex-wrap gap-3">
              <a href="/contact" class="btn btn-base btn-primary">Contact us</a>
              <a href={contactInfo.phone.href} class="btn btn-base btn-secondary">Call {contactInfo.phone.display}</a>
            </div>
          </div>
          <div class="surface-card space-y-4 p-6 text-sm text-content-secondary">
            <h3 class="text-base font-semibold text-content-primary">Home Office</h3>
            <p>
              {#each contactInfo.addressLines as line}
                <span class="block">{line}</span>
              {/each}
            </p>
            <a href={contactInfo.phone.href} class="font-semibold text-accent hover:text-accent-strong">
              Toll Free: {contactInfo.phone.display}
            </a>
          </div>
        </div>
      </Container>
    </section>
  </div>
{/if}
