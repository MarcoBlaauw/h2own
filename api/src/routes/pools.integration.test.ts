import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { poolsRoutes } from './pools.js';
import {
  poolCoreService,
  poolEquipmentService,
  PoolForbiddenError,
  PoolNotFoundError,
  PoolOwnerRequiredError,
  PoolCreateOwnerForbiddenError,
  PoolLocationAccessError,
  PoolValidationError,
} from '../services/pools/index.js';
import { accountIntegrationsService } from '../services/account-integrations.js';

describe('GET /pools/:poolId integration', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';
  let currentUserRole: string | undefined;

  beforeEach(async () => {
    currentUserRole = undefined;
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: currentUserRole };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(poolsRoutes, { prefix: '/pools' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns nested pool detail payloads', async () => {
    const poolDetail = {
      id: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
      ownerId: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
      locationId: null,
      name: 'Community Pool',
      volumeGallons: 25000,
      surfaceType: 'plaster',
      sanitizerType: 'chlorine',
      chlorineSource: 'swg',
      saltLevelPpm: 3200,
      sanitizerTargetMinPpm: 2,
      sanitizerTargetMaxPpm: 4,
      shadeLevel: 'partial',
      enclosureType: null,
      hasCover: true,
      pumpGpm: 60,
      filterType: 'sand',
      hasHeater: false,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      owner: {
        id: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
        email: 'owner@example.com',
        name: 'Owner',
      },
      members: [
        {
          poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
          userId: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
          roleName: 'owner',
          permissions: null,
          invitedBy: null,
          invitedAt: new Date('2024-01-01T00:00:00.000Z'),
          addedAt: new Date('2024-01-01T00:00:00.000Z'),
          lastAccessAt: null,
          user: {
            id: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
            email: 'owner@example.com',
            name: 'Owner',
          },
        },
      ],
      tests: [
        {
          id: 'c0b6a688-5342-4d9d-a3c5-423f5fbe0cb3',
          testedAt: new Date('2024-01-05T00:00:00.000Z'),
          freeChlorine: 3,
          totalChlorine: 4,
          ph: 7.4,
          totalAlkalinity: 90,
          cyanuricAcid: 40,
          calciumHardness: 220,
          salt: 3200,
          waterTempF: 78,
          tester: {
            id: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
            email: 'owner@example.com',
            name: 'Owner',
          },
        },
      ],
      lastTestedAt: new Date('2024-01-05T00:00:00.000Z'),
    };

    vi.spyOn(poolCoreService, 'getPoolById').mockResolvedValue(poolDetail as any);

    const id = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const response = await app.inject({ method: 'GET', url: `/pools/${id}` });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual({
      ...poolDetail,
      createdAt: poolDetail.createdAt.toISOString(),
      updatedAt: poolDetail.updatedAt.toISOString(),
      members: poolDetail.members.map((member) => ({
        ...member,
        invitedAt: member.invitedAt.toISOString(),
        addedAt: member.addedAt.toISOString(),
        lastAccessAt: null,
      })),
      tests: poolDetail.tests.map((test) => ({
        ...test,
        testedAt: test.testedAt.toISOString(),
      })),
      lastTestedAt: poolDetail.lastTestedAt?.toISOString() ?? null,
    });
    expect(poolCoreService.getPoolById).toHaveBeenCalledWith(id, currentUserId);
  });

  it('returns 404 when the pool is missing', async () => {
    vi.spyOn(poolCoreService, 'getPoolById').mockRejectedValue(new PoolNotFoundError('missing'));

    const id = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const response = await app.inject({ method: 'GET', url: `/pools/${id}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Pool not found' });
    expect(poolCoreService.getPoolById).toHaveBeenCalledWith(id, currentUserId);
  });

  it('returns 403 when the user is not a member of the pool', async () => {
    vi.spyOn(poolCoreService, 'getPoolById').mockRejectedValue(new PoolForbiddenError('nope'));

    const id = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const response = await app.inject({ method: 'GET', url: `/pools/${id}` });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    expect(poolCoreService.getPoolById).toHaveBeenCalledWith(id, currentUserId);
  });

  it('returns 403 when updating a pool without access', async () => {
    vi.spyOn(poolCoreService, 'updatePool').mockRejectedValue(new PoolOwnerRequiredError('nope'));

    const id = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const response = await app.inject({
      method: 'PATCH',
      url: `/pools/${id}`,
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    expect(poolCoreService.updatePool).toHaveBeenCalledWith(id, currentUserId, { name: 'Updated' });
  });

  it('returns 403 when creating a pool for another owner as a non-business user', async () => {
    const ownerId = 'aa2f15d7-70a8-4556-b01d-2dc8d105a92b';
    vi.spyOn(poolCoreService, 'createPool').mockRejectedValue(new PoolCreateOwnerForbiddenError());

    const response = await app.inject({
      method: 'POST',
      url: '/pools',
      payload: {
        ownerId,
        name: 'New Pool',
        volumeGallons: 15000,
        sanitizerType: 'chlorine',
        surfaceType: 'plaster',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    expect(poolCoreService.createPool).toHaveBeenCalledWith(
      currentUserId,
      expect.objectContaining({ ownerId }),
      undefined
    );
  });

  it('passes business role when creating a pool for another owner', async () => {
    currentUserRole = 'business';
    const ownerId = 'aa2f15d7-70a8-4556-b01d-2dc8d105a92b';
    const created = {
      poolId: '3d2e6167-2e16-483f-a4bf-8df770a11be8',
      ownerId,
      name: 'Owner Pool',
      volumeGallons: 20000,
      sanitizerType: 'chlorine',
      chlorineSource: 'manual',
      surfaceType: 'plaster',
      locationId: null,
    };
    vi.spyOn(poolCoreService, 'createPool').mockResolvedValue(created as any);

    const response = await app.inject({
      method: 'POST',
      url: '/pools',
      payload: {
        ownerId,
        name: 'Owner Pool',
        volumeGallons: 20000,
        sanitizerType: 'chlorine',
        surfaceType: 'plaster',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(created);
    expect(poolCoreService.createPool).toHaveBeenCalledWith(
      currentUserId,
      expect.objectContaining({ ownerId }),
      'business'
    );
  });

  it('returns 400 when pool location is invalid', async () => {
    const invalidLocationId = '4b9f9c10-1c1c-4aa3-a123-6df1b3e894d9';
    vi.spyOn(poolCoreService, 'createPool').mockRejectedValue(
      new PoolLocationAccessError(invalidLocationId)
    );

    const response = await app.inject({
      method: 'POST',
      url: '/pools',
      payload: {
        name: 'New Pool',
        volumeGallons: 15000,
        sanitizerType: 'chlorine',
        surfaceType: 'plaster',
        locationId: invalidLocationId,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'InvalidLocation',
      locationId: invalidLocationId,
      message: expect.stringContaining(invalidLocationId),
    });
  });

  it('returns 400 when salt target validation fails', async () => {
    vi.spyOn(poolCoreService, 'createPool').mockRejectedValue(
      new PoolValidationError(
        'Salt target ppm is required when chlorine source is SWG and must be a positive number.'
      )
    );

    const response = await app.inject({
      method: 'POST',
      url: '/pools',
      payload: {
        name: 'SWG Pool',
        volumeGallons: 18000,
        sanitizerType: 'chlorine',
        chlorineSource: 'swg',
        surfaceType: 'plaster',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'ValidationError',
      details: [
        {
          message: 'Salt target ppm is required when chlorine source is SWG and must be a positive number.',
        },
      ],
    });
  });

  it('gets and updates pool equipment', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const equipment = {
      poolId,
      equipmentId: '5bb8fda7-a38f-4628-a7f0-ab4be6d5a37d',
      equipmentType: 'heater',
      energySource: 'gas',
      status: 'enabled',
      capacityBtu: 180000,
      metadata: null,
      createdAt: new Date('2026-02-20T15:00:00.000Z'),
      updatedAt: new Date('2026-02-20T15:10:00.000Z'),
    };

    vi.spyOn(poolEquipmentService, 'getEquipment').mockResolvedValue(equipment as any);

    const getResponse = await app.inject({ method: 'GET', url: `/pools/${poolId}/equipment` });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual({
      ...equipment,
      createdAt: equipment.createdAt.toISOString(),
      updatedAt: equipment.updatedAt.toISOString(),
    });

    vi.spyOn(poolEquipmentService, 'upsertEquipment').mockResolvedValue({
      ...equipment,
      equipmentType: 'combo',
      energySource: 'heat_pump',
      status: 'enabled',
      capacityBtu: 120000,
    } as any);

    const putResponse = await app.inject({
      method: 'PUT',
      url: `/pools/${poolId}/equipment`,
      payload: {
        equipmentType: 'combo',
        energySource: 'heat_pump',
        status: 'enabled',
        capacityBtu: 120000,
      },
    });
    expect(putResponse.statusCode).toBe(200);
    expect(poolEquipmentService.upsertEquipment).toHaveBeenCalledWith(poolId, currentUserId, {
      equipmentType: 'combo',
      energySource: 'heat_pump',
      status: 'enabled',
      capacityBtu: 120000,
      metadata: null,
    });
  });

  it('gets and updates pool temperature preferences', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const prefs = {
      poolId,
      preferredTemp: 84,
      minTemp: 80,
      maxTemp: 88,
      unit: 'F',
      createdAt: new Date('2026-02-20T15:00:00.000Z'),
      updatedAt: new Date('2026-02-20T15:10:00.000Z'),
    };

    vi.spyOn(poolEquipmentService, 'getTemperaturePreferences').mockResolvedValue(prefs as any);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/pools/${poolId}/temperature-preferences`,
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual({
      ...prefs,
      createdAt: prefs.createdAt.toISOString(),
      updatedAt: prefs.updatedAt.toISOString(),
    });

    vi.spyOn(poolEquipmentService, 'upsertTemperaturePreferences').mockResolvedValue({
      ...prefs,
      preferredTemp: 29,
      minTemp: 26,
      maxTemp: 31,
      unit: 'C',
    } as any);

    const putResponse = await app.inject({
      method: 'PUT',
      url: `/pools/${poolId}/temperature-preferences`,
      payload: {
        preferredTemp: 29,
        minTemp: 26,
        maxTemp: 31,
        unit: 'C',
      },
    });
    expect(putResponse.statusCode).toBe(200);
    expect(poolEquipmentService.upsertTemperaturePreferences).toHaveBeenCalledWith(poolId, currentUserId, {
      preferredTemp: 29,
      minTemp: 26,
      maxTemp: 31,
      unit: 'C',
    });
  });

  it('lists pool sensor readings for authorized users', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const listSpy = vi
      .spyOn(accountIntegrationsService, 'listPoolSensorReadings')
      .mockResolvedValue([
        {
          readingId: 1,
          poolId,
          metric: 'water_temp_f',
          value: '82.1000',
          unit: 'F',
          source: 'govee',
          recordedAt: new Date('2026-02-22T10:00:00.000Z'),
        },
      ] as any);

    const response = await app.inject({
      method: 'GET',
      url: `/pools/${poolId}/sensors/readings?limit=25`,
    });
    expect(response.statusCode).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(poolId, currentUserId, 25);
    expect(response.json().items).toHaveLength(1);
  });
});
