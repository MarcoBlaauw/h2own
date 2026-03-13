import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

const invalidateAllMock = vi.hoisted(() => vi.fn());
const gotoMock = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({
  goto: gotoMock,
  invalidateAll: invalidateAllMock,
}));

vi.mock('$lib/api', () => ({
  api: {
    schedule: {
      create: vi.fn(),
      complete: vi.fn(),
      del: vi.fn(),
    },
  },
}));

const baseData = {
  pools: [
    { poolId: 'pool-1', name: 'Backyard Pool' },
    { poolId: 'pool-2', name: 'Lap Pool' },
  ],
  events: {
    items: [
      {
        eventId: 'event-1',
        poolId: 'pool-1',
        poolName: 'Backyard Pool',
        eventType: 'test',
        title: 'Weekly chemistry check',
        notes: 'Bring reagents',
        dueAt: '2026-03-14T12:00:00.000Z',
        recurrence: 'weekly',
        reminderLeadMinutes: 1440,
        status: 'scheduled',
      },
    ],
  },
  summary: { scheduledCount: 1, overdueCount: 0 },
  preferences: { reminderLeadMinutes: 1440 },
  requestedPoolId: null,
};

describe('calendar page', () => {
  const createMock = api.schedule.create as unknown as Mock;
  const completeMock = api.schedule.complete as unknown as Mock;

  beforeEach(() => {
    createMock.mockReset();
    completeMock.mockReset();
    invalidateAllMock.mockReset();
    gotoMock.mockReset();
    createMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    completeMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing scheduled events', () => {
    const { getByText } = render(Page, { props: { data: baseData } });

    expect(getByText('Weekly chemistry check')).toBeInTheDocument();
    expect(getByText(/Backyard Pool •/i)).toBeInTheDocument();
  });

  it('creates a new schedule event', async () => {
    const { getByText, getByLabelText } = render(Page, { props: { data: baseData } });

    await fireEvent.input(getByLabelText('Title'), { target: { value: 'Shock pool' } });
    await fireEvent.input(getByLabelText('Due at'), { target: { value: '2026-03-20T09:00' } });
    await fireEvent.click(getByText('Create event'));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled();
    });
    expect(invalidateAllMock).toHaveBeenCalled();
  });

  it('completes an event from the agenda list', async () => {
    const { getByText } = render(Page, { props: { data: baseData } });

    await fireEvent.click(getByText('Complete'));

    await waitFor(() => {
      expect(completeMock).toHaveBeenCalledWith('event-1');
    });
  });
});
