import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

type ApiTokensMock = {
  list: Mock;
  create: Mock;
  revoke: Mock;
};

vi.mock('$lib/api', () => {
  const list = vi.fn();
  const create = vi.fn();
  const revoke = vi.fn();
  return {
    api: {
      apiTokens: { list, create, revoke },
    },
  };
});

describe('admin api tokens page', () => {
  const listMock = api.apiTokens.list as unknown as ApiTokensMock['list'];
  const createMock = api.apiTokens.create as unknown as ApiTokensMock['create'];
  const revokeMock = api.apiTokens.revoke as unknown as ApiTokensMock['revoke'];

  const baseTokens = [
    {
      tokenId: 'tok-1',
      name: 'Staging deployer',
      createdAt: new Date('2024-03-01T00:00:00.000Z').toISOString(),
      lastUsedAt: new Date('2024-03-02T12:00:00.000Z').toISOString(),
      revoked: false,
      permissions: {},
    },
  ];

  beforeEach(() => {
    listMock.mockReset();
    createMock.mockReset();
    revokeMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing tokens', () => {
    const { getByText } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          tokens: baseTokens,
          loadError: null,
        },
      },
    });

    expect(getByText('Staging deployer')).toBeTruthy();
    expect(getByText(baseTokens[0].tokenId)).toBeTruthy();
  });

  it('creates a token and shows a single-use preview while keeping listings secret', async () => {
    const createdAt = new Date('2024-04-01T00:00:00.000Z').toISOString();

    createMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tokenId: 'tok-2',
          name: 'Integration key',
          createdAt,
          preview: 'tok_super_secret',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    listMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          ...baseTokens,
          {
            tokenId: 'tok-2',
            name: 'Integration key',
            createdAt,
            lastUsedAt: null,
            revoked: false,
            permissions: {},
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { getByLabelText, getByRole, findByText, queryByText } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          tokens: baseTokens,
          loadError: null,
        },
      },
    });

    await fireEvent.input(getByLabelText('Token name'), { target: { value: 'Integration key' } });
    await fireEvent.click(getByRole('button', { name: /create token/i }));

    expect(createMock).toHaveBeenCalledWith({ name: 'Integration key' });

    const preview = await findByText(/Token created: Integration key/i);
    expect(preview).toBeTruthy();
    expect(await findByText('tok_super_secret')).toBeTruthy();

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    const leak = queryByText('tok_super_secret', { selector: 'td' });
    expect(leak).toBeNull();
  });

  it('revokes a token and surfaces feedback', async () => {
    revokeMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    listMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            tokenId: 'tok-1',
            name: 'Staging deployer',
            createdAt: baseTokens[0].createdAt,
            lastUsedAt: baseTokens[0].lastUsedAt,
            revoked: true,
            permissions: {},
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { getByRole, findByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          tokens: baseTokens,
          loadError: null,
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: /revoke/i }));

    expect(revokeMock).toHaveBeenCalledWith('tok-1');

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    const status = await findByRole('status');
    expect(status.textContent).toContain('revoked');
  });
});
