<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { PageData } from './$types';
  import type { AdminUser } from './+page';

  export let data: PageData;

  const filters = data.filters ?? {};
  let users: AdminUser[] = data.users ?? [];
  let loadError = data.loadError;

  let search = filters.search ?? '';
  let roleFilter = filters.role ?? '';
  let statusFilter: 'all' | 'active' | 'inactive' = filters.isActive ?? 'all';

  let isLoading = false;
  let tableMessage: { type: 'success' | 'error'; text: string } | null = null;
  let busyUsers = new SvelteSet<string>();

  const roles = [
    { label: 'All roles', value: '' },
    { label: 'Member', value: 'member' },
    { label: 'Admin', value: 'admin' },
  ];

  const statusOptions: { label: string; value: 'all' | 'active' | 'inactive' }[] = [
    { label: 'All statuses', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  function toBoolean(value: 'all' | 'active' | 'inactive') {
    if (value === 'all') return undefined;
    return value === 'active';
  }

  async function refreshUsers() {
    isLoading = true;
    tableMessage = null;
    try {
      const response = await api.users.list(undefined, {
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        isActive: toBoolean(statusFilter),
      });

      if (!response.ok) {
        loadError = `Failed to load users (${response.status})`;
        users = [];
        return;
      }

      users = (await response.json()) as AdminUser[];
      loadError = null;
    } catch (error) {
      console.error('Failed to refresh users', error);
      loadError = 'Unable to refresh users. Please try again later.';
      users = [];
    } finally {
      isLoading = false;
    }
  }

  async function handleFilters(event: Event) {
    event.preventDefault();
    await refreshUsers();
  }

  async function updateUser(userId: string, payload: Record<string, unknown>, message: string) {
    busyUsers.add(userId);
    tableMessage = null;
    try {
      const response = await api.users.update(userId, payload);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        tableMessage = {
          type: 'error',
          text: body?.error ?? 'Failed to update user.',
        };
        return;
      }

      const updated = (await response.json()) as AdminUser;
      users = users.map((user) => (user.userId === updated.userId ? updated : user));
      tableMessage = { type: 'success', text: message };
    } catch (error) {
      console.error('Failed to update user', error);
      tableMessage = { type: 'error', text: 'Unable to update user. Please try again later.' };
    } finally {
      busyUsers.delete(userId);
    }
  }

  async function handleRoleChange(user: AdminUser, event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const nextRole = select.value;
    if (nextRole === user.role) return;
    await updateUser(user.userId, { role: nextRole }, 'Role updated successfully.');
  }

  async function toggleActive(user: AdminUser) {
    await updateUser(
      user.userId,
      { isActive: !user.isActive },
      `User ${user.isActive ? 'deactivated' : 'activated'} successfully.`
    );
  }

  async function resetPassword(user: AdminUser) {
    busyUsers.add(user.userId);
    tableMessage = null;
    try {
      const response = await api.users.resetPassword(user.userId);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        tableMessage = {
          type: 'error',
          text: body?.error ?? 'Failed to reset password.',
        };
        return;
      }

      const result = await response.json();
      tableMessage = {
        type: 'success',
        text: `Temporary password generated: ${result.temporaryPassword}`,
      };
    } catch (error) {
      console.error('Failed to reset password', error);
      tableMessage = {
        type: 'error',
        text: 'Unable to reset password. Please try again later.',
      };
    } finally {
      busyUsers.delete(user.userId);
    }
  }
</script>

<svelte:head>
  <title>Admin · Users</title>
</svelte:head>

<Container>
<div class="mx-auto w-full max-w-6xl space-y-6 py-6">
  <div>
    <h1 class="text-2xl font-semibold text-content-primary">User management</h1>
    <p class="text-sm text-content-secondary">
      Review accounts, update roles, and manage access for your organization.
    </p>
  </div>

  <Card className="space-y-4">
    <form class="grid gap-4 sm:grid-cols-4" on:submit|preventDefault={handleFilters}>
      <label class="col-span-2 text-sm">
        <span class="mb-1 block font-medium text-content-secondary">Search</span>
        <input
          class="input"
          type="search"
          bind:value={search}
          placeholder="Search by email or name"
        />
      </label>
      <label class="text-sm">
        <span class="mb-1 block font-medium text-content-secondary">Role</span>
        <select class="input" bind:value={roleFilter}>
          {#each roles as roleOption}
            <option value={roleOption.value}>{roleOption.label}</option>
          {/each}
        </select>
      </label>
      <label class="text-sm">
        <span class="mb-1 block font-medium text-content-secondary">Status</span>
        <select class="input" bind:value={statusFilter}>
          {#each statusOptions as status}
            <option value={status.value}>{status.label}</option>
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
            ? 'border-success/40 bg-success/5 text-success'
            : 'border-error/40 bg-error/5 text-error'
        }`}
      >
        {tableMessage.text}
      </div>
    {/if}

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-border/50">
        <thead class="bg-surface-strong/30 text-left text-xs uppercase tracking-wide text-content-secondary">
          <tr>
            <th class="px-4 py-3 font-semibold">Email</th>
            <th class="px-4 py-3 font-semibold">Name</th>
            <th class="px-4 py-3 font-semibold">Role</th>
            <th class="px-4 py-3 font-semibold">Status</th>
            <th class="px-4 py-3 font-semibold">Created</th>
            <th class="px-4 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/40 text-sm">
          {#if users.length === 0}
            <tr>
              <td colspan="6" class="px-4 py-6 text-center text-content-secondary">
                {#if isLoading}
                  Loading users...
                {:else}
                  No users matched your filters.
                {/if}
              </td>
            </tr>
          {:else}
            {#each users as user}
              <tr>
                <td class="px-4 py-3 font-medium text-content-primary">{user.email}</td>
                <td class="px-4 py-3 text-content-secondary">{user.name ?? '—'}</td>
                <td class="px-4 py-3">
                  <select
                    class="input"
                    value={user.role ?? ''}
                    on:change={(event) => handleRoleChange(user, event)}
                    disabled={busyUsers.has(user.userId)}
                    aria-label={`Change role for ${user.email}`}
                  >
                    {#each roles.slice(1) as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-4 py-3">
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      user.isActive ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td class="px-4 py-3 text-content-secondary">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button
                      class="btn btn-xs btn-tonal"
                      on:click={() => toggleActive(user)}
                      disabled={busyUsers.has(user.userId)}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      class="btn btn-xs btn-secondary"
                      on:click={() => resetPassword(user)}
                      disabled={busyUsers.has(user.userId)}
                    >
                      Reset password
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </Card>
</div>
</Container>
