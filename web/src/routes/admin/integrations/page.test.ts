import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const list = vi.fn();
  const update = vi.fn();
  const get = vi.fn();
  return {
    api: {
      adminIntegrations: { list, update, get },
    },
  };
});

describe('admin integrations page', () => {
  const listMock = api.adminIntegrations.list as unknown as Mock;
  const updateMock = api.adminIntegrations.update as unknown as Mock;
  const session = null;

  const integrations = [
    {
      integrationId: 'integ-1',
      provider: 'tomorrow_io',
      displayName: 'Tomorrow.io',
      enabled: true,
      cacheTtlSeconds: 1800,
      rateLimitCooldownSeconds: 300,
      config: { baseUrl: 'https://api.tomorrow.io/v4' },
      credentials: { hasApiKey: true, apiKeyPreview: 'ABCD****YZ' },
      lastResponseCode: 200,
      lastResponseText: 'ok',
      lastResponseAt: new Date('2026-02-20T10:00:00.000Z').toISOString(),
      lastSuccessAt: new Date('2026-02-20T10:00:00.000Z').toISOString(),
      nextAllowedRequestAt: null,
      updatedBy: null,
      createdAt: new Date('2026-02-20T09:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-02-20T10:00:00.000Z').toISOString(),
    },
  ];

  beforeEach(() => {
    listMock.mockReset();
    updateMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders integration cards', () => {
    const { getByText } = render(Page, {
      props: { data: { session, integrations, loadError: null } },
    });

    expect(getByText('Tomorrow.io')).toBeInTheDocument();
    expect(getByText('tomorrow_io')).toBeInTheDocument();
    expect(getByText(/Last code:/i)).toBeInTheDocument();
  });

  it('saves integration settings', async () => {
    const updated = {
      ...integrations[0],
      cacheTtlSeconds: 3600,
      rateLimitCooldownSeconds: 600,
      credentials: { hasApiKey: true, apiKeyPreview: 'ZZZZ****ZZ' },
      updatedAt: new Date('2026-02-20T11:00:00.000Z').toISOString(),
    };

    updateMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByText, getByLabelText, getByPlaceholderText, findByRole } = render(Page, {
      props: { data: { session, integrations, loadError: null } },
    });

    await fireEvent.input(getByLabelText('Cache TTL (seconds)'), { target: { value: '3600' } });
    await fireEvent.input(getByLabelText('Rate-limit cooldown (seconds)'), {
      target: { value: '600' },
    });
    await fireEvent.input(getByPlaceholderText('Leave blank to keep current key'), {
      target: { value: 'new-api-key' },
    });
    await fireEvent.click(getByText('Save'));

    expect(updateMock).toHaveBeenCalledWith(
      'tomorrow_io',
      expect.objectContaining({
        enabled: true,
        cacheTtlSeconds: 3600,
        rateLimitCooldownSeconds: 600,
        apiKey: 'new-api-key',
      })
    );

    const status = await findByRole('status');
    expect(status.textContent).toContain('settings updated');
  });

  it('refreshes integration list', async () => {
    listMock.mockResolvedValueOnce(
      new Response(JSON.stringify(integrations), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByRole } = render(Page, {
      props: { data: { session, integrations: [], loadError: null } },
    });

    await fireEvent.click(getByRole('button', { name: /refresh/i }));
    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });
  });
});
