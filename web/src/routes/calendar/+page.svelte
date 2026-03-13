<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { api } from '$lib/api';
  import { goto, invalidateAll } from '$app/navigation';

  export let data;

  type PoolSummary = {
    poolId: string;
    name: string;
  };

  type ScheduleItem = {
    eventId: string;
    poolId: string;
    poolName: string;
    eventType: 'dosage' | 'test' | 'maintenance';
    title: string;
    notes: string | null;
    dueAt: string;
    recurrence: 'once' | 'daily' | 'weekly' | 'monthly';
    reminderLeadMinutes: number;
    status: 'scheduled' | 'completed' | 'canceled';
  };

  const pools: PoolSummary[] = Array.isArray(data?.pools) ? data.pools : [];
  let items: ScheduleItem[] = Array.isArray(data?.events?.items) ? data.events.items : [];
  let summary = data?.summary ?? { scheduledCount: 0, overdueCount: 0 };
  let selectedPoolId = data?.requestedPoolId ?? '';
  let saving = false;
  let message: { type: 'success' | 'error'; text: string } | null = null;

  let form = {
    poolId: selectedPoolId || pools[0]?.poolId || '',
    eventType: 'test',
    title: '',
    notes: '',
    dueAt: '',
    recurrence: 'once',
    reminderLeadMinutes: String(data?.preferences?.reminderLeadMinutes ?? 1440),
  };

  const formatDue = (value: string) =>
    new Date(value).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  async function createEvent() {
    saving = true;
    message = null;
    try {
      const payload = {
        poolId: form.poolId,
        eventType: form.eventType,
        title: form.title.trim(),
        notes: form.notes.trim() || null,
        dueAt: new Date(form.dueAt).toISOString(),
        recurrence: form.recurrence,
        reminderLeadMinutes: Number(form.reminderLeadMinutes),
      };
      const res = await api.schedule.create(payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        message = { type: 'error', text: body.message ?? body.error ?? 'Unable to create event.' };
        return;
      }
      form = {
        ...form,
        title: '',
        notes: '',
        dueAt: '',
      };
      message = { type: 'success', text: 'Schedule event created.' };
      await invalidateAll();
    } catch {
      message = { type: 'error', text: 'Unable to create event.' };
    } finally {
      saving = false;
    }
  }

  async function completeEvent(eventId: string) {
    const res = await api.schedule.complete(eventId);
    if (res.ok) {
      await invalidateAll();
    }
  }

  async function deleteEvent(eventId: string) {
    const res = await api.schedule.del(eventId);
    if (res.ok) {
      await invalidateAll();
    }
  }

  async function filterPool(poolId: string) {
    await goto(poolId ? `/calendar?poolId=${poolId}` : '/calendar', { invalidateAll: true });
  }
</script>

<Container>
  <section class="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-content-primary">Calendar</h1>
        <p class="text-sm text-content-secondary">
          Schedule testing, dosage, and maintenance reminders for each pool.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <Card className="min-w-[9rem]">
          <div class="text-xs uppercase tracking-[0.18em] text-content-muted">Scheduled</div>
          <div class="mt-1 text-2xl font-semibold text-content-primary">{summary.scheduledCount}</div>
        </Card>
        <Card className="min-w-[9rem]">
          <div class="text-xs uppercase tracking-[0.18em] text-content-muted">Overdue</div>
          <div class="mt-1 text-2xl font-semibold text-danger">{summary.overdueCount}</div>
        </Card>
      </div>
    </header>

    <div class="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card>
        <div class="space-y-4">
          <div>
            <h2 class="text-lg font-semibold text-content-primary">New Event</h2>
            <p class="text-sm text-content-secondary">Create a reminder for an upcoming task.</p>
          </div>

          <label class="form-field">
            <span class="form-label">Pool</span>
            <select class="form-control" bind:value={form.poolId}>
              {#each pools as pool}
                <option value={pool.poolId}>{pool.name}</option>
              {/each}
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Type</span>
            <select class="form-control" bind:value={form.eventType}>
              <option value="test">Test</option>
              <option value="dosage">Dosage</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Title</span>
            <input class="form-control" bind:value={form.title} placeholder="Weekly chemistry check" />
          </label>

          <label class="form-field">
            <span class="form-label">Due at</span>
            <input class="form-control" type="datetime-local" bind:value={form.dueAt} />
          </label>

          <label class="form-field">
            <span class="form-label">Repeat</span>
            <select class="form-control" bind:value={form.recurrence}>
              <option value="once">One time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label class="form-field">
            <span class="form-label">Reminder lead time (minutes)</span>
            <input class="form-control" type="number" min="0" bind:value={form.reminderLeadMinutes} />
          </label>

          <label class="form-field">
            <span class="form-label">Notes</span>
            <textarea class="form-control min-h-24" bind:value={form.notes}></textarea>
          </label>

          {#if message}
            <p class={`text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>{message.text}</p>
          {/if}

          <button class="btn btn-primary w-full" on:click={createEvent} disabled={saving || !form.title || !form.dueAt || !form.poolId}>
            {saving ? 'Creating…' : 'Create event'}
          </button>
        </div>
      </Card>

      <Card>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-content-primary">Upcoming Events</h2>
              <p class="text-sm text-content-secondary">Agenda view for this month.</p>
            </div>
            <label class="form-field sm:min-w-[14rem]">
              <span class="form-label">Filter by pool</span>
              <select class="form-control" bind:value={selectedPoolId} on:change={(event) => filterPool((event.currentTarget as HTMLSelectElement).value)}>
                <option value="">All pools</option>
                {#each pools as pool}
                  <option value={pool.poolId}>{pool.name}</option>
                {/each}
              </select>
            </label>
          </div>

          {#if items.length === 0}
            <div class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-content-secondary">
              No schedule events yet.
            </div>
          {:else}
            <div class="space-y-3">
              {#each items as item}
                <article class="rounded-2xl border border-border bg-surface-subtle p-4">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="rounded-full bg-accent/15 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
                          {item.eventType}
                        </span>
                        <span class="rounded-full bg-surface px-2 py-1 text-xs text-content-secondary">
                          {item.recurrence}
                        </span>
                        {#if item.status !== 'scheduled'}
                          <span class="rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-warning">
                            {item.status}
                          </span>
                        {/if}
                      </div>
                      <h3 class="text-lg font-semibold text-content-primary">{item.title}</h3>
                      <p class="text-sm text-content-secondary">{item.poolName} • {formatDue(item.dueAt)}</p>
                      {#if item.notes}
                        <p class="text-sm text-content-secondary">{item.notes}</p>
                      {/if}
                    </div>
                    <div class="flex gap-2">
                      {#if item.status === 'scheduled'}
                        <button class="btn btn-sm btn-primary" on:click={() => completeEvent(item.eventId)}>Complete</button>
                      {/if}
                      <button class="btn btn-sm btn-tonal" on:click={() => deleteEvent(item.eventId)}>Delete</button>
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>
      </Card>
    </div>
  </section>
</Container>
