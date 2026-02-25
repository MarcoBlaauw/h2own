import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminLocationsRoutes } from './admin-locations.js';
import { locationsService, LocationTransferTargetError } from '../services/locations.js';

describe('admin locations routes', () => {
  let app: ReturnType<typeof Fastify>;
  let verifySessionMock: ReturnType<typeof vi.fn>;
  let requireRoleMock: ReturnType<typeof vi.fn>;
  let roleHandlers: Array<ReturnType<typeof vi.fn>>;
  let listLocationsSpy: any;
  let createLocationSpy: any;
  let updateLocationSpy: any;
  let deactivateLocationSpy: any;
  const currentUserId = 'aa1208ab-1cda-4a0c-9f12-9b8a5717e4c9';
  const baseLocationId = '5e4f2a8c-6c41-4c60-b3f6-bb34a91d9c1a';
  const secondaryLocationId = '7d3d4432-5d3f-4c02-8c24-3edb6249d6c7';
  const tertiaryLocationId = '9878e21d-54b5-4a62-93ba-964a23ea1c91';

  beforeEach(async () => {
    app = Fastify();
    roleHandlers = [];

    verifySessionMock = vi.fn(async (req: any) => {
      req.user = { id: currentUserId, role: 'admin' };
    });

    requireRoleMock = vi.fn((role: string) => {
      const handler = vi.fn(async (req: any, reply: any) => {
        if (req.user?.role !== role) {
          return reply.code(403).send({ error: 'Forbidden' });
        }
      });
      roleHandlers.push(handler);
      return handler;
    });

    app.decorate('auth', {
      verifySession: verifySessionMock,
      requireRole: requireRoleMock,
    } as any);

    await app.register(adminLocationsRoutes, { prefix: '/locations' });
    await app.ready();

    listLocationsSpy = vi.spyOn(locationsService, 'listLocations');
    createLocationSpy = vi.spyOn(locationsService, 'createLocation');
    updateLocationSpy = vi.spyOn(locationsService, 'updateLocation');
    deactivateLocationSpy = vi.spyOn(locationsService, 'deactivateLocation');
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists locations for admins', async () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    listLocationsSpy.mockResolvedValue([
      {
        locationId: baseLocationId,
        userId: '5b7ff8ab-9ae5-4763-9e9f-e74a64dbe4b6',
        name: 'Primary Home',
        latitude: 33.12,
        longitude: -84.98,
        timezone: 'America/New_York',
        isPrimary: true,
        isActive: true,
        createdAt,
        user: {
          userId: '5b7ff8ab-9ae5-4763-9e9f-e74a64dbe4b6',
          email: 'owner@example.com',
          name: 'Owner One',
        },
        pools: [
          {
            poolId: '2c59c4d6-2a9f-4d6b-9ab1-5f3ea32d7f3e',
            name: 'Backyard',
          },
        ],
      },
    ] as any);

    const response = await app.inject({ method: 'GET', url: '/locations' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        locationId: baseLocationId,
        userId: '5b7ff8ab-9ae5-4763-9e9f-e74a64dbe4b6',
        name: 'Primary Home',
        latitude: 33.12,
        longitude: -84.98,
        timezone: 'America/New_York',
        isPrimary: true,
        isActive: true,
        createdAt: createdAt.toISOString(),
        user: {
          userId: '5b7ff8ab-9ae5-4763-9e9f-e74a64dbe4b6',
          email: 'owner@example.com',
          name: 'Owner One',
        },
        pools: [
          {
            poolId: '2c59c4d6-2a9f-4d6b-9ab1-5f3ea32d7f3e',
            name: 'Backyard',
          },
        ],
      },
    ]);
    expect(verifySessionMock).toHaveBeenCalled();
    expect(requireRoleMock).toHaveBeenCalledWith('admin');
  });

  it('creates a new location', async () => {
    const createdAt = new Date('2024-02-02T00:00:00.000Z');
    createLocationSpy.mockResolvedValue({
      locationId: secondaryLocationId,
      userId: '3f041641-0d3d-4cbb-93b0-5eaa1b361f33',
      name: 'Secondary',
      latitude: 40,
      longitude: -70,
      timezone: 'America/Chicago',
      isPrimary: false,
      isActive: true,
      createdAt,
      user: {
        userId: '3f041641-0d3d-4cbb-93b0-5eaa1b361f33',
        email: 'member@example.com',
        name: 'Member',
      },
      pools: [],
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/locations',
      payload: {
        userId: '3f041641-0d3d-4cbb-93b0-5eaa1b361f33',
        name: 'Secondary',
        latitude: 40,
        longitude: -70,
        timezone: 'America/Chicago',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      locationId: secondaryLocationId,
      userId: '3f041641-0d3d-4cbb-93b0-5eaa1b361f33',
      name: 'Secondary',
      latitude: 40,
      longitude: -70,
      timezone: 'America/Chicago',
      isPrimary: false,
      isActive: true,
      createdAt: createdAt.toISOString(),
      user: {
        userId: '3f041641-0d3d-4cbb-93b0-5eaa1b361f33',
        email: 'member@example.com',
        name: 'Member',
      },
      pools: [],
    });
  });

  it('validates create payloads', async () => {
    const response = await app.inject({ method: 'POST', url: '/locations', payload: {} });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('ValidationError');
    expect(createLocationSpy).not.toHaveBeenCalled();
  });

  it('updates location metadata', async () => {
    const createdAt = new Date('2024-03-03T00:00:00.000Z');
    updateLocationSpy.mockResolvedValue({
      locationId: tertiaryLocationId,
      userId: 'f3fd8b28-6641-4a59-9c1b-7127346f0e71',
      name: 'Updated Location',
      latitude: 12,
      longitude: 20,
      timezone: 'UTC',
      isPrimary: true,
      isActive: true,
      createdAt,
      user: {
        userId: 'f3fd8b28-6641-4a59-9c1b-7127346f0e71',
        email: 'updated@example.com',
        name: 'Updater',
      },
      pools: [
        {
          poolId: '4ae2d986-668d-4ec4-b104-ef5d9a881644',
          name: 'Club',
        },
      ],
    } as any);

    const response = await app.inject({
      method: 'PATCH',
      url: `/locations/${tertiaryLocationId}`,
      payload: {
        name: 'Updated Location',
        assignPools: ['4ae2d986-668d-4ec4-b104-ef5d9a881644'],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe('Updated Location');
    expect(response.json().createdAt).toBe(createdAt.toISOString());
    expect(updateLocationSpy).toHaveBeenCalledWith(tertiaryLocationId, {
      name: 'Updated Location',
      assignPools: ['4ae2d986-668d-4ec4-b104-ef5d9a881644'],
    });
  });

  it('returns 404 when updating a missing location', async () => {
    updateLocationSpy.mockResolvedValue(null as any);

    const response = await app.inject({
      method: 'PATCH',
      url: `/locations/${baseLocationId}`,
      payload: { name: 'Missing' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'NotFound' });
  });

  it('deactivates locations and handles transfers', async () => {
    const createdAt = new Date('2024-04-04T00:00:00.000Z');
    deactivateLocationSpy.mockResolvedValue({
      locationId: baseLocationId,
      userId: '5b7ff8ab-9ae5-4763-9e9f-e74a64dbe4b6',
      name: 'Old Location',
      latitude: null,
      longitude: null,
      timezone: null,
      isPrimary: false,
      isActive: false,
      createdAt,
      user: {
        userId: '5b7ff8ab-9ae5-4763-9e9f-e74a64dbe4b6',
        email: 'user4@example.com',
        name: 'User Four',
      },
      pools: [],
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: `/locations/${baseLocationId}/deactivate`,
      payload: { transferPoolsTo: secondaryLocationId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().isActive).toBe(false);
    expect(deactivateLocationSpy).toHaveBeenCalledWith(baseLocationId, {
      transferPoolsTo: secondaryLocationId,
    });
  });

  it('returns validation errors when transfer target invalid', async () => {
    const inactiveTarget = '11111111-1111-1111-1111-111111111111';
    deactivateLocationSpy.mockRejectedValue(new LocationTransferTargetError(inactiveTarget));

    const response = await app.inject({
      method: 'POST',
      url: `/locations/${secondaryLocationId}/deactivate`,
      payload: { transferPoolsTo: inactiveTarget },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'InvalidTransferTarget',
      message: expect.stringContaining(inactiveTarget),
      target: inactiveTarget,
    });
  });
});
