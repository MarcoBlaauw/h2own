import { fireEvent, render, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import Page from './+page.svelte';
import { api } from '$lib/api';

vi.mock('$lib/api', () => {
  const create = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  const equipment = vi.fn();
  const updateEquipment = vi.fn();
  const temperaturePreferences = vi.fn();
  const updateTemperaturePreferences = vi.fn();
  const createLocation = vi.fn();
  return {
    api: {
      pools: {
        create,
        patch,
        del,
        list: vi.fn(),
        equipment,
        updateEquipment,
        temperaturePreferences,
        updateTemperaturePreferences,
      },
      userLocations: {
        create: createLocation,
        list: vi.fn(),
        update: vi.fn(),
        deactivate: vi.fn(),
        delete: vi.fn(),
        purgeLegacy: vi.fn(),
      },
    },
  };
});

describe('pools page', () => {
  const locations = [
    {
      locationId: 'd1f0f4a7-0d9f-4c36-9a3a-5b08e4b40c1e',
      name: 'Home',
      formattedAddress: '809 Country Cottage Blvd, Montz, LA 70068, USA',
      googlePlaceId: 'test-place-id',
      latitude: 34.1,
      longitude: -118.2,
      timezone: 'America/Chicago',
    },
  ];
  const pools = [
    {
      poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
      name: 'Backyard Pool',
      volumeGallons: 15000,
      sanitizerType: 'chlorine',
      chlorineSource: 'manual',
      sanitizerTargetMinPpm: 2,
      sanitizerTargetMaxPpm: 4,
      surfaceType: 'plaster',
      locationId: 'd1f0f4a7-0d9f-4c36-9a3a-5b08e4b40c1e',
    },
  ];

  const createMock = api.pools.create as unknown as Mock;
  const patchMock = api.pools.patch as unknown as Mock;
  const deleteMock = api.pools.del as unknown as Mock;
  const createLocationMock = api.userLocations.create as unknown as Mock;
  const listLocationsMock = api.userLocations.list as unknown as Mock;
  const equipmentMock = api.pools.equipment as unknown as Mock;
  const updateEquipmentMock = api.pools.updateEquipment as unknown as Mock;
  const temperaturePreferencesMock = api.pools.temperaturePreferences as unknown as Mock;
  const updateTemperaturePreferencesMock = api.pools.updateTemperaturePreferences as unknown as Mock;

  beforeEach(() => {
    createMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
    createLocationMock.mockReset();
    listLocationsMock.mockReset();
    equipmentMock.mockReset();
    updateEquipmentMock.mockReset();
    temperaturePreferencesMock.mockReset();
    updateTemperaturePreferencesMock.mockReset();
    listLocationsMock.mockResolvedValue(
      new Response(JSON.stringify(locations), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    equipmentMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          equipmentType: 'none',
          energySource: 'unknown',
          status: 'disabled',
          capacityBtu: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    temperaturePreferencesMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          preferredTemp: null,
          minTemp: null,
          maxTemp: null,
          unit: 'F',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    updateEquipmentMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    updateTemperaturePreferencesMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates required fields before creating', async () => {
    const { getByRole, findByRole } = render(Page, {
      props: { data: { session: null, defaultPoolId: null, pools, locations, loadError: null } },
    });

    const submit = getByRole('button', { name: /create pool/i });
    await fireEvent.click(submit);

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Name is required.');
    expect(alert.textContent).toContain('Timezone is required.');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a pool and adds it to the list', async () => {
    const created = {
      poolId: 'c6ffb1fd-5ee3-4a6f-a581-d848e87f6761',
      name: 'Lap Pool',
      volumeGallons: 20000,
      sanitizerType: 'chlorine',
      chlorineSource: 'swg',
      saltLevelPpm: 3200,
      sanitizerTargetMinPpm: 2,
      sanitizerTargetMaxPpm: 4,
      surfaceType: 'plaster',
      locationId: null,
    };

    createLocationMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          locationId: 'd1f0f4a7-0d9f-4c36-9a3a-5b08e4b40d00',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    createMock.mockResolvedValueOnce(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByLabelText, getByRole, findByRole, queryAllByText } = render(Page, {
      props: { data: { session: null, defaultPoolId: null, pools, locations, loadError: null } },
    });

    await fireEvent.input(getByLabelText('Name'), { target: { value: created.name } });
    await fireEvent.input(getByLabelText('Volume (gallons)'), { target: { value: created.volumeGallons } });
    await fireEvent.change(getByLabelText('Sanitizer type'), { target: { value: created.sanitizerType } });
    await fireEvent.change(getByLabelText('Chlorine source'), { target: { value: created.chlorineSource } });
    await fireEvent.input(getByLabelText(/salt target \(ppm\)/i), {
      target: { value: created.saltLevelPpm },
    });
    await fireEvent.input(getByLabelText('Sanitizer target min (ppm)'), {
      target: { value: created.sanitizerTargetMinPpm },
    });
    await fireEvent.input(getByLabelText(/sanitizer target max \(ppm\)/i), {
      target: { value: created.sanitizerTargetMaxPpm },
    });
    await fireEvent.change(getByLabelText('Surface type'), { target: { value: created.surfaceType } });
    await fireEvent.input(getByLabelText('Latitude'), { target: { value: '30.0279' } });
    await fireEvent.input(getByLabelText('Longitude'), { target: { value: '-90.4614' } });
    await fireEvent.change(getByLabelText('Timezone (from pin)'), {
      target: { value: 'America/Chicago' },
    });

    const submit = getByRole('button', { name: /create pool/i });
    await fireEvent.click(submit);

    await waitFor(() => {
      expect(createLocationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 30.0279,
          longitude: -90.4614,
          timezone: 'America/Chicago',
        })
      );
        expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: created.name,
          sanitizerType: created.sanitizerType,
          chlorineSource: created.chlorineSource,
          saltLevelPpm: created.saltLevelPpm,
          sanitizerTargetMinPpm: created.sanitizerTargetMinPpm,
          sanitizerTargetMaxPpm: created.sanitizerTargetMaxPpm,
          surfaceType: created.surfaceType,
        })
      );
    });

    const status = await findByRole('status');
    expect(status.textContent).toContain('Pool created.');
    await waitFor(() => {
      expect(queryAllByText(created.name).length).toBeGreaterThan(0);
    });
  });

  it('updates a pool', async () => {
    const updated = { ...pools[0], name: 'Updated Pool' };
    createLocationMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          locationId: 'd1f0f4a7-0d9f-4c36-9a3a-5b08e4b40d01',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    patchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { getByRole, getAllByText, queryAllByText } = render(Page, {
      props: { data: { session: null, defaultPoolId: null, pools, locations, loadError: null } },
    });

    await fireEvent.click(getByRole('button', { name: /edit pool/i }));

    const panel = getAllByText(pools[0].name)
      .map((node) => node.closest('.surface-panel'))
      .find((node): node is HTMLElement => Boolean(node));
    expect(panel).toBeTruthy();
    await fireEvent.input(within(panel as HTMLElement).getByLabelText('Name'), {
      target: { value: updated.name },
    });
    await fireEvent.click(getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(createLocationMock).toHaveBeenCalled();
      expect(patchMock).toHaveBeenCalledWith(
        updated.poolId,
        expect.objectContaining({ name: updated.name })
      );
      expect(queryAllByText(updated.name).length).toBeGreaterThan(0);
    });
  });

  it('removes a pool after double confirmation', async () => {
    deleteMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const { getByRole, queryByText } = render(Page, {
      props: { data: { session: null, defaultPoolId: null, pools, locations, loadError: null } },
    });

    const deleteButton = getByRole('button', { name: /remove pool/i });
    await fireEvent.click(deleteButton);

    expect(deleteMock).toHaveBeenCalledWith(pools[0].poolId);
    await waitFor(() => {
      expect(queryByText(pools[0].name)).toBeNull();
    });
  });

  it('shows a manage locations section', () => {
    const { getByText, getAllByText } = render(Page, {
      props: { data: { session: null, defaultPoolId: null, pools, locations, loadError: null } },
    });

    expect(getByText('Manage locations')).toBeTruthy();
    const entries = getAllByText(locations[0].name);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('shows timezone selection on create pool', () => {
    const { getByLabelText } = render(Page, {
      props: { data: { session: null, defaultPoolId: null, pools, locations, loadError: null } },
    });

    expect(getByLabelText('Timezone (from pin)')).toBeTruthy();
  });
});
