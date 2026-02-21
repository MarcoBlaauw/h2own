import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminPoolsRoutes } from './admin-pools.js';
import { poolAdminService, poolCoreService, poolEquipmentService } from '../services/pools/index.js';

vi.mock('../services/pools/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    poolAdminService: {
      ...actual.poolAdminService,
      listAllPools: vi.fn(),
      forceUpdatePool: vi.fn(),
      transferOwnership: vi.fn(),
    },
    poolEquipmentService: {
      ...actual.poolEquipmentService,
      getEquipmentAsAdmin: vi.fn(),
      upsertEquipmentAsAdmin: vi.fn(),
      getTemperaturePreferencesAsAdmin: vi.fn(),
      upsertTemperaturePreferencesAsAdmin: vi.fn(),
    },
    poolCoreService: {
      ...actual.poolCoreService,
      getPoolById: vi.fn(),
    },
  };
});

describe('admin pools routes', () => {
  const mockedAdminService = poolAdminService as unknown as {
    listAllPools: ReturnType<typeof vi.fn>;
    forceUpdatePool: ReturnType<typeof vi.fn>;
    transferOwnership: ReturnType<typeof vi.fn>;
  };

  const mockedCoreService = poolCoreService as unknown as {
    getPoolById: ReturnType<typeof vi.fn>;
  };
  const mockedEquipmentService = poolEquipmentService as unknown as {
    getEquipmentAsAdmin: ReturnType<typeof vi.fn>;
    upsertEquipmentAsAdmin: ReturnType<typeof vi.fn>;
    getTemperaturePreferencesAsAdmin: ReturnType<typeof vi.fn>;
    upsertTemperaturePreferencesAsAdmin: ReturnType<typeof vi.fn>;
  };

  const listAllPoolsMock = mockedAdminService.listAllPools as ReturnType<typeof vi.fn>;
  const getPoolByIdMock = mockedCoreService.getPoolById as ReturnType<typeof vi.fn>;
  const forceUpdatePoolMock = mockedAdminService.forceUpdatePool as ReturnType<typeof vi.fn>;
  const transferOwnershipMock = mockedAdminService.transferOwnership as ReturnType<typeof vi.fn>;
  const getEquipmentAsAdminMock = mockedEquipmentService.getEquipmentAsAdmin as ReturnType<typeof vi.fn>;
  const upsertEquipmentAsAdminMock = mockedEquipmentService.upsertEquipmentAsAdmin as ReturnType<typeof vi.fn>;
  const getTemperaturePreferencesAsAdminMock =
    mockedEquipmentService.getTemperaturePreferencesAsAdmin as ReturnType<typeof vi.fn>;
  const upsertTemperaturePreferencesAsAdminMock =
    mockedEquipmentService.upsertTemperaturePreferencesAsAdmin as ReturnType<typeof vi.fn>;

  let app: ReturnType<typeof Fastify>;
  let requireRoleMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    app = Fastify();
    requireRoleMock = vi.fn(() => async () => {});

    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: 'admin-user', role: 'admin' };
      }),
      requireRole: requireRoleMock,
    } as any);

    await app.register(adminPoolsRoutes, { prefix: '/admin/pools' });
    await app.ready();

    listAllPoolsMock.mockReset();
    getPoolByIdMock.mockReset();
    forceUpdatePoolMock.mockReset();
    transferOwnershipMock.mockReset();
    getEquipmentAsAdminMock.mockReset();
    upsertEquipmentAsAdminMock.mockReset();
    getTemperaturePreferencesAsAdminMock.mockReset();
    upsertTemperaturePreferencesAsAdminMock.mockReset();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('lists all pools for admins with serialized timestamps', async () => {
    const createdAt = new Date('2024-04-01T00:00:00.000Z');
    const updatedAt = new Date('2024-04-02T00:00:00.000Z');
    const lastTestedAt = new Date('2024-04-03T00:00:00.000Z');

    listAllPoolsMock.mockResolvedValueOnce([
      {
        id: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
        ownerId: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
        name: 'Admin Pool',
        volumeGallons: 15000,
        surfaceType: 'plaster',
        sanitizerType: 'chlorine',
        isActive: true,
        createdAt,
        updatedAt,
        owner: {
          id: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
          email: 'owner@example.com',
          name: 'Owner',
        },
        memberCount: 3,
        lastTestedAt,
        members: [
          {
            poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
            userId: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
            roleName: 'owner',
            email: 'owner@example.com',
            name: 'Owner',
          },
        ],
      },
    ]);

    const response = await app.inject({ method: 'GET', url: '/admin/pools' });

    expect(response.statusCode).toBe(200);
    expect(requireRoleMock).toHaveBeenCalledWith('admin');
    expect(response.json()).toEqual([
      {
        id: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
        ownerId: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
        name: 'Admin Pool',
        volumeGallons: 15000,
        surfaceType: 'plaster',
        sanitizerType: 'chlorine',
        isActive: true,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        owner: {
          id: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
          email: 'owner@example.com',
          name: 'Owner',
        },
        memberCount: 3,
        lastTestedAt: lastTestedAt.toISOString(),
        members: [
          {
            poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
            userId: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
            roleName: 'owner',
            email: 'owner@example.com',
            name: 'Owner',
          },
        ],
      },
    ]);
  });

  it('returns detailed pool data for admins', async () => {
    const createdAt = new Date('2024-04-01T00:00:00.000Z');
    const updatedAt = new Date('2024-04-02T00:00:00.000Z');
    const invitedAt = new Date('2024-04-03T00:00:00.000Z');
    const addedAt = new Date('2024-04-04T00:00:00.000Z');
    const testedAt = new Date('2024-04-05T00:00:00.000Z');

    getPoolByIdMock.mockResolvedValueOnce({
      id: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
      ownerId: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
      locationId: null,
      name: 'Admin Pool',
      volumeGallons: 15000,
      surfaceType: 'plaster',
      sanitizerType: 'chlorine',
      saltLevelPpm: null,
      shadeLevel: null,
      enclosureType: null,
      hasCover: false,
      pumpGpm: null,
      filterType: null,
      hasHeater: null,
      isActive: true,
      createdAt,
      updatedAt,
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
          invitedAt,
          addedAt,
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
          id: 'session-1',
          testedAt,
          freeChlorine: 3,
          totalChlorine: 4,
          ph: 7.4,
          totalAlkalinity: 90,
          cyanuricAcid: 30,
          calciumHardness: 200,
          salt: 3200,
          waterTempF: 78,
          tester: {
            id: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
            email: 'owner@example.com',
            name: 'Owner',
          },
        },
      ],
      lastTestedAt: testedAt,
    });

    const response = await app.inject({ method: 'GET', url: '/admin/pools/0b75c93b-7ae5-4a08-9a69-8191355f2175' });

    expect(response.statusCode).toBe(200);
    expect(getPoolByIdMock).toHaveBeenCalledWith('0b75c93b-7ae5-4a08-9a69-8191355f2175', null, { asAdmin: true });
    expect(response.json()).toEqual({
      id: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
      ownerId: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
      locationId: null,
      name: 'Admin Pool',
      volumeGallons: 15000,
      surfaceType: 'plaster',
      sanitizerType: 'chlorine',
      saltLevelPpm: null,
      shadeLevel: null,
      enclosureType: null,
      hasCover: false,
      pumpGpm: null,
      filterType: null,
      hasHeater: null,
      isActive: true,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
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
          invitedAt: invitedAt.toISOString(),
          addedAt: addedAt.toISOString(),
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
          id: 'session-1',
          testedAt: testedAt.toISOString(),
          freeChlorine: 3,
          totalChlorine: 4,
          ph: 7.4,
          totalAlkalinity: 90,
          cyanuricAcid: 30,
          calciumHardness: 200,
          salt: 3200,
          waterTempF: 78,
          tester: {
            id: 'e2d1e52d-84f1-4a07-b71e-2dba6b6b8e90',
            email: 'owner@example.com',
            name: 'Owner',
          },
        },
      ],
      lastTestedAt: testedAt.toISOString(),
    });
  });

  it('updates pool metadata via admin override', async () => {
    forceUpdatePoolMock.mockResolvedValueOnce({
      poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
      name: 'Updated Pool',
      isActive: false,
    });

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/pools/0b75c93b-7ae5-4a08-9a69-8191355f2175',
      payload: { name: 'Updated Pool', isActive: false },
    });

    expect(response.statusCode).toBe(200);
    expect(forceUpdatePoolMock).toHaveBeenCalledWith('0b75c93b-7ae5-4a08-9a69-8191355f2175', {
      name: 'Updated Pool',
      isActive: false,
    });
    expect(response.json()).toEqual({
      poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
      name: 'Updated Pool',
      isActive: false,
    });
  });

  it('transfers ownership between members as admin', async () => {
    transferOwnershipMock.mockResolvedValueOnce({
      poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175',
      ownerId: '4c9fbc44-1f4c-4ec1-9f5d-0a1c2b3d4e5f',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/admin/pools/0b75c93b-7ae5-4a08-9a69-8191355f2175/transfer',
      payload: { newOwnerId: '4c9fbc44-1f4c-4ec1-9f5d-0a1c2b3d4e5f' },
    });

    expect(response.statusCode).toBe(200);
    expect(transferOwnershipMock).toHaveBeenCalledWith('0b75c93b-7ae5-4a08-9a69-8191355f2175', '4c9fbc44-1f4c-4ec1-9f5d-0a1c2b3d4e5f');
    expect(response.json()).toEqual({ poolId: '0b75c93b-7ae5-4a08-9a69-8191355f2175', ownerId: '4c9fbc44-1f4c-4ec1-9f5d-0a1c2b3d4e5f' });
  });

  it('gets and updates equipment as admin', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const equipment = {
      poolId,
      equipmentId: 'd0846866-f4db-4fd4-b5cd-bfdb4fc8f153',
      equipmentType: 'heater',
      energySource: 'gas',
      status: 'enabled',
      capacityBtu: 150000,
      metadata: null,
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:10:00.000Z'),
    };
    getEquipmentAsAdminMock.mockResolvedValueOnce(equipment);

    const getResponse = await app.inject({ method: 'GET', url: `/admin/pools/${poolId}/equipment` });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual({
      ...equipment,
      createdAt: equipment.createdAt.toISOString(),
      updatedAt: equipment.updatedAt.toISOString(),
    });

    upsertEquipmentAsAdminMock.mockResolvedValueOnce({ ...equipment, equipmentType: 'combo' });
    const putResponse = await app.inject({
      method: 'PUT',
      url: `/admin/pools/${poolId}/equipment`,
      payload: { equipmentType: 'combo', energySource: 'heat_pump', status: 'enabled', capacityBtu: 120000 },
    });
    expect(putResponse.statusCode).toBe(200);
    expect(upsertEquipmentAsAdminMock).toHaveBeenCalledWith(poolId, {
      equipmentType: 'combo',
      energySource: 'heat_pump',
      status: 'enabled',
      capacityBtu: 120000,
      metadata: null,
    });
  });

  it('gets and updates temperature preferences as admin', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const prefs = {
      poolId,
      preferredTemp: 84,
      minTemp: 80,
      maxTemp: 88,
      unit: 'F',
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-02-20T00:10:00.000Z'),
    };
    getTemperaturePreferencesAsAdminMock.mockResolvedValueOnce(prefs);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/admin/pools/${poolId}/temperature-preferences`,
    });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toEqual({
      ...prefs,
      createdAt: prefs.createdAt.toISOString(),
      updatedAt: prefs.updatedAt.toISOString(),
    });

    upsertTemperaturePreferencesAsAdminMock.mockResolvedValueOnce({ ...prefs, unit: 'C' });
    const putResponse = await app.inject({
      method: 'PUT',
      url: `/admin/pools/${poolId}/temperature-preferences`,
      payload: { preferredTemp: 29, minTemp: 26, maxTemp: 31, unit: 'C' },
    });
    expect(putResponse.statusCode).toBe(200);
    expect(upsertTemperaturePreferencesAsAdminMock).toHaveBeenCalledWith(poolId, {
      preferredTemp: 29,
      minTemp: 26,
      maxTemp: 31,
      unit: 'C',
    });
  });
});
