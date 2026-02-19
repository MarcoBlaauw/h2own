import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const create = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  const createLocation = vi.fn();
  return {
    api: {
      pools: {
        create,
        patch,
        del,
        list: vi.fn(),
      },
      userLocations: {
        create: createLocation,
        list: vi.fn(),
      },
    },
  };
});

describe('pools page', () => {
  const locations = [
    {
      locationId: 'd1f0f4a7-0d9f-4c36-9a3a-5b08e4b40c1e',
      name: 'Home',
      latitude: 34.1,
      longitude: -118.2,
    },
  ];
  const pools = [
    {
      poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
      name: 'Backyard Pool',
      volumeGallons: 15000,
      sanitizerType: 'chlorine',
      surfaceType: 'plaster',
      locationId: null,
    },
  ];

  const createMock = api.pools.create as unknown as Mock;
  const patchMock = api.pools.patch as unknown as Mock;
  const deleteMock = api.pools.del as unknown as Mock;

  beforeEach(() => {
    createMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates required fields before creating', async () => {
    const { getByRole, findByRole } = render(Page, {
      props: { data: { session: null, pools, locations, loadError: null } },
    });

    const submit = getByRole('button', { name: /create pool/i });
    await fireEvent.click(submit);

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Name is required.');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a pool and adds it to the list', async () => {
    const created = {
      poolId: 'c6ffb1fd-5ee3-4a6f-a581-d848e87f6761',
      name: 'Lap Pool',
      volumeGallons: 20000,
      sanitizerType: 'salt',
      surfaceType: 'plaster',
      locationId: null,
    };

    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole, queryByText } = render(Page, {
      props: { data: { session: null, pools, locations, loadError: null } },
    });

    await fireEvent.input(getByLabelText('Name'), { target: { value: created.name } });
    await fireEvent.input(getByLabelText('Volume (gallons)'), { target: { value: created.volumeGallons } });
    await fireEvent.change(getByLabelText('Sanitizer type'), { target: { value: created.sanitizerType } });
    await fireEvent.change(getByLabelText('Surface type'), { target: { value: created.surfaceType } });

    const submit = getByRole('button', { name: /create pool/i });
    await fireEvent.click(submit);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: created.name,
        sanitizerType: created.sanitizerType,
        surfaceType: created.surfaceType,
      })
    );

    const status = await findByRole('status');
    expect(status.textContent).toContain('Pool created.');
    await waitFor(() => {
      expect(queryByText(created.name)).toBeTruthy();
    });
  });

  it('creates a location for the user', async () => {
    const location = {
      locationId: '9b93d8f1-0e7a-4f3d-b76a-5f7a9e1a0ed1',
      name: 'Cabin',
      latitude: 30.02,
      longitude: -90.46,
    };

    const createLocationMock = api.userLocations?.create as unknown as Mock;
    createLocationMock?.mockResolvedValueOnce(
      new Response(JSON.stringify(location), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole, queryByText } = render(Page, {
      props: { data: { session: null, pools, locations, loadError: null } },
    });

    await fireEvent.input(getByLabelText('Location name'), { target: { value: location.name } });
    await fireEvent.input(getByLabelText('Latitude (optional)'), { target: { value: location.latitude } });
    await fireEvent.input(getByLabelText('Longitude (optional)'), { target: { value: location.longitude } });

    const submit = getByRole('button', { name: /create location/i });
    await fireEvent.click(submit);

    expect(createLocationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
      })
    );

    const status = await findByRole('status');
    expect(status.textContent).toContain('Location created.');
    await waitFor(() => {
      expect(queryByText(location.name)).toBeTruthy();
    });
  });

  it('updates a pool', async () => {
    const updated = { ...pools[0], name: 'Updated Pool' };
    patchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByRole, getByText, queryByText } = render(Page, {
      props: { data: { session: null, pools, locations, loadError: null } },
    });

    await fireEvent.click(getByRole('button', { name: /edit/i }));

    const panel = getByText(pools[0].name).closest('.surface-panel');
    expect(panel).toBeTruthy();
    await fireEvent.input(within(panel as HTMLElement).getByLabelText('Name'), {
      target: { value: updated.name },
    });
    await fireEvent.click(getByRole('button', { name: /save changes/i }));

    expect(patchMock).toHaveBeenCalledWith(updated.poolId, expect.objectContaining({ name: updated.name }));
    await waitFor(() => {
      expect(queryByText(updated.name)).toBeTruthy();
    });
  });

  it('removes a pool after double confirmation', async () => {
    deleteMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const { getByRole, queryByText } = render(Page, {
      props: { data: { session: null, pools, locations, loadError: null } },
    });

    const deleteButton = getByRole('button', { name: /remove/i });
    await fireEvent.click(deleteButton);

    expect(deleteMock).toHaveBeenCalledWith(pools[0].poolId);
    await waitFor(() => {
      expect(queryByText(pools[0].name)).toBeNull();
    });
  });
});
