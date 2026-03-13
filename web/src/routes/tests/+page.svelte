<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  type TestsHistoryRow = {
    testId: string;
    poolId: string;
    poolName: string;
    testedAt: string;
    recommendationSummary: string;
  };

  export let data: {
    rows: TestsHistoryRow[];
    loadError: string | null;
  };

  const formatDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleString();
  };
</script>

<Container>
  <div class="mx-auto w-full max-w-6xl space-y-6 py-8">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold text-content-primary">Tests history</h1>
      <p class="text-sm text-content-secondary">
        Historical test sessions across pools you are permitted to access.
      </p>
    </header>

    <Card className="shadow-card">
      {#if data.loadError}
        <p role="alert" class="text-sm text-danger">{data.loadError}</p>
      {:else if data.rows.length === 0}
        <p class="text-sm text-content-secondary">
          No tests found for pools you can view.
        </p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <thead>
              <tr class="border-b border-border text-left text-xs uppercase tracking-wide text-content-secondary">
                <th class="px-3 py-2 font-semibold">Test ID</th>
                <th class="px-3 py-2 font-semibold">Date</th>
                <th class="px-3 py-2 font-semibold">Pool name</th>
                <th class="px-3 py-2 font-semibold">Recommendations (what needed work)</th>
              </tr>
            </thead>
            <tbody>
              {#each data.rows as row}
                <tr class="border-b border-border/60 align-top">
                  <td class="px-3 py-3">
                    <a
                      class="font-medium text-accent hover:text-accent-strong"
                      href={`/tests/${row.testId}?poolId=${encodeURIComponent(row.poolId)}`}
                    >
                      {row.testId}
                    </a>
                  </td>
                  <td class="px-3 py-3 text-content-primary">{formatDateTime(row.testedAt)}</td>
                  <td class="px-3 py-3 text-content-primary">{row.poolName}</td>
                  <td class="px-3 py-3 text-content-secondary">{row.recommendationSummary}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  </div>
</Container>
