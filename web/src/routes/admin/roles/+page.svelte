<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { api } from '$lib/api';
  import type { PageData } from './$types';
  import type { RoleCapabilityTemplate } from './+page';

  export let data: PageData;

  let roles: RoleCapabilityTemplate[] = data.roles ?? [];
  const initialRoleSnapshots = new Map(
    roles.map((role) => [
      role.role,
      {
        systemCapabilities: [...role.systemCapabilities].sort((a, b) => a.localeCompare(b)),
        accountCapabilities: [...role.accountCapabilities].sort((a, b) => a.localeCompare(b)),
      },
    ])
  );
  const available = data.available ?? { systemCapabilities: [], accountCapabilities: [] };
  let loadError = data.loadError;
  let selectedRole = roles[0]?.role ?? '';

  let busyRoles = new SvelteSet<string>();
  let message: { type: 'success' | 'error'; text: string } | null = null;

  const capabilityDescriptions: Record<string, string> = {
    'admin.users.read': 'View user directory and account status in admin tools.',
    'admin.users.manage': 'Change account roles, activation, and password resets.',
    'admin.audit.read': 'Access audit history for security and operational review.',
    'admin.tokens.manage': 'Create and revoke admin API tokens.',
    'admin.pools.manage': 'Manage pools from admin workflows.',
    'account.profile.read': 'View account profile details.',
    'account.profile.update': 'Edit account profile details.',
    'account.preferences.read': 'View personal preferences.',
    'account.preferences.update': 'Change personal preferences.',
    'account.security.read': 'View account security settings.',
    'account.security.update': 'Change password and security settings.',
    'notifications.read': 'Read notifications.',
    'notifications.manage': 'Mark notifications and manage notification state.',
    'messages.read': 'View in-app messages.',
    'messages.send': 'Send in-app messages.',
    'billing.read': 'View billing status and summaries.',
    'billing.manage': 'Manage billing actions such as portal access.',
  };

  $: activeRole = roles.find((role) => role.role === selectedRole) ?? null;
  $: activeRoleSnapshot = activeRole ? initialRoleSnapshots.get(activeRole.role) ?? null : null;
  $: hasUnsavedChanges = Boolean(
    activeRole &&
      activeRoleSnapshot &&
      (activeRole.systemCapabilities.join('|') !== activeRoleSnapshot.systemCapabilities.join('|') ||
        activeRole.accountCapabilities.join('|') !== activeRoleSnapshot.accountCapabilities.join('|'))
  );

  function hasCapability(role: RoleCapabilityTemplate, scope: 'system' | 'account', capability: string) {
    const values = scope === 'system' ? role.systemCapabilities : role.accountCapabilities;
    return values.includes(capability);
  }

  function toggleCapability(
    roleKey: string,
    scope: 'system' | 'account',
    capability: string,
    checked: boolean
  ) {
    roles = roles.map((role) => {
      if (role.role !== roleKey) return role;
      const nextValues = new Set(scope === 'system' ? role.systemCapabilities : role.accountCapabilities);
      if (checked) {
        nextValues.add(capability);
      } else {
        nextValues.delete(capability);
      }
      const sortedValues = [...nextValues].sort((a, b) => a.localeCompare(b));
      if (scope === 'system') {
        return { ...role, systemCapabilities: sortedValues };
      }
      return { ...role, accountCapabilities: sortedValues };
    });
  }

  async function saveRole(role: RoleCapabilityTemplate) {
    busyRoles.add(role.role);
    message = null;
    try {
      const response = await api.roleCapabilities.update(role.role, {
        systemCapabilities: role.systemCapabilities,
        accountCapabilities: role.accountCapabilities,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        message = {
          type: 'error',
          text: body?.error ?? `Failed to update ${role.role} role template.`,
        };
        return;
      }

      const updated = (await response.json()) as RoleCapabilityTemplate;
      roles = roles.map((candidate) => (candidate.role === updated.role ? updated : candidate));
      initialRoleSnapshots.set(updated.role, {
        systemCapabilities: [...updated.systemCapabilities].sort((a, b) => a.localeCompare(b)),
        accountCapabilities: [...updated.accountCapabilities].sort((a, b) => a.localeCompare(b)),
      });
      message = {
        type: 'success',
        text: `Saved capability template for ${role.role}.`,
      };
    } catch (error) {
      console.error('Failed to save role capability template', error);
      message = {
        type: 'error',
        text: 'Unable to save role template. Please try again later.',
      };
    } finally {
      busyRoles.delete(role.role);
    }
  }
</script>

<svelte:head>
  <title>Admin · Role Capabilities</title>
</svelte:head>

<Container>
  <div class="mx-auto w-full max-w-6xl space-y-6 py-6">
    <div>
      <h1 class="text-2xl font-semibold text-content-primary">Role capability templates</h1>
      <p class="text-sm text-content-secondary">
        Configure capability assignments for system roles used by authorization checks and UI previews.
      </p>
    </div>

    {#if loadError}
      <div class="rounded-md border border-error/40 bg-error/5 p-3 text-sm text-error">
        {loadError}
      </div>
    {/if}

    {#if message}
      <div
        role="status"
        class={`rounded-md border p-3 text-sm ${
          message.type === 'success'
            ? 'border-success/40 bg-success/5 text-success'
            : 'border-error/40 bg-error/5 text-error'
        }`}
      >
        {message.text}
      </div>
    {/if}

    {#if roles.length === 0}
      <Card>
        <p class="text-sm text-content-secondary">No role templates available.</p>
      </Card>
    {:else if activeRole}
      <Card className="space-y-5">
        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label class="text-sm">
            <span class="mb-1 block font-medium text-content-secondary">Role template</span>
            <select class="input max-w-xs" bind:value={selectedRole} aria-label="Role template">
              {#each roles as role}
                <option value={role.role}>{role.role}</option>
              {/each}
            </select>
          </label>
          <div class="flex items-center gap-3">
            {#if hasUnsavedChanges}
              <span class="text-xs font-medium text-warning">Unsaved changes</span>
            {/if}
            <button
              class="btn btn-primary"
              disabled={busyRoles.has(activeRole.role) || !hasUnsavedChanges}
              on:click={() => saveRole(activeRole)}
            >
              Save
            </button>
          </div>
        </div>

        <div class="rounded-lg border border-border/50 p-4">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-content-secondary">
            System capabilities
          </h2>
          <p class="mt-1 text-xs text-content-secondary">
            Admin-scoped permissions for platform operations.
          </p>
          <div class="mt-3 space-y-3">
            {#each available.systemCapabilities as capability}
              <label class="flex items-start gap-3 rounded-md border border-border/40 p-3 text-sm text-content-primary">
                <input
                  type="checkbox"
                  checked={hasCapability(activeRole, 'system', capability)}
                  disabled={busyRoles.has(activeRole.role)}
                  on:change={(event) =>
                    toggleCapability(
                      activeRole.role,
                      'system',
                      capability,
                      (event.currentTarget as HTMLInputElement).checked
                    )}
                />
                <span class="space-y-1">
                  <span class="block font-medium">{capability}</span>
                  <span class="block text-xs text-content-secondary">
                    {capabilityDescriptions[capability] ?? 'No description available yet.'}
                  </span>
                </span>
              </label>
            {/each}
          </div>
        </div>

        <div class="rounded-lg border border-border/50 p-4">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-content-secondary">
            Account capabilities
          </h2>
          <p class="mt-1 text-xs text-content-secondary">
            End-user account permissions available to this role.
          </p>
          <div class="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
            {#each available.accountCapabilities as capability}
              <label class="flex items-start gap-3 rounded-md border border-border/40 p-3 text-sm text-content-primary">
                <input
                  type="checkbox"
                  checked={hasCapability(activeRole, 'account', capability)}
                  disabled={busyRoles.has(activeRole.role)}
                  on:change={(event) =>
                    toggleCapability(
                      activeRole.role,
                      'account',
                      capability,
                      (event.currentTarget as HTMLInputElement).checked
                    )}
                />
                <span class="space-y-1">
                  <span class="block font-medium">{capability}</span>
                  <span class="block text-xs text-content-secondary">
                    {capabilityDescriptions[capability] ?? 'No description available yet.'}
                  </span>
                </span>
              </label>
            {/each}
          </div>
        </div>
      </Card>
    {:else}
      <Card>
        <p class="text-sm text-content-secondary">No role templates available.</p>
      </Card>
    {/if}
  </div>
</Container>
