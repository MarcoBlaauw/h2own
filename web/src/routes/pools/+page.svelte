<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import GoogleMapPicker from '$lib/components/location/GoogleMapPicker.svelte';
  import LocationPinsMap from '$lib/components/location/LocationPinsMap.svelte';
  import { api } from '$lib/api';
  import type { PageData } from './$types';
  import type { PoolSummary } from './+page';

  export let data: PageData;

  type LocationPoolSummary = {
    poolId: string;
    name: string;
  };

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
    pools: LocationPoolSummary[];
    city: string | null;
    state: string | null;
  };

  const parseCityState = (formattedAddress: string | null) => {
    if (!formattedAddress) return { city: null, state: null };
    const parts = formattedAddress
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 2) return { city: null, state: null };

    const city = parts[parts.length - 3] ?? parts[parts.length - 2] ?? null;
    const statePart = parts[parts.length - 2] ?? '';
    const state = statePart.split(/\s+/)[0] || null;
    return {
      city: city || null,
      state: state || null,
    };
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
          pools: Array.isArray(raw.pools)
            ? raw.pools
                .map((pool) => {
                  if (!pool || typeof pool !== 'object') return null;
                  const poolRaw = pool as Record<string, unknown>;
                  if (typeof poolRaw.poolId !== 'string' || typeof poolRaw.name !== 'string') {
                    return null;
                  }
                  return {
                    poolId: poolRaw.poolId,
                    name: poolRaw.name,
                  } satisfies LocationPoolSummary;
                })
                .filter((pool): pool is LocationPoolSummary => Boolean(pool))
            : [],
          ...parseCityState(typeof raw.formattedAddress === 'string' ? raw.formattedAddress : null),
        } satisfies LocationSummary;
      })
      .filter((location): location is LocationSummary => Boolean(location));
  };

  let pools: PoolSummary[] = data.pools ?? [];
  let locations: LocationSummary[] = normalizeLocations(data.locations);
  let loadError = data.loadError;
  let activePoolId = data.defaultPoolId ?? '';
  let activePoolMessage: { type: 'success' | 'error'; text: string } | null = null;
  let savingActivePool = false;

  type FormState = {
    name: string;
    volumeGallons: string;
    sanitizerType: string;
    chlorineSource: string;
    saltTargetPpm: string;
    sanitizerTargetMinPpm: string;
    sanitizerTargetMaxPpm: string;
    surfaceType: string;
    locationId?: string;
  };

  type EquipmentType = 'none' | 'heater' | 'chiller' | 'combo';
  type EnergySource = 'gas' | 'electric' | 'heat_pump' | 'solar_assisted' | 'unknown';
  type EquipmentStatus = 'enabled' | 'disabled';
  type TemperatureUnit = 'F' | 'C';

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

  const defaultForm: FormState = {
    name: '',
    volumeGallons: '',
    sanitizerType: '',
    chlorineSource: '',
    saltTargetPpm: '',
    sanitizerTargetMinPpm: '',
    sanitizerTargetMaxPpm: '',
    surfaceType: '',
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

  let createForm: FormState = { ...defaultForm };
  let editForm: FormState = { ...defaultForm };
  let createThermalForm: ThermalFormState = { ...defaultThermalForm };
  let editThermalForm: ThermalFormState = { ...defaultThermalForm };
  let poolEditLocationForm: {
    formattedAddress: string;
    googlePlaceId: string;
    googlePlusCode: string;
    latitude: string;
    longitude: string;
    timezone: string;
  } = {
    formattedAddress: '',
    googlePlaceId: '',
    googlePlusCode: '',
    latitude: '',
    longitude: '',
    timezone: '',
  };
  let locationForm: {
    formattedAddress: string;
    googlePlaceId: string;
    googlePlusCode: string;
    latitude: string;
    longitude: string;
    timezone: string;
  } = {
    formattedAddress: '',
    googlePlaceId: '',
    googlePlusCode: '',
    latitude: '',
    longitude: '',
    timezone: '',
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
  let loadingThermalSettings = false;
  let updatingLocation = false;
  let deletingPoolId: string | null = null;
  let deletingLocationId: string | null = null;
  let purgingLegacyLocations = false;
  let loadingLocations = false;
  let editingLocationId: string | null = null;
  let expandedLocationPools = new SvelteSet<string>();
  let showAllPools = false;
  let showAllLocations = false;
  let locationSearch = '';
  let locationCityFilter = '';
  let locationStateFilter = '';

  let locationEditForm: {
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

  $: activeLocations = locations.filter((location) => location.isActive !== false);
  $: cityOptions = Array.from(
    new Set(
      locations
        .map((location) => location.city)
        .filter((city): city is string => Boolean(city))
    )
  ).sort((a, b) => a.localeCompare(b));
  $: stateOptions = Array.from(
    new Set(
      locations
        .map((location) => location.state)
        .filter((state): state is string => Boolean(state))
    )
  ).sort((a, b) => a.localeCompare(b));
  $: filteredLocations = locations.filter((location) => {
    const search = locationSearch.trim().toLowerCase();
    if (search) {
      const haystack = [
        location.name,
        location.formattedAddress ?? '',
        location.city ?? '',
        location.state ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (locationCityFilter && location.city !== locationCityFilter) return false;
    if (locationStateFilter && location.state !== locationStateFilter) return false;
    return true;
  });
  $: visiblePools = showAllPools ? pools : pools.slice(0, 5);
  $: visibleLocations = showAllLocations
    ? filteredLocations
    : filteredLocations.slice(0, 5);
  $: if (activePoolId && !pools.some((pool) => pool.poolId === activePoolId)) {
    activePoolId = '';
  }

  const sanitizerOptions = ['chlorine', 'bromine'];
  const chlorineSourceOptions = ['manual', 'swg'];
  const surfaceOptions = ['plaster', 'vinyl', 'fiberglass', 'tile', 'concrete', 'other'];
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

  const fallbackTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Pacific/Honolulu',
  ];

  const getTimezones = () => {
    if (typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function') {
      try {
        return (Intl as any).supportedValuesOf('timeZone') as string[];
      } catch {
        return fallbackTimezones;
      }
    }
    return fallbackTimezones;
  };
  const availableTimezones = getTimezones();

  const normalizeText = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
  };

  const isChlorineSanitizer = (value: string) => value.trim().toLowerCase() === 'chlorine';
  const isBromineSanitizer = (value: string) => value.trim().toLowerCase() === 'bromine';
  const isSwgChlorinePool = (sanitizerType: string, chlorineSource: string) =>
    isChlorineSanitizer(sanitizerType) && chlorineSource.trim().toLowerCase() === 'swg';
  const showsSanitizerTargetRange = (value: string) =>
    ['chlorine', 'bromine'].includes(value.trim().toLowerCase());

  const validateForm = (form: FormState) => {
    const errors: string[] = [];
    if (!normalizeText(form.name).trim()) errors.push('Name is required.');
    if (!normalizeText(form.volumeGallons).trim()) errors.push('Volume is required.');
    if (!normalizeText(form.sanitizerType).trim()) errors.push('Sanitizer type is required.');
    if (!showsSanitizerTargetRange(form.sanitizerType)) {
      errors.push('Sanitizer type must be chlorine or bromine.');
    }
    if (isChlorineSanitizer(form.sanitizerType) && !form.chlorineSource.trim()) {
      errors.push('Chlorine source is required for chlorine pools.');
    }
    if (isSwgChlorinePool(form.sanitizerType, form.chlorineSource)) {
      const saltTarget = parseOptionalNumber(form.saltTargetPpm);
      if (saltTarget === null || saltTarget <= 0) {
        errors.push('Salt target (ppm) is required for SWG chlorine pools and must be a positive number.');
      }
    }
    if (showsSanitizerTargetRange(form.sanitizerType)) {
      const sanitizerMin = parseOptionalNumber(form.sanitizerTargetMinPpm);
      const sanitizerMax = parseOptionalNumber(form.sanitizerTargetMaxPpm);
      if (sanitizerMin === null || sanitizerMax === null) {
        errors.push('Sanitizer target range requires both minimum and maximum ppm values.');
      } else if (sanitizerMin <= 0 || sanitizerMax <= 0 || sanitizerMin > sanitizerMax) {
        errors.push('Sanitizer target range must be positive and min must be less than or equal to max.');
      }
    }
    if (!normalizeText(form.surfaceType).trim()) errors.push('Surface type is required.');
    return errors;
  };

  const parseOptionalNumber = (value: string | number | null | undefined) => {
    const trimmed = normalizeText(value).trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const validateThermalForm = (form: ThermalFormState, errors: string[]) => {
    const capacity = parseOptionalNumber(form.capacityBtu);
    if (form.capacityBtu.trim() && (capacity === null || capacity <= 0)) {
      errors.push('Equipment capacity must be a positive number.');
    }

    const preferred = parseOptionalNumber(form.preferredTemp);
    const min = parseOptionalNumber(form.minTemp);
    const max = parseOptionalNumber(form.maxTemp);

    if (form.preferredTemp.trim() && preferred === null) {
      errors.push('Preferred temperature must be numeric.');
    }
    if (form.minTemp.trim() && min === null) {
      errors.push('Minimum temperature must be numeric.');
    }
    if (form.maxTemp.trim() && max === null) {
      errors.push('Maximum temperature must be numeric.');
    }
    if (min !== null && max !== null && min > max) {
      errors.push('Minimum temperature must be less than or equal to maximum temperature.');
    }
    if (preferred !== null && min !== null && preferred < min) {
      errors.push('Preferred temperature must be greater than or equal to minimum temperature.');
    }
    if (preferred !== null && max !== null && preferred > max) {
      errors.push('Preferred temperature must be less than or equal to maximum temperature.');
    }
  };

  const toEquipmentPayload = (form: ThermalFormState) => ({
    equipmentType: form.equipmentType,
    energySource: form.energySource,
    status: form.equipmentType === 'none' ? 'disabled' : form.status,
    capacityBtu: parseOptionalNumber(form.capacityBtu),
    metadata: null,
  });

  const toTemperaturePreferencesPayload = (form: ThermalFormState) => ({
    preferredTemp: parseOptionalNumber(form.preferredTemp),
    minTemp: parseOptionalNumber(form.minTemp),
    maxTemp: parseOptionalNumber(form.maxTemp),
    unit: form.unit,
  });

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

  const toPayload = (form: FormState) => ({
    name: form.name.trim(),
    volumeGallons: Number(form.volumeGallons),
    sanitizerType: form.sanitizerType.trim(),
    chlorineSource: isChlorineSanitizer(form.sanitizerType) ? form.chlorineSource.trim() : null,
    saltLevelPpm: isSwgChlorinePool(form.sanitizerType, form.chlorineSource)
      ? parseOptionalNumber(form.saltTargetPpm)
      : null,
    sanitizerTargetMinPpm: showsSanitizerTargetRange(form.sanitizerType)
      ? parseOptionalNumber(form.sanitizerTargetMinPpm)
      : null,
    sanitizerTargetMaxPpm: showsSanitizerTargetRange(form.sanitizerType)
      ? parseOptionalNumber(form.sanitizerTargetMaxPpm)
      : null,
    surfaceType: form.surfaceType.trim(),
    locationId: form.locationId?.trim() || undefined,
  });

  const resetCreateForm = () => {
    createForm = { ...defaultForm };
    createThermalForm = { ...defaultThermalForm };
    createErrors = [];
  };

  const resetLocationForm = () => {
    locationForm = {
      formattedAddress: '',
      googlePlaceId: '',
      googlePlusCode: '',
      latitude: '',
      longitude: '',
      timezone: '',
    };
    locationErrors = [];
  };

  const saveActivePool = async () => {
    savingActivePool = true;
    activePoolMessage = null;
    try {
      const payload = { defaultPoolId: activePoolId || null };
      const res = await api.me.updatePreferences(payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        activePoolMessage = {
          type: 'error',
          text: body.message ?? body.error ?? `Unable to save active pool (${res.status}).`,
        };
        return;
      }
      activePoolMessage = { type: 'success', text: 'Active pool updated.' };
    } catch {
      activePoolMessage = { type: 'error', text: 'Unable to save active pool.' };
    } finally {
      savingActivePool = false;
    }
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

  const beginLocationEdit = (location: LocationSummary) => {
    editingLocationId = location.locationId;
    locationEditForm = {
      name: location.name,
      formattedAddress: location.formattedAddress ?? '',
      googlePlaceId: location.googlePlaceId ?? '',
      googlePlusCode: location.googlePlusCode ?? '',
      latitude: location.latitude === null ? '' : String(location.latitude),
      longitude: location.longitude === null ? '' : String(location.longitude),
      timezone: location.timezone ?? '',
      isPrimary: location.isPrimary,
    };
  };

  const cancelLocationEdit = () => {
    editingLocationId = null;
  };

  const toggleLocationPools = (locationId: string) => {
    if (expandedLocationPools.has(locationId)) {
      expandedLocationPools.delete(locationId);
    } else {
      expandedLocationPools.add(locationId);
    }
  };

  const beginEdit = (pool: PoolSummary) => {
    const currentLocation = pool.locationId
      ? locations.find((location) => location.locationId === pool.locationId) ?? null
      : null;
    editingPoolId = pool.poolId;
    editForm = {
      name: pool.name ?? '',
      volumeGallons: pool.volumeGallons?.toString() ?? '',
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
      locationId: pool.locationId ?? '',
    };
    poolEditLocationForm = {
      formattedAddress: currentLocation?.formattedAddress ?? '',
      googlePlaceId: currentLocation?.googlePlaceId ?? '',
      googlePlusCode: currentLocation?.googlePlusCode ?? '',
      latitude: currentLocation?.latitude === null || currentLocation?.latitude === undefined
        ? ''
        : String(currentLocation.latitude),
      longitude:
        currentLocation?.longitude === null || currentLocation?.longitude === undefined
          ? ''
          : String(currentLocation.longitude),
      timezone: currentLocation?.timezone ?? '',
    };
    editErrors = [];
    editMessage = null;
    editThermalForm = { ...defaultThermalForm };
    void loadPoolThermalSettings(pool.poolId);
  };

  const cancelEdit = () => {
    editingPoolId = null;
    editThermalForm = { ...defaultThermalForm };
    editErrors = [];
    editMessage = null;
  };

  const loadPoolThermalSettings = async (poolId: string) => {
    loadingThermalSettings = true;
    try {
      const [equipmentRes, prefsRes] = await Promise.all([
        api.pools.equipment(poolId),
        api.pools.temperaturePreferences(poolId),
      ]);
      if (!equipmentRes.ok || !prefsRes.ok) {
        return;
      }
      const equipment = await equipmentRes.json().catch(() => null);
      const prefs = await prefsRes.json().catch(() => null);
      if (editingPoolId === poolId) {
        editThermalForm = hydrateThermalForm(equipment, prefs);
      }
    } finally {
      loadingThermalSettings = false;
    }
  };

  const savePoolThermalSettings = async (poolId: string, form: ThermalFormState) => {
    const [equipmentRes, prefsRes] = await Promise.all([
      api.pools.updateEquipment(poolId, toEquipmentPayload(form)),
      api.pools.updateTemperaturePreferences(poolId, toTemperaturePreferencesPayload(form)),
    ]);

    if (!equipmentRes.ok || !prefsRes.ok) {
      const [equipmentBody, prefsBody] = await Promise.all([
        equipmentRes.json().catch(() => ({})),
        prefsRes.json().catch(() => ({})),
      ]);
      const equipmentError = equipmentBody.error ?? equipmentBody.message;
      const prefsError = prefsBody.error ?? prefsBody.message;
      return (
        equipmentError ||
        prefsError ||
        `Unable to save thermal settings (${equipmentRes.status}/${prefsRes.status}).`
      );
    }

    return null;
  };

  const handleCreate = async () => {
    createMessage = null;
    createErrors = validateForm(createForm);
    validateThermalForm(createThermalForm, createErrors);
    const latitude = locationForm.latitude.trim()
      ? Number(locationForm.latitude.trim())
      : undefined;
    const longitude = locationForm.longitude.trim()
      ? Number(locationForm.longitude.trim())
      : undefined;
    if (latitude === undefined || Number.isNaN(latitude)) {
      createErrors.push('Select a valid location pin to set latitude.');
    }
    if (longitude === undefined || Number.isNaN(longitude)) {
      createErrors.push('Select a valid location pin to set longitude.');
    }
    if (!locationForm.timezone.trim()) {
      createErrors.push('Timezone is required. Pick a location pin first.');
    }
    if (createErrors.length) return;

    creating = true;
    let createdLocationId: string | null = null;
    try {
      const fallbackName = `${createForm.name.trim()} location`;
      const autoName =
        locationForm.formattedAddress.trim().split(',')[0]?.trim() || fallbackName;
      const locationRes = await api.userLocations.create({
        name: autoName,
        formattedAddress: locationForm.formattedAddress.trim() || undefined,
        googlePlaceId: locationForm.googlePlaceId.trim() || undefined,
        googlePlusCode: locationForm.googlePlusCode.trim() || undefined,
        latitude,
        longitude,
        timezone: locationForm.timezone.trim(),
      });
      if (!locationRes.ok) {
        const body = await locationRes.json().catch(() => ({}));
        createMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Create location failed (${locationRes.status}).`,
        };
        return;
      }
      const createdLocation = (await locationRes.json().catch(() => null)) as
        | { locationId?: string }
        | null;
      createdLocationId =
        createdLocation && typeof createdLocation.locationId === 'string'
          ? createdLocation.locationId
          : null;
      if (!createdLocationId) {
        createMessage = {
          type: 'error',
          text: 'Location was created but no location ID was returned.',
        };
        return;
      }

      const res = await api.pools.create({
        ...toPayload(createForm),
        locationId: createdLocationId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (createdLocationId) {
          await api.userLocations.deactivate(createdLocationId, { transferPoolsTo: null }).catch(
            () => null
          );
        }
        createMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Create failed (${res.status}).`,
        };
        return;
      }
      const created = (await res.json()) as PoolSummary;
      const thermalError = await savePoolThermalSettings(created.poolId, createThermalForm);
      if (thermalError) {
        createMessage = {
          type: 'error',
          text: `Pool created, but thermal settings failed: ${thermalError}`,
        };
        pools = [created, ...pools];
        await refreshLocations();
        return;
      }
      pools = [created, ...pools];
      createMessage = { type: 'success', text: 'Pool created.' };
      resetCreateForm();
      resetLocationForm();
      await refreshLocations();
    } catch (error) {
      createMessage = { type: 'error', text: 'Unable to create pool.' };
    } finally {
      creating = false;
    }
  };

  const handleUpdateLocation = async (locationId: string) => {
    locationMessage = null;
    locationErrors = [];
    if (!locationEditForm.name.trim()) {
      locationErrors = ['Location name is required.'];
      return;
    }

    updatingLocation = true;
    try {
      const latitude = locationEditForm.latitude.trim()
        ? Number(locationEditForm.latitude)
        : undefined;
      const longitude = locationEditForm.longitude.trim()
        ? Number(locationEditForm.longitude)
        : undefined;
      if (latitude !== undefined && Number.isNaN(latitude)) {
        locationErrors = ['Latitude must be a valid number.'];
        return;
      }
      if (longitude !== undefined && Number.isNaN(longitude)) {
        locationErrors = ['Longitude must be a valid number.'];
        return;
      }

      const payload = {
        name: locationEditForm.name.trim(),
        formattedAddress: locationEditForm.formattedAddress.trim() || null,
        googlePlaceId: locationEditForm.googlePlaceId.trim() || null,
        googlePlusCode: locationEditForm.googlePlusCode.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timezone: locationEditForm.timezone.trim() || null,
        isPrimary: locationEditForm.isPrimary,
      };

      const res = await api.userLocations.update(locationId, payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        locationMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Update location failed (${res.status}).`,
        };
        return;
      }
      await refreshLocations();
      editingLocationId = null;
      locationMessage = { type: 'success', text: 'Location updated.' };
    } catch (error) {
      locationMessage = { type: 'error', text: 'Unable to update location.' };
    } finally {
      updatingLocation = false;
    }
  };

  const handleDeactivateLocation = async (location: LocationSummary) => {
    if (deletingLocationId) return;
    const confirmed = window.confirm(`Remove location "${location.name}"?`);
    if (!confirmed) return;

    deletingLocationId = location.locationId;
    try {
      const res =
        location.isActive === false
          ? await api.userLocations.delete(location.locationId)
          : await api.userLocations.deactivate(location.locationId, {
              transferPoolsTo: null,
            });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        locationMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Remove location failed (${res.status}).`,
        };
        return;
      }
      await refreshLocations();
      locationMessage = {
        type: 'success',
        text:
          location.isActive === false
            ? 'Location permanently deleted.'
            : 'Location removed.',
      };
    } catch (error) {
      locationMessage = { type: 'error', text: 'Unable to remove location.' };
    } finally {
      deletingLocationId = null;
    }
  };

  const handlePurgeLegacyLocations = async () => {
    if (purgingLegacyLocations) return;
    const confirmed = window.confirm(
      'Delete all legacy locations without a Google Place ID? Pools linked to these locations will be unassigned.'
    );
    if (!confirmed) return;

    purgingLegacyLocations = true;
    try {
      const res = await api.userLocations.purgeLegacy();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        locationMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Purge failed (${res.status}).`,
        };
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { deletedCount?: number };
      await refreshLocations();
      locationMessage = {
        type: 'success',
        text: `Deleted ${body.deletedCount ?? 0} legacy location(s).`,
      };
    } catch (error) {
      locationMessage = { type: 'error', text: 'Unable to purge legacy locations.' };
    } finally {
      purgingLegacyLocations = false;
    }
  };

  const handleUpdate = async () => {
    if (!editingPoolId) return;
    editMessage = null;
    editErrors = validateForm(editForm);
    validateThermalForm(editThermalForm, editErrors);
    const latitude = poolEditLocationForm.latitude.trim()
      ? Number(poolEditLocationForm.latitude.trim())
      : undefined;
    const longitude = poolEditLocationForm.longitude.trim()
      ? Number(poolEditLocationForm.longitude.trim())
      : undefined;
    if (latitude === undefined || Number.isNaN(latitude)) {
      editErrors.push('Select a valid location pin to set latitude.');
    }
    if (longitude === undefined || Number.isNaN(longitude)) {
      editErrors.push('Select a valid location pin to set longitude.');
    }
    if (!poolEditLocationForm.timezone.trim()) {
      editErrors.push('Timezone is required. Pick a location pin first.');
    }
    if (editErrors.length) return;

    updating = true;
    try {
      const locationRes = await api.userLocations.create({
        name: poolEditLocationForm.formattedAddress.trim().split(',')[0]?.trim() || `${editForm.name.trim()} location`,
        formattedAddress: poolEditLocationForm.formattedAddress.trim() || undefined,
        googlePlaceId: poolEditLocationForm.googlePlaceId.trim() || undefined,
        googlePlusCode: poolEditLocationForm.googlePlusCode.trim() || undefined,
        latitude,
        longitude,
        timezone: poolEditLocationForm.timezone.trim(),
      });
      if (!locationRes.ok) {
        const body = await locationRes.json().catch(() => ({}));
        editMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Create location failed (${locationRes.status}).`,
        };
        return;
      }
      const createdLocation = (await locationRes.json().catch(() => null)) as
        | { locationId?: string }
        | null;
      const locationId =
        createdLocation && typeof createdLocation.locationId === 'string'
          ? createdLocation.locationId
          : null;
      if (!locationId) {
        editMessage = { type: 'error', text: 'Location created without location ID.' };
        return;
      }

      const res = await api.pools.patch(editingPoolId, {
        ...toPayload(editForm),
        locationId,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        editMessage = {
          type: 'error',
          text: body.error ?? body.message ?? `Update failed (${res.status}).`,
        };
        return;
      }
      const updated = (await res.json()) as PoolSummary;
      const thermalError = await savePoolThermalSettings(editingPoolId, editThermalForm);
      if (thermalError) {
        editMessage = {
          type: 'error',
          text: `Pool updated, but thermal settings failed: ${thermalError}`,
        };
        pools = pools.map((pool) => (pool.poolId === updated.poolId ? updated : pool));
        await refreshLocations();
        return;
      }
      pools = pools.map((pool) => (pool.poolId === updated.poolId ? updated : pool));
      editMessage = { type: 'success', text: 'Pool updated.' };
      editingPoolId = null;
      await refreshLocations();
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
    <h1 class="text-2xl font-semibold text-content-primary">My Pools</h1>
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
    <div class="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-content-primary">Active Pool</h2>
        <p class="text-sm text-content-secondary">
          Choose the pool used as your default context in Pool Overview and related workflows.
        </p>
        <label class="text-sm font-medium text-content-secondary">
          Active pool
          <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={activePoolId}>
            <option value="">No default pool</option>
            {#each pools as pool}
              <option value={pool.poolId}>{pool.name}</option>
            {/each}
          </select>
        </label>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-sm btn-primary" on:click={saveActivePool} disabled={savingActivePool}>
            {savingActivePool ? 'Saving...' : 'Save active pool'}
          </button>
          <a
            class="btn btn-sm btn-secondary"
            href={activePoolId ? `/overview?poolId=${activePoolId}` : '/overview'}
          >
            Open Pool Overview
          </a>
        </div>
        {#if activePoolMessage}
          <p class={`text-sm ${activePoolMessage.type === 'success' ? 'text-success' : 'text-danger'}`}>
            {activePoolMessage.text}
          </p>
        {/if}
      </div>
      <div>
        <LocationPinsMap
          locations={filteredLocations}
          idPrefix="pool-locations-active"
          heightClass="h-56"
          activePoolId={activePoolId || null}
        />
      </div>
    </div>
  </Card>

  <Card>
    <h2 class="text-lg font-semibold text-content-primary">Create new pool</h2>
    <div class="mt-4 space-y-4">
      <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Pool Characteristics</p>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
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
          {#if isChlorineSanitizer(createForm.sanitizerType)}
            <label class="text-sm font-medium text-content-secondary">
              Chlorine source
              <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createForm.chlorineSource}>
                <option value="">Select chlorine source</option>
                {#each chlorineSourceOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </label>
          {/if}
          {#if isSwgChlorinePool(createForm.sanitizerType, createForm.chlorineSource)}
            <label class="text-sm font-medium text-content-secondary">
              Salt target (ppm)
              <input
                class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                type="number"
                min="1"
                bind:value={createForm.saltTargetPpm}
                placeholder="e.g. 3200"
              />
              <span class="mt-1 block text-xs font-normal text-content-secondary/80">
                SWG generator salt configuration target, not a test reading.
              </span>
            </label>
          {/if}
          {#if showsSanitizerTargetRange(createForm.sanitizerType)}
            <label class="text-sm font-medium text-content-secondary">
              Sanitizer target min (ppm)
              <input
                class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                type="number"
                min="0"
                step="0.1"
                bind:value={createForm.sanitizerTargetMinPpm}
                placeholder="e.g. 3"
              />
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Sanitizer target max (ppm)
              <input
                class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                type="number"
                min="0"
                step="0.1"
                bind:value={createForm.sanitizerTargetMaxPpm}
                placeholder="e.g. 5"
              />
              <span class="mt-1 block text-xs font-normal text-content-secondary/80">
                Required target policy range for sanitizer residual in ppm.
              </span>
            </label>
          {/if}
          <label class="text-sm font-medium text-content-secondary">
            Surface type
            <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createForm.surfaceType}>
              <option value="">Select a surface</option>
              {#each surfaceOptions as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </label>
        </div>
      </div>

      <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Thermal System</p>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <label class="text-sm font-medium text-content-secondary">
            Thermal equipment
            <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createThermalForm.equipmentType}>
              {#each equipmentTypeOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>

          {#if createThermalForm.equipmentType !== 'none'}
            <label class="text-sm font-medium text-content-secondary">
              Energy source
              <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createThermalForm.energySource}>
                {#each energySourceOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Equipment status
              <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createThermalForm.status}>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Capacity (BTU/hr)
              <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" min="1" bind:value={createThermalForm.capacityBtu} />
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Temperature unit
              <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createThermalForm.unit}>
                <option value="F">Fahrenheit (F)</option>
                <option value="C">Celsius (C)</option>
              </select>
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Preferred swim temperature
              <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" step="0.1" bind:value={createThermalForm.preferredTemp} />
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Min automation temperature
              <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" step="0.1" bind:value={createThermalForm.minTemp} />
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Max automation temperature
              <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" step="0.1" bind:value={createThermalForm.maxTemp} />
            </label>
          {/if}
        </div>
      </div>

      <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Location</p>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <GoogleMapPicker
              idPrefix="pool-create-location"
              bind:latitude={locationForm.latitude}
              bind:longitude={locationForm.longitude}
              bind:formattedAddress={locationForm.formattedAddress}
              bind:googlePlaceId={locationForm.googlePlaceId}
              bind:googlePlusCode={locationForm.googlePlusCode}
              bind:timezone={locationForm.timezone}
            />
          </div>
          <label class="text-sm font-medium text-content-secondary">
            Timezone (from pin)
            <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={locationForm.timezone}>
              <option value="">Auto-detect from map pin</option>
              {#each availableTimezones as zone}
                <option value={zone}>{zone}</option>
              {/each}
            </select>
          </label>
          <label class="text-sm font-medium text-content-secondary">
            Latitude
            <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="text" inputmode="decimal" bind:value={locationForm.latitude} />
          </label>
          <label class="text-sm font-medium text-content-secondary">
            Longitude
            <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="text" inputmode="decimal" bind:value={locationForm.longitude} />
          </label>
          <label class="text-sm font-medium text-content-secondary sm:col-span-2">
            Selected address
            <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={locationForm.formattedAddress} />
          </label>
        </div>
      </div>
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
        {#each visiblePools as pool}
          <div class="surface-panel space-y-3">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="font-medium text-content-primary">{pool.name}</div>
                <div class="text-xs text-content-secondary/80">
                  {pool.volumeGallons} gal · {pool.sanitizerType} · {pool.surfaceType}
                </div>
                {#if pool.accessRole && pool.accessRole !== 'owner'}
                  <div class="mt-1 text-xs text-content-secondary/80">
                    Access: {pool.accessRole} (owner-only edits are disabled)
                  </div>
                {/if}
              </div>
              {#if !pool.accessRole || pool.accessRole === 'owner'}
                <div class="flex gap-2">
                  <button class="btn btn-sm btn-tonal" on:click={() => beginEdit(pool)}>Edit pool</button>
                  <button class="btn btn-sm btn-secondary" on:click={() => handleDelete(pool)} disabled={deletingPoolId === pool.poolId}>
                    {deletingPoolId === pool.poolId ? 'Removing...' : 'Remove pool'}
                  </button>
                </div>
              {/if}
            </div>

            {#if editingPoolId === pool.poolId}
              {#if loadingThermalSettings}
                <p class="text-xs text-content-secondary/80">Loading equipment and temperature settings...</p>
              {/if}
              <div class="space-y-4">
                <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
                  <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Pool Characteristics</p>
                  <div class="mt-3 grid gap-3 sm:grid-cols-2">
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
                    {#if isChlorineSanitizer(editForm.sanitizerType)}
                      <label class="text-sm font-medium text-content-secondary">
                        Chlorine source
                        <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editForm.chlorineSource}>
                          <option value="">Select chlorine source</option>
                          {#each chlorineSourceOptions as option}
                            <option value={option}>{option}</option>
                          {/each}
                        </select>
                      </label>
                    {/if}
                    {#if isSwgChlorinePool(editForm.sanitizerType, editForm.chlorineSource)}
                      <label class="text-sm font-medium text-content-secondary">
                        Salt target (ppm)
                        <input
                          class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                          type="number"
                          min="1"
                          bind:value={editForm.saltTargetPpm}
                          placeholder="e.g. 3200"
                        />
                        <span class="mt-1 block text-xs font-normal text-content-secondary/80">
                          SWG generator salt configuration target, not a test reading.
                        </span>
                      </label>
                    {/if}
                    {#if showsSanitizerTargetRange(editForm.sanitizerType)}
                      <label class="text-sm font-medium text-content-secondary">
                        Sanitizer target min (ppm)
                        <input
                          class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                          type="number"
                          min="0"
                          step="0.1"
                          bind:value={editForm.sanitizerTargetMinPpm}
                          placeholder="e.g. 3"
                        />
                      </label>
                      <label class="text-sm font-medium text-content-secondary">
                        Sanitizer target max (ppm)
                        <input
                          class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                          type="number"
                          min="0"
                          step="0.1"
                          bind:value={editForm.sanitizerTargetMaxPpm}
                          placeholder="e.g. 5"
                        />
                        <span class="mt-1 block text-xs font-normal text-content-secondary/80">
                          Required target policy range for sanitizer residual in ppm.
                        </span>
                      </label>
                    {/if}
                    <label class="text-sm font-medium text-content-secondary">
                      Surface type
                      <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editForm.surfaceType}>
                        <option value="">Select a surface</option>
                        {#each surfaceOptions as option}
                          <option value={option}>{option}</option>
                        {/each}
                      </select>
                    </label>
                  </div>
                </div>

                <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
                  <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Thermal System</p>
                  <div class="mt-3 grid gap-3 sm:grid-cols-2">
                    <label class="text-sm font-medium text-content-secondary">
                      Thermal equipment
                      <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editThermalForm.equipmentType}>
                        {#each equipmentTypeOptions as option}
                          <option value={option.value}>{option.label}</option>
                        {/each}
                      </select>
                    </label>

                    {#if editThermalForm.equipmentType !== 'none'}
                      <label class="text-sm font-medium text-content-secondary">
                        Energy source
                        <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editThermalForm.energySource}>
                          {#each energySourceOptions as option}
                            <option value={option.value}>{option.label}</option>
                          {/each}
                        </select>
                      </label>
                      <label class="text-sm font-medium text-content-secondary">
                        Equipment status
                        <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editThermalForm.status}>
                          <option value="enabled">Enabled</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </label>
                      <label class="text-sm font-medium text-content-secondary">
                        Capacity (BTU/hr)
                        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" min="1" bind:value={editThermalForm.capacityBtu} />
                      </label>
                      <label class="text-sm font-medium text-content-secondary">
                        Temperature unit
                        <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={editThermalForm.unit}>
                          <option value="F">Fahrenheit (F)</option>
                          <option value="C">Celsius (C)</option>
                        </select>
                      </label>
                      <label class="text-sm font-medium text-content-secondary">
                        Preferred swim temperature
                        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" step="0.1" bind:value={editThermalForm.preferredTemp} />
                      </label>
                      <label class="text-sm font-medium text-content-secondary">
                        Min automation temperature
                        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" step="0.1" bind:value={editThermalForm.minTemp} />
                      </label>
                      <label class="text-sm font-medium text-content-secondary">
                        Max automation temperature
                        <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" step="0.1" bind:value={editThermalForm.maxTemp} />
                      </label>
                    {/if}
                  </div>
                </div>

                <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
                  <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Location</p>
                  <div class="mt-3 grid gap-3 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                      <GoogleMapPicker
                        idPrefix={`pool-edit-location-${pool.poolId}`}
                        bind:latitude={poolEditLocationForm.latitude}
                        bind:longitude={poolEditLocationForm.longitude}
                        bind:formattedAddress={poolEditLocationForm.formattedAddress}
                        bind:googlePlaceId={poolEditLocationForm.googlePlaceId}
                        bind:googlePlusCode={poolEditLocationForm.googlePlusCode}
                        bind:timezone={poolEditLocationForm.timezone}
                        heightClass="h-44"
                      />
                    </div>
                    <label class="text-sm font-medium text-content-secondary">
                      Timezone (from pin)
                      <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={poolEditLocationForm.timezone}>
                        <option value="">Auto-detect from map pin</option>
                        {#each availableTimezones as zone}
                          <option value={zone}>{zone}</option>
                        {/each}
                      </select>
                    </label>
                    <label class="text-sm font-medium text-content-secondary">
                      Latitude
                      <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="text" inputmode="decimal" bind:value={poolEditLocationForm.latitude} />
                    </label>
                    <label class="text-sm font-medium text-content-secondary">
                      Longitude
                      <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="text" inputmode="decimal" bind:value={poolEditLocationForm.longitude} />
                    </label>
                    <label class="text-sm font-medium text-content-secondary sm:col-span-2">
                      Selected address
                      <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={poolEditLocationForm.formattedAddress} />
                    </label>
                  </div>
                </div>
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
      {#if pools.length > 5}
        <div class="mt-4">
          <button class="btn btn-sm btn-tonal" on:click={() => (showAllPools = !showAllPools)}>
            {showAllPools ? 'Show fewer pools' : `Show all pools (${pools.length})`}
          </button>
        </div>
      {/if}
    {/if}
  </Card>

  <Card>
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-lg font-semibold text-content-primary">Manage locations</h2>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" on:click={handlePurgeLegacyLocations} disabled={purgingLegacyLocations}>
          {purgingLegacyLocations ? 'Purging...' : 'Purge legacy'}
        </button>
        <button class="btn btn-sm btn-tonal" on:click={refreshLocations} disabled={loadingLocations}>
          {loadingLocations ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <label class="text-sm font-medium text-content-secondary">
        Search
        <input
          class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Name, address, city, state"
          bind:value={locationSearch}
        />
      </label>
      <label class="text-sm font-medium text-content-secondary">
        City
        <select
          class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          bind:value={locationCityFilter}
        >
          <option value="">All cities</option>
          {#each cityOptions as city}
            <option value={city}>{city}</option>
          {/each}
        </select>
      </label>
      <label class="text-sm font-medium text-content-secondary">
        State
        <select
          class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          bind:value={locationStateFilter}
        >
          <option value="">All states</option>
          {#each stateOptions as state}
            <option value={state}>{state}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="mt-4">
      <LocationPinsMap
        locations={filteredLocations}
        idPrefix="pool-locations-overview"
        activePoolId={activePoolId || null}
      />
    </div>

    <p class="mt-3 text-xs text-content-secondary">
      Showing {filteredLocations.length} of {locations.length} locations.
    </p>
    {#if locations.length === 0}
      <p class="mt-3 text-sm text-content-secondary">No locations yet.</p>
    {:else}
      <div class="mt-4 space-y-4">
        {#each visibleLocations as location}
          <div class="surface-panel space-y-3">
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

            <div class="flex flex-wrap gap-2">
              <button class="btn btn-sm btn-tonal" on:click={() => beginLocationEdit(location)}>
                Edit location
              </button>
              <button
                class="btn btn-sm btn-secondary"
                on:click={() => handleDeactivateLocation(location)}
                disabled={deletingLocationId === location.locationId}
              >
                {deletingLocationId === location.locationId ? 'Removing...' : 'Remove location'}
              </button>
              <button class="btn btn-sm btn-tonal" on:click={() => toggleLocationPools(location.locationId)}>
                {expandedLocationPools.has(location.locationId)
                  ? `Hide pools (${location.pools.length})`
                  : `Show pools (${location.pools.length})`}
              </button>
            </div>

            {#if expandedLocationPools.has(location.locationId)}
              <div class="rounded-lg border border-border/70 bg-surface/40 p-3">
                <p class="text-xs font-medium uppercase tracking-wide text-content-secondary">
                  Pools at this location
                </p>
                {#if location.pools.length === 0}
                  <p class="mt-2 text-sm text-content-secondary">No pools assigned.</p>
                {:else}
                  <ul class="mt-2 space-y-1">
                    {#each location.pools as pool}
                      <li class="text-sm text-content-primary">{pool.name}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}

            {#if editingLocationId === location.locationId}
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-sm font-medium text-content-secondary">
                  Location name
                  <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={locationEditForm.name} />
                </label>
                <label class="text-sm font-medium text-content-secondary">
                  Timezone
                  <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={locationEditForm.timezone}>
                    <option value="">No timezone</option>
                    {#each availableTimezones as zone}
                      <option value={zone}>{zone}</option>
                    {/each}
                  </select>
                </label>
                <div class="sm:col-span-2">
                  <GoogleMapPicker
                    idPrefix={`edit-location-${location.locationId}`}
                    bind:latitude={locationEditForm.latitude}
                    bind:longitude={locationEditForm.longitude}
                    bind:formattedAddress={locationEditForm.formattedAddress}
                    bind:googlePlaceId={locationEditForm.googlePlaceId}
                    bind:googlePlusCode={locationEditForm.googlePlusCode}
                    bind:timezone={locationEditForm.timezone}
                    heightClass="h-44"
                  />
                </div>
                <label class="text-sm font-medium text-content-secondary sm:col-span-2">
                  Formatted address
                  <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={locationEditForm.formattedAddress} />
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-content-secondary sm:col-span-2">
                  <input type="checkbox" class="rounded border-border" bind:checked={locationEditForm.isPrimary} />
                  Set as primary location
                </label>
              </div>
              <div class="mt-3 flex gap-2">
                <button class="btn btn-sm btn-primary" on:click={() => handleUpdateLocation(location.locationId)} disabled={updatingLocation}>
                  {updatingLocation ? 'Saving...' : 'Save location'}
                </button>
                <button class="btn btn-sm btn-secondary" on:click={cancelLocationEdit}>Cancel</button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
      {#if filteredLocations.length > 5}
        <div class="mt-4">
          <button class="btn btn-sm btn-tonal" on:click={() => (showAllLocations = !showAllLocations)}>
            {showAllLocations
              ? 'Show fewer locations'
              : `Show all locations (${filteredLocations.length})`}
          </button>
        </div>
      {/if}
    {/if}
  </Card>
</section>
</Container>
