import { describe, expect, it } from 'vitest';
import { getIntegrationAdapter } from './integration-adapters.js';

describe('integration adapters', () => {
  it('normalizes default discover payload into provider devices', async () => {
    const adapter = getIntegrationAdapter('custom_provider');
    const devices = await adapter.discoverDevices({
      userId: 'user-1',
      provider: 'custom_provider',
      payload: {
        devices: [{ providerDeviceId: 'abc', deviceType: 'sensor', label: 'Patio Sensor' }],
      },
    });

    expect(devices).toEqual([
      expect.objectContaining({
        providerDeviceId: 'abc',
        deviceType: 'sensor',
        label: 'Patio Sensor',
      }),
    ]);
  });

  it('normalizes weather station webhook metrics', async () => {
    const adapter = getIntegrationAdapter('weather_station');
    const result = await adapter.webhook({
      provider: 'weather_station',
      headers: {},
      payload: {
        readings: [
          { providerDeviceId: 'ws-1', metric: 'temperature', value: 71.6 },
          { providerDeviceId: 'ws-1', metric: 'humidity', value: 44 },
          { providerDeviceId: 'ws-1', metric: 'wind_mph', value: 5.2 },
        ],
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.readings).toEqual([
      expect.objectContaining({ metric: 'air_temp_f', unit: 'F' }),
      expect.objectContaining({ metric: 'humidity_percent', unit: '%' }),
      expect.objectContaining({ metric: 'wind_speed_mph', unit: 'mph' }),
    ]);
  });

  it('requires webhook signature presence', async () => {
    const adapter = getIntegrationAdapter('weather_station');
    await expect(
      adapter.verifyWebhook({
        provider: 'weather_station',
        headers: {},
        payload: {},
      })
    ).rejects.toMatchObject({ code: 'Unauthorized' });
  });
});
