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

    const [pool] = await this.db
      .update(schema.pools)
      .set(buildPoolUpdate(data))
      .where(eq(schema.pools.poolId, poolId))
      .returning();

    if (!pool) {
      throw new PoolNotFoundError(poolId);
    }

    return pool;
  }

  async transferOwnership(poolId: string, newOwnerId: string) {
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
        return { poolId, ownerId: newOwnerId };
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
        });
      }

      await tx
        .update(schema.poolMembers)
        .set({ roleName: 'manager' })
        .where(and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, pool.ownerId)));

      return { poolId, ownerId: newOwnerId };
    });
  }
}

export const poolAdminService = new PoolAdminService();
