import { db as dbClient } from '../../db/index.js';
import * as schema from '../../db/schema/index.js';
import { and, asc, count, desc, eq, inArray, max } from 'drizzle-orm';
import {
  PoolCoreService,
  PoolNotFoundError,
  AdminPoolMemberSummary,
  AdminPoolSummary,
  AdminUpdatePoolData,
  buildPoolUpdate,
  resolvePoolChemistryConfig,
} from './core.js';

export class PoolAdminService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  async listAllPools(): Promise<AdminPoolSummary[]> {
    const rows = await this.db
      .select({
        poolId: schema.pools.poolId,
        ownerId: schema.pools.ownerId,
        name: schema.pools.name,
        volumeGallons: schema.pools.volumeGallons,
        surfaceType: schema.pools.surfaceType,
        sanitizerType: schema.pools.sanitizerType,
        chlorineSource: schema.pools.chlorineSource,
        saltLevelPpm: schema.pools.saltLevelPpm,
        sanitizerTargetMinPpm: schema.pools.sanitizerTargetMinPpm,
        sanitizerTargetMaxPpm: schema.pools.sanitizerTargetMaxPpm,
        isActive: schema.pools.isActive,
        createdAt: schema.pools.createdAt,
        updatedAt: schema.pools.updatedAt,
        ownerEmail: schema.users.email,
        ownerName: schema.users.name,
      })
      .from(schema.pools)
      .leftJoin(schema.users, eq(schema.pools.ownerId, schema.users.userId))
      .orderBy(desc(schema.pools.createdAt));

    if (rows.length === 0) {
      return [];
    }

    const poolIds = rows.map((row) => row.poolId);

    const [memberCounts, latestTests, memberDetails] = await Promise.all([
      this.db
        .select({
          poolId: schema.poolMembers.poolId,
          total: count(schema.poolMembers.userId),
        })
        .from(schema.poolMembers)
        .where(inArray(schema.poolMembers.poolId, poolIds))
        .groupBy(schema.poolMembers.poolId),
      this.db
        .select({
          poolId: schema.testSessions.poolId,
          lastTestedAt: max(schema.testSessions.testedAt),
        })
        .from(schema.testSessions)
        .where(inArray(schema.testSessions.poolId, poolIds))
        .groupBy(schema.testSessions.poolId),
      this.db
        .select({
          poolId: schema.poolMembers.poolId,
          userId: schema.poolMembers.userId,
          roleName: schema.poolMembers.roleName,
          email: schema.users.email,
          name: schema.users.name,
        })
        .from(schema.poolMembers)
        .leftJoin(schema.users, eq(schema.poolMembers.userId, schema.users.userId))
        .where(inArray(schema.poolMembers.poolId, poolIds))
        .orderBy(asc(schema.poolMembers.poolId), asc(schema.poolMembers.addedAt)),
    ]);

    const memberCountMap = new Map<string, number>();
    for (const countRow of memberCounts) {
      memberCountMap.set(countRow.poolId, Number(countRow.total));
    }

    const lastTestMap = new Map<string, Date | null>();
    for (const testRow of latestTests) {
      lastTestMap.set(testRow.poolId, testRow.lastTestedAt ?? null);
    }

    const membersByPool = new Map<string, AdminPoolMemberSummary[]>();
    for (const member of memberDetails) {
      const list = membersByPool.get(member.poolId) ?? [];
      list.push({
        poolId: member.poolId,
        userId: member.userId,
        roleName: member.roleName,
        email: member.email ?? null,
        name: member.name ?? null,
      });
      membersByPool.set(member.poolId, list);
    }

    return rows.map((row) => ({
      id: row.poolId,
      ownerId: row.ownerId,
      name: row.name,
      volumeGallons: row.volumeGallons,
      surfaceType: row.surfaceType ?? null,
      sanitizerType: row.sanitizerType ?? null,
      chlorineSource: row.chlorineSource ?? null,
      saltLevelPpm: row.saltLevelPpm ?? null,
      sanitizerTargetMinPpm:
        row.sanitizerTargetMinPpm === null || row.sanitizerTargetMinPpm === undefined
          ? null
          : Number(row.sanitizerTargetMinPpm),
      sanitizerTargetMaxPpm:
        row.sanitizerTargetMaxPpm === null || row.sanitizerTargetMaxPpm === undefined
          ? null
          : Number(row.sanitizerTargetMaxPpm),
      isActive: row.isActive ?? true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      owner: row.ownerId
        ? {
            id: row.ownerId,
            email: row.ownerEmail ?? null,
            name: row.ownerName ?? null,
          }
        : null,
      memberCount: memberCountMap.get(row.poolId) ?? 0,
      lastTestedAt: lastTestMap.get(row.poolId) ?? null,
      members: membersByPool.get(row.poolId) ?? [],
    } satisfies AdminPoolSummary));
  }

  async forceUpdatePool(poolId: string, data: AdminUpdatePoolData) {
    if (data.locationId && typeof data.locationId === 'string') {
      const [poolOwner] = await this.db
        .select({ ownerId: schema.pools.ownerId })
        .from(schema.pools)
        .where(eq(schema.pools.poolId, poolId))
        .limit(1);

      if (!poolOwner) {
        throw new PoolNotFoundError(poolId);
      }

      await this.core.ensureLocationAccessible(data.locationId, poolOwner.ownerId);
    }

    const [currentPool] = await this.db
      .select({
        sanitizerType: schema.pools.sanitizerType,
        chlorineSource: schema.pools.chlorineSource,
        saltLevelPpm: schema.pools.saltLevelPpm,
        sanitizerTargetMinPpm: schema.pools.sanitizerTargetMinPpm,
        sanitizerTargetMaxPpm: schema.pools.sanitizerTargetMaxPpm,
      })
      .from(schema.pools)
      .where(eq(schema.pools.poolId, poolId))
      .limit(1);

    if (!currentPool) {
      throw new PoolNotFoundError(poolId);
    }

    const chemistry = resolvePoolChemistryConfig({
      currentSanitizerType: currentPool.sanitizerType,
      currentChlorineSource: currentPool.chlorineSource,
      currentSaltLevelPpm: currentPool.saltLevelPpm,
      currentTargetMinPpm: currentPool.sanitizerTargetMinPpm,
      currentTargetMaxPpm: currentPool.sanitizerTargetMaxPpm,
      nextSanitizerType: data.sanitizerType,
      nextChlorineSource: data.chlorineSource,
      nextSaltLevelPpm: data.saltLevelPpm,
      nextTargetMinPpm: data.sanitizerTargetMinPpm,
      nextTargetMaxPpm: data.sanitizerTargetMaxPpm,
    });

    const updatePayload = buildPoolUpdate(data);
    updatePayload.sanitizerType = chemistry.sanitizerType;
    updatePayload.chlorineSource = chemistry.chlorineSource;
    updatePayload.saltLevelPpm = chemistry.saltLevelPpm;
    updatePayload.sanitizerTargetMinPpm = chemistry.sanitizerTargetMinPpm.toString();
    updatePayload.sanitizerTargetMaxPpm = chemistry.sanitizerTargetMaxPpm.toString();

    const [pool] = await this.db
      .update(schema.pools)
      .set(updatePayload)
      .where(eq(schema.pools.poolId, poolId))
      .returning();

    if (!pool) {
      throw new PoolNotFoundError(poolId);
    }

    return pool;
  }

  async transferOwnership(
    poolId: string,
    newOwnerId: string,
    options?: {
      retainExistingAccess?: boolean;
      transferredByUserId?: string | null;
    }
  ) {
    const retainExistingAccess = options?.retainExistingAccess ?? false;
    return this.db.transaction(async (tx) => {
      const [pool] = await tx
        .select({ ownerId: schema.pools.ownerId })
        .from(schema.pools)
        .where(eq(schema.pools.poolId, poolId))
        .limit(1);

      if (!pool) {
        throw new PoolNotFoundError(poolId);
      }

      if (pool.ownerId === newOwnerId) {
        return {
          poolId,
          ownerId: newOwnerId,
          previousOwnerId: pool.ownerId,
          retainExistingAccess,
          revokedAccessCount: 0,
        };
      }

      await tx
        .update(schema.pools)
        .set({ ownerId: newOwnerId })
        .where(eq(schema.pools.poolId, poolId));

      const existingMembership = await tx
        .select({ userId: schema.poolMembers.userId })
        .from(schema.poolMembers)
        .where(and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, newOwnerId)))
        .limit(1);

      if (existingMembership.length > 0) {
        await tx
          .update(schema.poolMembers)
          .set({ roleName: 'owner' })
          .where(and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, newOwnerId)));
      } else {
        await tx.insert(schema.poolMembers).values({
          poolId,
          userId: newOwnerId,
          roleName: 'owner',
          invitedBy: options?.transferredByUserId ?? null,
        });
      }

      let revokedAccessCount = 0;
      if (retainExistingAccess) {
        await tx
          .update(schema.poolMembers)
          .set({ roleName: 'manager' })
          .where(and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, pool.ownerId)));
      } else {
        await tx
          .delete(schema.poolMembers)
          .where(and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, pool.ownerId)));

        const remainingMembersToRevoke = await tx
          .select({ userId: schema.poolMembers.userId })
          .from(schema.poolMembers)
          .where(eq(schema.poolMembers.poolId, poolId));

        const revokeUserIds = remainingMembersToRevoke
          .map((member) => member.userId)
          .filter((userId) => userId !== newOwnerId);

        if (revokeUserIds.length > 0) {
          await tx
            .delete(schema.poolMembers)
            .where(
              and(
                eq(schema.poolMembers.poolId, poolId),
                inArray(schema.poolMembers.userId, revokeUserIds)
              )
            );
        }

        const distinctRevoked = new Set<string>([
          pool.ownerId,
          ...revokeUserIds,
        ]);
        distinctRevoked.delete(newOwnerId);
        revokedAccessCount = distinctRevoked.size;
      }

      return {
        poolId,
        ownerId: newOwnerId,
        previousOwnerId: pool.ownerId,
        retainExistingAccess,
        revokedAccessCount,
      };
    });
  }
}

export const poolAdminService = new PoolAdminService();
