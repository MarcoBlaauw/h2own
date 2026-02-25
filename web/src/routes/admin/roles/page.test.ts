import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const list = vi.fn();
  const update = vi.fn();
  return {
    api: {
      roleCapabilities: { list, update },
    },
  };
});

describe('admin role capabilities page', () => {
  const updateMock = api.roleCapabilities.update as unknown as Mock;

  it('updates role capability template', async () => {
    updateMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          role: 'business',
          systemCapabilities: ['admin.pools.manage'],
          accountCapabilities: ['account.profile.read', 'messages.send'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { getByLabelText, getByRole, findByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          roles: [
            {
              role: 'business',
              systemCapabilities: ['admin.pools.manage'],
              accountCapabilities: ['account.profile.read'],
            },
          ],
          available: {
            systemCapabilities: ['admin.pools.manage'],
            accountCapabilities: ['account.profile.read', 'messages.send'],
          },
          loadError: null,
        },
      },
    });

    await fireEvent.click(getByLabelText(/messages\.send/i));
    await fireEvent.click(getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'business',
        {
          systemCapabilities: ['admin.pools.manage'],
          accountCapabilities: ['account.profile.read', 'messages.send'],
        }
      );
    });

    const status = await findByRole('status');
    expect(status.textContent).toContain('Saved capability template for business');
  });
});
