<script lang="ts">
  import { api } from '$lib/api';
  import Card from '$lib/components/ui/Card.svelte';
  import type { PageData } from './$types';
  import type { AdminPool } from './+page';

  export let data: PageData;

  type EquipmentType = 'none' | 'heater' | 'chiller' | 'combo';
  type EnergySource = 'gas' | 'electric' | 'heat_pump' | 'solar_assisted' | 'unknown';
  type EquipmentStatus = 'enabled' | 'disabled';
  type TemperatureUnit = 'F' | 'C';

  type UpdateFormState = {
    poolId: string | null;
    name: string;
    volumeGallons: string;
    sanitizerType: string;
    chlorineSource: string;
    saltTargetPpm: string;
    sanitizerTargetMinPpm: string;
    sanitizerTargetMaxPpm: string;
    surfaceType: string;
    isActive: boolean;
  };

  type ThermalFormState = {
    equipmentType: EquipmentType;
    energySource: EnergySource;
    status: EquipmentStatus;
    capacityBtu: string;
    preferredTemp: string;
    minTemp: string;
    maxTemp: string;
    unit: TemperatureUnit;
  };

  type TransferFormState = {
    newOwnerId: string;
    retainExistingAccess: boolean;
  };

  const defaultUpdateForm: UpdateFormState = {
    poolId: null,
    name: '',
    volumeGallons: '',
    sanitizerType: '',
    chlorineSource: '',
    saltTargetPpm: '',
    sanitizerTargetMinPpm: '',
    sanitizerTargetMaxPpm: '',
    surfaceType: '',
    isActive: true,
  };

  const defaultThermalForm: ThermalFormState = {
    equipmentType: 'none',
    energySource: 'unknown',
    status: 'disabled',
    capacityBtu: '',
    preferredTemp: '',
    minTemp: '',
    maxTemp: '',
    unit: 'F',
  };

  const equipmentTypeOptions: Array<{ value: EquipmentType; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'heater', label: 'Heater only' },
    { value: 'chiller', label: 'Chiller only' },
    { value: 'combo', label: 'Heater + chiller' },
  ];

  const energySourceOptions: Array<{ value: EnergySource; label: string }> = [
    { value: 'unknown', label: 'Unknown' },
    { value: 'gas', label: 'Gas' },
    { value: 'electric', label: 'Electric' },
    { value: 'heat_pump', label: 'Heat pump' },
    { value: 'solar_assisted', label: 'Solar-assisted' },
  ];

  let pools: AdminPool[] = data.pools ?? [];
  let loadError: string | null = data.loadError;
  let selectedPoolId: string | null = pools[0]?.id ?? null;

  let updateForm: UpdateFormState = { ...defaultUpdateForm };
  let thermalForm: ThermalFormState = { ...defaultThermalForm };
  let transferForm: TransferFormState = { newOwnerId: '', retainExistingAccess: false };

  let updateErrors: string[] = [];
  let transferErrors: string[] = [];
  let updateMessage: { type: 'success' | 'error'; text: string } | null = null;
  let transferMessage: { type: 'success' | 'error'; text: string } | null = null;

  let updating = false;
  let transferring = false;
  let refreshing = false;
  let loadingThermal = false;

  $: selectedPool = selectedPoolId
    ? pools.find((pool) => pool.id === selectedPoolId) ?? null
    : null;

  function formFromPool(pool: AdminPool): UpdateFormState {
    return {
      poolId: pool.id,
      name: pool.name,
      volumeGallons: pool.volumeGallons.toString(),
      sanitizerType: pool.sanitizerType ?? '',
      chlorineSource: pool.chlorineSource ?? '',
      saltTargetPpm:
        pool.saltLevelPpm === null || pool.saltLevelPpm === undefined
          ? ''
          : String(pool.saltLevelPpm),
      sanitizerTargetMinPpm:
        pool.sanitizerTargetMinPpm === null || pool.sanitizerTargetMinPpm === undefined
          ? ''
          : String(pool.sanitizerTargetMinPpm),
      sanitizerTargetMaxPpm:
        pool.sanitizerTargetMaxPpm === null || pool.sanitizerTargetMaxPpm === undefined
          ? ''
          : String(pool.sanitizerTargetMaxPpm),
      surfaceType: pool.surfaceType ?? '',
      isActive: pool.isActive,
    };
  }

  function defaultTransferForm(pool: AdminPool): TransferFormState {
    const nextMember = pool.members.find((member) => member.userId !== pool.ownerId);
    return {
      newOwnerId: nextMember?.userId ?? '',
      retainExistingAccess: false,
    } satisfies TransferFormState;
  }

  function applyPoolSelection(pool: AdminPool) {
    updateForm = formFromPool(pool);
    transferForm = defaultTransferForm(pool);
    thermalForm = { ...defaultThermalForm };
    updateErrors = [];
    transferErrors = [];
    updateMessage = null;
    transferMessage = null;
    void loadThermalSettings(pool.id);
  }

  function selectPool(poolId: string | null) {
    if (poolId === selectedPoolId) return;
    selectedPoolId = poolId;
    const nextPool = poolId ? pools.find((pool) => pool.id === poolId) ?? null : null;
    if (nextPool) {
      applyPoolSelection(nextPool);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  }

  const parseOptionalNumber = (value: string | number | null | undefined) => {
    const trimmed = value === null || value === undefined ? '' : String(value).trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const isChlorineSanitizer = (value: string | null | undefined) =>
    typeof value === 'string' && value.trim().toLowerCase() === 'chlorine';
  const isBromineSanitizer = (value: string | null | undefined) =>
    typeof value === 'string' && value.trim().toLowerCase() === 'bromine';
  const showsSanitizerTargetRange = (value: string | null | undefined) =>
    typeof value === 'string' && ['chlorine', 'bromine'].includes(value.trim().toLowerCase());
  const isSwgChlorinePool = (
    sanitizerType: string | null | undefined,
    chlorineSource: string | null | undefined
  ) =>
    isChlorineSanitizer(sanitizerType) &&
    typeof chlorineSource === 'string' &&
    chlorineSource.trim().toLowerCase() === 'swg';

  const hydrateThermalForm = (equipmentInput: unknown, prefsInput: unknown): ThermalFormState => {
    const equipment = (equipmentInput ?? {}) as Record<string, unknown>;
    const prefs = (prefsInput ?? {}) as Record<string, unknown>;

    return {
      equipmentType: (equipment.equipmentType as EquipmentType) ?? 'none',
      energySource: (equipment.energySource as EnergySource) ?? 'unknown',
      status: (equipment.status as EquipmentStatus) ?? 'disabled',
      capacityBtu:
        equipment.capacityBtu === null || equipment.capacityBtu === undefined
          ? ''
          : String(equipment.capacityBtu),
      preferredTemp:
        prefs.preferredTemp === null || prefs.preferredTemp === undefined
          ? ''
          : String(prefs.preferredTemp),
      minTemp: prefs.minTemp === null || prefs.minTemp === undefined ? '' : String(prefs.minTemp),
      maxTemp: prefs.maxTemp === null || prefs.maxTemp === undefined ? '' : String(prefs.maxTemp),
      unit: prefs.unit === 'C' ? 'C' : 'F',
    };
  };

  const validateThermalForm = (errors: string[]) => {
    const capacity = parseOptionalNumber(thermalForm.capacityBtu);
    if (thermalForm.capacityBtu.trim() && (capacity === null || capacity <= 0)) {
      errors.push('Equipment capacity must be a positive number.');
    }

    const preferred = parseOptionalNumber(thermalForm.preferredTemp);
    const min = parseOptionalNumber(thermalForm.minTemp);
    const max = parseOptionalNumber(thermalForm.maxTemp);

    if (thermalForm.preferredTemp.trim() && preferred === null) errors.push('Preferred temperature must be numeric.');
    if (thermalForm.minTemp.trim() && min === null) errors.push('Minimum temperature must be numeric.');
    if (thermalForm.maxTemp.trim() && max === null) errors.push('Maximum temperature must be numeric.');
    if (min !== null && max !== null && min > max) errors.push('Minimum temperature must be less than or equal to maximum temperature.');
    if (preferred !== null && min !== null && preferred < min) errors.push('Preferred temperature must be greater than or equal to minimum temperature.');
    if (preferred !== null && max !== null && preferred > max) errors.push('Preferred temperature must be less than or equal to maximum temperature.');
  };

  const equipmentPayload = () => ({
    equipmentType: thermalForm.equipmentType,
    energySource: thermalForm.energySource,
    status: thermalForm.equipmentType === 'none' ? 'disabled' : thermalForm.status,
    capacityBtu: parseOptionalNumber(thermalForm.capacityBtu),
    metadata: null,
  });

  const tempPrefsPayload = () => ({
    preferredTemp: parseOptionalNumber(thermalForm.preferredTemp),
    minTemp: parseOptionalNumber(thermalForm.minTemp),
    maxTemp: parseOptionalNumber(thermalForm.maxTemp),
    unit: thermalForm.unit,
  });

  async function loadThermalSettings(poolId: string) {
    loadingThermal = true;
    try {
      const [equipmentRes, prefsRes] = await Promise.all([
        api.adminPools.equipment(poolId),
        api.adminPools.temperaturePreferences(poolId),
      ]);

      if (!equipmentRes.ok || !prefsRes.ok) return;

      const [equipment, prefs] = await Promise.all([
        equipmentRes.json().catch(() => null),
        prefsRes.json().catch(() => null),
      ]);

      if (selectedPoolId === poolId) {
        thermalForm = hydrateThermalForm(equipment, prefs);
      }
    } finally {
      loadingThermal = false;
    }
  }

  async function refreshPools(preferredId?: string | null) {
    refreshing = true;
    try {
      const response = await api.adminPools.list();
      if (!response.ok) throw new Error(`Refresh failed (${response.status})`);

      const refreshed = (await response.json()) as AdminPool[];
      pools = refreshed;
      let nextSelectedPoolId = selectedPoolId;
      if (preferredId && refreshed.some((pool) => pool.id === preferredId)) {
        nextSelectedPoolId = preferredId;
      } else if (selectedPoolId && !refreshed.some((pool) => pool.id === selectedPoolId)) {
        nextSelectedPoolId = refreshed[0]?.id ?? null;
      }

      if (nextSelectedPoolId !== selectedPoolId) {
        selectPool(nextSelectedPoolId);
      }
    } catch (error) {
      console.error('Failed to refresh pools', error);
    } finally {
      refreshing = false;
    }
  }

  async function handleUpdate(event: SubmitEvent) {
    event.preventDefault();
    updateErrors = [];
    updateMessage = null;

    if (!selectedPool) return;

    const trimmedName = updateForm.name.trim();
    if (!trimmedName) updateErrors.push('Name is required.');

    const volumeInput =
      typeof updateForm.volumeGallons === 'number'
        ? String(updateForm.volumeGallons)
        : (updateForm.volumeGallons ?? '');
    const volumeValue = Number(volumeInput.trim());
    if (Number.isNaN(volumeValue) || volumeValue <= 0) {
      updateErrors.push('Volume must be a positive number.');
    }

    validateThermalForm(updateErrors);

    if (updateErrors.length > 0) return;

    const payload: Record<string, unknown> = {};
    if (trimmedName !== selectedPool.name) payload.name = trimmedName;
    if (volumeValue !== selectedPool.volumeGallons) payload.volumeGallons = volumeValue;

    const sanitizer = updateForm.sanitizerType.trim();
    const chlorineSource = updateForm.chlorineSource.trim();
    const saltTarget = parseOptionalNumber(updateForm.saltTargetPpm);
    const sanitizerTargetMin = parseOptionalNumber(updateForm.sanitizerTargetMinPpm);
    const sanitizerTargetMax = parseOptionalNumber(updateForm.sanitizerTargetMaxPpm);
    if (!showsSanitizerTargetRange(sanitizer)) {
      updateErrors.push('Sanitizer type must be chlorine or bromine.');
    }
    if (isChlorineSanitizer(sanitizer) && !chlorineSource) {
      updateErrors.push('Chlorine source is required for chlorine pools.');
    }
    if (isSwgChlorinePool(sanitizer, chlorineSource) && (saltTarget === null || saltTarget <= 0)) {
      updateErrors.push('Salt target (ppm) is required for SWG chlorine pools and must be a positive number.');
    }
    if (showsSanitizerTargetRange(sanitizer)) {
      if (sanitizerTargetMin === null || sanitizerTargetMax === null) {
        updateErrors.push('Sanitizer target range requires both minimum and maximum ppm values.');
      } else if (sanitizerTargetMin <= 0 || sanitizerTargetMax <= 0 || sanitizerTargetMin > sanitizerTargetMax) {
        updateErrors.push('Sanitizer target range must be positive and min must be less than or equal to max.');
      }
    }
    if (sanitizer !== (selectedPool.sanitizerType ?? '')) payload.sanitizerType = sanitizer;
    if (isChlorineSanitizer(sanitizer)) {
      if (chlorineSource !== (selectedPool.chlorineSource ?? '')) payload.chlorineSource = chlorineSource;
    } else if (selectedPool.chlorineSource !== null) {
      payload.chlorineSource = null;
    }
    if (isSwgChlorinePool(sanitizer, chlorineSource)) {
      if (saltTarget !== selectedPool.saltLevelPpm) payload.saltLevelPpm = saltTarget;
    } else if (selectedPool.saltLevelPpm !== null) {
      payload.saltLevelPpm = null;
    }
    if (showsSanitizerTargetRange(sanitizer)) {
      if (sanitizerTargetMin !== selectedPool.sanitizerTargetMinPpm) {
        payload.sanitizerTargetMinPpm = sanitizerTargetMin;
      }
      if (sanitizerTargetMax !== selectedPool.sanitizerTargetMaxPpm) {
        payload.sanitizerTargetMaxPpm = sanitizerTargetMax;
      }
    } else {
      if (selectedPool.sanitizerTargetMinPpm !== null) payload.sanitizerTargetMinPpm = null;
      if (selectedPool.sanitizerTargetMaxPpm !== null) payload.sanitizerTargetMaxPpm = null;
    }

    const surface = updateForm.surfaceType.trim();
    if (surface !== (selectedPool.surfaceType ?? '')) payload.surfaceType = surface;

    if (updateForm.isActive !== selectedPool.isActive) payload.isActive = updateForm.isActive;

    if (updateErrors.length > 0) return;

    updating = true;
    try {
      if (Object.keys(payload).length > 0) {
        const poolRes = await api.adminPools.update(selectedPool.id, payload);
        if (!poolRes.ok) {
          updateMessage = { type: 'error', text: `Pool metadata update failed (${poolRes.status}).` };
          return;
        }
      }

      const [equipmentRes, prefsRes] = await Promise.all([
        api.adminPools.updateEquipment(selectedPool.id, equipmentPayload()),
        api.adminPools.updateTemperaturePreferences(selectedPool.id, tempPrefsPayload()),
      ]);

      if (!equipmentRes.ok || !prefsRes.ok) {
        updateMessage = {
          type: 'error',
          text: `Thermal settings update failed (${equipmentRes.status}/${prefsRes.status}).`,
        };
        return;
      }

      updateMessage = { type: 'success', text: 'Pool updated successfully.' };
      await refreshPools(selectedPool.id);
      await loadThermalSettings(selectedPool.id);
    } catch (error) {
      console.error('Failed to update pool', error);
      updateMessage = {
        type: 'error',
        text: 'Unable to update pool. Please try again later.',
      };
    } finally {
      updating = false;
    }
  }

  async function handleTransfer(event: SubmitEvent) {
    event.preventDefault();
    transferErrors = [];
    transferMessage = null;

    if (!selectedPool) return;

    const newOwnerId = transferForm.newOwnerId.trim();
    if (!newOwnerId) transferErrors.push('A new owner must be selected.');
    else if (newOwnerId === selectedPool.ownerId) transferErrors.push('The selected user already owns this pool.');

    if (transferErrors.length > 0) return;

    transferring = true;
    try {
      const response = await api.adminPools.transfer(selectedPool.id, {
        newOwnerId,
        retainExistingAccess: transferForm.retainExistingAccess,
      });
      if (!response.ok) {
        transferMessage = { type: 'error', text: `Transfer failed (${response.status}).` };
        return;
      }

      transferMessage = { type: 'success', text: 'Ownership transferred successfully.' };
      await refreshPools(selectedPool.id);
    } catch (error) {
      console.error('Failed to transfer ownership', error);
      transferMessage = {
        type: 'error',
        text: 'Unable to transfer ownership. Please try again later.',
      };
    } finally {
      transferring = false;
    }
  }

  if (selectedPoolId) {
    const initialPool = pools.find((pool) => pool.id === selectedPoolId) ?? null;
    if (initialPool) {
      applyPoolSelection(initialPool);
    }
  }
</script>

<svelte:head>
  <title>Admin Pools</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:flex-row">
  <aside class="sm:w-64">
    <Card className="p-4">
      <h2 class="text-lg font-semibold text-content-primary">Pools</h2>
      {#if loadError}
        <div role="alert" class="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}
        </div>
      {/if}
      {#if pools.length === 0}
        <p class="mt-4 text-sm text-content-secondary">No pools found.</p>
      {:else}
        <ul class="mt-3 space-y-2">
          {#each pools as pool}
            <li>
              <button
                class={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedPoolId === pool.id
                    ? 'bg-accent/10 text-accent-strong'
                    : 'bg-surface-strong/40 hover:bg-surface-strong/60'
                }`}
                type="button"
                on:click={() => selectPool(pool.id)}
              >
                <div class="font-medium">{pool.name}</div>
                <div class="text-xs text-content-secondary">Members: {pool.memberCount}</div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </aside>

  <section class="flex-1 space-y-6">
    {#if selectedPool}
      <Card className="p-5">
        <header class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold text-content-primary">{selectedPool.name}</h2>
            <p class="text-sm text-content-secondary">Pool ID: {selectedPool.id}</p>
          </div>
          <div class="flex flex-wrap gap-3 text-sm text-content-secondary">
            <span>Owner: {selectedPool.owner?.email ?? selectedPool.owner?.id ?? 'Unknown'}</span>
            <span>Status: {selectedPool.isActive ? 'Active' : 'Suspended'}</span>
            <span>Last Test: {formatDate(selectedPool.lastTestedAt)}</span>
          </div>
        </header>

        <div class="mt-4 grid gap-6 lg:grid-cols-2">
          <form class="space-y-4" on:submit|preventDefault={handleUpdate} aria-label="Update pool">
            <h3 class="text-lg font-semibold text-content-primary">Pool Configuration</h3>

            <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Pool Characteristics</p>
              <div class="mt-3 grid gap-3">
                <label class="text-sm font-medium text-content-secondary" for="pool-name">Name</label>
                <input id="pool-name" class="input" type="text" bind:value={updateForm.name} required />

                <label class="text-sm font-medium text-content-secondary" for="pool-volume">Volume (gallons)</label>
                <input id="pool-volume" class="input" type="number" min="1" bind:value={updateForm.volumeGallons} required />

                <label class="text-sm font-medium text-content-secondary" for="pool-sanitizer">Sanitizer</label>
                <select id="pool-sanitizer" class="input" bind:value={updateForm.sanitizerType}>
                  <option value="">Select sanitizer</option>
                  <option value="chlorine">chlorine</option>
                  <option value="bromine">bromine</option>
                </select>
                {#if isChlorineSanitizer(updateForm.sanitizerType)}
                  <label class="text-sm font-medium text-content-secondary" for="pool-chlorine-source">Chlorine source</label>
                  <select id="pool-chlorine-source" class="input" bind:value={updateForm.chlorineSource}>
                    <option value="">Select chlorine source</option>
                    <option value="manual">manual</option>
                    <option value="swg">swg</option>
                  </select>
                {/if}
                {#if isSwgChlorinePool(updateForm.sanitizerType, updateForm.chlorineSource)}
                  <label class="text-sm font-medium text-content-secondary" for="pool-salt-target">Salt target (ppm)</label>
                  <div>
                    <input
                      id="pool-salt-target"
                      class="input"
                      type="number"
                      min="1"
                      bind:value={updateForm.saltTargetPpm}
                      placeholder="e.g. 3200"
                    />
                    <p class="mt-1 text-xs text-content-secondary/80">
                      SWG generator salt configuration target, not a test reading.
                    </p>
                  </div>
                {/if}
                {#if showsSanitizerTargetRange(updateForm.sanitizerType)}
                  <label class="text-sm font-medium text-content-secondary" for="pool-sanitizer-target-min">
                    Sanitizer target min (ppm)
                  </label>
                  <input
                    id="pool-sanitizer-target-min"
                    class="input"
                    type="number"
                    min="0"
                    step="0.1"
                    bind:value={updateForm.sanitizerTargetMinPpm}
                    placeholder="e.g. 3"
                  />

                  <label class="text-sm font-medium text-content-secondary" for="pool-sanitizer-target-max">
                    Sanitizer target max (ppm)
                  </label>
                  <div>
                    <input
                      id="pool-sanitizer-target-max"
                      class="input"
                      type="number"
                      min="0"
                      step="0.1"
                      bind:value={updateForm.sanitizerTargetMaxPpm}
                      placeholder="e.g. 5"
                    />
                    <p class="mt-1 text-xs text-content-secondary/80">
                      Required target policy range for sanitizer residual in ppm.
                    </p>
                  </div>
                {/if}

                <label class="text-sm font-medium text-content-secondary" for="pool-surface">Surface</label>
                <input id="pool-surface" class="input" type="text" bind:value={updateForm.surfaceType} placeholder="e.g. Plaster" />

                <label class="flex items-center gap-2 text-sm font-medium text-content-secondary">
                  <input type="checkbox" bind:checked={updateForm.isActive} />
                  Pool is active
                </label>
              </div>
            </div>

            <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Thermal System</p>
              {#if loadingThermal}
                <p class="mt-2 text-xs text-content-secondary/80">Loading thermal settings...</p>
              {/if}
              <div class="mt-3 grid gap-3">
                <label class="text-sm font-medium text-content-secondary" for="pool-thermal-type">Thermal equipment</label>
                <select id="pool-thermal-type" class="input" bind:value={thermalForm.equipmentType}>
                  {#each equipmentTypeOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>

                {#if thermalForm.equipmentType !== 'none'}
                  <label class="text-sm font-medium text-content-secondary" for="pool-energy-source">Energy source</label>
                  <select id="pool-energy-source" class="input" bind:value={thermalForm.energySource}>
                    {#each energySourceOptions as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>

                  <label class="text-sm font-medium text-content-secondary" for="pool-equipment-status">Equipment status</label>
                  <select id="pool-equipment-status" class="input" bind:value={thermalForm.status}>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>

                  <label class="text-sm font-medium text-content-secondary" for="pool-capacity">Capacity (BTU/hr)</label>
                  <input id="pool-capacity" class="input" type="number" min="1" bind:value={thermalForm.capacityBtu} />

                  <label class="text-sm font-medium text-content-secondary" for="pool-temp-unit">Temperature unit</label>
                  <select id="pool-temp-unit" class="input" bind:value={thermalForm.unit}>
                    <option value="F">Fahrenheit (F)</option>
                    <option value="C">Celsius (C)</option>
                  </select>

                  <label class="text-sm font-medium text-content-secondary" for="pool-temp-preferred">Preferred swim temperature</label>
                  <input id="pool-temp-preferred" class="input" type="number" step="0.1" bind:value={thermalForm.preferredTemp} />

                  <label class="text-sm font-medium text-content-secondary" for="pool-temp-min">Min automation temperature</label>
                  <input id="pool-temp-min" class="input" type="number" step="0.1" bind:value={thermalForm.minTemp} />

                  <label class="text-sm font-medium text-content-secondary" for="pool-temp-max">Max automation temperature</label>
                  <input id="pool-temp-max" class="input" type="number" step="0.1" bind:value={thermalForm.maxTemp} />
                {/if}
              </div>
            </div>

            {#if updateErrors.length > 0}
              <ul class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {#each updateErrors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            {/if}

            {#if updateMessage}
              <div
                class={`rounded-md p-3 text-sm ${
                  updateMessage.type === 'success'
                    ? 'border border-success/40 bg-success/10 text-success'
                    : 'border border-destructive/40 bg-destructive/10 text-destructive'
                }`}
              >
                {updateMessage.text}
              </div>
            {/if}

            <button class="btn btn-primary" type="submit" disabled={updating}>
              {updating ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

          <form class="space-y-4" on:submit|preventDefault={handleTransfer} aria-label="Transfer ownership">
            <h3 class="text-lg font-semibold text-content-primary">Ownership</h3>
            <div class="grid gap-3">
              <label class="text-sm font-medium text-content-secondary" for="pool-transfer-select">
                New owner
              </label>
              <select id="pool-transfer-select" class="input" bind:value={transferForm.newOwnerId}>
                <option value="">Select a member</option>
                {#each selectedPool.members as member}
                  {#if member.userId !== selectedPool.ownerId}
                    <option value={member.userId}>
                      {member.email ?? member.userId} ({member.roleName})
                    </option>
                  {/if}
                {/each}
              </select>
              <label class="mt-1 flex items-start gap-2 text-sm text-content-secondary">
                <input type="checkbox" bind:checked={transferForm.retainExistingAccess} />
                <span>
                  Retain existing member access after transfer
                  <span class="block text-xs text-content-secondary/80">
                    When unchecked, prior non-owner access is revoked by default during sign-over.
                  </span>
                </span>
              </label>
            </div>

            {#if transferErrors.length > 0}
              <ul class="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {#each transferErrors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            {/if}

            {#if transferMessage}
              <div
                class={`rounded-md p-3 text-sm ${
                  transferMessage.type === 'success'
                    ? 'border border-success/40 bg-success/10 text-success'
                    : 'border border-destructive/40 bg-destructive/10 text-destructive'
                }`}
              >
                {transferMessage.text}
              </div>
            {/if}

            <button class="btn btn-secondary" type="submit" disabled={transferring}>
              {transferring ? 'Transferring…' : 'Transfer Ownership'}
            </button>

            <button
              type="button"
              class="btn btn-tonal"
              disabled={refreshing}
              on:click={() => refreshPools(selectedPool.id)}
            >
              {refreshing ? 'Refreshing…' : 'Refresh Pool Data'}
            </button>
          </form>
        </div>
      </Card>
    {:else}
      <Card className="p-5">
        <p class="text-sm text-content-secondary">Select a pool to manage.</p>
      </Card>
    {/if}
  </section>
</div>
