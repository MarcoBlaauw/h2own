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
    {
      integrationId: 'integ-llm',
      provider: 'llm',
      displayName: 'LLM Provider',
      enabled: true,
      cacheTtlSeconds: null,
      rateLimitCooldownSeconds: null,
      config: {
        provider: 'openai',
        modelFamily: 'balanced',
        modelId: 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 1200,
        timeoutMs: 12000,
        maxRetries: 2,
        circuitBreakerThreshold: 3,
        circuitBreakerCooldownMs: 30000,
        fallbackBehavior: 'computed_preview',
      },
      credentials: { hasApiKey: true, apiKeyPreview: 'OPEN****AI' },
      lastResponseCode: 200,
      lastResponseText: 'openai:gpt-4o-mini',
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
    const { getByText, getAllByText } = render(Page, {
      props: { data: { session, integrations, loadError: null } },
    });

    expect(getByText('Tomorrow.io')).toBeInTheDocument();
    expect(getByText('tomorrow_io')).toBeInTheDocument();
    expect(getAllByText(/Last code:/i).length).toBeGreaterThan(0);
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

    const { getAllByText, getAllByLabelText, getAllByPlaceholderText, findByRole } = render(Page, {
      props: { data: { session, integrations, loadError: null } },
    });

    await fireEvent.input(getAllByLabelText('Cache TTL (seconds)')[0], { target: { value: '3600' } });
    await fireEvent.input(getAllByLabelText('Rate-limit cooldown (seconds)')[0], {
      target: { value: '600' },
    });
    await fireEvent.input(getAllByPlaceholderText('Leave blank to keep current key')[0], {
      target: { value: 'new-api-key' },
    });
    await fireEvent.click(getAllByText('Save')[0]);

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

  it('saves llm integration settings', async () => {
    const llmIntegration = integrations[1];
    const updated = {
      ...llmIntegration,
      config: {
        ...llmIntegration.config,
        modelFamily: 'quality',
        modelId: 'gpt-4o',
      },
    };

    updateMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getAllByText, getByDisplayValue, getByPlaceholderText } = render(Page, {
      props: { data: { session, integrations, loadError: null } },
    });

    await fireEvent.change(getByDisplayValue('balanced'), { target: { value: 'quality' } });
    await fireEvent.input(
      getByPlaceholderText('Leave blank to use the default model for the selected provider/family'),
      { target: { value: 'gpt-4o' } }
    );
    await fireEvent.click(getAllByText('Save')[1]);

    expect(updateMock).toHaveBeenCalledWith(
      'llm',
      expect.objectContaining({
        enabled: true,
        config: expect.objectContaining({
          provider: 'openai',
          modelFamily: 'quality',
          modelId: 'gpt-4o',
          fallbackBehavior: 'computed_preview',
        }),
      })
    );
  });
});
