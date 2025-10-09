import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { PoolsService, type CreatePoolData } from './pools.js';
import * as schema from '../db/schema/index.js';

describe('PoolsService', () => {
  const userId = 'user-1';
  let insertSpy: ReturnType<typeof vi.fn>;
  let updateSpy: ReturnType<typeof vi.fn>;
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

    const mockDb = {
      insert: insertSpy,
      update: updateSpy,
      delete: vi.fn(),
      select: vi.fn(),
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
});

describe('getTestsByPoolId', () => {
  it('applies pagination cursor using testedAt and sessionId', async () => {
    const items = [
      {
        sessionId: 'session-200',
        poolId: 'pool-xyz',
        testedAt: new Date('2024-02-10T10:00:00.000Z'),
        totalChlorinePpm: '4',
        freeChlorinePpm: '3',
      },
      {
        sessionId: 'session-150',
        poolId: 'pool-xyz',
        testedAt: new Date('2024-02-05T10:00:00.000Z'),
        totalChlorinePpm: '3',
        freeChlorinePpm: '1',
      },
    ];

    const limitSpy = vi.fn().mockResolvedValue(items);
    const orderBySpy = vi.fn().mockReturnValue({ limit: limitSpy });
    const whereSpy = vi.fn().mockReturnValue({ orderBy: orderBySpy });
    const fromSpy = vi.fn().mockReturnValue({ where: whereSpy });
    const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });

    const mockDb = {
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      select: selectSpy,
    } as unknown as typeof import('../db/index.js')['db'];

    const pools = new PoolsService(mockDb);
    const cursor = {
      testedAt: '2024-02-11T10:00:00.000Z',
      sessionId: 'session-250',
    };

    const result = await pools.getTestsByPoolId('pool-xyz', 2, cursor);

    const cursorDate = new Date(cursor.testedAt);
    expect(whereSpy).toHaveBeenCalledWith(
      and(
        eq(schema.testSessions.poolId, 'pool-xyz'),
        or(
          lt(schema.testSessions.testedAt, cursorDate),
          and(
            eq(schema.testSessions.testedAt, cursorDate),
            lt(schema.testSessions.sessionId, cursor.sessionId)
          )
        )
      )
    );
    expect(orderBySpy).toHaveBeenCalledWith(
      desc(schema.testSessions.testedAt),
      desc(schema.testSessions.sessionId)
    );
    expect(limitSpy).toHaveBeenCalledWith(2);
    expect(result.nextCursor).toEqual({
      testedAt: items[1].testedAt.toISOString(),
      sessionId: items[1].sessionId,
    });
    expect(result.items[0].cc).toBe(1);
    expect(result.items[1].cc).toBe(2);
  });

  it('filters only by testedAt when sessionId is not provided', async () => {
    const items = [
      {
        sessionId: 'session-101',
        poolId: 'pool-xyz',
        testedAt: new Date('2024-02-01T10:00:00.000Z'),
      },
    ];

    const limitSpy = vi.fn().mockResolvedValue(items);
    const orderBySpy = vi.fn().mockReturnValue({ limit: limitSpy });
    const whereSpy = vi.fn().mockReturnValue({ orderBy: orderBySpy });
    const fromSpy = vi.fn().mockReturnValue({ where: whereSpy });
    const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });

    const mockDb = {
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      select: selectSpy,
    } as unknown as typeof import('../db/index.js')['db'];

    const pools = new PoolsService(mockDb);
    const cursor = {
      testedAt: '2024-02-03T10:00:00.000Z',
    };

    await pools.getTestsByPoolId('pool-xyz', 1, cursor);

    const cursorDate = new Date(cursor.testedAt);
    expect(whereSpy).toHaveBeenCalledWith(
      and(
        eq(schema.testSessions.poolId, 'pool-xyz'),
        lt(schema.testSessions.testedAt, cursorDate)
      )
    );
  });
});
