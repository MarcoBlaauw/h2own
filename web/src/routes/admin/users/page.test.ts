import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const list = vi.fn();
  const update = vi.fn();
  const resetPassword = vi.fn();
  return {
    api: {
      users: { list, update, resetPassword },
    },
  };
});

describe('admin users page', () => {
  const users = [
    {
      userId: 'user-1',
      email: 'owner@example.com',
      name: 'Owner One',
      role: 'admin',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    },
    {
      userId: 'user-2',
      email: 'member@example.com',
      name: 'Member Two',
      role: 'member',
      isActive: false,
      createdAt: new Date('2024-02-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2024-02-01T00:00:00.000Z').toISOString(),
    },
  ];

  const listMock = api.users.list as unknown as Mock;
  const updateMock = api.users.update as unknown as Mock;
  const resetPasswordMock = api.users.resetPassword as unknown as Mock;

  beforeEach(() => {
    listMock.mockReset();
    updateMock.mockReset();
    resetPasswordMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('applies filters and refreshes the user list', async () => {
    const filtered = [users[0]];
    listMock.mockResolvedValueOnce(
      new Response(JSON.stringify(filtered), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          users,
          filters: { search: '', role: '', isActive: 'all' },
          roleCapabilityPreview: {},
          loadError: null,
        },
      },
    });

    await fireEvent.input(getByLabelText('Search'), { target: { value: 'owner' } });
    await fireEvent.change(getByLabelText('Role'), { target: { value: 'admin' } });
    await fireEvent.change(getByLabelText('Status'), { target: { value: 'active' } });

    const submit = getByRole('button', { name: /apply filters/i });
    await fireEvent.click(submit);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(undefined, {
        search: 'owner',
        role: 'admin',
        isActive: true,
      });
    });
  });

  it('updates a user role and shows a confirmation', async () => {
    const updated = { ...users[1], role: 'admin', isActive: false };
    updateMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getAllByLabelText, findByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          users,
          filters: { search: '', role: '', isActive: 'all' },
          roleCapabilityPreview: {},
          loadError: null,
        },
      },
    });

    const roleSelectors = getAllByLabelText(/change role/i);
    await fireEvent.change(roleSelectors[1], { target: { value: 'admin' } });

    expect(updateMock).toHaveBeenCalledWith(users[1].userId, { role: 'admin' });
    const status = await findByRole('status');
    expect(status.textContent).toContain('Role updated successfully.');
  });

  it('toggles activation state of a user', async () => {
    const toggled = { ...users[1], isActive: true };
    updateMock.mockResolvedValueOnce(
      new Response(JSON.stringify(toggled), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByRole, findByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          users,
          filters: { search: '', role: '', isActive: 'all' },
          roleCapabilityPreview: {},
          loadError: null,
        },
      },
    });

    const toggle = getByRole('button', { name: /^activate$/i });
    await fireEvent.click(toggle);

    expect(updateMock).toHaveBeenCalledWith(users[1].userId, { isActive: true });
    const status = await findByRole('status');
    expect(status.textContent).toContain('activated successfully');
  });

  it('resets a user password and surfaces the temporary credential', async () => {
    resetPasswordMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ userId: users[1].userId, temporaryPassword: 'Temp1234!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getAllByRole, findByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          users,
          filters: { search: '', role: '', isActive: 'all' },
          roleCapabilityPreview: {},
          loadError: null,
        },
      },
    });

    const resetButtons = getAllByRole('button', { name: /reset password/i });
    await fireEvent.click(resetButtons[1]);

    expect(resetPasswordMock).toHaveBeenCalledWith(users[1].userId);
    const status = await findByRole('status');
    expect(status.textContent).toContain('Temp1234!');
  });
});
