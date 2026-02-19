import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import DosingHistoryCard from './DosingHistoryCard.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const create = vi.fn();
  const list = vi.fn();
  return {
    api: {
      dosing: {
        create,
        list,
      },
    },
  };
});

describe('DosingHistoryCard', () => {
  const createMock = api.dosing.create as unknown as Mock;
  const listMock = api.dosing.list as unknown as Mock;

  beforeEach(() => {
    createMock.mockReset();
    listMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs dosing and refreshes the history list', async () => {
    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ actionId: 'new-action' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    listMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              actionId: 'new-action',
              chemicalId: '6f4f5c62-8b5f-41a8-b6a5-6c5f4a2b8e15',
              chemicalName: 'Liquid Chlorine',
              amount: '12',
              unit: 'oz',
              addedAt: '2024-01-02T18:00:00.000Z',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { getByLabelText, getByRole, findByText, findByRole } = render(DosingHistoryCard, {
      props: {
        dosingHistory: [],
        poolId: '2a1e4c1f-7c39-4e01-9aaf-32047eb1f0e3',
      },
    });

    await fireEvent.input(getByLabelText('Chemical ID'), {
      target: { value: '6f4f5c62-8b5f-41a8-b6a5-6c5f4a2b8e15' },
    });
    await fireEvent.input(getByLabelText('Amount'), { target: { value: '12' } });
    await fireEvent.input(getByLabelText('Unit'), { target: { value: 'oz' } });
    await fireEvent.input(getByLabelText('Added at'), { target: { value: '2024-01-02T10:00' } });

    await fireEvent.click(getByRole('button', { name: /log dosing/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        '2a1e4c1f-7c39-4e01-9aaf-32047eb1f0e3',
        expect.objectContaining({
          chemicalId: '6f4f5c62-8b5f-41a8-b6a5-6c5f4a2b8e15',
          amount: 12,
          unit: 'oz',
          addedAt: expect.any(String),
        })
      );
    });

    const status = await findByRole('status');
    expect(status.textContent).toContain('Dosing event logged');
    expect(await findByText('Liquid Chlorine')).toBeTruthy();
  });

  it('surfaces API errors when dosing creation fails', async () => {
    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Chemical not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole } = render(DosingHistoryCard, {
      props: {
        dosingHistory: [],
        poolId: '2a1e4c1f-7c39-4e01-9aaf-32047eb1f0e3',
      },
    });

    await fireEvent.input(getByLabelText('Chemical ID'), {
      target: { value: '6f4f5c62-8b5f-41a8-b6a5-6c5f4a2b8e15' },
    });
    await fireEvent.input(getByLabelText('Amount'), { target: { value: '12' } });
    await fireEvent.input(getByLabelText('Unit'), { target: { value: 'oz' } });

    await fireEvent.click(getByRole('button', { name: /log dosing/i }));

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Chemical not found');
    expect(listMock).not.toHaveBeenCalled();
  });
});
