import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PoolsService, type CreatePoolData, PoolLocationAccessError } from './pools.js';
import * as schema from '../db/schema/index.js';

describe('PoolsService', () => {
  const userId = 'user-1';
  let insertSpy: ReturnType<typeof vi.fn>;
  let updateSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;
  let capturedPoolInsert: any;
  let capturedMemberInsert: any;
  let capturedUpdate: any;
  let capturedTestInsert: any;
  let ensurePoolAccessMock: ReturnType<typeof vi.fn>;
  let transactionSpy: ReturnType<typeof vi.fn>;
  let service: PoolsService;

  beforeEach(() => {
    capturedPoolInsert = undefined;
    capturedMemberInsert = undefined;
    capturedUpdate = undefined;
    capturedTestInsert = undefined;

    insertSpy = vi.fn((table) => {
      if (table === schema.pools) {
        return {
          values: (value: any) => {
            capturedPoolInsert = value;
            return {
              returning: () => Promise.resolve([{ ...value, poolId: 'pool-123' }]),
            };
          },
        };
      }

      if (table === schema.poolMembers) {
        return {
          values: (value: any) => {
            capturedMemberInsert = value;
            return Promise.resolve([{ ...value }]);
          },
        };
      }

      if (table === schema.testSessions) {
        return {
          values: (value: any) => {
            capturedTestInsert = value;
            return {
              returning: () =>
                Promise.resolve([
                  {
                    ...value,
                    sessionId: 'session-1',
                  },
                ]),
            };
          },
        };
      }

      throw new Error('Unexpected table insert');
    });

    updateSpy = vi.fn(() => ({
      set: (value: any) => {
        capturedUpdate = value;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ poolId: 'pool-123', ...value }]),
          }),
        };
      },
    }));

    selectSpy = vi.fn();
    transactionSpy = vi.fn(async (callback: any) =>
      callback({
        insert: insertSpy,
        update: updateSpy,
        delete: vi.fn(),
        select: selectSpy,
      })
    );

    const mockDb = {
      insert: insertSpy,
      update: updateSpy,
      delete: vi.fn(),
      select: selectSpy,
      transaction: transactionSpy,
    } as unknown as typeof import('../db/index.js')['db'];

    service = new PoolsService(mockDb);
    ensurePoolAccessMock = vi.fn().mockResolvedValue({ poolId: 'pool-123', ownerId: userId });
    (service as any).ensurePoolAccess = ensurePoolAccessMock;
  });

  it('maps create payloads to database column names', async () => {
    const payload: CreatePoolData = {
      name: 'Backyard Pool',
      volumeGallons: 15000,
      sanitizerType: 'chlorine',
      surfaceType: 'plaster',
      shadeLevel: 'partial',
      hasCover: true,
    };

    const pool = await service.createPool(userId, payload);

    expect(pool.poolId).toBe('pool-123');
    expect(capturedPoolInsert).toMatchObject({
      ownerId: userId,
      isActive: true,
      name: payload.name,
      volumeGallons: payload.volumeGallons,
      sanitizerType: payload.sanitizerType,
      surfaceType: payload.surfaceType,
      shadeLevel: payload.shadeLevel,
      hasCover: payload.hasCover,
    });
    expect(capturedPoolInsert).not.toHaveProperty('sanitizer');
    expect(capturedPoolInsert).not.toHaveProperty('surface');

    expect(capturedMemberInsert).toEqual({
      poolId: 'pool-123',
      userId,
      roleName: 'owner',
    });
  });

  it('validates location ownership when creating a pool', async () => {
    selectSpy.mockImplementationOnce(() => ({
      from: (table: unknown) => {
        expect(table).toBe(schema.userLocations);
        return {
          where: (condition: unknown) => {
            expect(condition).toBeDefined();
            return {
              limit: (count: number) => {
                expect(count).toBe(1);
                return Promise.resolve([{ userId, isActive: true }]);
              },
            };
          },
        };
      },
    }));

    const payload: CreatePoolData = {
      name: 'Club Pool',
      volumeGallons: 20000,
      sanitizerType: 'salt',
      surfaceType: 'fiberglass',
      locationId: 'loc-1',
    };

    await service.createPool(userId, payload);
    expect(selectSpy).toHaveBeenCalled();
  });

  it('throws when assigning an inaccessible location', async () => {
    selectSpy.mockImplementationOnce(() => ({
      from: (table: unknown) => {
        expect(table).toBe(schema.userLocations);
        return {
          where: () => ({
            limit: (count: number) => {
              expect(count).toBe(1);
              return Promise.resolve([]);
            },
          }),
        };
      },
    }));

    await expect(
      service.createPool(userId, {
        name: 'Club Pool',
        volumeGallons: 20000,
        sanitizerType: 'salt',
        surfaceType: 'fiberglass',
        locationId: 'loc-1',
      })
    ).rejects.toBeInstanceOf(PoolLocationAccessError);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('maps update payloads to database column names', async () => {
    const pool = await service.updatePool('pool-123', userId, {
      sanitizerType: 'bromine',
      surfaceType: 'fiberglass',
    });

    expect(pool).toMatchObject({
      poolId: 'pool-123',
      sanitizerType: 'bromine',
      surfaceType: 'fiberglass',
    });
    expect(capturedUpdate).toEqual({
      sanitizerType: 'bromine',
      surfaceType: 'fiberglass',
    });
    expect(capturedUpdate).not.toHaveProperty('sanitizer');
    expect(capturedUpdate).not.toHaveProperty('surface');
    expect(ensurePoolAccessMock).toHaveBeenCalledWith('pool-123', userId);
  });

  it('validates location when updating a pool', async () => {
    selectSpy.mockImplementationOnce(() => ({
      from: (table: unknown) => {
        expect(table).toBe(schema.userLocations);
        return {
          where: () => ({
            limit: (count: number) => {
              expect(count).toBe(1);
              return Promise.resolve([{ userId, isActive: true }]);
            },
          }),
        };
      },
    }));

    await service.updatePool('pool-123', userId, { locationId: 'loc-2' });
    expect(selectSpy).toHaveBeenCalled();
  });

  it('throws when updating with an inaccessible location', async () => {
    selectSpy.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: (count: number) => {
            expect(count).toBe(1);
            return Promise.resolve([]);
          },
        }),
      }),
    }));

    await expect(
      service.updatePool('pool-123', userId, { locationId: 'loc-9' })
    ).rejects.toBeInstanceOf(PoolLocationAccessError);
  });

  it('returns pools for memberships', async () => {
    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.poolMembers);
          return {
            where: () =>
              Promise.resolve([
                { poolId: 'pool-1', userId },
                { poolId: 'pool-2', userId },
              ]),
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            where: () =>
              Promise.resolve([
                { poolId: 'pool-1', name: 'Pool 1' },
                { poolId: 'pool-2', name: 'Pool 2' },
              ]),
          };
        },
      }));

    const pools = await service.getPools(userId);

    expect(pools).toEqual([
      { poolId: 'pool-1', name: 'Pool 1' },
      { poolId: 'pool-2', name: 'Pool 2' },
    ]);
    expect(selectSpy).toHaveBeenCalledTimes(2);
  });

  it('returns pool detail with nested owner, members, and tests', async () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const updatedAt = new Date('2024-01-02T00:00:00.000Z');
    const invitedAt = new Date('2024-01-03T00:00:00.000Z');
    const addedAt = new Date('2024-01-04T00:00:00.000Z');
    const testedAt = new Date('2024-01-05T00:00:00.000Z');

    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: () =>
                  Promise.resolve([
                    {
                      poolId: 'pool-123',
                      ownerId: 'user-1',
                      locationId: null,
                      name: 'Backyard Pool',
                      volumeGallons: 15000,
                      surfaceType: 'plaster',
                      sanitizerType: 'chlorine',
                      saltLevelPpm: 3200,
                      shadeLevel: 'partial',
                      enclosureType: null,
                      hasCover: true,
                      pumpGpm: 40,
                      filterType: 'sand',
                      hasHeater: false,
                      isActive: true,
                      createdAt,
                      updatedAt,
                      ownerUserId: 'user-1',
                      ownerEmail: 'owner@example.com',
                      ownerName: 'Owner One',
                    },
                  ]),
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.poolMembers);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: () => ({
                  orderBy: (orderArg: unknown) => {
                    expect(orderArg).toBeTruthy();
                    return Promise.resolve([
                      {
                        poolId: 'pool-123',
                        userId: 'user-1',
                        roleName: 'owner',
                        permissions: null,
                        invitedBy: null,
                        invitedAt,
                        addedAt,
                        lastAccessAt: null,
                        memberEmail: 'owner@example.com',
                        memberName: 'Owner One',
                      },
                      {
                        poolId: 'pool-123',
                        userId: 'user-2',
                        roleName: 'member',
                        permissions: null,
                        invitedBy: 'user-1',
                        invitedAt,
                        addedAt,
                        lastAccessAt: null,
                        memberEmail: 'friend@example.com',
                        memberName: 'Friend',
                      },
                    ]);
                  },
                }),
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.testSessions);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: () => ({
                  orderBy: (...orderArgs: unknown[]) => {
                    expect(orderArgs).toHaveLength(1);
                    return {
                      limit: (limitValue: number) => {
                        expect(limitValue).toBe(10);
                        return Promise.resolve([
                          {
                            sessionId: 'session-1',
                            testedAt,
                            testedBy: 'user-1',
                            freeChlorinePpm: '3',
                            totalChlorinePpm: '4',
                            phLevel: '7.5',
                            totalAlkalinityPpm: 90,
                            cyanuricAcidPpm: 30,
                            calciumHardnessPpm: 200,
                            saltPpm: 3200,
                            waterTempF: 78,
                            testerId: 'user-1',
                            testerEmail: 'owner@example.com',
                            testerName: 'Owner One',
                          },
                        ]);
                      },
                    };
                  },
                }),
              };
            },
          };
        },
      }));

    const detail = await service.getPoolById('pool-123', userId);

    expect(detail).toEqual({
      id: 'pool-123',
      ownerId: 'user-1',
      locationId: null,
      name: 'Backyard Pool',
      volumeGallons: 15000,
      surfaceType: 'plaster',
      sanitizerType: 'chlorine',
      saltLevelPpm: 3200,
      shadeLevel: 'partial',
      enclosureType: null,
      hasCover: true,
      pumpGpm: 40,
      filterType: 'sand',
      hasHeater: false,
      isActive: true,
      createdAt,
      updatedAt,
      owner: {
        id: 'user-1',
        email: 'owner@example.com',
        name: 'Owner One',
      },
      members: [
        {
          poolId: 'pool-123',
          userId: 'user-1',
          roleName: 'owner',
          permissions: null,
          invitedBy: null,
          invitedAt,
          addedAt,
          lastAccessAt: null,
          user: {
            id: 'user-1',
            email: 'owner@example.com',
            name: 'Owner One',
          },
        },
        {
          poolId: 'pool-123',
          userId: 'user-2',
          roleName: 'member',
          permissions: null,
          invitedBy: 'user-1',
          invitedAt,
          addedAt,
          lastAccessAt: null,
          user: {
            id: 'user-2',
            email: 'friend@example.com',
            name: 'Friend',
          },
        },
      ],
      tests: [
        {
          id: 'session-1',
          testedAt,
          freeChlorine: 3,
          totalChlorine: 4,
          ph: 7.5,
          totalAlkalinity: 90,
          cyanuricAcid: 30,
          calciumHardness: 200,
          salt: 3200,
          waterTempF: 78,
          tester: {
            id: 'user-1',
            email: 'owner@example.com',
            name: 'Owner One',
          },
        },
      ],
      lastTestedAt: testedAt,
    });
    expect(ensurePoolAccessMock).toHaveBeenCalledWith('pool-123', userId);
  });

  it('allows admins to bypass membership checks when fetching pool detail', async () => {
    const createdAt = new Date('2024-02-01T00:00:00.000Z');
    const updatedAt = new Date('2024-02-02T00:00:00.000Z');
    const invitedAt = new Date('2024-02-03T00:00:00.000Z');
    const addedAt = new Date('2024-02-04T00:00:00.000Z');
    const testedAt = new Date('2024-02-05T00:00:00.000Z');

    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return {
                limit: (value: number) => {
                  expect(value).toBe(1);
                  return Promise.resolve([{ poolId: 'pool-123' }]);
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
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: () =>
                  Promise.resolve([
                    {
                      poolId: 'pool-123',
                      ownerId: 'admin-owner',
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
                      createdAt,
                      updatedAt,
                      ownerUserId: 'admin-owner',
                      ownerEmail: 'owner@example.com',
                      ownerName: 'Owner Admin',
                    },
                  ]),
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.poolMembers);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: () => ({
                  orderBy: () =>
                    Promise.resolve([
                      {
                        poolId: 'pool-123',
                        userId: 'admin-owner',
                        roleName: 'owner',
                        permissions: null,
                        invitedBy: null,
                        invitedAt,
                        addedAt,
                        lastAccessAt: null,
                        memberEmail: 'owner@example.com',
                        memberName: 'Owner Admin',
                      },
                    ]),
                }),
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.testSessions);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: () => ({
                  orderBy: () => ({
                    limit: (limitValue: number) => {
                      expect(limitValue).toBe(10);
                      return Promise.resolve([
                        {
                          sessionId: 'session-2',
                          testedAt,
                          testedBy: 'admin-owner',
                          freeChlorinePpm: '2',
                          totalChlorinePpm: '3',
                          phLevel: '7.3',
                          totalAlkalinityPpm: 90,
                          cyanuricAcidPpm: 30,
                          calciumHardnessPpm: 200,
                          saltPpm: 3300,
                          waterTempF: 78,
                          testerId: 'admin-owner',
                          testerEmail: 'owner@example.com',
                          testerName: 'Owner Admin',
                        },
                      ]);
                    },
                  }),
                }),
              };
            },
          };
        },
      }));

    const detail = await service.getPoolById('pool-123', null, { asAdmin: true });

    expect(detail?.id).toBe('pool-123');
    expect(detail?.owner?.id).toBe('admin-owner');
    expect(ensurePoolAccessMock).not.toHaveBeenCalled();
  });

  it('force updates pools with admin overrides', async () => {
    const result = await service.forceUpdatePool('pool-123', {
      name: 'Admin Update',
      isActive: false,
    });

    expect(result).toMatchObject({
      poolId: 'pool-123',
      name: 'Admin Update',
      isActive: false,
    });
    expect(capturedUpdate).toEqual({ name: 'Admin Update', isActive: false });
    expect(ensurePoolAccessMock).not.toHaveBeenCalled();
  });

  it('lists all pools with membership summaries for admins', async () => {
    const createdAt = new Date('2024-03-01T00:00:00.000Z');
    const updatedAt = new Date('2024-03-02T00:00:00.000Z');
    const lastTestedAt = new Date('2024-03-05T00:00:00.000Z');

    selectSpy
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                orderBy: (orderArg: unknown) => {
                  expect(orderArg).toBeTruthy();
                  return Promise.resolve([
                    {
                      poolId: 'pool-123',
                      ownerId: 'owner-1',
                      name: 'Central Pool',
                      volumeGallons: 20000,
                      surfaceType: 'plaster',
                      sanitizerType: 'chlorine',
                      isActive: true,
                      createdAt,
                      updatedAt,
                      ownerEmail: 'owner@example.com',
                      ownerName: 'Owner One',
                    },
                  ]);
                },
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.poolMembers);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return {
                groupBy: () =>
                  Promise.resolve([
                    {
                      poolId: 'pool-123',
                      total: 2,
                    },
                  ]),
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.testSessions);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return {
                groupBy: () =>
                  Promise.resolve([
                    {
                      poolId: 'pool-123',
                      lastTestedAt,
                    },
                  ]),
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.poolMembers);
          return {
            leftJoin: (joinTable: unknown) => {
              expect(joinTable).toBe(schema.users);
              return {
                where: (condition: unknown) => {
                  expect(condition).toBeDefined();
                  return {
                    orderBy: () =>
                      Promise.resolve([
                        {
                          poolId: 'pool-123',
                          userId: 'owner-1',
                          roleName: 'owner',
                          email: 'owner@example.com',
                          name: 'Owner One',
                        },
                        {
                          poolId: 'pool-123',
                          userId: 'member-2',
                          roleName: 'member',
                          email: 'member@example.com',
                          name: 'Member Two',
                        },
                      ]),
                  };
                },
              };
            },
          };
        },
      }));

    const pools = await service.listAllPools();

    expect(pools).toEqual([
      {
        id: 'pool-123',
        ownerId: 'owner-1',
        name: 'Central Pool',
        volumeGallons: 20000,
        surfaceType: 'plaster',
        sanitizerType: 'chlorine',
        isActive: true,
        createdAt,
        updatedAt,
        owner: {
          id: 'owner-1',
          email: 'owner@example.com',
          name: 'Owner One',
        },
        memberCount: 2,
        lastTestedAt,
        members: [
          {
            poolId: 'pool-123',
            userId: 'owner-1',
            roleName: 'owner',
            email: 'owner@example.com',
            name: 'Owner One',
          },
          {
            poolId: 'pool-123',
            userId: 'member-2',
            roleName: 'member',
            email: 'member@example.com',
            name: 'Member Two',
          },
        ],
      },
    ]);
  });

  it('transfers ownership and updates memberships atomically', async () => {
    let recordedPoolUpdate: any;
    let recordedOldOwnerUpdate: any;
    let recordedInsert: any;

    const txSelect = vi
      .fn()
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.pools);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return {
                limit: (value: number) => {
                  expect(value).toBe(1);
                  return Promise.resolve([{ ownerId: 'owner-1' }]);
                },
              };
            },
          };
        },
      }))
      .mockImplementationOnce(() => ({
        from: (table: unknown) => {
          expect(table).toBe(schema.poolMembers);
          return {
            where: (condition: unknown) => {
              expect(condition).toBeDefined();
              return {
                limit: (value: number) => {
                  expect(value).toBe(1);
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      }));

    const txUpdate = vi.fn((table: unknown) => {
      if (table === schema.pools) {
        return {
          set: (value: any) => {
            recordedPoolUpdate = value;
            return {
              where: (condition: unknown) => {
                expect(condition).toBeDefined();
                return Promise.resolve([]);
              },
            };
          },
        };
      }

      if (table === schema.poolMembers) {
        return {
          set: (value: any) => {
            recordedOldOwnerUpdate = value;
            return {
              where: (condition: unknown) => {
                expect(condition).toBeDefined();
                return Promise.resolve([]);
              },
            };
          },
        };
      }

      throw new Error('Unexpected update table');
    });

    const txInsert = vi.fn(() => ({
      values: (value: any) => {
        recordedInsert = value;
        return Promise.resolve([]);
      },
    }));

    transactionSpy.mockImplementationOnce(async (callback: any) =>
      callback({
        select: txSelect,
        update: txUpdate,
        insert: txInsert,
        delete: vi.fn(),
      })
    );

    const result = await service.transferOwnership('pool-123', 'new-owner');

    expect(result).toEqual({ poolId: 'pool-123', ownerId: 'new-owner' });
    expect(recordedPoolUpdate).toEqual({ ownerId: 'new-owner' });
    expect(recordedInsert).toEqual({ poolId: 'pool-123', userId: 'new-owner', roleName: 'owner' });
    expect(recordedOldOwnerUpdate).toEqual({ roleName: 'manager' });
  });

  it('paginates tests using testedAt cursor metadata', async () => {
    const rows = [
      {
        sessionId: 'session-1',
        poolId: 'pool-123',
        testedAt: new Date('2024-01-02T00:00:00.000Z'),
        totalChlorinePpm: '3',
        freeChlorinePpm: '1',
      },
      {
        sessionId: 'session-2',
        poolId: 'pool-123',
        testedAt: new Date('2024-01-01T00:00:00.000Z'),
        totalChlorinePpm: '4',
        freeChlorinePpm: '2',
      },
    ];

    selectSpy.mockReturnValue({
      from: (table: unknown) => {
        expect(table).toBe(schema.testSessions);
        return {
          where: (clause: unknown) => {
            expect(clause).toBeTruthy();
            return {
              orderBy: (...orderArgs: unknown[]) => {
                expect(orderArgs).toHaveLength(2);
                return {
                  limit: (value: number) => {
                    expect(value).toBe(2);
                    return Promise.resolve(rows);
                  },
                };
              },
            };
          },
        };
      },
    });

    const result = await service.getTestsByPoolId('pool-123', userId, 2, {
      testedAt: new Date('2024-01-03T00:00:00.000Z'),
      sessionId: 'session-5',
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].cc).toBe(2);
    expect(result.items[1].cc).toBe(2);
    expect(result.nextCursor).toEqual({
      testedAt: rows[1].testedAt.toISOString(),
      sessionId: rows[1].sessionId,
    });
    expect(ensurePoolAccessMock).toHaveBeenCalledWith('pool-123', userId);
  });

  it('omits measurements that were not provided when creating a test', async () => {
    const result = await service.createTest('pool-123', userId, { fc: 2.5 });

    expect(capturedTestInsert).toMatchObject({
      poolId: 'pool-123',
      testedBy: userId,
      freeChlorinePpm: '2.5',
    });
    expect(capturedTestInsert.totalChlorinePpm).toBeUndefined();
    expect(capturedTestInsert.phLevel).toBeUndefined();
    expect(capturedTestInsert.totalAlkalinityPpm).toBeUndefined();
    expect(capturedTestInsert.cyanuricAcidPpm).toBeUndefined();
    expect(result.cc).toBeUndefined();
    expect(ensurePoolAccessMock).toHaveBeenCalledWith('pool-123', userId);
  });
});
