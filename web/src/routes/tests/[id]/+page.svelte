<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  type TestDetail = {
    sessionId: string;
    poolId: string;
    testedAt: string | Date;
    freeChlorinePpm?: string | number | null;
    totalChlorinePpm?: string | number | null;
    phLevel?: string | number | null;
    totalAlkalinityPpm?: number | null;
    cyanuricAcidPpm?: number | null;
    calciumHardnessPpm?: number | null;
    saltPpm?: number | null;
    waterTempF?: number | null;
    cc?: number | null;
    notes?: string | null;
  };

  export let data: {
    test: TestDetail | null;
    loadError: string | null;
  };

  const formatMeasurement = (
    value: string | number | null | undefined,
    suffix: string,
    decimals = 2
  ) => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
      return 'N/A';
    }
    return `${numeric.toFixed(decimals)}${suffix}`;
  };

  const formatInteger = (value: number | null | undefined, suffix = '') => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    return `${value}${suffix}`;
  };

  const formatDateTime = (value: string | Date | undefined | null) => {
    if (!value) {
      return 'N/A';
    }
    const dateValue = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      return 'N/A';
    }
    return dateValue.toLocaleString();
  };
</script>

<Container>
  <div class="mx-auto w-full max-w-5xl space-y-6 py-8">
    <div class="flex flex-col gap-2">
      <h1 class="text-3xl font-semibold text-content-primary">Test details</h1>
      {#if data.test}
        <p class="text-sm text-content-secondary">
          Tested {formatDateTime(data.test.testedAt)} | Pool {data.test.poolId}
        </p>
      {/if}
    </div>

    {#if data.loadError}
      <p role="alert" class="text-sm text-danger">{data.loadError}</p>
    {/if}

    {#if data.test}
      <Card className="shadow-card">
        <div class="grid gap-6 md:grid-cols-2">
          <div class="space-y-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                Session
              </p>
              <p class="text-sm text-content-primary">{data.test.sessionId}</p>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  Free Chlorine
                </p>
                <p class="text-content-primary">
                  {formatMeasurement(data.test.freeChlorinePpm, ' ppm')}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  Total Chlorine
                </p>
                <p class="text-content-primary">
                  {formatMeasurement(data.test.totalChlorinePpm, ' ppm')}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  pH
                </p>
                <p class="text-content-primary">
                  {formatMeasurement(data.test.phLevel, '', 2)}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  Combined Chlorine
                </p>
                <p class="text-content-primary">
                  {formatMeasurement(data.test.cc ?? null, ' ppm')}
                </p>
              </div>
            </div>
          </div>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  Total Alkalinity
                </p>
                <p class="text-content-primary">
                  {formatInteger(data.test.totalAlkalinityPpm, ' ppm')}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  Cyanuric Acid
                </p>
                <p class="text-content-primary">
                  {formatInteger(data.test.cyanuricAcidPpm, ' ppm')}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  Calcium Hardness
                </p>
                <p class="text-content-primary">
                  {formatInteger(data.test.calciumHardnessPpm, ' ppm')}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  Salt
                </p>
                <p class="text-content-primary">
                  {formatInteger(data.test.saltPpm, ' ppm')}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                  Water Temp
                </p>
                <p class="text-content-primary">
                  {formatInteger(data.test.waterTempF, ' F')}
                </p>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary/70">
                Notes
              </p>
              <p class="text-sm text-content-primary">
                {data.test.notes?.trim() || 'No notes recorded.'}
              </p>
            </div>
          </div>
        </div>
        <div class="mt-6">
          <a class="text-sm font-semibold text-accent hover:text-accent-strong" href={`/pools/${data.test.poolId}`}>
            Back to pool
          </a>
        </div>
      </Card>
    {:else}
      <p class="text-sm text-content-secondary">No test data available.</p>
    {/if}
  </div>
</Container>
