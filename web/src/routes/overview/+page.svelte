<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Container from '$lib/components/layout/Container.svelte';
  import MetricTile from '$lib/components/MetricTile.svelte';
  import PoolSummaryCard from '$lib/components/PoolSummaryCard.svelte';
  import QuickTestForm from '$lib/components/QuickTestForm.svelte';
  import RecommendationsCard from '$lib/components/RecommendationsCard.svelte';
  import DosingHistoryCard from '$lib/components/DosingHistoryCard.svelte';
  import WeatherQualityCard from '$lib/components/WeatherQualityCard.svelte';
  import AdSlot from '$lib/components/AdSlot.svelte';
  import AiMaintenanceAdvisorCard from '$lib/components/AiMaintenanceAdvisorCard.svelte';
  import GuidedTestForm from '$lib/components/GuidedTestForm.svelte';
  import UpcomingMaintenanceCard from '$lib/components/UpcomingMaintenanceCard.svelte';
  import GoogleMapPicker from '$lib/components/location/GoogleMapPicker.svelte';
  import { api } from '$lib/api';
  import { page } from '$app/stores';

  type HighlightedPool = {
    id: string;
    name?: string;
    owner?: { email?: string | null; name?: string | null } | null;
    volumeGallons?: number | null;
    surfaceType?: string | null;
    sanitizerType?: string | null;
    chlorineSource?: string | null;
    saltLevelPpm?: number | null;
    sanitizerTargetMinPpm?: number | null;
    sanitizerTargetMaxPpm?: number | null;
    locationId?: string | null;
    lastTestedAt?: string | Date | null;
    tests?: Array<{
      id?: string;
      testedAt?: string | Date | null;
      freeChlorine?: number | null;
      ph?: number | null;
      totalAlkalinity?: number | null;
      cyanuricAcid?: number | null;
      calciumHardness?: number | null;
      salt?: number | null;
    }> | null;
    equipment?: {
      equipmentType?: string | null;
      energySource?: string | null;
      status?: string | null;
      capacityBtu?: number | null;
    } | null;
  };

  type UserLocationSummary = {
    locationId: string;
    name: string;
    formattedAddress?: string | null;
    googlePlaceId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    timezone?: string | null;
    isActive?: boolean;
  };

  export let data: {
    pools: Array<{ poolId: string; name?: string }>;
    locations: UserLocationSummary[];
    preferences?: {
      measurementSystem?: 'metric' | 'imperial' | null;
    } | null;
    highlightedPool: HighlightedPool | null;
    defaultPoolId?: string | null;
    latestTest: {
      sessionId?: string;
      freeChlorinePpm?: string | null;
      phLevel?: string | null;
      totalAlkalinityPpm?: number | null;
      cyanuricAcidPpm?: number | null;
      calciumHardnessPpm?: number | null;
      saltPpm?: number | null;
      testedAt?: string | Date | null;
    } | null;
    recentTests: Array<{
      id?: string;
      testedAt?: string | Date | null;
      freeChlorine?: number | null;
      ph?: number | null;
      totalAlkalinity?: number | null;
      cyanuricAcid?: number | null;
      calciumHardness?: number | null;
      salt?: number | null;
    }>;
    recommendations: {
      primary: {
        chemicalId: string;
        chemicalName: string;
        amount: number;
        unit: string | null;
        reason: string;
        predictedOutcome: string;
      } | null;
      alternatives: Array<{
        chemicalId: string;
        chemicalName: string;
        amount: number;
        unit: string | null;
        reason: string;
        predictedOutcome: string;
      }>;
    } | null;
    latestTreatmentPlan?: {
      planId: string;
      status: string;
      responsePayload?: {
        interpretationSummary?: string;
        stepByStepPlan?: Array<{
          action: string;
          amount: number | null;
          unit: string | null;
          rationale: string;
        }>;
      } | null;
      createdAt: string;
    } | null;
    recommendationHistory: Array<{
      recommendationId: string;
      type: string;
      title: string;
      description?: string | null;
      status: string;
      payload?: {
        chemicalId?: string;
        chemicalName?: string;
        amount?: number;
        unit?: string | null;
        predictedOutcome?: string;
      } | null;
      createdAt: string;
    }>;
    dosingHistory: Array<{
      actionId: string;
      chemicalId: string;
      chemicalName?: string | null;
      amount: string | number;
      unit: string | null;
      addedAt: string | Date | null;
      reason?: string | null;
      additionMethod?: string | null;
    }>;
    inventoryItems: Array<{
      productId: string;
      itemClass?: string | null;
      productName?: string | null;
      productBrand?: string | null;
      unit?: string | null;
      quantityOnHand?: string | number | null;
    }>;
    effectiveness: {
      byPool: Array<{
        poolId?: string | null;
        poolName?: string | null;
        outcomes: number;
        loggedOutcomes: number;
        averageQuality: number | null;
      }>;
      byTreatmentType: Array<{
        treatmentType?: string | null;
        outcomes: number;
        loggedOutcomes: number;
        averageQuality: number | null;
      }>;
    };
    dueOutcomePrompts: Array<{
      dueAt: string;
      checkpointHours: number;
    }>;
    weatherDaily: Array<{
      weatherId: string;
      locationId: string;
      recordedAt: string;
      createdAt?: string | null;
      sunriseTime?: string | null;
      sunsetTime?: string | null;
      visibilityMi?: string | number | null;
      cloudCoverPercent?: string | number | null;
      cloudBaseKm?: string | number | null;
      cloudCeilingKm?: string | number | null;
      airTempF?: number | null;
      temperatureApparentF?: number | null;
      uvIndex?: number | null;
      uvHealthConcern?: number | null;
      ezHeatStressIndex?: number | null;
      rainfallIn?: string | number | null;
      windSpeedMph?: number | null;
      windDirectionDeg?: number | null;
      windGustMph?: number | null;
      humidityPercent?: number | null;
    }>;
    weatherError?: string | null;
  };


  const deriveRecommendationsFromPlan = (plan: typeof data.latestTreatmentPlan) => {
    const firstStep = plan?.responsePayload?.stepByStepPlan?.[0];
    if (!firstStep) return null;
    return {
      primary: {
        chemicalId: 'treatment-plan-artifact',
        chemicalName: firstStep.action,
        amount: firstStep.amount ?? 0,
        unit: firstStep.unit,
        reason: plan?.responsePayload?.interpretationSummary ?? firstStep.rationale,
        predictedOutcome: firstStep.rationale,
      },
      alternatives: [],
    };
  };

  $: effectiveRecommendations =
    deriveRecommendationsFromPlan(data.latestTreatmentPlan) ?? data.recommendations;

  const formatMeasurement = (
    value: string | number | null | undefined,
    suffix: string,
    decimals = 1,
  ) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
      return '—';
    }
    return `${numeric.toFixed(decimals)}${suffix}`;
  };

  const findLatestMetricValue = (
    tests: typeof data.recentTests,
    selector: (test: (typeof data.recentTests)[number]) => number | string | null | undefined,
  ) => {
    for (const test of tests ?? []) {
      const value = selector(test);
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }
    return null;
  };

  const formatTargetRange = (
    min: number | string | null | undefined,
    max: number | string | null | undefined,
    suffix = '',
  ) => {
    if (min === null || min === undefined || max === null || max === undefined) {
      return null;
    }
    return `target ${min}\u2013${max}${suffix}`;
  };

  const defaultSanitizerTargetHint = (pool: HighlightedPool | null) => {
    const derived = formatTargetRange(
      pool?.sanitizerTargetMinPpm ?? null,
      pool?.sanitizerTargetMaxPpm ?? null,
    );
    if (derived) return derived;
    return pool?.sanitizerType?.toLowerCase() === 'bromine' ? 'target 3–5' : 'target 2–4';
  };

  const defaultSaltTargetHint = (pool: HighlightedPool | null) => {
    const saltTarget = pool?.saltLevelPpm;
    if (typeof saltTarget === 'number' && Number.isFinite(saltTarget) && saltTarget > 0) {
      return `target ${saltTarget.toLocaleString()} ppm`;
    }
    return 'target 2700–3400';
  };

  $: latestMetricValues = {
    freeChlorinePpm: findLatestMetricValue(data.recentTests, (test) => test.freeChlorine),
    phLevel: findLatestMetricValue(data.recentTests, (test) => test.ph),
    totalAlkalinityPpm: findLatestMetricValue(data.recentTests, (test) => test.totalAlkalinity),
    cyanuricAcidPpm: findLatestMetricValue(data.recentTests, (test) => test.cyanuricAcid),
    calciumHardnessPpm: findLatestMetricValue(data.recentTests, (test) => test.calciumHardness),
    saltPpm: findLatestMetricValue(data.recentTests, (test) => test.salt),
  };

  let metrics: Array<{
    label: string;
    value: string | number;
    trend?: 'flat' | 'up' | 'down';
    hint?: string;
  }> = [];

  $: metrics = data.recentTests?.length
    ? [
        {
          label: 'Free Chlorine',
          value: formatMeasurement(latestMetricValues.freeChlorinePpm, ' ppm'),
          trend: 'flat',
          hint: defaultSanitizerTargetHint(data.highlightedPool),
        },
        {
          label: 'pH',
          value: formatMeasurement(latestMetricValues.phLevel, '', 1),
          trend: 'flat',
          hint: 'target 7.4–7.6',
        },
        {
          label: 'Total Alkalinity',
          value: formatMeasurement(latestMetricValues.totalAlkalinityPpm, ' ppm', 0),
          trend: 'flat',
          hint: 'target 80–120',
        },
        {
          label: 'Cyanuric Acid',
          value: formatMeasurement(latestMetricValues.cyanuricAcidPpm, ' ppm', 0),
          trend: 'flat',
          hint: 'target 30–50',
        },
        {
          label: 'Calcium Hardness',
          value: formatMeasurement(latestMetricValues.calciumHardnessPpm, ' ppm', 0),
          trend: 'flat',
          hint: 'target 200–400',
        },
        {
          label: 'Salt',
          value: formatMeasurement(latestMetricValues.saltPpm, ' ppm', 0),
          trend: 'flat',
          hint: defaultSaltTargetHint(data.highlightedPool),
        },
      ]
    : [];

  let showQuickModal = false;
  let showGuidedModal = false;
  let showCreatePoolModal = false;
  let generatingTreatmentPlan = false;
  let treatmentPlanMessage = '';
  let treatmentPlanError = '';
  let creatingPool = false;
  let createPoolError = '';
  let createPoolSuccess = '';
  let showCreatePoolAdvanced = false;
  let createPoolLocationSelection = '__new__';
  let createPoolForm = {
    name: '',
    volumeGallons: '',
    sanitizerType: '',
    chlorineSource: '',
    saltTargetPpm: '',
    sanitizerTargetMinPpm: '',
    sanitizerTargetMaxPpm: '',
    surfaceType: '',
    formattedAddress: '',
    googlePlaceId: '',
    googlePlusCode: '',
    latitude: '',
    longitude: '',
    timezone: '',
  };
  let selectedPoolId =
    data.highlightedPool?.id ??
    (typeof data.defaultPoolId === 'string' ? data.defaultPoolId : '') ??
    '';

  $: adsEnabledForOverview = Boolean($page.data.session?.monetization?.adsEnabled);

  const sanitizerOptions = ['chlorine', 'bromine'];
  const chlorineSourceOptions = ['manual', 'swg'];
  const surfaceOptions = ['plaster', 'vinyl', 'fiberglass', 'tile', 'concrete', 'other'];
  const sanitizerResidualMaxPpm = 20;
  const newLocationOptionValue = '__new__';

  const normalizeAddress = (value: string | null | undefined) =>
    (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

  $: overviewActiveLocations = (data.locations ?? []).filter((location) => location?.isActive !== false);

  function closeModals() {
    showQuickModal = false;
    showGuidedModal = false;
    showCreatePoolModal = false;
    createPoolError = '';
    createPoolSuccess = '';
  }

  function openCreatePoolModal() {
    showCreatePoolModal = true;
    createPoolError = '';
    createPoolSuccess = '';
    showCreatePoolAdvanced = false;
    createPoolForm = {
      name: '',
      volumeGallons: '',
      sanitizerType: '',
      chlorineSource: '',
      saltTargetPpm: '',
      sanitizerTargetMinPpm: '',
      sanitizerTargetMaxPpm: '',
      surfaceType: '',
      formattedAddress: '',
      googlePlaceId: '',
      googlePlusCode: '',
      latitude: '',
      longitude: '',
      timezone: '',
    };
    createPoolLocationSelection = overviewActiveLocations.length > 0 ? overviewActiveLocations[0].locationId : newLocationOptionValue;
  }

  const parseOptionalNumber = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return null;
    const trimmed = typeof value === 'string' ? value.trim() : String(value);
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const isChlorineSanitizer = (value: string) => value.trim().toLowerCase() === 'chlorine';
  const isSwgChlorinePool = (sanitizerType: string, chlorineSource: string) =>
    isChlorineSanitizer(sanitizerType) && chlorineSource.trim().toLowerCase() === 'swg';
  const showsSanitizerTargetRange = (value: string) =>
    ['chlorine', 'bromine'].includes(value.trim().toLowerCase());

  const findExistingLocationMatch = () =>
    overviewActiveLocations.find((location) => {
      const placeId = createPoolForm.googlePlaceId.trim();
      if (placeId && location.googlePlaceId?.trim() === placeId) {
        return true;
      }

      const selectedAddress = normalizeAddress(createPoolForm.formattedAddress);
      if (!selectedAddress || normalizeAddress(location.formattedAddress) !== selectedAddress) {
        return false;
      }

      const selectedLat = createPoolForm.latitude.trim() ? Number(createPoolForm.latitude.trim()) : null;
      const selectedLng = createPoolForm.longitude.trim() ? Number(createPoolForm.longitude.trim()) : null;
      if (selectedLat === null || selectedLng === null || Number.isNaN(selectedLat) || Number.isNaN(selectedLng)) {
        return true;
      }

      return location.latitude === selectedLat && location.longitude === selectedLng;
    }) ?? null;

  async function handleCreatePoolSubmit() {
    createPoolError = '';
    createPoolSuccess = '';

    if (!createPoolForm.name.trim()) {
      createPoolError = 'Name is required.';
      return;
    }
    const volume = Number(createPoolForm.volumeGallons);
    if (!Number.isFinite(volume) || volume <= 0) {
      createPoolError = 'Volume must be a positive number.';
      return;
    }
    if (!createPoolForm.sanitizerType.trim()) {
      createPoolError = 'Sanitizer type is required.';
      return;
    }
    if (!createPoolForm.surfaceType.trim()) {
      createPoolError = 'Surface type is required.';
      return;
    }
    if (isChlorineSanitizer(createPoolForm.sanitizerType) && !createPoolForm.chlorineSource.trim()) {
      createPoolError = 'Chlorine source is required for chlorine pools.';
      return;
    }
    if (isSwgChlorinePool(createPoolForm.sanitizerType, createPoolForm.chlorineSource)) {
      const saltTarget = parseOptionalNumber(createPoolForm.saltTargetPpm);
      if (saltTarget === null || saltTarget <= 0) {
        createPoolError = 'Salt target must be a positive number for SWG pools.';
        return;
      }
    }
    if (showsSanitizerTargetRange(createPoolForm.sanitizerType)) {
      const min = parseOptionalNumber(createPoolForm.sanitizerTargetMinPpm);
      const max = parseOptionalNumber(createPoolForm.sanitizerTargetMaxPpm);
      if (min !== null || max !== null) {
        if (min === null || max === null || min <= 0 || max <= 0 || min > max) {
          createPoolError = 'Sanitizer target range must include valid min/max ppm values.';
          return;
        }
        if (min > sanitizerResidualMaxPpm || max > sanitizerResidualMaxPpm) {
          createPoolError =
            'Sanitizer target range must be 20 ppm or less. Enter sanitizer residual ppm, not the salt level.';
          return;
        }
      }
    }

    creatingPool = true;
    try {
      let locationId =
        createPoolLocationSelection !== newLocationOptionValue ? createPoolLocationSelection : null;

      if (!locationId) {
        const latitude = createPoolForm.latitude.trim() ? Number(createPoolForm.latitude.trim()) : undefined;
        const longitude = createPoolForm.longitude.trim() ? Number(createPoolForm.longitude.trim()) : undefined;
        if (latitude === undefined || Number.isNaN(latitude) || longitude === undefined || Number.isNaN(longitude)) {
          createPoolError = 'Select a valid location using the map picker.';
          return;
        }

        const existingLocation = findExistingLocationMatch();
        if (existingLocation) {
          locationId = existingLocation.locationId;
        } else {
          const fallbackLocationName = `${createPoolForm.name.trim()} location`;
          const autoLocationName =
            createPoolForm.formattedAddress.trim().split(',')[0]?.trim() || fallbackLocationName;
          const locationRes = await api.userLocations.create({
            name: autoLocationName,
            formattedAddress: createPoolForm.formattedAddress.trim() || undefined,
            googlePlaceId: createPoolForm.googlePlaceId.trim() || undefined,
            googlePlusCode: createPoolForm.googlePlusCode.trim() || undefined,
            latitude,
            longitude,
            timezone: createPoolForm.timezone.trim() || undefined,
          });
          if (!locationRes.ok) {
            const body = await locationRes.json().catch(() => ({}));
            if (locationRes.status === 409 && typeof body.locationId === 'string') {
              locationId = body.locationId;
            } else {
              createPoolError = body.error ?? body.message ?? `Unable to create location (${locationRes.status}).`;
              return;
            }
          } else {
            const locationBody = (await locationRes.json().catch(() => null)) as { locationId?: string } | null;
            locationId = locationBody?.locationId ?? null;
          }
        }
      }

      if (!locationId) {
        createPoolError = 'Location could not be resolved.';
        return;
      }

      const poolRes = await api.pools.create({
        name: createPoolForm.name.trim(),
        volumeGallons: volume,
        sanitizerType: createPoolForm.sanitizerType.trim(),
        chlorineSource: isChlorineSanitizer(createPoolForm.sanitizerType)
          ? createPoolForm.chlorineSource.trim()
          : null,
        saltLevelPpm: isSwgChlorinePool(createPoolForm.sanitizerType, createPoolForm.chlorineSource)
          ? parseOptionalNumber(createPoolForm.saltTargetPpm)
          : null,
        sanitizerTargetMinPpm:
          showsSanitizerTargetRange(createPoolForm.sanitizerType) && showCreatePoolAdvanced
            ? parseOptionalNumber(createPoolForm.sanitizerTargetMinPpm)
            : null,
        sanitizerTargetMaxPpm:
          showsSanitizerTargetRange(createPoolForm.sanitizerType) && showCreatePoolAdvanced
            ? parseOptionalNumber(createPoolForm.sanitizerTargetMaxPpm)
            : null,
        surfaceType: createPoolForm.surfaceType.trim(),
        locationId,
      });
      if (!poolRes.ok) {
        const body = await poolRes.json().catch(() => ({}));
        createPoolError = body.error ?? body.message ?? `Unable to create pool (${poolRes.status}).`;
        return;
      }
      const createdPool = (await poolRes.json().catch(() => null)) as { poolId?: string } | null;
      const createdPoolId = createdPool?.poolId;
      if (!createdPoolId) {
        createPoolError = 'Pool created without a pool ID.';
        return;
      }

      await api.me.updatePreferences({ defaultPoolId: createdPoolId }).catch(() => null);
      createPoolSuccess = 'Pool created.';
      showCreatePoolModal = false;
      await goto(`/overview?poolId=${createdPoolId}`, { invalidateAll: true });
    } catch {
      createPoolError = 'Unable to create pool.';
    } finally {
      creatingPool = false;
    }
  }

  const toDateOrNull = (value: string | Date | null | undefined) => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDueLabel = (date: Date | null, fallback: string) => {
    if (!date) return fallback;
    return date.toLocaleString();
  };

  $: latestTestDate = toDateOrNull(data.latestTest?.testedAt ?? data.highlightedPool?.lastTestedAt ?? null);
  $: weatherContext = data.weatherDaily?.[0] ?? null;
  $: upcomingEvents = (() => {
    const events: Array<{ id: string; title: string; dueLabel: string; detail: string }> = [];
    const now = new Date();
    const retestAt = latestTestDate
      ? new Date(latestTestDate.getTime() + 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 2 * 60 * 60 * 1000);

    if (effectiveRecommendations?.primary) {
      events.push({
        id: 'dose-primary',
        title: `Dose ${effectiveRecommendations.primary.chemicalName}`,
        dueLabel: 'Now',
        detail: `${effectiveRecommendations.primary.amount}${effectiveRecommendations.primary.unit ? ` ${effectiveRecommendations.primary.unit}` : ''} recommended. ${effectiveRecommendations.primary.reason}`,
      });
    }

    events.push({
      id: 'retest',
      title: latestTestDate ? 'Re-test and verify chemistry' : 'Run a baseline water test',
      dueLabel: formatDueLabel(retestAt, 'Soon'),
      detail: latestTestDate
        ? 'Confirm the pool remains within target ranges after the latest recommendations and weather exposure.'
        : 'Capture a test result to unlock a full maintenance timeline and recommendation history.',
    });

    const uvIndex = typeof weatherContext?.uvIndex === 'number' ? weatherContext.uvIndex : null;
    const rainfall =
      weatherContext?.rainfallIn === null || weatherContext?.rainfallIn === undefined
        ? null
        : Number(weatherContext.rainfallIn);
    if ((uvIndex !== null && uvIndex >= 7) || (rainfall !== null && !Number.isNaN(rainfall) && rainfall >= 0.25)) {
      events.push({
        id: 'weather-check',
        title: 'Weather follow-up check',
        dueLabel: 'Later today',
        detail:
          uvIndex !== null && uvIndex >= 7
            ? 'High UV is expected. Check sanitizer drift before the end of the day.'
            : 'Recent rainfall can dilute chemistry. Recheck sanitizer and pH after the rain passes.',
      });
    }

    return events;
  })();

  async function handlePoolSelectionChange() {
    if (!selectedPoolId) return;
    await api.me.updatePreferences({ defaultPoolId: selectedPoolId }).catch(() => null);
    await goto(`/overview?poolId=${selectedPoolId}`, { invalidateAll: true });
  }

  async function handleGenerateTreatmentPlan() {
    if (!data.highlightedPool?.id) return;
    generatingTreatmentPlan = true;
    treatmentPlanMessage = '';
    treatmentPlanError = '';

    try {
      const response = await api.treatmentPlans.generate(data.highlightedPool.id);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        treatmentPlanError =
          payload?.message ?? payload?.error ?? `Unable to generate treatment plan (${response.status}).`;
        return;
      }

      const payload = await response.json().catch(() => null);
      const status = typeof payload?.status === 'string' ? payload.status : 'generated';
      treatmentPlanMessage =
        status === 'refused'
          ? 'Treatment plan generated with blocking safety checks.'
          : 'Treatment plan generated.';
      await invalidateAll();
    } catch {
      treatmentPlanError = 'Unable to generate treatment plan.';
    } finally {
      generatingTreatmentPlan = false;
    }
  }
</script>

<Container>
  <header class="mt-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold text-content-primary">Pool Overview</h1>
      <p class="text-sm text-content-secondary">
        Active pool dashboard and testing workflows.
      </p>
    </div>
    <div class="min-w-[220px]">
      <label class="text-xs font-semibold uppercase tracking-wide text-content-secondary" for="overview-pool-selector">Pool</label>
      <select id="overview-pool-selector" class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={selectedPoolId} on:change={handlePoolSelectionChange}>
        {#each data.pools as pool}
          <option value={pool.poolId}>{pool.name ?? pool.poolId}</option>
        {/each}
      </select>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-sm btn-ghost" on:click={openCreatePoolModal}>
        Create new pool
      </button>
      <button class="btn btn-sm btn-primary" on:click={() => (showQuickModal = true)} disabled={!data.highlightedPool}>
        Quick test
      </button>
      <button class="btn btn-sm btn-secondary" on:click={() => (showGuidedModal = true)} disabled={!data.highlightedPool}>
        Guided full test
      </button>
    </div>
  </header>

  <div class="mt-6 flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-xl font-semibold text-content-primary">Last Test Results</h2>
    {#if data.latestTest?.sessionId}
      <a
        class="text-sm font-semibold text-accent hover:text-accent-strong"
        href={`/tests/${data.latestTest.sessionId}?poolId=${encodeURIComponent(data.highlightedPool?.id ?? '')}`}
      >
        View test details
      </a>
    {/if}
  </div>
  {#if data.recentTests?.length}
    <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each metrics as m}
        <MetricTile {...m} />
      {/each}
    </div>
  {:else}
    <p class="mt-3 text-sm text-content-secondary">
      No test results yet. Add a new test to populate metrics.
    </p>
  {/if}

  <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="lg:col-span-2">
      {#if data.highlightedPool}
        <PoolSummaryCard pool={data.highlightedPool} />
      {:else}
        <p class="text-sm text-content-secondary">No pools available yet.</p>
      {/if}
    </div>

    <div class="lg:col-span-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <RecommendationsCard
        recommendations={effectiveRecommendations}
        hasTest={Boolean(data.latestTest)}
        poolId={data.highlightedPool?.id}
        recommendationHistory={data.recommendationHistory}
      />
      <DosingHistoryCard
        dosingHistory={data.dosingHistory}
        poolId={data.highlightedPool?.id ?? null}
        availableChemicals={data.inventoryItems.filter((item) => item.itemClass === 'chemical')}
        measurementSystem={data.preferences?.measurementSystem === 'metric' ? 'metric' : 'imperial'}
      />
    </div>
    <div class="lg:col-span-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="surface-frame rounded-xl p-4">
        <h3 class="text-base font-semibold text-content-primary">Recommendation effectiveness by treatment type</h3>
        <div class="mt-3 space-y-2">
          {#if data.effectiveness?.byTreatmentType?.length}
            {#each data.effectiveness.byTreatmentType as row}
              <div class="surface-panel flex items-center justify-between text-sm">
                <span class="text-content-primary">{row.treatmentType ?? 'unspecified'}</span>
                <span class="text-content-secondary">{row.loggedOutcomes}/{row.outcomes} logged • quality {row.averageQuality === null ? 'n/a' : Number(row.averageQuality).toFixed(2)}</span>
              </div>
            {/each}
          {:else}
            <p class="text-sm text-content-secondary">No recommendation outcomes logged yet.</p>
          {/if}
        </div>
      </section>
      <section class="surface-frame rounded-xl p-4">
        <h3 class="text-base font-semibold text-content-primary">Outcome follow-ups due (24h / 72h)</h3>
        <div class="mt-3 space-y-2 text-sm text-content-secondary">
          {#if data.dueOutcomePrompts?.length}
            {#each data.dueOutcomePrompts as due}
              <p class="surface-panel">
                {new Date(due.dueAt).toLocaleString()} • {due.checkpointHours}h checkpoint. Log new test values and observed issues.
              </p>
            {/each}
          {:else}
            <p class="surface-panel">No due follow-ups right now.</p>
          {/if}
        </div>
      </section>
    </div>
    <div class="lg:col-span-3">
      <UpcomingMaintenanceCard events={upcomingEvents} poolName={data.highlightedPool?.name ?? null} />
    </div>
    <div class="lg:col-span-3">
      <section class="space-y-3">
        <div class="surface-frame flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
          <div>
            <h3 class="text-base font-semibold text-content-primary">AI Treatment Plan</h3>
            <p class="text-sm text-content-secondary">
              Trigger the LLM-backed treatment-plan flow for the active pool.
            </p>
            <p class="mt-1 text-xs text-content-secondary">
              Requirements: active pool access, at least one saved water test, and treatment-plan migrations initialized.
            </p>
            {#if data.latestTreatmentPlan}
              <p class="mt-1 text-xs text-content-secondary">
                Latest plan: {new Date(data.latestTreatmentPlan.createdAt).toLocaleString()} · status {data.latestTreatmentPlan.status}
              </p>
            {/if}
          </div>
          <button
            class="btn btn-sm btn-primary"
            on:click={handleGenerateTreatmentPlan}
            disabled={!data.highlightedPool || generatingTreatmentPlan || !data.latestTest}
            data-loading={generatingTreatmentPlan ? 'true' : undefined}
            aria-busy={generatingTreatmentPlan}
          >
            <span class="btn__spinner" aria-hidden="true"></span>
            <span class="btn__content">
              <span class="btn__label">
                {generatingTreatmentPlan ? 'Generating AI plan...' : 'Generate AI treatment plan'}
              </span>
            </span>
          </button>
        </div>
        {#if treatmentPlanMessage}
          <p class="text-sm text-success" role="status">{treatmentPlanMessage}</p>
        {/if}
        {#if treatmentPlanError}
          <p class="text-sm text-danger" role="alert">{treatmentPlanError}</p>
        {/if}
        <AiMaintenanceAdvisorCard
          poolName={data.highlightedPool?.name ?? null}
          hasLatestTest={Boolean(data.latestTest)}
          recommendations={effectiveRecommendations}
          weatherDaily={data.weatherDaily}
          dosingHistoryCount={data.dosingHistory.length}
        />
      </section>
    </div>
    <div class="lg:col-span-3">
      <WeatherQualityCard dailyWeather={data.weatherDaily} error={data.weatherError ?? null} />
    </div>
    <div class="lg:col-span-3">
      <AdSlot enabled={adsEnabledForOverview} placement="overview_footer" />
    </div>
  </div>
</Container>

{#if showQuickModal && data.highlightedPool}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Quick test dialog">
    <div
      class="surface-frame w-full max-w-2xl rounded-xl p-4"
      style="background-color: rgb(var(--color-bg-raised)); opacity: 1;"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-content-primary">Quick Test</h2>
        <button class="btn btn-sm btn-ghost" on:click={closeModals}>Close</button>
      </div>
      <QuickTestForm poolId={data.highlightedPool.id} />
    </div>
  </div>
{/if}

{#if showGuidedModal && data.highlightedPool}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Guided full test dialog">
    <div
      class="surface-frame max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl p-4"
      style="background-color: rgb(var(--color-bg-raised)); opacity: 1;"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-content-primary">Guided Full Test</h2>
        <button class="btn btn-sm btn-ghost" on:click={closeModals}>Close</button>
      </div>
      <GuidedTestForm poolId={data.highlightedPool.id} compact={true} />
    </div>
  </div>
{/if}

{#if showCreatePoolModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Create pool dialog">
    <div
      class="surface-frame max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl p-4"
      style="background-color: rgb(var(--color-bg-raised)); opacity: 1;"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-content-primary">Create new pool</h2>
        <button class="btn btn-sm btn-ghost" on:click={closeModals}>Close</button>
      </div>
      <div class="space-y-4">
        <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Pool Characteristics</p>
          <div class="mt-3 grid gap-4 sm:grid-cols-2">
            <label class="text-sm font-medium text-content-secondary">
              Name
              <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createPoolForm.name} />
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Volume (gallons)
              <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" min="1" bind:value={createPoolForm.volumeGallons} />
            </label>
            <label class="text-sm font-medium text-content-secondary">
              Sanitizer type
              <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createPoolForm.sanitizerType}>
                <option value="">Select a sanitizer</option>
                {#each sanitizerOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </label>
            {#if isChlorineSanitizer(createPoolForm.sanitizerType)}
              <label class="text-sm font-medium text-content-secondary">
                Chlorine source
                <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createPoolForm.chlorineSource}>
                  <option value="">Select chlorine source</option>
                  {#each chlorineSourceOptions as option}
                    <option value={option}>{option}</option>
                  {/each}
                </select>
              </label>
            {/if}
            {#if isSwgChlorinePool(createPoolForm.sanitizerType, createPoolForm.chlorineSource)}
              <label class="text-sm font-medium text-content-secondary">
                Salt target (ppm)
                <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" min="1" bind:value={createPoolForm.saltTargetPpm} placeholder="e.g. 3200" />
                <span class="mt-1 block text-xs font-normal text-content-secondary/80">
                  SWG generator salt configuration target, not a test reading.
                </span>
              </label>
            {/if}
            {#if showsSanitizerTargetRange(createPoolForm.sanitizerType)}
              <label class="flex items-center gap-3 text-sm font-medium text-content-secondary sm:col-span-2">
                <span>Advanced settings</span>
                <input
                  type="checkbox"
                  class="sr-only peer"
                  bind:checked={showCreatePoolAdvanced}
                />
                <span class="relative inline-flex h-6 w-11 items-center rounded-full bg-border transition peer-checked:bg-accent">
                  <span class={`inline-block h-5 w-5 transform rounded-full bg-white transition ${showCreatePoolAdvanced ? 'translate-x-5' : 'translate-x-1'}`}></span>
                </span>
              </label>
            {/if}
            {#if showsSanitizerTargetRange(createPoolForm.sanitizerType) && showCreatePoolAdvanced}
              <label class="text-sm font-medium text-content-secondary">
                Sanitizer target min (ppm)
                <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" min="0" max={sanitizerResidualMaxPpm} step="0.1" bind:value={createPoolForm.sanitizerTargetMinPpm} placeholder="e.g. 2" />
                <span class="mt-1 block text-xs font-normal text-content-secondary/80">
                  Sanitizer residual target. For chlorine pools, a common target is 2-4 ppm.
                </span>
              </label>
              <label class="text-sm font-medium text-content-secondary">
                Sanitizer target max (ppm)
                <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" type="number" min="0" max={sanitizerResidualMaxPpm} step="0.1" bind:value={createPoolForm.sanitizerTargetMaxPpm} placeholder="e.g. 4" />
                <span class="mt-1 block text-xs font-normal text-content-secondary/80">
                  Required target policy range for sanitizer residual in ppm. Do not enter the SWG salt target here.
                </span>
              </label>
            {/if}
            <label class="text-sm font-medium text-content-secondary">
              Surface type
              <select class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createPoolForm.surfaceType}>
                <option value="">Select a surface</option>
                {#each surfaceOptions as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </label>
          </div>
        </div>
        <div class="rounded-lg border border-border/70 bg-surface/30 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-content-secondary">Location</p>
          <div class="mt-3 grid gap-4 sm:grid-cols-2">
            {#if overviewActiveLocations.length > 0}
              <label class="text-sm font-medium text-content-secondary sm:col-span-2">
                Existing location
                <select
                  class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  bind:value={createPoolLocationSelection}
                >
                  {#each overviewActiveLocations as location}
                    <option value={location.locationId}>
                      {location.name}{location.formattedAddress ? ` • ${location.formattedAddress}` : ''}
                    </option>
                  {/each}
                  <option value={newLocationOptionValue}>Add a new location</option>
                </select>
              </label>
            {/if}
            {#if createPoolLocationSelection === newLocationOptionValue}
            <div class="sm:col-span-2">
              <GoogleMapPicker
                idPrefix="overview-create-location"
                bind:latitude={createPoolForm.latitude}
                bind:longitude={createPoolForm.longitude}
                bind:formattedAddress={createPoolForm.formattedAddress}
                bind:googlePlaceId={createPoolForm.googlePlaceId}
                bind:googlePlusCode={createPoolForm.googlePlusCode}
                bind:timezone={createPoolForm.timezone}
              />
            </div>
            <label class="text-sm font-medium text-content-secondary sm:col-span-2">
              Selected address
              <input class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" bind:value={createPoolForm.formattedAddress} />
            </label>
            {:else}
              <div class="sm:col-span-2 rounded-lg border border-border/60 bg-surface px-3 py-3 text-sm text-content-secondary">
                {#if overviewActiveLocations.find((location) => location.locationId === createPoolLocationSelection)?.formattedAddress}
                  {overviewActiveLocations.find((location) => location.locationId === createPoolLocationSelection)?.formattedAddress}
                {:else}
                  Using saved location for this account.
                {/if}
              </div>
            {/if}
          </div>
        </div>
        {#if createPoolError}
          <p class="text-sm text-danger" role="alert">{createPoolError}</p>
        {/if}
        {#if createPoolSuccess}
          <p class="text-sm text-success" role="status">{createPoolSuccess}</p>
        {/if}
        <button
          class="btn btn-base btn-primary w-full"
          on:click={handleCreatePoolSubmit}
          disabled={creatingPool}
          data-loading={creatingPool ? 'true' : undefined}
          aria-busy={creatingPool}
        >
          <span class="btn__spinner" aria-hidden="true"></span>
          <span class="btn__content">
            <span class="btn__label">{creatingPool ? 'Creating pool...' : 'Create pool'}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
{/if}
