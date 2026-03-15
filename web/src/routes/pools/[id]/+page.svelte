<script lang="ts">
  import { api } from '$lib/api';
  import { page } from '$app/stores';
  import { invalidateAll } from '$app/navigation';
  import Card from '$lib/components/ui/Card.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  let fc = '';
  let generatingPlan = false;
  let planError = '';
  let tc = '';
  let ph = '';
  let selectedPlanSteps: Record<string, Record<number, boolean>> = {};
  let reportAudienceByPlanId: Record<string, 'owner' | 'service_tech' | 'audit'> = {};
  let reportEmailByPlanId: Record<string, string> = {};
  let reportBusyKey: string | null = null;
  let reportFeedback = '';
  let schedulingPlanId: string | null = null;
  let scheduleError = '';

  const toNumberOrUndefined = (value: string) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  async function handleSubmit() {
    const poolId = $page.params.id;
    if (!poolId) return;

    const payload: Record<string, number> = {};
    const fcValue = toNumberOrUndefined(fc);
    const tcValue = toNumberOrUndefined(tc);
    const phValue = toNumberOrUndefined(ph);

    if (fcValue !== undefined) payload.fc = fcValue;
    if (tcValue !== undefined) payload.tc = tcValue;
    if (phValue !== undefined) payload.ph = phValue;

    await api.tests.create(poolId, payload);
    await invalidateAll();
  }

  async function handleGeneratePlan() {
    const poolId = $page.params.id;
    if (!poolId) return;
    generatingPlan = true;
    planError = '';
    try {
      const response = await api.treatmentPlans.generate(poolId);
      if (!response.ok) {
        planError = `Failed to generate plan (${response.status})`;
      }
    } catch {
      planError = 'Failed to generate plan.';
    } finally {
      generatingPlan = false;
      await invalidateAll();
    }
  }



  const getPlanSteps = (plan: any) => (plan?.responsePayload?.stepByStepPlan ?? []) as Array<{
    action?: string;
    timing?: string;
    rationale?: string;
    recommendedDueAt?: string | null;
    eventType?: 'dosage' | 'test' | 'maintenance' | null;
    leadMinutes?: number | null;
    recurrence?: 'once' | 'daily' | 'weekly' | 'monthly' | null;
  }>;

  const getPlanMetadata = (plan: any) => plan?.responsePayload?.planMetadata ?? null;
  const getProvenanceLabels = (plan: any) => getPlanMetadata(plan)?.provenance?.labels ?? [];
  const getPolicyIssues = (plan: any) => getPlanMetadata(plan)?.policyChecks?.issues ?? [];
  const getBlockedAlternatives = (plan: any) =>
    getPlanMetadata(plan)?.blockedUnsafeAlternativesConsidered ?? [];
  const getReportAudience = (planId: string) => reportAudienceByPlanId[planId] ?? 'owner';
  const getReportEmail = (planId: string) => reportEmailByPlanId[planId] ?? '';

  const setReportAudience = (planId: string, audience: 'owner' | 'service_tech' | 'audit') => {
    reportAudienceByPlanId = {
      ...reportAudienceByPlanId,
      [planId]: audience,
    };
  };

  const setReportEmail = (planId: string, value: string) => {
    reportEmailByPlanId = {
      ...reportEmailByPlanId,
      [planId]: value,
    };
  };

  async function downloadPlanReport(plan: any) {
    const poolId = $page.params.id;
    if (!poolId) return;

    reportBusyKey = `download:${plan.planId}`;
    reportFeedback = '';

    try {
      const res = await api.treatmentPlans.report(poolId, plan.planId, {
        audience: getReportAudience(plan.planId),
      });
      if (!res.ok) {
        reportFeedback = `Failed to download report (${res.status})`;
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `treatment-report-v${plan.version}-${getReportAudience(plan.planId)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      reportFeedback = 'Failed to download report.';
    } finally {
      reportBusyKey = null;
    }
  }

  async function emailPlanReport(plan: any) {
    const poolId = $page.params.id;
    if (!poolId) return;

    reportBusyKey = `email:${plan.planId}`;
    reportFeedback = '';

    try {
      const body: { audience: 'owner' | 'service_tech' | 'audit'; to?: string } = {
        audience: getReportAudience(plan.planId),
      };
      const recipient = getReportEmail(plan.planId).trim();
      if (recipient) body.to = recipient;

      const res = await api.treatmentPlans.emailReport(poolId, plan.planId, body);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        reportFeedback = payload?.message ?? `Failed to email report (${res.status})`;
        return;
      }

      reportFeedback = 'Report email queued.';
    } catch {
      reportFeedback = 'Failed to email report.';
    } finally {
      reportBusyKey = null;
    }
  }

  const hasSelectedStep = (planId: string, index: number) => Boolean(selectedPlanSteps[planId]?.[index]);

  const togglePlanStep = (planId: string, index: number, checked: boolean) => {
    selectedPlanSteps = {
      ...selectedPlanSteps,
      [planId]: {
        ...(selectedPlanSteps[planId] ?? {}),
        [index]: checked,
      },
    };
  };

  async function schedulePlanSteps(plan: any, mode: 'all' | 'selected') {
    const poolId = $page.params.id;
    if (!poolId) return;

    const steps = getPlanSteps(plan);
    const selectedIndexes = mode === 'all'
      ? steps.map((_step, index) => index)
      : steps.map((_step, index) => index).filter((index) => hasSelectedStep(plan.planId, index));

    if (selectedIndexes.length === 0) {
      scheduleError = 'Select at least one step to schedule.';
      return;
    }

    schedulingPlanId = plan.planId;
    scheduleError = '';

    const makePayload = (confirmConflicts: boolean) => ({
      confirmConflicts,
      steps: selectedIndexes.map((index) => {
        const step = steps[index] ?? {};
        return {
          index,
          dueAt: step.recommendedDueAt ?? undefined,
          eventType: step.eventType ?? undefined,
          leadMinutes: step.leadMinutes ?? undefined,
          recurrence: step.recurrence ?? undefined,
        };
      }),
    });

    try {
      let res = await api.treatmentPlans.schedule(poolId, plan.planId, makePayload(false));
      if (res.status === 409) {
        const body = await res.json();
        const overlapCount = body?.conflicts?.overlappingEventIds?.length ?? 0;
        const reminderCount = body?.conflicts?.existingReminderEventIds?.length ?? 0;
        const proceed = window.confirm(
          `Found ${overlapCount} overlapping events and ${reminderCount} existing reminders. Add anyway?`
        );
        if (!proceed) {
          scheduleError = 'Scheduling cancelled due to conflicts.';
          return;
        }
        res = await api.treatmentPlans.schedule(poolId, plan.planId, makePayload(true));
      }

      if (!res.ok) {
        scheduleError = `Failed to schedule plan steps (${res.status})`;
        return;
      }

      selectedPlanSteps = {
        ...selectedPlanSteps,
        [plan.planId]: {},
      };
      await invalidateAll();
    } catch {
      scheduleError = 'Failed to schedule plan steps.';
    } finally {
      schedulingPlanId = null;
    }
  }

  async function handleRoleChange(userId: string | undefined, role: string) {
    const poolId = $page.params.id;
    if (!poolId || !userId) return;
    await api.members.update(poolId, userId, { role });
    await invalidateAll();
  }

  async function handleRemoveMember(userId: string | undefined) {
    const poolId = $page.params.id;
    if (!poolId || !userId) return;
    await api.members.del(poolId, userId);
    await invalidateAll();
  }

  const formatCc = (test) => {
    if (typeof test.totalChlorine !== 'number' || typeof test.freeChlorine !== 'number') {
      return 'N/A';
    }
    const value = Math.max(0, test.totalChlorine - test.freeChlorine);
    return value.toFixed(2);
  };
</script>

<div class="container mx-auto px-4 py-8 space-y-6">
  {#if data.pool}
    <h1 class="text-3xl font-semibold text-content-primary">{data.pool.name}</h1>
    <p class="text-base text-content-secondary">{data.pool.volumeGallons} gallons</p>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="shadow-card h-full">
        <div class="space-y-4">
          <h2 class="text-xl font-semibold text-content-primary">Members</h2>
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm text-content-secondary">
              <thead class="border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-content-secondary/80 dark:border-border-strong/60">
                <tr>
                  <th class="px-3 py-2">User</th>
                  <th class="px-3 py-2">Role</th>
                  <th class="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/40">
                {#if data.pool.members?.length > 0}
                  {#each data.pool.members as member}
                    <tr>
                      <td class="px-3 py-3 text-content-primary">{member.user?.email ?? 'Unknown user'}</td>
                      <td class="px-3 py-3">
                        <select
                          class="form-control form-select"
                          bind:value={member.roleName}
                          on:change={() => handleRoleChange(member.user?.id, member.roleName)}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </td>
                      <td class="px-3 py-3">
                        <button on:click={() => handleRemoveMember(member.user?.id)} class="btn btn-sm btn-outline-danger" disabled={!member.user?.id}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  {/each}
                {:else}
                  <tr>
                    <td colspan="3" class="px-3 py-6 text-center text-content-secondary/80">No members found.</td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <Card className="shadow-card h-full">
        <div class="space-y-4">
          <h2 class="text-xl font-semibold text-content-primary">Tests</h2>
          {#if data.pool.tests?.length > 0}
            <ul class="space-y-4 text-sm text-content-secondary">
              {#each data.pool.tests as test}
                <li class="surface-panel space-y-2">
                  <p>
                    FC: {test.freeChlorine ?? 'N/A'}, TC: {test.totalChlorine ?? 'N/A'}, pH: {test.ph ?? 'N/A'}, CC: {formatCc(test)}
                  </p>
                  <p class="text-xs text-content-secondary/75">
                    Tested on {new Date(test.testedAt).toLocaleString()} by {test.tester?.email ?? 'Unknown'}
                  </p>
                  <a class="text-xs font-semibold text-accent hover:text-accent-strong" href={`/tests/${test.id}`}>
                    View details
                  </a>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm text-content-secondary/80">No tests found.</p>
          {/if}
        </div>
      </Card>

      <Card className="shadow-card h-full md:col-span-2">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-xl font-semibold text-content-primary">Saved treatment plans</h2>
            <button class="btn btn-base btn-primary" on:click={handleGeneratePlan} disabled={generatingPlan}>
              {generatingPlan ? 'Generating...' : 'Generate plan'}
            </button>
          </div>
          {#if planError}
            <p class="text-sm text-danger">{planError}</p>
          {/if}
          {#if scheduleError}
            <p class="text-sm text-danger">{scheduleError}</p>
          {/if}
          {#if reportFeedback}
            <p class="text-sm text-content-secondary">{reportFeedback}</p>
          {/if}
          {#if data.plans?.length > 0}
            <ul class="space-y-3 text-sm">
              {#each data.plans as plan}
                <li class="surface-panel space-y-3">
                  <p class="font-medium text-content-primary">v{plan.version} · {plan.status}</p>
                  <p class="text-content-secondary">{plan.responsePayload?.interpretationSummary ?? data.recommendationPreview?.primary?.reason ?? 'No summary available.'}</p>
                  {#if getProvenanceLabels(plan).length > 0}
                    <div class="flex flex-wrap gap-2">
                      {#each getProvenanceLabels(plan) as label}
                        <span class="rounded-full border border-border/60 px-2 py-1 text-[11px] text-content-secondary">{label}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if getPolicyIssues(plan).length > 0}
                    <div class="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-content-secondary">
                      <p class="font-semibold text-content-primary">Policy checks</p>
                      {#each getPolicyIssues(plan) as issue}
                        <p>
                          <strong class="text-content-primary">{issue.severity}:</strong>
                          {issue.message}
                        </p>
                      {/each}
                    </div>
                  {/if}
                  {#if getBlockedAlternatives(plan).length > 0}
                    <div class="space-y-1 text-xs text-content-secondary">
                      <p class="font-semibold text-content-primary">Blocked or unsafe alternatives considered</p>
                      {#each getBlockedAlternatives(plan) as item}
                        <p>{item.alternative}: {item.reason}</p>
                      {/each}
                    </div>
                  {/if}
                  {#if getPlanSteps(plan).length > 0}
                    <div class="space-y-2">
                      {#each getPlanSteps(plan) as step, index}
                        <label class="flex items-start gap-2 text-xs text-content-secondary">
                          <input
                            type="checkbox"
                            checked={hasSelectedStep(plan.planId, index)}
                            on:change={(event) => togglePlanStep(plan.planId, index, (event.currentTarget as HTMLInputElement).checked)}
                          >
                          <span>
                            <strong class="text-content-primary">{step.action ?? `Step ${index + 1}`}</strong>
                            {#if step.recommendedDueAt}
                              · due {new Date(step.recommendedDueAt).toLocaleString()}
                            {/if}
                            {#if step.recurrence}
                              · {step.recurrence}
                            {/if}
                          </span>
                        </label>
                      {/each}
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <button
                        class="btn btn-sm btn-outline"
                        on:click={() => schedulePlanSteps(plan, 'all')}
                        disabled={schedulingPlanId === plan.planId}
                      >
                        Add all to calendar
                      </button>
                      <button
                        class="btn btn-sm btn-outline"
                        on:click={() => schedulePlanSteps(plan, 'selected')}
                        disabled={schedulingPlanId === plan.planId}
                      >
                        Add selected steps
                      </button>
                    </div>
                  {/if}
                  <div class="grid gap-2 rounded-lg border border-border/50 p-3 md:grid-cols-[180px_minmax(0,1fr)_auto_auto]">
                    <label class="text-xs text-content-secondary">
                      Report audience
                      <select
                        class="form-control form-select mt-1"
                        value={getReportAudience(plan.planId)}
                        on:change={(event) => setReportAudience(plan.planId, (event.currentTarget as HTMLSelectElement).value as 'owner' | 'service_tech' | 'audit')}
                      >
                        <option value="owner">Owner</option>
                        <option value="service_tech">Service tech</option>
                        <option value="audit">Audit</option>
                      </select>
                    </label>
                    <label class="text-xs text-content-secondary">
                      Email recipient
                      <input
                        class="form-control mt-1"
                        type="email"
                        placeholder="Required for service tech/audit"
                        value={getReportEmail(plan.planId)}
                        on:input={(event) => setReportEmail(plan.planId, (event.currentTarget as HTMLInputElement).value)}
                      >
                    </label>
                    <button
                      class="btn btn-sm btn-outline self-end"
                      on:click={() => downloadPlanReport(plan)}
                      disabled={reportBusyKey === `download:${plan.planId}`}
                    >
                      Download PDF
                    </button>
                    <button
                      class="btn btn-sm btn-outline self-end"
                      on:click={() => emailPlanReport(plan)}
                      disabled={reportBusyKey === `email:${plan.planId}`}
                    >
                      Email report
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-content-secondary/80">No saved treatment plans yet. Fallback recommendations will continue to be used until one is generated.</p>
          {/if}
        </div>
      </Card>

      <Card className="shadow-card h-full md:col-span-2">
        <form class="form-grid" on:submit|preventDefault={handleSubmit}>
          <div class="sm:col-span-2 flex items-center justify-between gap-3">
            <h2 class="text-xl font-semibold text-content-primary">Add New Test (Quick)</h2>
            <a class="text-sm font-semibold text-accent hover:text-accent-strong" href={`/pools/${data.pool.poolId}/tests/new`}>Use detailed form</a>
          </div>
          <div class="form-field">
            <label class="form-label" for="fc">Free Chlorine (FC)</label>
            <input
              class="form-control"
              id="fc"
              type="number"
              bind:value={fc}
            >
          </div>
          <div class="form-field">
            <label class="form-label" for="tc">Total Chlorine (TC)</label>
            <input
              class="form-control"
              id="tc"
              type="number"
              bind:value={tc}
            >
          </div>
          <div class="form-field">
            <label class="form-label" for="ph">pH</label>
            <input
              class="form-control"
              id="ph"
              type="number"
              bind:value={ph}
            >
          </div>
          <div class="sm:col-span-2 flex justify-end">
            <button class="btn btn-base btn-primary" type="submit">
              Add Test
            </button>
          </div>
        </form>
      </Card>
    </div>
  {:else}
    <p class="text-content-secondary/80">Pool not found.</p>
  {/if}
</div>
