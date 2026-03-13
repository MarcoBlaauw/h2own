import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => ({
  api: {
    integrations: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      listDevices: vi.fn(),
      discoverDevices: vi.fn(),
      linkPool: vi.fn(),
    },
  },
}));

describe('integrations page', () => {
  const connectMock = api.integrations.connect as unknown as Mock;
  const discoverDevicesMock = api.integrations.discoverDevices as unknown as Mock;
  const linkPoolMock = api.integrations.linkPool as unknown as Mock;

  const baseData = {
    integrations: [
      {
        integrationId: 'integration-1',
        userId: 'user-1',
        provider: 'weather_station',
        status: 'connected',
        scopes: null,
        externalAccountId: null,
        hasApiKey: true,
        apiKeyPreview: 'ABCD****YZ',
        pollIntervalMinutes: 45,
        pollIntervalUpdatedAt: '2026-02-25T10:00:00.000Z',
        pollIntervalDecreaseAllowedAt: '2026-02-25T16:00:00.000Z',
        createdAt: '2026-02-25T10:00:00.000Z',
        updatedAt: '2026-02-25T10:00:00.000Z',
      },
    ],
    pools: [
      { poolId: 'pool-1', name: 'Backyard Pool' },
      { poolId: 'pool-2', name: 'Lap Pool' },
    ],
    loadError: null,
  };

  beforeEach(() => {
    connectMock.mockReset();
    discoverDevicesMock.mockReset();
    linkPoolMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('saves weather-station settings with provider credentials', async () => {
    connectMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...baseData.integrations[0],
          apiKeyPreview: 'WXYZ****99',
          pollIntervalMinutes: 60,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { getByLabelText, getByRole, findByRole } = render(Page, {
      props: { data: baseData },
    });

    await fireEvent.input(getByLabelText('API key'), { target: { value: 'new-weather-key' } });
    await fireEvent.change(getByLabelText('Polling interval'), { target: { value: '60' } });
    await fireEvent.click(getByRole('button', { name: /save settings/i }));

    expect(connectMock).toHaveBeenCalledWith('weather_station', {
      payload: {
        credentials: {
          apiKey: 'new-weather-key',
          pollIntervalMinutes: 60,
        },
      },
    });

    const status = await findByRole('status');
    expect(status.textContent).toContain('saved');
  });

  it('discovers devices and links a device to the selected pool', async () => {
    discoverDevicesMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              deviceId: 'device-1',
              integrationId: 'integration-1',
              providerDeviceId: 'provider-device-1',
              deviceType: 'weather_station',
              label: 'Patio Sensor',
              poolId: null,
              status: 'discovered',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    linkPoolMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { getByRole, findByText } = render(Page, {
      props: { data: baseData },
    });

    await fireEvent.click(getByRole('button', { name: /discover devices/i }));

    expect(await findByText('Patio Sensor')).toBeInTheDocument();

    await fireEvent.click(getByRole('button', { name: /link to pool/i }));

    await waitFor(() => {
      expect(linkPoolMock).toHaveBeenCalledWith('integration-1', 'device-1', { poolId: 'pool-1' });
    });
  });
});
