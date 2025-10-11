<script lang="ts">
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';
  import type { PageData } from './$types';
  import type { AuditLogEntry } from './+page';

  export let data: PageData;

  const normalizeValue = (value: string | undefined | null) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const normalizeFilters = (initial: { user?: string | null; action?: string | null; entity?: string | null } = {}) => ({
    user: normalizeValue(initial.user ?? undefined),
    action: normalizeValue(initial.action ?? undefined),
    entity: normalizeValue(initial.entity ?? undefined),
  });

  let entries: AuditLogEntry[] = data.entries ?? [];
  let filters = normalizeFilters(data.filters ?? {});
  let pagination = data.pagination ?? { page: 1, pageSize: 25, total: 0 };
  let loadError: string | null = data.loadError;

  let userFilter = filters.user ?? '';
  let actionFilter = filters.action ?? '';
  let entityFilter = filters.entity ?? '';
  let pageSizeOption = String(pagination.pageSize ?? 25);

  let isLoading = false;
  let tableMessage: { type: 'success' | 'error'; text: string } | null = null;

  const pageSizeOptions = [10, 25, 50, 100];

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString();
  };

  const displayUser = (entry: AuditLogEntry) => {
    if (entry.userName && entry.userEmail) {
      return `${entry.userName} (${entry.userEmail})`;
    }
    if (entry.userName) return entry.userName;
    if (entry.userEmail) return entry.userEmail;
    return 'System';
  };

  const clean = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  type FetchOverrides = {
    page?: number;
    pageSize?: number;
    user?: string | undefined;
    action?: string | undefined;
    entity?: string | undefined;
  };

  async function fetchLogs(overrides: FetchOverrides = {}) {
    isLoading = true;
    tableMessage = null;

    const fallbackPage = pagination.page ?? 1;
    const fallbackPageSize = Number.isFinite(Number(pageSizeOption))
      ? Math.max(Number(pageSizeOption), 1)
      : pagination.pageSize ?? 25;

    const nextPage = overrides.page ?? fallbackPage;
    const nextPageSize = overrides.pageSize ?? fallbackPageSize;
    const nextUser = overrides.user ?? filters.user;
    const nextAction = overrides.action ?? filters.action;
    const nextEntity = overrides.entity ?? filters.entity;
    const normalizedUser = normalizeValue(nextUser ?? undefined);
    const normalizedAction = normalizeValue(nextAction ?? undefined);
    const normalizedEntity = normalizeValue(nextEntity ?? undefined);

    try {
      const response = await api.auditLog.list(undefined, {
        page: nextPage,
        pageSize: nextPageSize,
        user: normalizedUser,
        action: normalizedAction,
        entity: normalizedEntity,
      });

      if (!response.ok) {
        loadError = `Failed to load audit log (${response.status})`;
        entries = [];
        pagination = { page: nextPage, pageSize: nextPageSize, total: 0 };
        return;
      }

      const result = await response.json();
      entries = (result.items ?? []) as AuditLogEntry[];
      pagination = {
        page: result.page ?? nextPage,
        pageSize: result.pageSize ?? nextPageSize,
        total: result.total ?? 0,
      };
      filters = normalizeFilters({
        user: normalizedUser ?? undefined,
        action: normalizedAction ?? undefined,
        entity: normalizedEntity ?? undefined,
      });
      pageSizeOption = String(pagination.pageSize ?? nextPageSize);
      loadError = null;
    } catch (error) {
      console.error('Failed to load audit log entries', error);
      loadError = 'Unable to load audit log. Please try again later.';
      entries = [];
      pagination = { page: nextPage, pageSize: nextPageSize, total: 0 };
    } finally {
      isLoading = false;
    }
  }

  async function handleFilters(event: Event) {
    event.preventDefault();
    const user = clean(userFilter);
    const action = clean(actionFilter);
    const entity = clean(entityFilter);
    await fetchLogs({
      page: 1,
      pageSize: Number(pageSizeOption),
      user,
      action,
      entity,
    });
    filters = { user, action, entity };
  }

  async function changePage(next: number) {
    const totalPages = Math.max(1, Math.ceil((pagination.total ?? 0) / (pagination.pageSize ?? 1)));
    if (next < 1 || next > totalPages) return;
    await fetchLogs({ page: next });
  }

  async function handlePageSizeChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const size = Number(select.value);
    const normalized = Number.isFinite(size) && size > 0 ? size : pagination.pageSize ?? 25;
    pageSizeOption = String(normalized);
    await fetchLogs({ page: 1, pageSize: normalized });
  }

  const toCsvValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return '';
    }

    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  };

  function exportCsv() {
    if (entries.length === 0) {
      tableMessage = { type: 'error', text: 'There are no audit log entries to export.' };
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (
      typeof URL.createObjectURL !== 'function' ||
      typeof URL.revokeObjectURL !== 'function'
    ) {
      tableMessage = {
        type: 'error',
        text: 'CSV export is not supported in this environment.',
      };
      return;
    }

    const header = [
      'Timestamp',
      'User',
      'Action',
      'Entity',
      'Entity ID',
      'IP address',
      'Session ID',
      'Details',
    ];

    const rows = entries.map((entry) => [
      entry.at,
      displayUser(entry),
      entry.action,
      entry.entity ?? '',
      entry.entityId ?? '',
      entry.ipAddress ?? '',
      entry.sessionId ?? '',
      entry.data ? JSON.stringify(entry.data) : '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => toCsvValue(cell)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-log-${timestamp}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    tableMessage = { type: 'success', text: 'Audit log exported as CSV.' };
  }

  $: totalPages = Math.max(1, Math.ceil((pagination.total ?? 0) / (pagination.pageSize ?? 1)));
  $: showingStart = entries.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  $: showingEnd = entries.length > 0 ? showingStart + entries.length - 1 : 0;
</script>

<svelte:head>
  <title>Admin · Audit log</title>
</svelte:head>

<div class="space-y-6 py-6">
  <div>
    <h1 class="text-2xl font-semibold text-content-primary">Audit log</h1>
    <p class="text-sm text-content-secondary">
      Review critical changes, authentication activity, and export the log for further analysis.
    </p>
  </div>

  <Card className="space-y-4">
    <form class="grid gap-4 sm:grid-cols-4" on:submit|preventDefault={handleFilters}>
      <label class="col-span-2 text-sm">
        <span class="mb-1 block font-medium text-content-secondary">User</span>
        <input
          class="input"
          type="search"
          bind:value={userFilter}
          placeholder="Search by email or name"
        />
      </label>
      <label class="text-sm">
        <span class="mb-1 block font-medium text-content-secondary">Action</span>
        <input class="input" type="search" bind:value={actionFilter} placeholder="Action key" />
      </label>
      <label class="text-sm">
        <span class="mb-1 block font-medium text-content-secondary">Entity</span>
        <input class="input" type="search" bind:value={entityFilter} placeholder="Entity" />
      </label>
      <label class="text-sm">
        <span class="mb-1 block font-medium text-content-secondary">Page size</span>
        <select class="input" bind:value={pageSizeOption} on:change={handlePageSizeChange}>
          {#each pageSizeOptions as size}
            <option value={size}>{size} per page</option>
          {/each}
        </select>
      </label>
      <div class="sm:col-span-4">
        <button class="btn btn-primary" type="submit" disabled={isLoading}>
          {#if isLoading}
            Loading...
          {:else}
            Apply filters
          {/if}
        </button>
      </div>
    </form>

    {#if loadError}
      <div class="rounded-md border border-error/40 bg-error/5 p-3 text-sm text-error">
        {loadError}
      </div>
    {/if}

    {#if tableMessage}
      <div
        role="status"
        class={`rounded-md border p-3 text-sm ${
          tableMessage.type === 'success'
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-error/40 bg-error/5 text-error'
        }`}
      >
        {tableMessage.text}
      </div>
    {/if}

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-content-secondary">
        {#if entries.length > 0}
          Showing <span class="font-medium text-content-primary">{showingStart}–{showingEnd}</span>
          of
          <span class="font-medium text-content-primary">{pagination.total}</span> entries
        {:else}
          No entries to display
        {/if}
      </p>
      <div class="flex items-center gap-2">
        <button class="btn btn-tonal" type="button" on:click={exportCsv}>
          Export CSV
        </button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-border/60 text-left text-sm">
        <thead class="bg-surface-muted text-xs uppercase tracking-wide text-content-secondary">
          <tr>
            <th scope="col" class="px-3 py-2 font-semibold">Timestamp</th>
            <th scope="col" class="px-3 py-2 font-semibold">User</th>
            <th scope="col" class="px-3 py-2 font-semibold">Action</th>
            <th scope="col" class="px-3 py-2 font-semibold">Entity</th>
            <th scope="col" class="px-3 py-2 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/40 bg-surface text-content-secondary">
          {#if entries.length === 0}
            <tr>
              <td class="px-3 py-4 text-center text-sm text-content-tertiary" colspan="5">
                {#if isLoading}
                  Loading audit log entries...
                {:else}
                  No audit activity found for the selected filters.
                {/if}
              </td>
            </tr>
          {:else}
            {#each entries as entry (entry.auditId)}
              <tr class="align-top">
                <td class="whitespace-nowrap px-3 py-3 text-content-primary">{formatDate(entry.at)}</td>
                <td class="px-3 py-3">
                  <div class="font-medium text-content-primary">{displayUser(entry)}</div>
                  {#if entry.ipAddress}
                    <div class="text-xs text-content-tertiary">IP: {entry.ipAddress}</div>
                  {/if}
                  {#if entry.sessionId}
                    <div class="text-xs text-content-tertiary">Session: {entry.sessionId}</div>
                  {/if}
                </td>
                <td class="px-3 py-3">
                  <div class="font-medium text-content-primary">{entry.action}</div>
                  {#if entry.userAgent}
                    <div class="text-xs text-content-tertiary">{entry.userAgent}</div>
                  {/if}
                </td>
                <td class="px-3 py-3">
                  <div class="font-medium text-content-primary">{entry.entity ?? '—'}</div>
                  {#if entry.entityId}
                    <div class="text-xs text-content-tertiary">ID: {entry.entityId}</div>
                  {/if}
                  {#if entry.poolId}
                    <div class="text-xs text-content-tertiary">Pool: {entry.poolId}</div>
                  {/if}
                </td>
                <td class="px-3 py-3">
                  {#if entry.data}
                    <pre class="whitespace-pre-wrap break-words rounded bg-surface-muted/60 p-2 text-xs">
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  {:else}
                    <span class="text-xs text-content-tertiary">No additional data</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <div class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-content-secondary">Page {pagination.page} of {totalPages}</p>
      <div class="flex items-center gap-2">
        <button
          class="btn btn-tonal"
          type="button"
          on:click={() => changePage(pagination.page - 1)}
          disabled={isLoading || pagination.page <= 1}
        >
          Previous
        </button>
        <button
          class="btn btn-tonal"
          type="button"
          on:click={() => changePage(pagination.page + 1)}
          disabled={isLoading || pagination.page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  </Card>
</div>
