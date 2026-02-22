<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';

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

  const windDirectionIconClass = (value?: number | null) => {
    if (value === null || value === undefined) return 'wi-strong-wind';
    const normalized = ((value % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return 'wi-wind-north';
    if (normalized < 67.5) return 'wi-wind-north-east';
    if (normalized < 112.5) return 'wi-wind-east';
    if (normalized < 157.5) return 'wi-wind-south-east';
    if (normalized < 202.5) return 'wi-wind-south';
    if (normalized < 247.5) return 'wi-wind-south-west';
    if (normalized < 292.5) return 'wi-wind-west';
    return 'wi-wind-north-west';
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

  const beaufortIconClass = (value?: number | null) => {
    const beaufort = beaufortFromMph(value);
    return beaufort === null ? 'wi-strong-wind' : `wi-beafort-${beaufort}`;
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
  const windDirectionIcon = windDirectionIconClass(today?.windDirectionDeg);
  const windDirectionText =
    today?.windDirectionDeg === null || today?.windDirectionDeg === undefined
      ? '—'
      : `${windDirectionLabel(today.windDirectionDeg)} (${formatDegrees(today.windDirectionDeg)})`;
  const beaufortIcon = beaufortIconClass(today?.windSpeedMph);
  const beaufortValue = beaufortFromMph(today?.windSpeedMph);
  const lastRefreshedAt = dailyWeather.reduce<Date | null>((latest, day) => {
    if (!day.createdAt) return latest;
    const created = day.createdAt instanceof Date ? day.createdAt : new Date(day.createdAt);
    if (Number.isNaN(created.getTime())) return latest;
    if (!latest || created.getTime() > latest.getTime()) return created;
    return latest;
  }, null);
</script>

<Card>
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-lg font-semibold text-content-primary">Pool weather quality</h2>
      <p class="text-xs text-content-secondary">{quality.detail}</p>
      <p class="text-xs text-content-secondary mt-1">
        Last refreshed: {formatDateTime(lastRefreshedAt)}
      </p>
    </div>
    <div class="text-right">
      <div class="text-2xl font-semibold text-content-primary">
        {quality.score !== null ? quality.score : '—'}
      </div>
      <div class="text-xs uppercase tracking-wide text-content-secondary">{quality.label}</div>
    </div>
  </div>

  {#if today}
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">Today</div>
        <div class="mt-1 text-lg font-semibold text-content-primary">{formatDate(today.recordedAt)}</div>
        <div class="mt-2 text-sm text-content-secondary">
          Temp: <span class="font-medium text-content-primary">{formatTemp(today.airTempF)}</span>
        </div>
        <div class="text-sm text-content-secondary">
          Rain: <span class="font-medium text-content-primary">{formatInches(today.rainfallIn)}</span>
        </div>
      </div>
      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">Next 3 days</div>
        <div class="mt-2 space-y-2">
          {#each sorted.slice(1, 4) as day}
            <div class="flex items-center justify-between text-sm">
              <span class="text-content-secondary">{formatDate(day.recordedAt)}</span>
              <span class="font-medium text-content-primary">{formatTemp(day.airTempF)}</span>
            </div>
          {/each}
          {#if sorted.length <= 1}
            <div class="text-sm text-content-secondary">No upcoming forecast yet.</div>
          {/if}
        </div>
      </div>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-2">
      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">Solar</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-sunrise text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Sunrise:
              <span class="font-medium text-content-primary">{formatTime(today.sunriseTime)}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-sunset text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Sunset:
              <span class="font-medium text-content-primary">{formatTime(today.sunsetTime)}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">Sky</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-day-haze text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Visibility:
              <span class="font-medium text-content-primary">{formatMiles(today.visibilityMi)}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-cloudy text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Cloud cover:
              <span class="font-medium text-content-primary">{formatPercent(today.cloudCoverPercent)}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-cloud-down text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Cloud base:
              <span class="font-medium text-content-primary">{formatKm(today.cloudBaseKm)}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-cloud-up text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Cloud ceiling:
              <span class="font-medium text-content-primary">{formatKm(today.cloudCeilingKm)}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">UV And Heat</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-day-sunny text-content-primary text-base" aria-hidden="true"></i>
            <span>
              UV index:
              <span class="font-medium text-content-primary">{today.uvIndex ?? '—'}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-hot text-content-primary text-base" aria-hidden="true"></i>
            <span>
              UV concern:
              <span class="font-medium text-content-primary">{today.uvHealthConcern ?? '—'}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-thermometer text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Apparent temp:
              <span class="font-medium text-content-primary">{formatTemp(today.temperatureApparentF)}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-thermometer-exterior text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Heat stress:
              <span class="font-medium text-content-primary">{today.ezHeatStressIndex ?? '—'}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">Wind And Air</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div class="text-content-secondary flex items-center gap-2">
            <i class={`wi ${beaufortIcon} text-content-primary text-base`} aria-hidden="true"></i>
            <span>
              Wind speed:
              <span class="font-medium text-content-primary">{formatMph(today.windSpeedMph)}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class={`wi ${windDirectionIcon} text-content-primary text-base`} aria-hidden="true"></i>
            <span>
              Wind direction:
              <span class="font-medium text-content-primary">{windDirectionText}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-strong-wind text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Wind gust:
              <span class="font-medium text-content-primary">{formatMph(today.windGustMph)}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class="wi wi-umbrella text-content-primary text-base" aria-hidden="true"></i>
            <span>
              Humidity:
              <span class="font-medium text-content-primary">{formatPercent(today.humidityPercent)}</span>
            </span>
          </div>
          <div class="text-content-secondary flex items-center gap-2">
            <i class={`wi ${beaufortIcon} text-content-primary text-base`} aria-hidden="true"></i>
            <span>
              Wind force:
              <span class="font-medium text-content-primary">{beaufortValue ?? '—'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <p class="mt-4 text-sm text-content-secondary">
      Add a location with coordinates to view daily weather guidance.
    </p>
  {/if}
</Card>
