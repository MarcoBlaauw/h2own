import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { poolsRoutes } from './pools.js';
import {
  poolsService,
  PoolForbiddenError,
  PoolNotFoundError,
  PoolLocationAccessError,
} from '../services/pools.js';

describe('GET /pools/:poolId integration', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId };
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
      sanitizerType: 'salt',
      saltLevelPpm: 3200,
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

    vi.spyOn(poolsService, 'getPoolById').mockResolvedValue(poolDetail as any);

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
        lastAccessAt: member.lastAccessAt ? member.lastAccessAt.toISOString() : null,
      })),
      tests: poolDetail.tests.map((test) => ({
        ...test,
        testedAt: test.testedAt.toISOString(),
      })),
      lastTestedAt: poolDetail.lastTestedAt?.toISOString() ?? null,
    });
    expect(poolsService.getPoolById).toHaveBeenCalledWith(id, currentUserId);
  });

  it('returns 404 when the pool is missing', async () => {
    vi.spyOn(poolsService, 'getPoolById').mockRejectedValue(new PoolNotFoundError('missing'));

    const id = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const response = await app.inject({ method: 'GET', url: `/pools/${id}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Pool not found' });
    expect(poolsService.getPoolById).toHaveBeenCalledWith(id, currentUserId);
  });

  it('returns 403 when the user is not a member of the pool', async () => {
    vi.spyOn(poolsService, 'getPoolById').mockRejectedValue(new PoolForbiddenError('nope'));

    const id = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const response = await app.inject({ method: 'GET', url: `/pools/${id}` });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    expect(poolsService.getPoolById).toHaveBeenCalledWith(id, currentUserId);
  });

  it('returns 403 when updating a pool without access', async () => {
    vi.spyOn(poolsService, 'updatePool').mockRejectedValue(new PoolForbiddenError('nope'));

    const id = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const response = await app.inject({
      method: 'PATCH',
      url: `/pools/${id}`,
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    expect(poolsService.updatePool).toHaveBeenCalledWith(id, currentUserId, { name: 'Updated' });
  });

  it('returns 400 when pool location is invalid', async () => {
    const invalidLocationId = '4b9f9c10-1c1c-4aa3-a123-6df1b3e894d9';
    vi.spyOn(poolsService, 'createPool').mockRejectedValue(
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
});
