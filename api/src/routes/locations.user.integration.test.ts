import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { locationsRoutes } from './locations.js';
import { locationsService } from '../services/locations.js';

describe('User locations routes', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: 'member' };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(locationsRoutes, { prefix: '/locations' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists locations for the current user', async () => {
    vi.spyOn(locationsService, 'listLocationsForUser').mockResolvedValue([
      {
        locationId: '02d8ec67-6a91-4e2d-9a4c-e0cd813c6b9c',
        userId: currentUserId,
        name: 'Home',
        latitude: 34.1,
        longitude: -118.2,
        timezone: 'America/Los_Angeles',
        isPrimary: true,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        user: null,
        pools: [],
      },
    ] as any);

    const response = await app.inject({
      method: 'GET',
      url: '/locations',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()[0].name).toBe('Home');
    expect(locationsService.listLocationsForUser).toHaveBeenCalledWith(currentUserId);
  });

  it('creates a location for the current user', async () => {
    const created = {
      locationId: '02d8ec67-6a91-4e2d-9a4c-e0cd813c6b9c',
      userId: currentUserId,
      name: 'Home',
      latitude: 34.1,
      longitude: -118.2,
      timezone: 'America/Los_Angeles',
      isPrimary: true,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      user: null,
      pools: [],
    };

    vi.spyOn(locationsService, 'createLocation').mockResolvedValue(created as any);

    const response = await app.inject({
      method: 'POST',
      url: '/locations',
      payload: {
        name: 'Home',
        latitude: 34.1,
        longitude: -118.2,
        timezone: 'America/Los_Angeles',
        isPrimary: true,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      locationId: created.locationId,
      name: 'Home',
    });
    expect(locationsService.createLocation).toHaveBeenCalledWith({
      userId: currentUserId,
      name: 'Home',
      latitude: 34.1,
      longitude: -118.2,
      timezone: 'America/Los_Angeles',
      isPrimary: true,
    });
  });
});
