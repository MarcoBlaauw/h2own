<script lang="ts">
  import { api } from '$lib/api';
  import GoogleMapPicker from '$lib/components/location/GoogleMapPicker.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { PageData } from './$types';
  import type { AdminLocation, AdminLocationUser } from './+page';

  export let data: PageData;

  let locations: AdminLocation[] = data.locations ?? [];
  let users: AdminLocationUser[] = data.users ?? [];
  let loadError: string | null = data.loadError;

  let selectedLocationId: string | null = locations[0]?.locationId ?? null;
  let updateForm: {
    locationId: string | null;
    userId: string;
    name: string;
    formattedAddress: string;
    googlePlaceId: string;
    googlePlusCode: string;
    latitude: string;
    longitude: string;
    timezone: string;
    isPrimary: boolean;
    isActive: boolean;
  } = {
    locationId: null,
    userId: '',
    name: '',
    formattedAddress: '',
    googlePlaceId: '',
    googlePlusCode: '',
    latitude: '',
    longitude: '',
    timezone: '',
    isPrimary: false,
    isActive: true,
  };

  const defaultCreateForm = {
    userId: '',
    name: '',
    formattedAddress: '',
    googlePlaceId: '',
    googlePlusCode: '',
    latitude: '',
    longitude: '',
    timezone: '',
    isPrimary: false,
  };

  let createForm = { ...defaultCreateForm };

  let createErrors: string[] = [];
  let updateErrors: string[] = [];
  let createMessage: { type: 'success' | 'error'; text: string } | null = null;
  let updateMessage: { type: 'success' | 'error'; text: string } | null = null;
  let deactivateMessage: { type: 'success' | 'error'; text: string } | null = null;
  let poolMessage: { type: 'success' | 'error'; text: string } | null = null;

  let creating = false;
  let updating = false;
  let deactivating = false;
  const poolBusy = new SvelteSet<string>();
  let deactivateTransfer = '';

  $: selectedLocation = selectedLocationId
    ? locations.find((loc) => loc.locationId === selectedLocationId) ?? null
    : null;

  $: if (selectedLocation && updateForm.locationId !== selectedLocation.locationId) {
    updateForm = formFromLocation(selectedLocation);
    deactivateTransfer = '';
    updateErrors = [];
    updateMessage = null;
    deactivateMessage = null;
  }

  function formFromLocation(location: AdminLocation) {
    return {
      locationId: location.locationId,
      userId: location.userId,
      name: location.name,
      formattedAddress: location.formattedAddress ?? '',
      googlePlaceId: location.googlePlaceId ?? '',
      googlePlusCode: location.googlePlusCode ?? '',
      latitude: location.latitude !== null ? location.latitude.toString() : '',
      longitude: location.longitude !== null ? location.longitude.toString() : '',
      timezone: location.timezone ?? '',
      isPrimary: location.isPrimary,
      isActive: location.isActive,
    };
  }

  function coordinateFromInput(
    value: string,
    label: 'Latitude' | 'Longitude',
    errors: string[],
    allowNull = false
  ) {
    const trimmed = value.trim();
    if (!trimmed) {
      return allowNull ? null : undefined;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      errors.push(`${label} must be a number.`);
      return undefined;
    }
    return parsed;
  }

  function updateLocationState(updated: AdminLocation) {
    const exists = locations.some((loc) => loc.locationId === updated.locationId);
    if (exists) {
      locations = locations.map((loc) =>
        loc.locationId === updated.locationId ? updated : loc
      );
    } else {
      locations = [...locations, updated];
    }
  }

  async function refreshLocations() {
    try {
      const response = await api.locations.list();
      if (!response.ok) {
        throw new Error(`Refresh failed (${response.status})`);
      }
      const refreshed = (await response.json()) as AdminLocation[];
      locations = refreshed;
      if (selectedLocationId && !refreshed.some((loc) => loc.locationId === selectedLocationId)) {
        selectedLocationId = refreshed[0]?.locationId ?? null;
      }
    } catch (error) {
      console.error('Failed to refresh locations', error);
    }
  }

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    createErrors = [];
    createMessage = null;

    if (!createForm.userId) {
      createErrors.push('A user must be selected.');
    }
    if (!createForm.name.trim()) {
      createErrors.push('Name is required.');
    }

    const payload: Record<string, unknown> = {
      userId: createForm.userId,
      name: createForm.name.trim(),
      formattedAddress: createForm.formattedAddress.trim() || undefined,
      googlePlaceId: createForm.googlePlaceId.trim() || undefined,
      googlePlusCode: createForm.googlePlusCode.trim() || undefined,
      isPrimary: createForm.isPrimary,
    };

    const latitude = coordinateFromInput(createForm.latitude, 'Latitude', createErrors);
    const longitude = coordinateFromInput(createForm.longitude, 'Longitude', createErrors);

    if (latitude !== undefined) payload.latitude = latitude;
    if (longitude !== undefined) payload.longitude = longitude;

    if (createForm.timezone.trim()) {
      payload.timezone = createForm.timezone.trim();
    }

    if (createErrors.length > 0) {
      return;
    }

    creating = true;
    try {
      const response = await api.locations.create(payload);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        createMessage = {
          type: 'error',
          text:
            body?.error === 'ValidationError'
              ? 'The server rejected the provided location details.'
              : `Failed to create location (${response.status}).`,
        };
        return;
      }

      const created = (await response.json()) as AdminLocation;
      updateLocationState(created);
      createMessage = { type: 'success', text: 'Location created successfully.' };
      createForm = { ...defaultCreateForm };
      selectedLocationId = created.locationId;
    } catch (error) {
      console.error('Failed to create location', error);
      createMessage = {
        type: 'error',
        text: 'Unable to create location. Please try again later.',
      };
    } finally {
      creating = false;
    }
  }

  async function handleUpdate(event: SubmitEvent) {
    event.preventDefault();
    updateErrors = [];
    updateMessage = null;

    if (!selectedLocation) {
      return;
    }

    if (!updateForm.name.trim()) {
      updateErrors.push('Name is required.');
    }
    if (!updateForm.userId) {
      updateErrors.push('A user must be selected.');
    }

    const payload: Record<string, unknown> = {
      userId: updateForm.userId,
      name: updateForm.name.trim(),
      formattedAddress: updateForm.formattedAddress.trim() || null,
      googlePlaceId: updateForm.googlePlaceId.trim() || null,
      googlePlusCode: updateForm.googlePlusCode.trim() || null,
      isPrimary: updateForm.isPrimary,
    };

    const latitude = coordinateFromInput(updateForm.latitude, 'Latitude', updateErrors, true);
    const longitude = coordinateFromInput(updateForm.longitude, 'Longitude', updateErrors, true);

    if (latitude !== undefined) payload.latitude = latitude;
    if (longitude !== undefined) payload.longitude = longitude;

    payload.timezone = updateForm.timezone.trim() ? updateForm.timezone.trim() : null;

    if (updateErrors.length > 0) {
      return;
    }

    updating = true;
    try {
      const response = await api.locations.update(selectedLocation.locationId, payload);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        updateMessage = {
          type: 'error',
          text:
            body?.error === 'ValidationError'
              ? 'One or more fields are invalid.'
              : `Failed to update location (${response.status}).`,
        };
        return;
      }

      const updated = (await response.json()) as AdminLocation;
      updateLocationState(updated);
      updateMessage = { type: 'success', text: 'Location updated successfully.' };
    } catch (error) {
      console.error('Failed to update location', error);
      updateMessage = {
        type: 'error',
        text: 'Unable to update location. Please try again later.',
      };
    } finally {
      updating = false;
    }
  }

  async function handleDeactivate(event: SubmitEvent) {
    event.preventDefault();
    deactivateMessage = null;

    if (!selectedLocation) return;

    const payload: Record<string, unknown> = {};
    if (deactivateTransfer === '__unassigned') {
      payload.transferPoolsTo = null;
    } else if (deactivateTransfer) {
      payload.transferPoolsTo = deactivateTransfer;
    }

    deactivating = true;
    try {
      const response = await api.locations.deactivate(selectedLocation.locationId, payload);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        deactivateMessage = {
          type: 'error',
          text:
            body?.error === 'InvalidTransferTarget'
              ? 'The selected transfer target is not active.'
              : `Failed to deactivate location (${response.status}).`,
        };
        return;
      }

      const updated = (await response.json()) as AdminLocation;
      updateLocationState(updated);
      deactivateMessage = { type: 'success', text: 'Location deactivated.' };
      await refreshLocations();
    } catch (error) {
      console.error('Failed to deactivate location', error);
      deactivateMessage = {
        type: 'error',
        text: 'Unable to deactivate location. Please try again later.',
      };
    } finally {
      deactivating = false;
    }
  }

  async function handlePoolMove(poolId: string, target: string) {
    if (!selectedLocation) return;
    poolMessage = null;
    const currentLocationId = selectedLocation.locationId;

    let request: Promise<Response> | null = null;
    if (target === '__unassigned') {
      request = api.locations.update(currentLocationId, { unassignPools: [poolId] });
    } else if (target && target !== currentLocationId) {
      request = api.locations.update(target, { assignPools: [poolId] });
    } else {
      return;
    }

    poolBusy.add(poolId);
    try {
      const response = await request;
      if (!response.ok) {
        poolMessage = {
          type: 'error',
          text: `Failed to update pool assignment (${response.status}).`,
        };
        return;
      }

      const updated = (await response.json()) as AdminLocation;
      updateLocationState(updated);
      await refreshLocations();
      poolMessage = { type: 'success', text: 'Pool assignment updated.' };
    } catch (error) {
      console.error('Failed to update pool assignment', error);
      poolMessage = {
        type: 'error',
        text: 'Unable to update pool assignment. Please try again later.',
      };
    } finally {
      poolBusy.delete(poolId);
    }
  }

  $: activeLocations = locations.filter((location) => location.isActive);
</script>

<div class="container mx-auto px-4 py-8 space-y-6">
  <h1 class="text-3xl font-semibold text-content-primary">Locations</h1>
  {#if loadError}
    <div class="rounded-md border border-border/60 bg-surface-subtle px-4 py-3 text-sm text-content-secondary" role="alert">
      {loadError}
    </div>
  {/if}

  <div class="grid gap-6 md:grid-cols-2">
    <Card className="shadow-card h-full">
      <h2 class="text-xl font-semibold text-content-primary">Location Directory</h2>
      {#if locations.length === 0}
        <p class="mt-3 text-sm text-content-secondary">No locations available yet.</p>
      {:else}
        <ul class="mt-3 space-y-2">
          {#each locations as location}
            <li>
              <button
                class={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedLocationId === location.locationId
                    ? 'border-accent bg-accent/10 text-content-primary'
                    : 'border-border/60 bg-surface-subtle hover:border-accent hover:bg-accent/10'
                }`}
                on:click={() => {
                  selectedLocationId = location.locationId;
                }}
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium">{location.name}</span>
                  <span class="text-xs uppercase text-content-secondary">
                    {location.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div class="mt-1 text-xs text-content-secondary">
                  {location.user?.email ?? 'Unassigned'} •
                  {location.timezone ?? 'No timezone'}
                </div>
                {#if location.formattedAddress}
                  <div class="mt-1 text-xs text-content-secondary/80">{location.formattedAddress}</div>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <Card className="shadow-card h-full">
      <h2 class="text-xl font-semibold text-content-primary">Create Location</h2>
      <form class="mt-4 space-y-4" on:submit|preventDefault={handleCreate}>
        {#if createErrors.length > 0}
          <div class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            <ul class="list-disc pl-5">
              {#each createErrors as error}
                <li>{error}</li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if createMessage}
          <div
            class={`rounded-md px-3 py-2 text-sm ${
              createMessage.type === 'success'
                ? 'border border-success/50 bg-success/10 text-success'
                : 'border border-destructive/50 bg-destructive/10 text-destructive'
            }`}
            role="status"
          >
            {createMessage.text}
          </div>
        {/if}
        <div class="space-y-1">
          <label class="form-label" for="create-user">User</label>
          <select
            id="create-user"
            class="form-control form-select"
            bind:value={createForm.userId}
            required
          >
            <option value="">Select a user</option>
            {#each users as user}
              <option value={user.userId}>
                {user.email} {user.isActive === false ? '(inactive)' : ''}
              </option>
            {/each}
          </select>
        </div>
        <div class="space-y-1">
          <label class="form-label" for="create-name">Name</label>
          <input id="create-name" class="form-control" bind:value={createForm.name} required />
        </div>
        <GoogleMapPicker
          idPrefix="admin-create-location"
          bind:latitude={createForm.latitude}
          bind:longitude={createForm.longitude}
          bind:formattedAddress={createForm.formattedAddress}
          bind:googlePlaceId={createForm.googlePlaceId}
          bind:googlePlusCode={createForm.googlePlusCode}
        />
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1">
            <label class="form-label" for="create-latitude">Latitude</label>
            <input id="create-latitude" class="form-control" bind:value={createForm.latitude} />
          </div>
          <div class="space-y-1">
            <label class="form-label" for="create-longitude">Longitude</label>
            <input id="create-longitude" class="form-control" bind:value={createForm.longitude} />
          </div>
        </div>
        <div class="space-y-1">
          <label class="form-label" for="create-timezone">Timezone</label>
          <input id="create-timezone" class="form-control" bind:value={createForm.timezone} placeholder="e.g. America/New_York" />
        </div>
        <div class="space-y-1">
          <label class="form-label" for="create-formatted-address">Formatted address</label>
          <input id="create-formatted-address" class="form-control" bind:value={createForm.formattedAddress} />
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={createForm.isPrimary} />
          Primary location
        </label>
        <button class="btn btn-base btn-primary" type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create location'}
        </button>
      </form>
    </Card>
  </div>

  {#if selectedLocation}
    <div class="grid gap-6 md:grid-cols-2">
      <Card className="shadow-card h-full">
        <h2 class="text-xl font-semibold text-content-primary">Edit Metadata</h2>
        <form class="mt-4 space-y-4" on:submit|preventDefault={handleUpdate}>
          {#if updateErrors.length > 0}
            <div class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              <ul class="list-disc pl-5">
                {#each updateErrors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if updateMessage}
            <div
              class={`rounded-md px-3 py-2 text-sm ${
                updateMessage.type === 'success'
                  ? 'border border-success/50 bg-success/10 text-success'
                  : 'border border-destructive/50 bg-destructive/10 text-destructive'
              }`}
              role="status"
            >
              {updateMessage.text}
            </div>
          {/if}
          <div class="space-y-1">
            <label class="form-label" for="edit-user">User</label>
            <select
              id="edit-user"
              class="form-control form-select"
              bind:value={updateForm.userId}
              required
            >
              <option value="">Select a user</option>
              {#each users as user}
                <option value={user.userId}>
                  {user.email} {user.isActive === false ? '(inactive)' : ''}
                </option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label class="form-label" for="edit-name">Name</label>
            <input id="edit-name" class="form-control" bind:value={updateForm.name} required />
          </div>
          <GoogleMapPicker
            idPrefix="admin-edit-location"
            bind:latitude={updateForm.latitude}
            bind:longitude={updateForm.longitude}
            bind:formattedAddress={updateForm.formattedAddress}
            bind:googlePlaceId={updateForm.googlePlaceId}
            bind:googlePlusCode={updateForm.googlePlusCode}
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="form-label" for="edit-latitude">Latitude</label>
              <input id="edit-latitude" class="form-control" bind:value={updateForm.latitude} />
            </div>
            <div class="space-y-1">
              <label class="form-label" for="edit-longitude">Longitude</label>
              <input id="edit-longitude" class="form-control" bind:value={updateForm.longitude} />
            </div>
          </div>
          <div class="space-y-1">
            <label class="form-label" for="edit-timezone">Timezone</label>
            <input id="edit-timezone" class="form-control" bind:value={updateForm.timezone} placeholder="e.g. America/Los_Angeles" />
          </div>
          <div class="space-y-1">
            <label class="form-label" for="edit-formatted-address">Formatted address</label>
            <input id="edit-formatted-address" class="form-control" bind:value={updateForm.formattedAddress} />
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={updateForm.isPrimary} />
            Primary location
          </label>
          <div class="flex items-center gap-3">
            <button class="btn btn-base btn-primary" type="submit" disabled={updating}>
              {updating ? 'Saving…' : 'Save changes'}
            </button>
            <span class="text-xs text-content-secondary">Created {new Date(selectedLocation.createdAt).toLocaleString()}</span>
          </div>
        </form>

        <form class="mt-6 space-y-3" on:submit|preventDefault={handleDeactivate}>
          <h3 class="text-lg font-semibold text-content-primary">Deactivate</h3>
          <p class="text-sm text-content-secondary">
            Deactivated locations remain available for historical data but cannot be assigned to new pools.
          </p>
          {#if deactivateMessage}
            <div
              class={`rounded-md px-3 py-2 text-sm ${
                deactivateMessage.type === 'success'
                  ? 'border border-success/50 bg-success/10 text-success'
                  : 'border border-destructive/50 bg-destructive/10 text-destructive'
              }`}
              role="status"
            >
              {deactivateMessage.text}
            </div>
          {/if}
          <div class="space-y-1">
            <label class="form-label" for="deactivate-transfer">Transfer pools to</label>
            <select
              id="deactivate-transfer"
              class="form-control form-select"
              bind:value={deactivateTransfer}
              disabled={!selectedLocation.isActive}
            >
              <option value="">Keep current assignments</option>
              <option value="__unassigned">Unassign from all pools</option>
              {#each activeLocations.filter((loc) => loc.locationId !== selectedLocation.locationId) as loc}
                <option value={loc.locationId}>{loc.name}</option>
              {/each}
            </select>
          </div>
          <button class="btn btn-base btn-outline" type="submit" disabled={deactivating || !selectedLocation.isActive}>
            {selectedLocation.isActive ? (deactivating ? 'Deactivating…' : 'Deactivate') : 'Already inactive'}
          </button>
        </form>
      </Card>

      <Card className="shadow-card h-full">
        <h2 class="text-xl font-semibold text-content-primary">Pools</h2>
        {#if poolMessage}
          <div
            class={`mt-3 rounded-md px-3 py-2 text-sm ${
              poolMessage.type === 'success'
                ? 'border border-success/50 bg-success/10 text-success'
                : 'border border-destructive/50 bg-destructive/10 text-destructive'
            }`}
            role="status"
          >
            {poolMessage.text}
          </div>
        {/if}
        {#if selectedLocation.pools.length === 0}
          <p class="mt-3 text-sm text-content-secondary">No pools are assigned to this location.</p>
        {:else}
          <table class="mt-4 w-full text-left text-sm">
            <thead>
              <tr class="border-b border-border/60 text-xs uppercase text-content-secondary">
                <th class="px-2 py-2">Pool</th>
                <th class="px-2 py-2">Assigned to</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/40">
              {#each selectedLocation.pools as pool}
                <tr>
                  <td class="px-2 py-3 text-content-primary">{pool.name}</td>
                  <td class="px-2 py-3">
                    <select
                      class="form-control form-select"
                      aria-label={`Reassign ${pool.name}`}
                      on:change={(event) => handlePoolMove(pool.poolId, (event.target as HTMLSelectElement).value)}
                      disabled={poolBusy.has(pool.poolId)}
                    >
                      <option value={selectedLocation.locationId}>Current location</option>
                      <option value="__unassigned">Unassigned</option>
                      {#each activeLocations.filter((loc) => loc.locationId !== selectedLocation.locationId) as loc}
                        <option value={loc.locationId}>{loc.name}</option>
                      {/each}
                    </select>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </Card>
    </div>
  {/if}
</div>
