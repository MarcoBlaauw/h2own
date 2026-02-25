import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PoolCoreService,
  type CreatePoolData,
  PoolLocationAccessError,
  PoolValidationError,
} from './core.js';
import * as schema from '../../db/schema/index.js';

describe('PoolCoreService', () => {
  const userId = 'user-1';
  let insertSpy: ReturnType<typeof vi.fn>;
  let updateSpy: ReturnType<typeof vi.fn>;
  let selectSpy: ReturnType<typeof vi.fn>;
  let capturedPoolInsert: any;
  let capturedMemberInsert: any;
  let capturedUpdate: any;
  let service: PoolCoreService;
  let ensurePoolCapabilityMock: ReturnType<typeof vi.fn>;

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
    } as unknown as typeof import('../../db/index.js')['db'];

    service = new PoolCoreService(mockDb);
    ensurePoolCapabilityMock = vi.fn().mockResolvedValue({ poolId: 'pool-123', ownerId: userId });
    service.ensurePoolCapability = ensurePoolCapabilityMock as any;
  });

  it('maps create payloads to database column names', async () => {
    const payload: CreatePoolData = {
      name: 'Backyard Pool',
      volumeGallons: 15000,
      sanitizerType: 'chlorine',
      chlorineSource: 'manual',
      sanitizerTargetMinPpm: 2,
      sanitizerTargetMaxPpm: 4,
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
      chlorineSource: payload.chlorineSource,
      sanitizerTargetMinPpm: '2',
      sanitizerTargetMaxPpm: '4',
      surfaceType: payload.surfaceType,
      shadeLevel: payload.shadeLevel,
      hasCover: payload.hasCover,
    });

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
          where: () => ({
            limit: (count: number) => {
              expect(count).toBe(1);
              return Promise.resolve([{ userId, isActive: true }]);
            },
          }),
        };
      },
    }));

    const payload: CreatePoolData = {
      name: 'Club Pool',
      volumeGallons: 20000,
      sanitizerType: 'chlorine',
      chlorineSource: 'swg',
      saltLevelPpm: 3200,
      sanitizerTargetMinPpm: 2,
      sanitizerTargetMaxPpm: 4,
      surfaceType: 'fiberglass',
      locationId: 'loc-1',
    };

    await service.createPool(userId, payload);
    expect(selectSpy).toHaveBeenCalled();
  });

  it('throws when assigning an inaccessible location', async () => {
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
      service.createPool(userId, {
        name: 'Club Pool',
        volumeGallons: 20000,
        sanitizerType: 'chlorine',
        chlorineSource: 'manual',
        sanitizerTargetMinPpm: 2,
        sanitizerTargetMaxPpm: 4,
        surfaceType: 'fiberglass',
        locationId: 'loc-1',
      })
    ).rejects.toBeInstanceOf(PoolLocationAccessError);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('maps update payloads to database column names', async () => {
    selectSpy.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                sanitizerType: 'chlorine',
                chlorineSource: 'manual',
                saltLevelPpm: null,
                sanitizerTargetMinPpm: '2',
                sanitizerTargetMaxPpm: '4',
              },
            ]),
        }),
      }),
    }));

    await service.updatePool('pool-123', userId, {
      sanitizerType: 'bromine',
      sanitizerTargetMinPpm: 3,
      sanitizerTargetMaxPpm: 5,
      surfaceType: 'fiberglass',
    });

    expect(capturedUpdate).toEqual({
      sanitizerType: 'bromine',
      chlorineSource: null,
      saltLevelPpm: null,
      sanitizerTargetMinPpm: '3',
      sanitizerTargetMaxPpm: '5',
      surfaceType: 'fiberglass',
    });
    expect(ensurePoolCapabilityMock).toHaveBeenCalledWith('pool-123', userId, 'pool.update');
  });

  it('requires salt target ppm when chlorine source is swg', async () => {
    await expect(
      service.createPool(userId, {
        name: 'SWG Pool',
        volumeGallons: 18000,
        sanitizerType: 'chlorine',
        chlorineSource: 'swg',
        sanitizerTargetMinPpm: 2,
        sanitizerTargetMaxPpm: 4,
        surfaceType: 'plaster',
      })
    ).rejects.toBeInstanceOf(PoolValidationError);

    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('clears chlorine source and salt target when switching to bromine', async () => {
    selectSpy.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                sanitizerType: 'chlorine',
                chlorineSource: 'swg',
                saltLevelPpm: 3200,
                sanitizerTargetMinPpm: '2',
                sanitizerTargetMaxPpm: '4',
              },
            ]),
        }),
      }),
    }));

    await service.updatePool('pool-123', userId, {
      sanitizerType: 'bromine',
      sanitizerTargetMinPpm: 3,
      sanitizerTargetMaxPpm: 5,
    });

    expect(capturedUpdate).toEqual({
      sanitizerType: 'bromine',
      chlorineSource: null,
      saltLevelPpm: null,
      sanitizerTargetMinPpm: '3',
      sanitizerTargetMaxPpm: '5',
    });
  });

  it('requires sanitizer residual range when creating bromine pools', async () => {
    await expect(
      service.createPool(userId, {
        name: 'Bromine Pool',
        volumeGallons: 18000,
        sanitizerType: 'bromine',
        surfaceType: 'plaster',
      })
    ).rejects.toBeInstanceOf(PoolValidationError);
  });
});
