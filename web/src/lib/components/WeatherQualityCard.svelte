<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';

  type WeatherDay = {
    recordedAt: string | Date;
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
</script>

<Card>
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-lg font-semibold text-content-primary">Pool weather quality</h2>
      <p class="text-xs text-content-secondary">{quality.detail}</p>
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
          <div class="text-content-secondary">
            Sunrise:
            <span class="font-medium text-content-primary">{formatTime(today.sunriseTime)}</span>
          </div>
          <div class="text-content-secondary">
            Sunset:
            <span class="font-medium text-content-primary">{formatTime(today.sunsetTime)}</span>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">Sky</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div class="text-content-secondary">
            Visibility:
            <span class="font-medium text-content-primary">{formatMiles(today.visibilityMi)}</span>
          </div>
          <div class="text-content-secondary">
            Cloud cover:
            <span class="font-medium text-content-primary">{formatPercent(today.cloudCoverPercent)}</span>
          </div>
          <div class="text-content-secondary">
            Cloud base:
            <span class="font-medium text-content-primary">{formatKm(today.cloudBaseKm)}</span>
          </div>
          <div class="text-content-secondary">
            Cloud ceiling:
            <span class="font-medium text-content-primary">{formatKm(today.cloudCeilingKm)}</span>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">UV And Heat</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div class="text-content-secondary">
            UV index:
            <span class="font-medium text-content-primary">{today.uvIndex ?? '—'}</span>
          </div>
          <div class="text-content-secondary">
            UV concern:
            <span class="font-medium text-content-primary">{today.uvHealthConcern ?? '—'}</span>
          </div>
          <div class="text-content-secondary">
            Apparent temp:
            <span class="font-medium text-content-primary">{formatTemp(today.temperatureApparentF)}</span>
          </div>
          <div class="text-content-secondary">
            Heat stress:
            <span class="font-medium text-content-primary">{today.ezHeatStressIndex ?? '—'}</span>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border/60 bg-surface-subtle p-4">
        <div class="text-xs uppercase tracking-wide text-content-secondary">Wind And Air</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div class="text-content-secondary">
            Wind speed:
            <span class="font-medium text-content-primary">{formatMph(today.windSpeedMph)}</span>
          </div>
          <div class="text-content-secondary">
            Wind direction:
            <span class="font-medium text-content-primary">{formatDegrees(today.windDirectionDeg)}</span>
          </div>
          <div class="text-content-secondary">
            Wind gust:
            <span class="font-medium text-content-primary">{formatMph(today.windGustMph)}</span>
          </div>
          <div class="text-content-secondary">
            Humidity:
            <span class="font-medium text-content-primary">{formatPercent(today.humidityPercent)}</span>
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
