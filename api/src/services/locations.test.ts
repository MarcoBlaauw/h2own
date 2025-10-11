import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationsService, LocationTransferTargetError } from './locations.js';
import * as schema from '../db/schema/index.js';

describe('LocationsService', () => {
  let selectSpy: ReturnType<typeof vi.fn>;
  let insertSpy: ReturnType<typeof vi.fn>;
  let updateSpy: ReturnType<typeof vi.fn>;
  let service: LocationsService;

  beforeEach(() => {
    selectSpy = vi.fn();
    insertSpy = vi.fn();
    updateSpy = vi.fn();

    const mockDb = {
      select: selectSpy,
      insert: insertSpy,
      update: updateSpy,
    } as unknown as typeof import('../db/index.js')['db'];

    service = new LocationsService(mockDb);
  });

  it('lists locations with numeric coordinates and pools', async () => {
    const createdAt = new Date('2024-03-01T12:00:00.000Z');

    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.userLocations);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return Promise.resolve([
                {
                  locationId: 'loc-1',
                  userId: 'user-1',
                  name: 'Home Pool',
                  latitude: '33.12345678',
                  longitude: '-84.98765432',
                  timezone: 'America/New_York',
                  isPrimary: true,
                  isActive: true,
                  createdAt,
                  userEmail: 'owner@example.com',
                  userName: 'Owner One',
                },
              ]);
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return Promise.resolve([
                { poolId: 'pool-1', name: 'Lap Pool', locationId: 'loc-1' },
              ]);
            },
          };
        },
      }));

    const locations = await service.listLocations();

    expect(locations).toEqual([
      {
        locationId: 'loc-1',
        userId: 'user-1',
        name: 'Home Pool',
        latitude: 33.12345678,
        longitude: -84.98765432,
        timezone: 'America/New_York',
        isPrimary: true,
        isActive: true,
        createdAt,
        user: {
          userId: 'user-1',
          email: 'owner@example.com',
          name: 'Owner One',
        },
        pools: [{ poolId: 'pool-1', name: 'Lap Pool' }],
      },
    ]);
  });

  it('creates locations and returns hydrated detail', async () => {
    const createdAt = new Date('2024-03-05T00:00:00.000Z');
    let capturedInsert: any;

    insertSpy.mockImplementation((table: unknown) => {
      expect(table).toBe(schema.userLocations);
      return {
        values: (value: any) => {
          capturedInsert = value;
          return {
            returning: () => Promise.resolve([{ locationId: 'loc-123' }]),
          };
        },
      };
    });

    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.userLocations);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: (condition: unknown) => {
                  expect(condition).toBeDefined();
                  return {
                    limit: (count: number) => {
                      expect(count).toBe(1);
                      return Promise.resolve([
                        {
                          locationId: 'loc-123',
                          userId: 'user-42',
                          name: 'New Location',
                          latitude: '45.00000000',
                          longitude: null,
                          timezone: 'UTC',
                          isPrimary: true,
                          isActive: true,
                          createdAt,
                          userEmail: 'admin@example.com',
                          userName: 'Admin',
                        },
                      ]);
                    },
                  };
                },
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return Promise.resolve([]);
            },
          };
        },
      }));

    const detail = await service.createLocation({
      userId: 'user-42',
      name: 'New Location',
      latitude: 45,
      timezone: 'UTC',
      isPrimary: true,
    });

    expect(capturedInsert).toMatchObject({
      userId: 'user-42',
      name: 'New Location',
      latitude: '45',
      timezone: 'UTC',
      isPrimary: true,
      isActive: true,
    });
    expect(detail).toEqual({
      locationId: 'loc-123',
      userId: 'user-42',
      name: 'New Location',
      latitude: 45,
      longitude: null,
      timezone: 'UTC',
      isPrimary: true,
      isActive: true,
      createdAt,
      user: {
        userId: 'user-42',
        email: 'admin@example.com',
        name: 'Admin',
      },
      pools: [],
    });
  });

  it('updates metadata and pool assignments', async () => {
    const createdAt = new Date('2024-04-01T00:00:00.000Z');
    let capturedLocationUpdate: any;
    const poolUpdates: any[] = [];

    updateSpy.mockImplementation((table: unknown) => {
      if (table === schema.userLocations) {
        return {
          set: (value: any) => {
            capturedLocationUpdate = value;
            return {
              where: (condition: unknown) => {
                expect(condition).toBeDefined();
                return {
                  returning: () => Promise.resolve([{ locationId: 'loc-777' }]),
                };
              },
            };
          },
        };
      }

      if (table === schema.pools) {
        return {
          set: (value: any) => {
            poolUpdates.push(value);
            return {
              where: (condition: unknown) => {
                expect(condition).toBeDefined();
                return Promise.resolve([]);
              },
            };
          },
        };
      }

      throw new Error('Unexpected table update');
    });

    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.userLocations);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: (condition: unknown) => {
                  expect(condition).toBeDefined();
                  return {
                    limit: (count: number) => {
                      expect(count).toBe(1);
                      return Promise.resolve([
                        {
                          locationId: 'loc-777',
                          userId: 'user-777',
                          name: 'Updated',
                          latitude: '-33.50000000',
                          longitude: '151.20000000',
                          timezone: 'Australia/Sydney',
                          isPrimary: true,
                          isActive: true,
                          createdAt,
                          userEmail: 'owner@pool.io',
                          userName: 'Pool Owner',
                        },
                      ]);
                    },
                  };
                },
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return Promise.resolve([
                { poolId: 'pool-a', name: 'A Pool' },
                { poolId: 'pool-b', name: 'B Pool' },
              ]);
            },
          };
        },
      }));

    const detail = await service.updateLocation('loc-777', {
      userId: 'user-777',
      name: 'Updated',
      latitude: -33.5,
      longitude: 151.2,
      timezone: 'Australia/Sydney',
      isPrimary: true,
      assignPools: ['pool-a'],
      unassignPools: ['pool-x'],
    });

    expect(capturedLocationUpdate).toMatchObject({
      userId: 'user-777',
      name: 'Updated',
      latitude: '-33.5',
      longitude: '151.2',
      timezone: 'Australia/Sydney',
      isPrimary: true,
    });
    expect(poolUpdates).toEqual([
      { locationId: 'loc-777' },
      { locationId: null },
    ]);
    expect(detail?.pools).toEqual([
      { poolId: 'pool-a', name: 'A Pool' },
      { poolId: 'pool-b', name: 'B Pool' },
    ]);
    expect(detail?.latitude).toBeCloseTo(-33.5);
    expect(detail?.longitude).toBeCloseTo(151.2);
  });

  it('deactivates locations and optionally transfers pools', async () => {
    const createdAt = new Date('2024-05-01T00:00:00.000Z');
    const locationUpdates: any[] = [];
    const poolUpdates: any[] = [];

    updateSpy.mockImplementation((table: unknown) => {
      if (table === schema.userLocations) {
        return {
          set: (value: any) => {
            locationUpdates.push(value);
            return {
              where: (condition: unknown) => {
                expect(condition).toBeDefined();
                return {
                  returning: () => Promise.resolve([{ locationId: 'loc-dead' }]),
                };
              },
            };
          },
        };
      }

      if (table === schema.pools) {
        return {
          set: (value: any) => {
            poolUpdates.push(value);
            return {
              where: (condition: unknown) => {
                expect(condition).toBeDefined();
                return Promise.resolve([]);
              },
            };
          },
        };
      }

      throw new Error('Unexpected table update');
    });

    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.userLocations);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return {
                limit: (count: number) => {
                  expect(count).toBe(1);
                  return Promise.resolve([
                    { locationId: 'loc-target', isActive: true },
                  ]);
                },
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.userLocations);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: (condition: unknown) => {
                  expect(condition).toBeDefined();
                  return {
                    limit: (count: number) => {
                      expect(count).toBe(1);
                      return Promise.resolve([
                        {
                          locationId: 'loc-dead',
                          userId: 'user-9',
                          name: 'Closed Location',
                          latitude: null,
                          longitude: null,
                          timezone: null,
                          isPrimary: false,
                          isActive: false,
                          createdAt,
                          userEmail: 'user@closed.com',
                          userName: 'Closed User',
                        },
                      ]);
                    },
                  };
                },
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return Promise.resolve([]);
            },
          };
        },
      }));

    const detail = await service.deactivateLocation('loc-dead', {
      transferPoolsTo: 'loc-target',
    });

    expect(locationUpdates).toEqual([{ isActive: false, isPrimary: false }]);
    expect(poolUpdates).toEqual([{ locationId: 'loc-target' }]);
    expect(detail?.isActive).toBe(false);
  });

  it('throws when transferring pools to an inactive target', async () => {
    updateSpy.mockImplementation((table: unknown) => {
      if (table === schema.userLocations) {
        return {
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([{ locationId: 'loc-off' }]),
            }),
          }),
        };
      }

      if (table === schema.pools) {
        return {
          set: () => ({
            where: () => Promise.resolve([]),
          }),
        };
      }

      throw new Error('Unexpected table update');
    });

    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.userLocations);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return {
                limit: (count: number) => {
                  expect(count).toBe(1);
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      }));

    await expect(
      service.deactivateLocation('loc-off', { transferPoolsTo: 'missing' })
    ).rejects.toBeInstanceOf(LocationTransferTargetError);
  });
});
