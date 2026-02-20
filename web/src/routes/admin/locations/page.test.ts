import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Page from './+page.svelte';
import type { AdminLocation } from './+page';
import type { PageData } from './$types';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const locations = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  };
  const users = {
    list: vi.fn(),
    update: vi.fn(),
    resetPassword: vi.fn(),
  };
  const pools = {
    list: vi.fn(),
    create: vi.fn(),
    show: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  };
  return { api: { locations, users, pools } };
});

describe('admin locations page', () => {
  const locationsApi = api.locations as unknown as Record<string, Mock>;

  const adminSession: NonNullable<PageData['session']> = {
    user: {
      id: '8f2d8f8a-0b11-4a8a-9b8d-7b5484035d68',
      role: 'admin',
      email: 'admin@example.com',
    },
  };

  const baseUserId = '5b7ff8ab-9ae5-4763-9e9f-e74a64dbe4b6';
  const secondaryUserId = '3f041641-0d3d-4cbb-93b0-5eaa1b361f33';
  const secondaryLocationId = '7d3d4432-5d3f-4c02-8c24-3edb6249d6c7';
  const basePoolId = '2c59c4d6-2a9f-4d6b-9ab1-5f3ea32d7f3e';

  const baseLocation: AdminLocation = {
    locationId: '5e4f2a8c-6c41-4c60-b3f6-bb34a91d9c1a',
    userId: baseUserId,
    name: 'Primary Home',
    formattedAddress: null,
    googlePlaceId: null,
    googlePlusCode: null,
    latitude: 33.12,
    longitude: -84.98,
    timezone: 'America/New_York',
    isPrimary: true,
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    user: {
      userId: baseUserId,
      email: 'owner@example.com',
      name: 'Owner One',
    },
    pools: [
      {
        poolId: basePoolId,
        name: 'Backyard Pool',
      },
    ],
  };

  beforeEach(() => {
    Object.values(locationsApi).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders load errors', () => {
    const { getByRole } = render(Page, {
      props: {
        data: {
          session: adminSession,
          locations: [],
          users: [],
          loadError: 'Failed to load locations (500)',
        },
      },
    });

    expect(getByRole('alert').textContent).toContain('Failed to load locations (500)');
  });

  it('creates locations and adds them to the directory', async () => {
    const created = {
      ...baseLocation,
      locationId: secondaryLocationId,
      name: 'New Spot',
      userId: secondaryUserId,
      user: {
        userId: secondaryUserId,
        email: 'member@example.com',
        name: 'Member',
      },
      pools: [],
    };

    locationsApi.create.mockResolvedValueOnce(
      new Response(JSON.stringify(created), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getAllByLabelText, getByRole, findByText } = render(Page, {
      props: {
        data: {
          session: adminSession,
          locations: [baseLocation],
          users: [
            {
              userId: baseLocation.userId,
              email: 'owner@example.com',
              name: 'Owner One',
              isActive: true,
            },
            {
              userId: secondaryUserId,
              email: 'member@example.com',
              name: 'Member',
              isActive: true,
            },
          ],
          loadError: null,
        },
      },
    });

    const userSelects = getAllByLabelText('User');
    await fireEvent.change(userSelects[0], { target: { value: secondaryUserId } });

    const nameFields = getAllByLabelText('Name');
    await fireEvent.input(nameFields[0], { target: { value: 'New Spot' } });

    const latitudeFields = getAllByLabelText('Latitude');
    const longitudeFields = getAllByLabelText('Longitude');
    const timezoneFields = getAllByLabelText('Timezone');
    await fireEvent.input(latitudeFields[0], { target: { value: '12.5' } });
    await fireEvent.input(longitudeFields[0], { target: { value: '-70.1' } });
    await fireEvent.input(timezoneFields[0], { target: { value: 'UTC' } });

    await fireEvent.click(getByRole('button', { name: /create location/i }));

    await waitFor(() => {
      expect(locationsApi.create).toHaveBeenCalledWith({
        userId: secondaryUserId,
        name: 'New Spot',
        isPrimary: false,
        latitude: 12.5,
        longitude: -70.1,
        timezone: 'UTC',
      });
    });

    expect(await findByText('New Spot')).toBeInTheDocument();
  });

  it('updates metadata for a selected location', async () => {
    const updated = { ...baseLocation, name: 'Renamed Location' };
    locationsApi.update.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getAllByLabelText, getByRole, findByText } = render(Page, {
      props: {
        data: {
          session: adminSession,
          locations: [baseLocation],
          users: [
            {
              userId: baseLocation.userId,
              email: 'owner@example.com',
              name: 'Owner One',
              isActive: true,
            },
          ],
          loadError: null,
        },
      },
    });

    const nameFields = getAllByLabelText('Name');
    await fireEvent.input(nameFields[1], { target: { value: 'Renamed Location' } });
    await fireEvent.click(getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(locationsApi.update).toHaveBeenCalledWith(
        baseLocation.locationId,
        expect.objectContaining({
          userId: baseLocation.userId,
          name: 'Renamed Location',
          isPrimary: true,
          latitude: baseLocation.latitude,
          longitude: baseLocation.longitude,
          timezone: 'America/New_York',
        })
      );
    });

    expect(await findByText('Renamed Location')).toBeInTheDocument();
  });

  it('reassigns pools to a new location', async () => {
    const reassigned = {
      ...baseLocation,
      pools: [],
    };

    locationsApi.update.mockResolvedValueOnce(
      new Response(JSON.stringify(reassigned), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    locationsApi.list.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          reassigned,
          {
            ...baseLocation,
            locationId: secondaryLocationId,
            name: 'Secondary',
            pools: [
              {
                poolId: basePoolId,
                name: 'Backyard Pool',
              },
            ],
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { getByLabelText } = render(Page, {
      props: {
        data: {
          session: adminSession,
          locations: [
            baseLocation,
            {
              ...baseLocation,
              locationId: secondaryLocationId,
              name: 'Secondary',
              pools: [],
            },
          ],
          users: [
            {
              userId: baseLocation.userId,
              email: 'owner@example.com',
              name: 'Owner One',
              isActive: true,
            },
          ],
          loadError: null,
        },
      },
    });

    const poolSelect = getByLabelText('Reassign Backyard Pool') as HTMLSelectElement;
    await fireEvent.change(poolSelect, { target: { value: '__unassigned' } });

    await waitFor(() => {
      expect(locationsApi.update).toHaveBeenCalledWith(baseLocation.locationId, {
        unassignPools: [basePoolId],
      });
      expect(locationsApi.list).toHaveBeenCalled();
    });
  });
});
