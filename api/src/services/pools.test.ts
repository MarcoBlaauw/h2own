import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PoolsService, type CreatePoolData } from './pools.js';
import * as schema from '../db/schema/index.js';

describe('PoolsService', () => {
  const userId = 'user-1';
  let insertSpy: ReturnType<typeof vi.fn>;
  let updateSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;
  let capturedPoolInsert: any;
  let capturedMemberInsert: any;
  let capturedUpdate: any;
  let service: PoolsService;

  beforeEach(() => {
    capturedPoolInsert = undefined;
    capturedMemberInsert = undefined;
    capturedUpdate = undefined;

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

    const mockDb = {
      insert: insertSpy,
      update: updateSpy,
      delete: vi.fn(),
      select: selectSpy,
    } as unknown as typeof import('../db/index.js')['db'];

    service = new PoolsService(mockDb);
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

  it('maps update payloads to database column names', async () => {
    const pool = await service.updatePool('pool-123', {
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

    const result = await service.getTestsByPoolId('pool-123', 2, {
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
  });
});
