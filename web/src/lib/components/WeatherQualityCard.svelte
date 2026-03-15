<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/components/ui/icon-map';

  type WeatherDay = {
    recordedAt: string | Date;
    createdAt?: string | Date | null;
    sunriseTime?: string | Date | null;
    sunsetTime?: string | Date | null;
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
  };

  export let dailyWeather: WeatherDay[] = [];
  export let error: string | null = null;

  type Severity = 'success' | 'info' | 'warning' | 'danger';

  const toNumber = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return null;
    const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isNaN(numeric) ? null : numeric;
  };

  const formatDate = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (value?: string | Date | null) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTime = (value?: string | Date | null) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const formatTemp = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    return `${Math.round(value)}°F`;
  };

  const formatInches = (value?: string | number | null) => {
    const numeric = toNumber(value);
    if (numeric === null) return '—';
    return `${numeric.toFixed(2)} in`;
  };

  const formatMiles = (value?: string | number | null) => {
    const numeric = toNumber(value);
    if (numeric === null) return '—';
    return `${numeric.toFixed(1)} mi`;
  };

  const formatPercent = (value?: string | number | null) => {
    const numeric = toNumber(value);
    if (numeric === null) return '—';
    return `${Math.round(numeric)}%`;
  };

  const formatKm = (value?: string | number | null) => {
    const numeric = toNumber(value);
    if (numeric === null) return '—';
    return `${numeric.toFixed(2)} km`;
  };

  const formatMph = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    return `${Math.round(value)} mph`;
  };

  const formatDegrees = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    return `${Math.round(value)}°`;
  };

  const windDirectionLabel = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const normalized = ((value % 360) + 360) % 360;
    const index = Math.round(normalized / 45) % 8;
    return directions[index];
  };

  const beaufortFromMph = (value?: number | null) => {
    if (value === null || value === undefined) return null;
    if (value < 1) return 0;
    if (value < 4) return 1;
    if (value < 8) return 2;
    if (value < 13) return 3;
    if (value < 19) return 4;
    if (value < 25) return 5;
    if (value < 32) return 6;
    if (value < 39) return 7;
    if (value < 47) return 8;
    if (value < 55) return 9;
    if (value < 64) return 10;
    if (value < 73) return 11;
    return 12;
  };

  const severityClassMap: Record<Severity, string> = {
    success: 'border-success/40 bg-success/15 text-success',
    info: 'border-info/40 bg-info/15 text-info',
    warning: 'border-warning/40 bg-warning/15 text-warning',
    danger: 'border-danger/40 bg-danger/15 text-danger',
  };

  const uvSeverity = (value?: number | null): Severity => {
    if (value === null || value === undefined) return 'info';
    if (value >= 8) return 'danger';
    if (value >= 6) return 'warning';
    if (value >= 3) return 'info';
    return 'success';
  };

  const rainfallSeverity = (value?: string | number | null): Severity => {
    const numeric = toNumber(value);
    if (numeric === null) return 'info';
    if (numeric >= 1) return 'danger';
    if (numeric >= 0.25) return 'warning';
    if (numeric > 0) return 'info';
    return 'success';
  };

  const windSeverity = (value?: number | null): Severity => {
    if (value === null || value === undefined) return 'info';
    if (value >= 25) return 'danger';
    if (value >= 15) return 'warning';
    if (value >= 8) return 'info';
    return 'success';
  };

  const tempStressSeverity = (value?: number | null): Severity => {
    if (value === null || value === undefined) return 'info';
    if (value <= 50 || value >= 95) return 'danger';
    if (value <= 60 || value >= 90) return 'warning';
    return 'success';
  };

  const conditionIcon = (day?: WeatherDay): IconName => {
    if (!day) return 'weatherQuality';
    const rain = toNumber(day.rainfallIn) ?? 0;
    const uv = day.uvIndex ?? 0;
    const wind = day.windSpeedMph ?? 0;
    if (rain >= 0.25) return 'weatherRain';
    if (wind >= 15) return 'weatherWind';
    if (uv >= 7) return 'weatherUv';
    return 'weatherQuality';
  };

  const computeQuality = (day?: WeatherDay) => {
    if (!day) {
      if (error) {
        return { score: null, label: 'Unavailable', detail: error };
      }
      return { score: null, label: 'No data', detail: 'Connect a location to see forecasts.' };
    }

    let score = 100;
    const rainfall = toNumber(day.rainfallIn) ?? 0;
    const uvIndex = day.uvIndex ?? 0;
    const temp = day.airTempF ?? 0;
    const wind = day.windSpeedMph ?? 0;
    const humidity = day.humidityPercent ?? 0;

    if (rainfall >= 0.1) score -= 10;
    if (rainfall >= 0.5) score -= 15;
    if (rainfall >= 1) score -= 25;
    if (uvIndex >= 6) score -= 5;
    if (uvIndex >= 8) score -= 10;
    if (uvIndex >= 10) score -= 15;
    if (temp <= 60 || temp >= 90) score -= 10;
    if (temp <= 50 || temp >= 95) score -= 15;
    if (wind >= 15) score -= 5;
    if (wind >= 25) score -= 10;
    if (humidity >= 80) score -= 5;

    const clamped = Math.max(0, Math.min(100, score));
    if (clamped >= 85) {
      return { score: clamped, label: 'Excellent', detail: 'Low weather impact on water chemistry.' };
    }
    if (clamped >= 70) {
      return { score: clamped, label: 'Good', detail: 'Normal chemical demand expected.' };
    }
    if (clamped >= 50) {
      return { score: clamped, label: 'Fair', detail: 'Monitor sanitizer and balance closely.' };
    }
    return { score: clamped, label: 'Poor', detail: 'Weather may significantly affect water balance.' };
  };

  const sorted = [...dailyWeather].sort((a, b) => {
    const aTime = new Date(a.recordedAt).getTime();
    const bTime = new Date(b.recordedAt).getTime();
    return aTime - bTime;
  });

  const today = sorted[0];
  const quality = computeQuality(today);
  const summaryIconName = conditionIcon(today);
  const normalizedWindDirection =
    today?.windDirectionDeg === null || today?.windDirectionDeg === undefined
      ? null
      : ((today.windDirectionDeg % 360) + 360) % 360;
  const windDirectionText =
    today?.windDirectionDeg === null || today?.windDirectionDeg === undefined
      ? '—'
      : `${windDirectionLabel(today.windDirectionDeg)} (${formatDegrees(today.windDirectionDeg)})`;
  const beaufortValue = beaufortFromMph(today?.windSpeedMph);
  const lastRefreshedAt = dailyWeather.reduce<Date | null>((latest, day) => {
    if (!day.createdAt) return latest;
    const created = day.createdAt instanceof Date ? day.createdAt : new Date(day.createdAt);
    if (Number.isNaN(created.getTime())) return latest;
    if (!latest || created.getTime() > latest.getTime()) return created;
    return latest;
  }, null);
</script>

<Card status={quality.label === 'Poor' ? 'warning' : quality.label === 'Unavailable' ? 'danger' : 'default'}>
  <svelte:fragment slot="header">
    <div class="card-heading">
      <span class="card-icon-badge" data-shape="squircle">
        <Icon name="weatherQuality" size={20} tone="muted" />
      </span>
      <div class="card-title-group">
        <h2 class="card-title">Pool weather quality</h2>
        <p class="card-subtitle">{quality.detail}</p>
        <p class="text-xs text-content-secondary">Last refreshed: {formatDateTime(lastRefreshedAt)}</p>
      </div>
    </div>
  </svelte:fragment>

  {#if today}
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-surface-subtle p-4">
        <span class="rounded-full border border-border bg-surface px-3 py-3 text-content-primary">
          <Icon name={summaryIconName} size={24} decorative={false} />
        </span>
        <div class="min-w-[8rem]">
          <p class="text-2xl font-semibold text-content-primary">
            {quality.score !== null ? quality.score : '—'}
            <span class="ml-1 text-sm font-medium uppercase tracking-wide text-content-secondary">{quality.label}</span>
          </p>
          <p class="text-xs text-content-secondary">{formatDate(today.recordedAt)}</p>
        </div>
        <p class="flex-1 text-sm text-content-secondary">{quality.detail}</p>
      </div>

      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div class={`rounded-lg border px-3 py-2 ${severityClassMap[uvSeverity(today.uvIndex)]}`} data-testid="impact-uv" data-severity={uvSeverity(today.uvIndex)}>
          <div class="flex items-center gap-2 text-xs uppercase tracking-wide">
            <Icon name="weatherUv" size={16} tone={uvSeverity(today.uvIndex)} decorative={false} />
            UV
          </div>
          <div class="mt-1 text-sm font-semibold">{today.uvIndex ?? '—'}</div>
        </div>
        <div class={`rounded-lg border px-3 py-2 ${severityClassMap[rainfallSeverity(today.rainfallIn)]}`} data-testid="impact-rainfall" data-severity={rainfallSeverity(today.rainfallIn)}>
          <div class="flex items-center gap-2 text-xs uppercase tracking-wide">
            <Icon name="weatherRain" size={16} tone={rainfallSeverity(today.rainfallIn)} decorative={false} />
            Rainfall
          </div>
          <div class="mt-1 text-sm font-semibold">{formatInches(today.rainfallIn)}</div>
        </div>
        <div class={`rounded-lg border px-3 py-2 ${severityClassMap[windSeverity(today.windSpeedMph)]}`} data-testid="impact-wind" data-severity={windSeverity(today.windSpeedMph)}>
          <div class="flex items-center gap-2 text-xs uppercase tracking-wide">
            <Icon name="weatherWind" size={16} tone={windSeverity(today.windSpeedMph)} decorative={false} />
            Wind
          </div>
          <div class="mt-1 text-sm font-semibold">{formatMph(today.windSpeedMph)}</div>
        </div>
        <div class={`rounded-lg border px-3 py-2 ${severityClassMap[tempStressSeverity(today.airTempF)]}`} data-testid="impact-temp-stress" data-severity={tempStressSeverity(today.airTempF)}>
          <div class="flex items-center gap-2 text-xs uppercase tracking-wide">
            <Icon name="weatherHeatStress" size={16} tone={tempStressSeverity(today.airTempF)} decorative={false} />
            Temp stress
          </div>
          <div class="mt-1 text-sm font-semibold">{formatTemp(today.airTempF)}</div>
        </div>
      </div>

      <details class="rounded-xl border border-border/60 bg-surface-subtle p-4" open>
        <summary class="cursor-pointer text-sm font-medium text-content-primary">Detailed weather metrics</summary>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-lg border border-border/60 bg-surface p-3 text-sm">
            <div class="flex items-center gap-2 text-content-secondary">
              <Icon name="weatherCloudBase" size={16} decorative={false} />
              Cloud base
            </div>
            <div class="mt-1 font-semibold text-content-primary">{formatKm(today.cloudBaseKm)}</div>
          </div>
          <div class="rounded-lg border border-border/60 bg-surface p-3 text-sm">
            <div class="flex items-center gap-2 text-content-secondary">
              <Icon name="weatherCloudCeiling" size={16} decorative={false} />
              Cloud ceiling
            </div>
            <div class="mt-1 font-semibold text-content-primary">{formatKm(today.cloudCeilingKm)}</div>
          </div>
          <div class="rounded-lg border border-border/60 bg-surface p-3 text-sm">
            <div class="flex items-center gap-2 text-content-secondary">
              <Icon name="weatherVisibility" size={16} decorative={false} />
              Visibility
            </div>
            <div class="mt-1 font-semibold text-content-primary">{formatMiles(today.visibilityMi)}</div>
          </div>
          <div class="rounded-lg border border-border/60 bg-surface p-3 text-sm">
            <div class="flex items-center gap-2 text-content-secondary">
              <Icon name="weatherSunrise" size={16} decorative={false} />
              Sunrise
            </div>
            <div class="mt-1 font-semibold text-content-primary">{formatTime(today.sunriseTime)}</div>
          </div>
          <div class="rounded-lg border border-border/60 bg-surface p-3 text-sm">
            <div class="flex items-center gap-2 text-content-secondary">
              <Icon name="weatherSunset" size={16} decorative={false} />
              Sunset
            </div>
            <div class="mt-1 font-semibold text-content-primary">{formatTime(today.sunsetTime)}</div>
          </div>
          <div class="rounded-lg border border-border/60 bg-surface p-3 text-sm">
            <div class="flex items-center gap-2 text-content-secondary">
              <Icon name="weatherWindDirection" size={16} style={`transform: rotate(${normalizedWindDirection ?? 0}deg);`} decorative={false} />
              Wind direction
            </div>
            <div class="mt-1 font-semibold text-content-primary">{windDirectionText}</div>
          </div>
        </div>
      </details>
    </div>
  {:else}
    <p class="mt-4 text-sm text-content-secondary">
      Add a location with coordinates to view daily weather guidance.
    </p>
  {/if}
</Card>
