import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

const pageValue = {
  url: new URL(
    'http://localhost/auth/lockout?email=member%40example.com&offense=3&until=2026-03-13T20:00:00.000Z&support=1',
  ),
  data: { session: null },
};

vi.mock('$app/stores', () => {
  const page = {
    subscribe(run: (value: typeof pageValue) => void) {
      run(pageValue);
      return () => {};
    },
  };

  return {
    page,
    navigating: readable(null),
    updated: readable(false),
    getStores: () => ({ page, navigating: readable(null), updated: readable(false) }),
  };
});

vi.mock('$lib/api', () => ({
  api: {
    auth: {
      lockoutSupport: vi.fn(),
    },
  },
}));

describe('lockout page', () => {
  const lockoutSupportMock = api.auth.lockoutSupport as unknown as Mock;

  beforeEach(() => {
    lockoutSupportMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the third-offense support form', () => {
    const { getByText, getByLabelText } = render(Page);

    expect(getByText('Account locked for the rest of today')).toBeInTheDocument();
    expect(getByLabelText('Message')).toBeInTheDocument();
  });

  it('submits a support request for third-offense lockouts', async () => {
    lockoutSupportMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: 'Support request sent.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { getByLabelText, getByRole, findByText } = render(Page);

    await fireEvent.input(getByLabelText('Message'), {
      target: { value: 'Please help restore access for an urgent pool visit.' },
    });
    await fireEvent.click(getByRole('button', { name: /send support request/i }));

    await waitFor(() => {
      expect(lockoutSupportMock).toHaveBeenCalledWith({
        email: 'member@example.com',
        message: 'Please help restore access for an urgent pool visit.',
      });
    });

    expect(await findByText('Support request sent.')).toBeInTheDocument();
  });
});
