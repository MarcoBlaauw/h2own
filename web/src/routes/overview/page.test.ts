import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

const pageValue = {
  url: new URL('http://localhost/overview'),
  data: {
    session: {
      user: { id: 'user-1', role: 'member', email: 'member@example.com' },
      monetization: { adsEnabled: true, paidSubscriber: false, source: 'billing' as const },
    },
  },
};

const subscribers = new Set<(value: typeof pageValue) => void>();

vi.mock('$app/stores', () => {
  const page = {
    subscribe(run: (value: typeof pageValue) => void) {
      run(pageValue);
      subscribers.add(run);
      return () => subscribers.delete(run);
    },
  };

  return {
    page,
    navigating: readable(null),
    updated: readable(false),
    getStores: () => ({ page, navigating: readable(null), updated: readable(false) }),
  };
});

const gotoMock = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({
  goto: gotoMock,
}));

vi.mock('$lib/components/location/GoogleMapPicker.svelte', async () => {
  const mod = await import('$lib/components/location/__mocks__/GoogleMapPicker.svelte');
  return { default: mod.default };
});

vi.mock('$lib/api', () => ({
  api: {
    me: {
      updatePreferences: vi.fn(),
    },
    userLocations: {
      create: vi.fn(),
    },
    pools: {
      create: vi.fn(),
    },
  },
}));

const baseData = {
  pools: [
    { poolId: 'pool-1', name: 'Backyard Pool' },
    { poolId: 'pool-2', name: 'Lap Pool' },
  ],
  highlightedPool: {
    id: 'pool-1',
    name: 'Backyard Pool',
    locationId: 'loc-1',
  },
  defaultPoolId: 'pool-1',
  latestTest: {
    sessionId: 'test-1',
    testedAt: '2026-03-13T10:00:00.000Z',
    freeChlorinePpm: '3.2',
    phLevel: '7.5',
    totalAlkalinityPpm: 90,
    cyanuricAcidPpm: 40,
    calciumHardnessPpm: 250,
    saltPpm: 3100,
  },
  recommendations: {
    primary: {
      chemicalId: 'chem-1',
      chemicalName: 'Liquid Chlorine',
      amount: 12,
      unit: 'oz',
      reason: 'Raise FC',
      predictedOutcome: 'FC +1',
    },
    alternatives: [],
  },
  recommendationHistory: [],
  dosingHistory: [],
  costs: [],
  costSummary: null,
  weatherDaily: [],
  weatherError: null,
};

describe('overview page', () => {
  const updatePreferencesMock = api.me.updatePreferences as unknown as Mock;

  beforeEach(() => {
    gotoMock.mockReset();
    updatePreferencesMock.mockReset();
    updatePreferencesMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the quick test dialog from the overview page', async () => {
    const { getByRole, findByRole } = render(Page, { props: { data: baseData } });

    await fireEvent.click(getByRole('button', { name: /quick test/i }));

    expect(await findByRole('dialog', { name: /quick test dialog/i })).toBeInTheDocument();
  });

  it('opens the guided full test dialog from the overview page', async () => {
    const { getByRole, findByRole } = render(Page, { props: { data: baseData } });

    await fireEvent.click(getByRole('button', { name: /guided full test/i }));

    expect(await findByRole('dialog', { name: /guided full test dialog/i })).toBeInTheDocument();
  });

  it('persists active pool selection and reloads the overview for that pool', async () => {
    const { getByLabelText } = render(Page, { props: { data: baseData } });

    await fireEvent.change(getByLabelText('Pool'), { target: { value: 'pool-2' } });

    await waitFor(() => {
      expect(updatePreferencesMock).toHaveBeenCalledWith({ defaultPoolId: 'pool-2' });
    });
    expect(gotoMock).toHaveBeenCalledWith('/overview?poolId=pool-2', { invalidateAll: true });
  });

  it('renders derived upcoming maintenance tasks for the active pool', () => {
    const { getByText } = render(Page, { props: { data: baseData } });

    expect(getByText('Upcoming Maintenance')).toBeInTheDocument();
    expect(getByText(/Dose Liquid Chlorine/i)).toBeInTheDocument();
    expect(getByText(/Re-test and verify chemistry/i)).toBeInTheDocument();
  });
});
