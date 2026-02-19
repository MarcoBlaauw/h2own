import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import CostsCard from './CostsCard.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const create = vi.fn();
  const list = vi.fn();
  const summary = vi.fn();
  return {
    api: {
      costs: {
        create,
        list,
        summary,
      },
    },
  };
});

describe('CostsCard', () => {
  const createMock = api.costs.create as unknown as Mock;
  const listMock = api.costs.list as unknown as Mock;
  const summaryMock = api.costs.summary as unknown as Mock;

  beforeEach(() => {
    createMock.mockReset();
    listMock.mockReset();
    summaryMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a cost and refreshes the list', async () => {
    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ costId: 'new-cost' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    listMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              costId: 'new-cost',
              amount: '125.50',
              currency: 'USD',
              description: 'Filter replacement',
              vendor: 'Pool Depot',
              incurredAt: '2024-02-05T00:00:00.000Z',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    summaryMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          window: 'month',
          from: '2024-02-01T00:00:00.000Z',
          to: '2024-03-01T00:00:00.000Z',
          total: '125.50',
          currency: 'USD',
          byCategory: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { getByLabelText, getByRole, findByRole, findByText } = render(CostsCard, {
      props: {
        costs: [],
        summary: null,
        poolId: '2a1e4c1f-7c39-4e01-9aaf-32047eb1f0e3',
      },
    });

    await fireEvent.input(getByLabelText('Amount'), { target: { value: '125.5' } });
    await fireEvent.input(getByLabelText('Description'), {
      target: { value: 'Filter replacement' },
    });
    await fireEvent.input(getByLabelText('Vendor'), { target: { value: 'Pool Depot' } });
    await fireEvent.input(getByLabelText('Incurred at'), { target: { value: '2024-02-05' } });

    await fireEvent.click(getByRole('button', { name: /add cost/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        '2a1e4c1f-7c39-4e01-9aaf-32047eb1f0e3',
        expect.objectContaining({
          amount: 125.5,
          description: 'Filter replacement',
          vendor: 'Pool Depot',
          currency: 'USD',
          incurredAt: expect.any(String),
        })
      );
    });

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(
        '2a1e4c1f-7c39-4e01-9aaf-32047eb1f0e3',
        undefined,
        { limit: 5 }
      );
      expect(summaryMock).toHaveBeenCalledWith(
        '2a1e4c1f-7c39-4e01-9aaf-32047eb1f0e3',
        undefined,
        { window: 'month' }
      );
    });

    const status = await findByRole('status');
    expect(status.textContent).toContain('Cost entry added');
    expect(await findByText('Filter replacement')).toBeTruthy();
  });

  it('requires amount and description', async () => {
    const { getByLabelText, getByRole, findByRole } = render(CostsCard, {
      props: {
        costs: [],
        summary: null,
        poolId: '2a1e4c1f-7c39-4e01-9aaf-32047eb1f0e3',
      },
    });

    await fireEvent.input(getByLabelText('Amount'), { target: { value: '12' } });
    await fireEvent.click(getByRole('button', { name: /add cost/i }));

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Description is required');
    expect(createMock).not.toHaveBeenCalled();
  });
});
