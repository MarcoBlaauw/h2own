<script lang="ts">
  import { api } from '$lib/api';
  import Container from '$lib/components/layout/Container.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import type { PageData } from './$types';
  import type { UserIntegration } from './+page';

  export let data: PageData;

  let integrations: UserIntegration[] = data.integrations ?? [];
  const pools = data.pools ?? [];
  let loadError = data.loadError;
  let statusMessage: { type: 'success' | 'error'; text: string } | null = null;
  let disconnecting = '';
  let savingWeatherStation = false;
  let weatherStationApiKey = '';
  let weatherStationPollIntervalMinutes = '45';
  let devicesByIntegration: Record<string, IntegrationDevice[]> = {};
  let selectedPoolByDevice: Record<string, string> = {};
  let loadingDevicesByIntegration: Record<string, boolean> = {};
  let discoveringByIntegration: Record<string, boolean> = {};
  let linkingByDevice: Record<string, boolean> = {};

  type IntegrationDevice = {
    deviceId: string;
    integrationId: string;
    providerDeviceId: string;
    deviceType: string;
    label?: string | null;
    poolId?: string | null;
    status?: string;
    updatedAt?: string;
  };

  const deviceKey = (integrationId: string, deviceId: string) => `${integrationId}:${deviceId}`;

  $: weatherStationIntegration =
    integrations.find((item) => item.provider === 'weather_station') ?? null;
  $: if (weatherStationIntegration) {
    weatherStationPollIntervalMinutes = String(weatherStationIntegration.pollIntervalMinutes ?? 45);
  }

  async function saveWeatherStation() {
    savingWeatherStation = true;
    statusMessage = null;
    try {
      const response = await api.integrations.connect('weather_station', {
        payload: {
          credentials: {
            ...(weatherStationApiKey.trim() ? { apiKey: weatherStationApiKey.trim() } : {}),
            pollIntervalMinutes: Number(weatherStationPollIntervalMinutes)
          }
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        statusMessage = {
          type: 'error',
          text: payload?.message ?? `Failed to save weather station settings (${response.status}).`
        };
        return;
      }

      const updated = payload as UserIntegration;
      integrations = [
        ...integrations.filter((item) => item.provider !== 'weather_station'),
        updated
      ];
      weatherStationApiKey = '';
      statusMessage = {
        type: 'success',
        text: 'Weather station integration settings saved.'
      };
    } catch (error) {
      console.error('Failed to save weather station integration', error);
      statusMessage = { type: 'error', text: 'Unable to save weather station settings.' };
    } finally {
      savingWeatherStation = false;
    }
  }

  async function disconnect(integrationId: string) {
    disconnecting = integrationId;
    statusMessage = null;
    try {
      const response = await api.integrations.disconnect(integrationId);
      if (!response.ok) {
        statusMessage = { type: 'error', text: `Failed to disconnect integration (${response.status}).` };
        return;
      }
      integrations = integrations.filter((item) => item.integrationId !== integrationId);
      statusMessage = { type: 'success', text: 'Integration disconnected.' };
    } catch (error) {
      console.error('Failed to disconnect integration', error);
      statusMessage = { type: 'error', text: 'Unable to disconnect integration.' };
    } finally {
      disconnecting = '';
    }
  }

  async function loadDevices(integrationId: string) {
    loadingDevicesByIntegration = { ...loadingDevicesByIntegration, [integrationId]: true };
    statusMessage = null;
    try {
      const response = await api.integrations.listDevices(integrationId);
      if (!response.ok) {
        statusMessage = { type: 'error', text: `Failed to load devices (${response.status}).` };
        return;
      }
      const items = (await response.json()) as IntegrationDevice[];
      devicesByIntegration = { ...devicesByIntegration, [integrationId]: items };
      for (const device of items) {
        selectedPoolByDevice = {
          ...selectedPoolByDevice,
          [deviceKey(integrationId, device.deviceId)]: device.poolId ?? pools[0]?.poolId ?? ''
        };
      }
    } catch (error) {
      console.error('Failed to load integration devices', error);
      statusMessage = { type: 'error', text: 'Unable to load devices.' };
    } finally {
      loadingDevicesByIntegration = { ...loadingDevicesByIntegration, [integrationId]: false };
    }
  }

  async function discoverDevices(integrationId: string) {
    discoveringByIntegration = { ...discoveringByIntegration, [integrationId]: true };
    statusMessage = null;
    try {
      const response = await api.integrations.discoverDevices(integrationId);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        statusMessage = {
          type: 'error',
          text: payload?.message ?? `Failed to discover devices (${response.status}).`
        };
        return;
      }
      const items = (payload?.items ?? []) as IntegrationDevice[];
      devicesByIntegration = { ...devicesByIntegration, [integrationId]: items };
      for (const device of items) {
        selectedPoolByDevice = {
          ...selectedPoolByDevice,
          [deviceKey(integrationId, device.deviceId)]: device.poolId ?? pools[0]?.poolId ?? ''
        };
      }
      statusMessage = { type: 'success', text: `Discovered ${items.length} device(s).` };
    } catch (error) {
      console.error('Failed to discover integration devices', error);
      statusMessage = { type: 'error', text: 'Unable to discover devices.' };
    } finally {
      discoveringByIntegration = { ...discoveringByIntegration, [integrationId]: false };
    }
  }

  async function linkDeviceToPool(integrationId: string, deviceId: string) {
    const key = deviceKey(integrationId, deviceId);
    const poolId = selectedPoolByDevice[key];
    if (!poolId) {
      statusMessage = { type: 'error', text: 'Select a pool before linking a device.' };
      return;
    }

    linkingByDevice = { ...linkingByDevice, [key]: true };
    statusMessage = null;
    try {
      const response = await api.integrations.linkPool(integrationId, deviceId, { poolId });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        statusMessage = {
          type: 'error',
          text: payload?.message ?? `Failed to link device to pool (${response.status}).`
        };
        return;
      }
      const items = devicesByIntegration[integrationId] ?? [];
      devicesByIntegration = {
        ...devicesByIntegration,
        [integrationId]: items.map((item) =>
          item.deviceId === deviceId ? { ...item, poolId, status: 'linked' } : item
        ),
      };
      statusMessage = { type: 'success', text: 'Device linked to pool.' };
    } catch (error) {
      console.error('Failed to link integration device to pool', error);
      statusMessage = { type: 'error', text: 'Unable to link device to pool.' };
    } finally {
      linkingByDevice = { ...linkingByDevice, [key]: false };
    }
  }
</script>

<svelte:head>
  <title>Integrations</title>
</svelte:head>

<Container>
  <section class="mx-auto w-full max-w-5xl space-y-5 py-6">
    <div>
      <h1 class="text-2xl font-semibold text-content-primary">Integrations</h1>
      <p class="text-sm text-content-secondary">
        Manage user-level hardware and service API connections for future device providers.
      </p>
    </div>

    {#if loadError}
      <div class="rounded-md border border-error/40 bg-error/5 p-3 text-sm text-error">
        {loadError}
      </div>
    {/if}

    {#if statusMessage}
      <div
        role="status"
        class={`rounded-md border p-3 text-sm ${
          statusMessage.type === 'success'
            ? 'border-success/40 bg-success/5 text-success'
            : 'border-error/40 bg-error/5 text-error'
        }`}
      >
        {statusMessage.text}
      </div>
    {/if}

    <Card className="space-y-3">
      <h2 class="text-lg font-semibold text-content-primary">Weather Station Settings</h2>
      <p class="text-sm text-content-secondary">
        Configure a personal API key and background polling interval. Minimum polling interval is 30 minutes.
      </p>
      <form class="grid gap-3 md:grid-cols-2" on:submit|preventDefault={saveWeatherStation}>
        <div class="form-field md:col-span-2">
          <label class="form-label" for="ws-api-key">API key</label>
          <input
            id="ws-api-key"
            class="form-control"
            type="password"
            bind:value={weatherStationApiKey}
            placeholder={weatherStationIntegration?.hasApiKey ? '•••••••• (leave blank to keep current key)' : 'Enter API key'}
          >
          {#if weatherStationIntegration?.hasApiKey}
            <p class="text-xs text-content-secondary">
              Current key: {weatherStationIntegration.apiKeyPreview}
            </p>
          {/if}
        </div>
        <div class="form-field">
          <label class="form-label" for="ws-poll-interval">Polling interval</label>
          <select id="ws-poll-interval" class="form-control" bind:value={weatherStationPollIntervalMinutes}>
            <option value={30}>Every 30 minutes</option>
            <option value={45}>Every 45 minutes</option>
            <option value={60}>Every 60 minutes</option>
          </select>
        </div>
        <div class="flex items-end">
          <button class="btn btn-primary btn-base" type="submit" disabled={savingWeatherStation}>
            {savingWeatherStation ? 'Saving…' : 'Save settings'}
          </button>
        </div>
        {#if weatherStationIntegration?.pollIntervalDecreaseAllowedAt}
          <p class="text-xs text-content-secondary md:col-span-2">
            Poll interval decreases are rate-limited. Next allowed decrease:{' '}
            {new Date(weatherStationIntegration.pollIntervalDecreaseAllowedAt).toLocaleString()}.
          </p>
        {/if}
      </form>
    </Card>

    <Card className="space-y-3">
      <h2 class="text-lg font-semibold text-content-primary">Device Discovery and Pool Linking</h2>
      <p class="text-sm text-content-secondary">
        Discover provider devices and link each device to a pool for sensor ingestion.
      </p>
      {#if integrations.length === 0}
        <p class="text-sm text-content-secondary">Connect an integration first to discover devices.</p>
      {:else}
        <div class="space-y-4">
          {#each integrations as integration}
            <div class="rounded-lg border border-border/60 p-3">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="font-medium text-content-primary">{integration.provider}</p>
                  <p class="text-xs text-content-secondary">Integration ID: {integration.integrationId}</p>
                </div>
                <div class="flex gap-2">
                  <button
                    class="btn btn-secondary btn-sm"
                    on:click={() => loadDevices(integration.integrationId)}
                    disabled={Boolean(loadingDevicesByIntegration[integration.integrationId])}
                  >
                    {loadingDevicesByIntegration[integration.integrationId] ? 'Loading…' : 'Load devices'}
                  </button>
                  <button
                    class="btn btn-primary btn-sm"
                    on:click={() => discoverDevices(integration.integrationId)}
                    disabled={Boolean(discoveringByIntegration[integration.integrationId])}
                  >
                    {discoveringByIntegration[integration.integrationId] ? 'Discovering…' : 'Discover devices'}
                  </button>
                </div>
              </div>

              {#if (devicesByIntegration[integration.integrationId] ?? []).length === 0}
                <p class="text-xs text-content-secondary">No devices loaded for this integration yet.</p>
              {:else}
                <div class="space-y-2">
                  {#each devicesByIntegration[integration.integrationId] as device}
                    <div class="rounded-md border border-border/40 p-2">
                      <div class="mb-2">
                        <p class="text-sm font-medium text-content-primary">
                          {device.label ?? device.providerDeviceId}
                        </p>
                        <p class="text-xs text-content-secondary">
                          Type: {device.deviceType} · Status: {device.status ?? 'discovered'}
                        </p>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        <select
                          class="form-control min-w-48"
                          bind:value={selectedPoolByDevice[deviceKey(integration.integrationId, device.deviceId)]}
                          disabled={pools.length === 0}
                        >
                          {#if pools.length === 0}
                            <option value="">No pools available</option>
                          {:else}
                            {#each pools as pool}
                              <option value={pool.poolId}>{pool.name}</option>
                            {/each}
                          {/if}
                        </select>
                        <button
                          class="btn btn-tonal btn-sm"
                          on:click={() => linkDeviceToPool(integration.integrationId, device.deviceId)}
                          disabled={Boolean(linkingByDevice[deviceKey(integration.integrationId, device.deviceId)]) || pools.length === 0}
                        >
                          {#if linkingByDevice[deviceKey(integration.integrationId, device.deviceId)]}
                            Linking…
                          {:else}
                            Link to pool
                          {/if}
                        </button>
                        {#if device.poolId}
                          <span class="text-xs text-content-secondary">
                            Linked pool: {pools.find((pool) => pool.poolId === device.poolId)?.name ?? device.poolId}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </Card>

    <Card className="space-y-3">
      <h2 class="text-lg font-semibold text-content-primary">Connected Integrations</h2>
      {#if integrations.length === 0}
        <p class="text-sm text-content-secondary">No user integrations connected yet.</p>
      {:else}
        <div class="space-y-3">
          {#each integrations as integration}
            <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
              <div>
                <p class="font-medium text-content-primary">{integration.provider}</p>
                <p class="text-xs text-content-secondary">
                  Status: {integration.status} · Updated:{' '}
                  {new Date(integration.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                class="btn btn-tonal btn-sm"
                on:click={() => disconnect(integration.integrationId)}
                disabled={disconnecting === integration.integrationId}
              >
                {disconnecting === integration.integrationId ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </Card>
  </section>
</Container>
