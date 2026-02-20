<script lang="ts">
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import GoogleMapPicker from '$lib/components/location/GoogleMapPicker.svelte';
  import { api } from '$lib/api';
  import type { PageData } from './$types';
  import type { PoolSummary } from './+page';

  export let data: PageData;

  type LocationSummary = {
    locationId: string;
    name: string;
    formattedAddress: string | null;
    googlePlaceId: string | null;
    googlePlusCode: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    isPrimary: boolean;
    isActive: boolean;
  };

  const normalizeLocations = (items: unknown): LocationSummary[] => {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const raw = item as Record<string, unknown>;
        if (typeof raw.locationId !== 'string' || !raw.locationId.trim()) return null;
        return {
          locationId: raw.locationId,
          name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Unnamed location',
          formattedAddress: typeof raw.formattedAddress === 'string' ? raw.formattedAddress : null,
          googlePlaceId: typeof raw.googlePlaceId === 'string' ? raw.googlePlaceId : null,
          googlePlusCode: typeof raw.googlePlusCode === 'string' ? raw.googlePlusCode : null,
          latitude: typeof raw.latitude === 'number' ? raw.latitude : null,
          longitude: typeof raw.longitude === 'number' ? raw.longitude : null,
          timezone: typeof raw.timezone === 'string' ? raw.timezone : null,
          isPrimary: Boolean(raw.isPrimary),
          isActive: raw.isActive === undefined ? true : Boolean(raw.isActive),
        } satisfies LocationSummary;
      })
      .filter((location): location is LocationSummary => Boolean(location));
  };

  let pools: PoolSummary[] = data.pools ?? [];
  let locations: LocationSummary[] = normalizeLocations(data.locations);
  let loadError = data.loadError;

  type FormState = {
    name: string;
    volumeGallons: string;
    sanitizerType: string;
    surfaceType: string;
    locationId: string;
  };

  const defaultForm: FormState = {
    name: '',
    volumeGallons: '',
    sanitizerType: '',
    surfaceType: '',
    locationId: '',
  };

  let createForm: FormState = { ...defaultForm };
  let editForm: FormState = { ...defaultForm };
  let locationForm: {
    name: string;
    formattedAddress: string;
    googlePlaceId: string;
    googlePlusCode: string;
    latitude: string;
    longitude: string;
    timezone: string;
    isPrimary: boolean;
  } = {
    name: '',
    formattedAddress: '',
    googlePlaceId: '',
    googlePlusCode: '',
    latitude: '',
    longitude: '',
    timezone: '',
    isPrimary: false,
  };
  let editingPoolId: string | null = null;
  let createErrors: string[] = [];
  let editErrors: string[] = [];
  let locationErrors: string[] = [];
  let createMessage: { type: 'success' | 'error'; text: string } | null = null;
  let editMessage: { type: 'success' | 'error'; text: string } | null = null;
  let locationMessage: { type: 'success' | 'error'; text: string } | null = null;
  let creating = false;
  let updating = false;
  let creatingLocation = false;
  let deletingPoolId: string | null = null;
  let loadingLocations = false;

  $: activeLocations = locations.filter((location) => location.isActive !== false);

  const sanitizerOptions = ['chlorine', 'salt', 'bromine', 'mineral', 'biguanide', 'other'];
  const surfaceOptions = ['plaster', 'vinyl', 'fiberglass', 'tile', 'concrete', 'other'];

  const normalizeText = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
  };

  const validateForm = (form: FormState) => {
    const errors: string[] = [];
    if (!normalizeText(form.name).trim()) errors.push('Name is required.');
    if (!normalizeText(form.volumeGallons).trim()) errors.push('Volume is required.');
    if (!normalizeText(form.sanitizerType).trim()) errors.push('Sanitizer type is required.');
    if (!normalizeText(form.surfaceType).trim()) errors.push('Surface type is required.');
    return errors;
  };

  const toPayload = (form: FormState) => ({
    name: form.name.trim(),
    volumeGallons: Number(form.volumeGallons),
    sanitizerType: form.sanitizerType.trim(),
    surfaceType: form.surfaceType.trim(),
    locationId: form.locationId.trim() || undefined,
  });

  const resetCreateForm = () => {
    createForm = { ...defaultForm };
    createErrors = [];
  };

  const resetLocationForm = () => {
    locationForm = {
      name: '',
      formattedAddress: '',
      googlePlaceId: '',
      googlePlusCode: '',
      latitude: '',
      longitude: '',
      timezone: '',
      isPrimary: false,
    };
    locationErrors = [];
  };

  const refreshLocations = async () => {
    loadingLocations = true;
    try {
      const res = await api.userLocations.list();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        locationMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Load locations failed (${res.status}).`,
        };
        return;
      }
      const body = await res.json();
      locations = normalizeLocations(body);
    } catch (error) {
      locationMessage = { type: 'error', text: 'Unable to refresh locations.' };
    } finally {
      loadingLocations = false;
    }
  };

  const beginEdit = (pool: PoolSummary) => {
    editingPoolId = pool.poolId;
    editForm = {
      name: pool.name ?? '',
      volumeGallons: pool.volumeGallons?.toString() ?? '',
      sanitizerType: pool.sanitizerType ?? '',
      surfaceType: pool.surfaceType ?? '',
      locationId: pool.locationId ?? '',
    };
    editErrors = [];
    editMessage = null;
  };

  const cancelEdit = () => {
    editingPoolId = null;
    editErrors = [];
    editMessage = null;
  };

  const handleCreate = async () => {
    createMessage = null;
    createErrors = validateForm(createForm);
    if (createErrors.length) return;

    creating = true;
    try {
      const res = await api.pools.create(toPayload(createForm));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        createMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Create failed (${res.status}).`,
        };
        return;
      }
      const created = (await res.json()) as PoolSummary;
      pools = [created, ...pools];
      createMessage = { type: 'success', text: 'Pool created.' };
      resetCreateForm();
    } catch (error) {
      createMessage = { type: 'error', text: 'Unable to create pool.' };
    } finally {
      creating = false;
    }
  };

  const handleCreateLocation = async () => {
    locationMessage = null;
    locationErrors = [];
    if (!locationForm.name.trim()) {
      locationErrors = ['Location name is required.'];
      return;
    }

    creatingLocation = true;
    try {
      const latitudeText = locationForm.latitude;
      const longitudeText = locationForm.longitude;
      const latitude = latitudeText.trim() ? Number(latitudeText) : undefined;
      const longitude = longitudeText.trim() ? Number(longitudeText) : undefined;

      if (latitude !== undefined && Number.isNaN(latitude)) {
        locationErrors = ['Latitude must be a valid number.'];
        return;
      }
      if (longitude !== undefined && Number.isNaN(longitude)) {
        locationErrors = ['Longitude must be a valid number.'];
        return;
      }

      const payload = {
        name: locationForm.name.trim(),
        formattedAddress: locationForm.formattedAddress.trim() || undefined,
        googlePlaceId: locationForm.googlePlaceId.trim() || undefined,
        googlePlusCode: locationForm.googlePlusCode.trim() || undefined,
        latitude,
        longitude,
        timezone: locationForm.timezone.trim() || undefined,
        isPrimary: locationForm.isPrimary || undefined,
      };
      const res = await api.userLocations.create(payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        locationMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Create location failed (${res.status}).`,
        };
        return;
      }
      await res.json().catch(() => null);
      await refreshLocations();
      locationMessage = { type: 'success', text: 'Location created.' };
      resetLocationForm();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? `Unable to create location: ${error.message}`
          : 'Unable to create location.';
      locationMessage = { type: 'error', text: message };
    } finally {
      creatingLocation = false;
    }
  };

  const handleUpdate = async () => {
    if (!editingPoolId) return;
    editMessage = null;
    editErrors = validateForm(editForm);
    if (editErrors.length) return;

    updating = true;
    try {
      const res = await api.pools.patch(editingPoolId, toPayload(editForm));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        editMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Update failed (${res.status}).`,
        };
        return;
      }
      const updated = (await res.json()) as PoolSummary;
      pools = pools.map((pool) => (pool.poolId === updated.poolId ? updated : pool));
      editMessage = { type: 'success', text: 'Pool updated.' };
      editingPoolId = null;
    } catch (error) {
      editMessage = { type: 'error', text: 'Unable to update pool.' };
    } finally {
      updating = false;
    }
  };

  const handleDelete = async (pool: PoolSummary) => {
    if (deletingPoolId) return;
    const confirmOne = window.confirm(`Delete ${pool.name}? This cannot be undone.`);
    if (!confirmOne) return;
    const confirmTwo = window.confirm('Please confirm again to permanently remove this pool.');
    if (!confirmTwo) return;

    deletingPoolId = pool.poolId;
    try {
      const res = await api.pools.del(pool.poolId);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        editMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Delete failed (${res.status}).`,
        };
        return;
      }
      pools = pools.filter((item) => item.poolId !== pool.poolId);
      if (editingPoolId === pool.poolId) {
        cancelEdit();
      }
    } catch (error) {
      editMessage = { type: 'error', text: 'Unable to delete pool.' };
    } finally {
      deletingPoolId = null;
    }
  };
</script>

<Container>
<section class="mx-auto w-full max-w-6xl space-y-6 py-6">
  <header>
    <h1 class="text-2xl font-semibold text-content-primary">Pool setup</h1>
    <p class="mt-1 text-sm text-content-secondary">
      Create and manage pools tied to your account.
    </p>
  </header>

  {#if loadError}
    <Card status="warning">
      <p class="text-sm">{loadError}</p>
    </Card>
  {/if}

  <Card>
    <h2 class="text-lg font-semibold text-content-primary">Create new pool</h2>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <label class="text-sm font-medium text-content-secondary">
        Name
        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createForm.name} />
      </label>
      <label class="text-sm font-medium text-content-secondary">
        Volume (gallons)
        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" min="0" bind:value={createForm.volumeGallons} />
      </label>
      <label class="text-sm font-medium text-content-secondary">
        Sanitizer type
        <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createForm.sanitizerType}>
          <option value="">Select a sanitizer</option>
          {#each sanitizerOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
      <label class="text-sm font-medium text-content-secondary">
        Surface type
        <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createForm.surfaceType}>
          <option value="">Select a surface</option>
          {#each surfaceOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
      <label class="text-sm font-medium text-content-secondary sm:col-span-2">
        Location (optional)
        <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createForm.locationId}>
          <option value="">No location</option>
          {#each activeLocations as location}
            <option value={location.locationId}>{location.name}</option>
          {/each}
        </select>
      </label>
    </div>

    {#if createErrors.length > 0}
      <div class="mt-3 text-sm text-danger" role="alert">{createErrors.join(' ')}</div>
    {/if}
    {#if createMessage}
      <p class={`mt-3 text-sm ${createMessage.type === 'success' ? 'text-success' : 'text-danger'}`} role={createMessage.type === 'success' ? 'status' : 'alert'}>
        {createMessage.text}
      </p>
    {/if}

    <div class="mt-4">
      <button class="btn btn-primary" on:click={handleCreate} disabled={creating}>
        {creating ? 'Creating...' : 'Create pool'}
      </button>
    </div>
  </Card>

  <Card>
    <h2 class="text-lg font-semibold text-content-primary">Manage pools</h2>
    {#if pools.length === 0}
      <p class="mt-3 text-sm text-content-secondary">No pools yet.</p>
    {:else}
      <div class="mt-4 space-y-4">
        {#each pools as pool}
          <div class="surface-panel space-y-3">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="font-medium text-content-primary">{pool.name}</div>
                <div class="text-xs text-content-secondary/80">
                  {pool.volumeGallons} gal · {pool.sanitizerType} · {pool.surfaceType}
                </div>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-tonal" on:click={() => beginEdit(pool)}>Edit</button>
                <button class="btn btn-sm btn-secondary" on:click={() => handleDelete(pool)} disabled={deletingPoolId === pool.poolId}>
                  {deletingPoolId === pool.poolId ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>

            {#if editingPoolId === pool.poolId}
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-sm font-medium text-content-secondary">
                  Name
                  <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editForm.name} />
                </label>
                <label class="text-sm font-medium text-content-secondary">
                  Volume (gallons)
                  <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" min="0" bind:value={editForm.volumeGallons} />
                </label>
                <label class="text-sm font-medium text-content-secondary">
                  Sanitizer type
                  <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editForm.sanitizerType}>
                    <option value="">Select a sanitizer</option>
                    {#each sanitizerOptions as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                </label>
                <label class="text-sm font-medium text-content-secondary">
                  Surface type
                  <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editForm.surfaceType}>
                    <option value="">Select a surface</option>
                    {#each surfaceOptions as option}
                      <option value={option}>{option}</option>
                    {/each}
                  </select>
                </label>
                <label class="text-sm font-medium text-content-secondary sm:col-span-2">
                  Location (optional)
                  <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editForm.locationId}>
                    <option value="">No location</option>
                    {#each activeLocations as location}
                      <option value={location.locationId}>{location.name}</option>
                    {/each}
                  </select>
                </label>
              </div>

              {#if editErrors.length > 0}
                <div class="mt-2 text-sm text-danger" role="alert">{editErrors.join(' ')}</div>
              {/if}
              {#if editMessage}
                <p class={`mt-2 text-sm ${editMessage.type === 'success' ? 'text-success' : 'text-danger'}`} role={editMessage.type === 'success' ? 'status' : 'alert'}>
                  {editMessage.text}
                </p>
              {/if}

              <div class="mt-3 flex gap-2">
                <button class="btn btn-sm btn-primary" on:click={handleUpdate} disabled={updating}>
                  {updating ? 'Saving...' : 'Save changes'}
                </button>
                <button class="btn btn-sm btn-secondary" on:click={cancelEdit}>Cancel</button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <Card>
    <h2 class="text-lg font-semibold text-content-primary">Locations</h2>
    <p class="mt-1 text-sm text-content-secondary">
      Add a location to power weather insights. Latitude/longitude are needed for forecasts.
    </p>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <label class="text-sm font-medium text-content-secondary">
        Location name
        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={locationForm.name} />
      </label>
      <label class="text-sm font-medium text-content-secondary">
        Timezone (optional)
        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="America/Los_Angeles" bind:value={locationForm.timezone} />
      </label>
      <div class="sm:col-span-2">
        <GoogleMapPicker
          idPrefix="pool-location"
          bind:latitude={locationForm.latitude}
          bind:longitude={locationForm.longitude}
          bind:formattedAddress={locationForm.formattedAddress}
          bind:googlePlaceId={locationForm.googlePlaceId}
          bind:googlePlusCode={locationForm.googlePlusCode}
        />
      </div>
      <label class="text-sm font-medium text-content-secondary">
        Latitude (optional)
        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" step="0.0001" bind:value={locationForm.latitude} />
      </label>
      <label class="text-sm font-medium text-content-secondary">
        Longitude (optional)
        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" step="0.0001" bind:value={locationForm.longitude} />
      </label>
      <label class="text-sm font-medium text-content-secondary sm:col-span-2">
        Formatted address
        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={locationForm.formattedAddress} />
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-content-secondary sm:col-span-2">
        <input type="checkbox" class="rounded border-border" bind:checked={locationForm.isPrimary} />
        Set as primary location
      </label>
    </div>

    {#if locationErrors.length > 0}
      <div class="mt-3 text-sm text-danger" role="alert">{locationErrors.join(' ')}</div>
    {/if}
    {#if locationMessage}
      <p class={`mt-3 text-sm ${locationMessage.type === 'success' ? 'text-success' : 'text-danger'}`} role={locationMessage.type === 'success' ? 'status' : 'alert'}>
        {locationMessage.text}
      </p>
    {/if}

    <div class="mt-4">
      <button class="btn btn-primary" on:click={handleCreateLocation} disabled={creatingLocation}>
        {creatingLocation ? 'Creating...' : 'Create location'}
      </button>
    </div>
  </Card>

  <Card>
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold text-content-primary">Manage locations</h2>
      <button class="btn btn-sm btn-tonal" on:click={refreshLocations} disabled={loadingLocations}>
        {loadingLocations ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
    {#if locations.length === 0}
      <p class="mt-3 text-sm text-content-secondary">No locations yet.</p>
    {:else}
      <div class="mt-4 space-y-4">
        {#each locations as location}
          <div class="surface-panel">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="font-medium text-content-primary">{location.name}</div>
                <div class="text-xs text-content-secondary/80">
                  {#if location.formattedAddress}
                    {location.formattedAddress}
                  {:else}
                    {#if location.latitude !== null && location.longitude !== null}
                      {location.latitude}, {location.longitude}
                    {:else}
                      Coordinates not set
                    {/if}
                  {/if}
                  {#if location.googlePlaceId}
                    · Google place linked
                  {/if}
                </div>
                <div class="text-xs text-content-secondary/70">
                  {#if location.latitude !== null && location.longitude !== null}
                    {location.latitude}, {location.longitude}
                  {:else}
                    Coordinates not set
                  {/if}
                  {#if location.timezone}
                    · {location.timezone}
                  {/if}
                </div>
              </div>
              <div class="text-xs text-content-secondary/80">
                {#if location.isActive === false}
                  Inactive
                {:else if location.isPrimary}
                  Primary
                {:else}
                  Active
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Card>
</section>
</Container>
