import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const list = vi.fn();
  return {
    api: {
      auditLog: { list },
    },
  };
});

describe('admin audit log page', () => {
  const listMock = api.auditLog.list as unknown as Mock;

  const entries = [
    {
      auditId: 1,
      at: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      action: 'user.login',
      entity: 'session',
      entityId: 'session-1',
      userId: 'user-1',
      poolId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'Chrome',
      sessionId: 'sid-1',
      data: { detail: 'success' },
      userEmail: 'owner@example.com',
      userName: 'Owner One',
    },
    {
      auditId: 2,
      at: new Date('2024-01-02T00:00:00.000Z').toISOString(),
      action: 'pool.updated',
      entity: 'pool',
      entityId: 'pool-1',
      userId: 'user-2',
      poolId: 'pool-1',
      ipAddress: '127.0.0.2',
      userAgent: 'Chrome',
      sessionId: 'sid-2',
      data: { before: { name: 'Lap' }, after: { name: 'Lap Pool' } },
      userEmail: 'member@example.com',
      userName: 'Member Two',
    },
  ];

  beforeEach(() => {
    listMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies filters and requests matching log entries', async () => {
    listMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          page: 1,
          pageSize: 25,
          total: 1,
          items: [entries[0]],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { getByLabelText, getByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          entries,
          filters: { user: '', action: '', entity: '' },
          pagination: { page: 1, pageSize: 25, total: entries.length },
          loadError: null,
        },
      },
    });

    await fireEvent.input(getByLabelText('User'), { target: { value: 'owner@example.com' } });
    await fireEvent.input(getByLabelText('Action'), { target: { value: 'user' } });
    await fireEvent.input(getByLabelText('Entity'), { target: { value: 'session' } });

    const apply = getByRole('button', { name: /apply filters/i });
    await fireEvent.click(apply);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(undefined, {
        page: 1,
        pageSize: 25,
        user: 'owner@example.com',
        action: 'user',
        entity: 'session',
      });
    });
  });

  it('requests the next page of results when paginating', async () => {
    listMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          page: 2,
          pageSize: 25,
          total: entries.length,
          items: [entries[1]],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { getByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          entries,
          filters: { user: '', action: '', entity: '' },
          pagination: { page: 1, pageSize: 25, total: 60 },
          loadError: null,
        },
      },
    });

    const next = getByRole('button', { name: /next/i });
    await fireEvent.click(next);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(undefined, {
        page: 2,
        pageSize: 25,
        user: undefined,
        action: undefined,
        entity: undefined,
      });
    });
  });

  it('exports the current table as CSV', async () => {
    if (typeof URL.createObjectURL !== 'function') {
      (URL as unknown as Record<string, unknown>).createObjectURL = () => '';
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as unknown as Record<string, unknown>).revokeObjectURL = () => undefined;
    }

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:log-export');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const originalCreateElement = document.createElement;
    const anchorClicks: Array<() => void> = [];

    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const anchor = originalCreateElement.call(document, 'a') as HTMLAnchorElement;
        const clickMock = vi.fn();
        anchor.click = clickMock;
        anchorClicks.push(clickMock);
        return anchor;
      }
      return originalCreateElement.call(document, tagName);
    });

    const { getByRole, findByRole } = render(Page, {
      props: {
        data: {
          session: { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } },
          entries,
          filters: { user: '', action: '', entity: '' },
          pagination: { page: 1, pageSize: 25, total: entries.length },
          loadError: null,
        },
      },
    });

    const exportButton = getByRole('button', { name: /export csv/i });
    await fireEvent.click(exportButton);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(anchorClicks[0]).toHaveBeenCalled();
      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(revokeSpy).toHaveBeenCalledWith('blob:log-export');
    });

    const status = await findByRole('status');
    expect(status.textContent).toContain('Audit log exported as CSV.');

    createElementSpy.mockRestore();
  });
});
