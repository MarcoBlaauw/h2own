import { db as dbClient } from '../../db/index.js';
import * as schema from '../../db/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { PoolCoreService } from './core.js';

export class PoolMembershipService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  async getPoolMembers(poolId: string, requestingUserId: string) {
    await this.core.ensurePoolAccess(poolId, requestingUserId);
    return this.db.select().from(schema.poolMembers).where(eq(schema.poolMembers.poolId, poolId));
  }

  async addPoolMember(poolId: string, requestingUserId: string, userId: string, role: string) {
    await this.core.ensurePoolCapability(poolId, requestingUserId, 'pool.members.manage');
    const [member] = await this.db
      .insert(schema.poolMembers)
      .values({
        poolId,
        userId,
        roleName: role,
      })
      .returning();
    return member;
  }

  async updatePoolMember(poolId: string, requestingUserId: string, userId: string, role: string) {
    await this.core.ensurePoolCapability(poolId, requestingUserId, 'pool.members.manage');
    const [member] = await this.db
      .update(schema.poolMembers)
      .set({ roleName: role })
      .where(
        and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, userId))
      )
      .returning();
    return member;
  }

  async removePoolMember(poolId: string, requestingUserId: string, userId: string) {
    await this.core.ensurePoolCapability(poolId, requestingUserId, 'pool.members.manage');
    await this.db
      .delete(schema.poolMembers)
      .where(and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, userId)));
  }
}

export const poolMembershipService = new PoolMembershipService();
