import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import type { AdminPool } from './+page';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const adminPools = {
    list: vi.fn(),
    update: vi.fn(),
    transfer: vi.fn(),
  };
  return { api: { adminPools } };
});

describe('admin pools page', () => {
  const adminPoolsApi = api.adminPools as unknown as Record<string, Mock>;

  const adminSession = {
    user: {
      id: 'f9d3af7f-4d0e-4cb1-935b-e60db3eb0f5e',
      role: 'admin',
      email: 'admin@example.com',
    },
  } as const;

  const basePool: AdminPool = {
    id: '3f144e55-5b3e-4af4-9e26-2b8c78e8f0ac',
    ownerId: 'owner-1',
    name: 'Community Pool',
    volumeGallons: 18000,
    surfaceType: 'plaster',
    sanitizerType: 'chlorine',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2024-01-02T00:00:00.000Z').toISOString(),
    owner: {
      id: 'owner-1',
      email: 'owner@example.com',
      name: 'Owner One',
    },
    memberCount: 2,
    lastTestedAt: new Date('2024-01-05T00:00:00.000Z').toISOString(),
    members: [
      {
        poolId: '3f144e55-5b3e-4af4-9e26-2b8c78e8f0ac',
        userId: 'owner-1',
        roleName: 'owner',
        email: 'owner@example.com',
        name: 'Owner One',
      },
      {
        poolId: '3f144e55-5b3e-4af4-9e26-2b8c78e8f0ac',
        userId: 'member-2',
        roleName: 'member',
        email: 'member@example.com',
        name: 'Member Two',
      },
    ],
  };

  beforeEach(() => {
    Object.values(adminPoolsApi).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders load errors', () => {
    const { getByRole } = render(Page, {
      props: {
        data: {
          session: adminSession,
          pools: [basePool],
          loadError: 'Failed to load pools (500)',
        } as any,
      },
    });

    expect(getByRole('alert').textContent).toContain('Failed to load pools (500)');
  });

  it('updates metadata and refreshes the directory', async () => {
    const updatedPool = {
      ...basePool,
      name: 'Updated Community Pool',
      isActive: false,
    } satisfies AdminPool;

    adminPoolsApi.update.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ poolId: updatedPool.id, name: updatedPool.name, isActive: updatedPool.isActive }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    adminPoolsApi.list.mockResolvedValueOnce(
      new Response(JSON.stringify([updatedPool]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole } = render(Page, {
      props: {
        data: {
          session: adminSession,
          pools: [basePool],
          loadError: null,
        } as any,
      },
    });

    await fireEvent.input(getByLabelText('Name'), { target: { value: 'Updated Community Pool' } });
    await fireEvent.input(getByLabelText('Volume (gallons)'), { target: { value: '19000' } });
    const activeCheckbox = getByLabelText('Pool is active') as HTMLInputElement;
    if (activeCheckbox.checked) {
      await fireEvent.click(activeCheckbox);
    }

    await fireEvent.click(getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(adminPoolsApi.update).toHaveBeenCalledWith(updatedPool.id, {
        name: 'Updated Community Pool',
        volumeGallons: 19000,
        isActive: false,
      });
    });

    await waitFor(() => {
      expect(adminPoolsApi.list).toHaveBeenCalled();
    });

    await waitFor(() => {
      const poolList = getByRole('list');
      const updatedEntry = within(poolList).getByRole('button', { name: /Updated Community Pool/i });
      expect(updatedEntry).toBeTruthy();
    });
  });

  it('transfers ownership to a selected member', async () => {
    adminPoolsApi.transfer.mockResolvedValueOnce(
      new Response(JSON.stringify({ poolId: basePool.id, ownerId: 'member-2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    adminPoolsApi.list.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            ...basePool,
            ownerId: 'member-2',
            owner: { id: 'member-2', email: 'member@example.com', name: 'Member Two' },
          },
        ] satisfies AdminPool[]),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { getByLabelText, getByRole, findByText } = render(Page, {
      props: {
        data: {
          session: adminSession,
          pools: [basePool],
          loadError: null,
        } as any,
      },
    });

    const select = getByLabelText('Transfer to existing member') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'member-2' } });

    await fireEvent.click(getByRole('button', { name: /transfer ownership/i }));

    await waitFor(() => {
      expect(adminPoolsApi.transfer).toHaveBeenCalledWith(basePool.id, { newOwnerId: 'member-2' });
    });

    await waitFor(() => {
      expect(adminPoolsApi.list).toHaveBeenCalled();
    });

    expect(await findByText('member@example.com')).toBeTruthy();
  });
});
