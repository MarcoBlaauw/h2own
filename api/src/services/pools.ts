import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { eq, and, desc, inArray, lt, or, asc } from 'drizzle-orm';

export interface CreatePoolData {
  name: string;
  volumeGallons: number;
  sanitizerType: string;
  surfaceType: string;
  locationId?: string;
  saltLevelPpm?: number;
  shadeLevel?: string;
  enclosureType?: string;
  hasCover?: boolean;
  pumpGpm?: number;
  filterType?: string;
  hasHeater?: boolean;
}

export interface CreateTestData {
  fc?: number;
  tc?: number;
  ph?: number;
  ta?: number;
  cya?: number;
  ch?: number;
  salt?: number;
  temp?: number;
  collectedAt?: string;
}

export interface CreateDosingData {
  chemicalId: string;
  amount: number;
  unit: string;
  linkedTestId?: string;
  notes?: string;
}

type PoolInsert = typeof schema.pools.$inferInsert;

function mapCreatePoolData(userId: string, data: CreatePoolData): PoolInsert {
  return {
    ownerId: userId,
    isActive: true,
    name: data.name,
    volumeGallons: data.volumeGallons,
    sanitizerType: data.sanitizerType,
    surfaceType: data.surfaceType,
    locationId: data.locationId,
    saltLevelPpm: data.saltLevelPpm,
    shadeLevel: data.shadeLevel,
    enclosureType: data.enclosureType,
    hasCover: data.hasCover,
    pumpGpm: data.pumpGpm,
    filterType: data.filterType,
    hasHeater: data.hasHeater,
  } satisfies PoolInsert;
}

function mapUpdatePoolData(data: Partial<CreatePoolData>): Partial<PoolInsert> {
  const mapped: Partial<PoolInsert> = {};

  if (data.name !== undefined) mapped.name = data.name;
  if (data.volumeGallons !== undefined) mapped.volumeGallons = data.volumeGallons;
  if (data.sanitizerType !== undefined) mapped.sanitizerType = data.sanitizerType;
  if (data.surfaceType !== undefined) mapped.surfaceType = data.surfaceType;
  if (data.locationId !== undefined) mapped.locationId = data.locationId;
  if (data.saltLevelPpm !== undefined) mapped.saltLevelPpm = data.saltLevelPpm;
  if (data.shadeLevel !== undefined) mapped.shadeLevel = data.shadeLevel;
  if (data.enclosureType !== undefined) mapped.enclosureType = data.enclosureType;
  if (data.hasCover !== undefined) mapped.hasCover = data.hasCover;
  if (data.pumpGpm !== undefined) mapped.pumpGpm = data.pumpGpm;
  if (data.filterType !== undefined) mapped.filterType = data.filterType;
  if (data.hasHeater !== undefined) mapped.hasHeater = data.hasHeater;

  return mapped;
}

export interface PoolMemberDetail {
  poolId: string;
  userId: string;
  roleName: string;
  permissions: unknown;
  invitedBy: string | null;
  invitedAt: Date;
  addedAt: Date;
  lastAccessAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export interface PoolTestDetail {
  id: string;
  testedAt: Date;
  freeChlorine: number | null;
  totalChlorine: number | null;
  ph: number | null;
  totalAlkalinity: number | null;
  cyanuricAcid: number | null;
  calciumHardness: number | null;
  salt: number | null;
  waterTempF: number | null;
  tester: {
    id: string;
    email: string;
    name: string | null;
  } | null;
}

export interface PoolDetail {
  id: string;
  ownerId: string;
  locationId: string | null;
  name: string;
  volumeGallons: number;
  surfaceType: string | null;
  sanitizerType: string | null;
  saltLevelPpm: number | null;
  shadeLevel: string | null;
  enclosureType: string | null;
  hasCover: boolean | null;
  pumpGpm: number | null;
  filterType: string | null;
  hasHeater: boolean | null;
  isActive: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  members: PoolMemberDetail[];
  tests: PoolTestDetail[];
  lastTestedAt: Date | null;
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

export class PoolsService {
  constructor(private readonly db = dbClient) {}

  async createPool(userId: string, data: CreatePoolData) {
    const [pool] = await this.db
      .insert(schema.pools)
      .values(mapCreatePoolData(userId, data))
      .returning();

    // Add owner as a member
    await this.db.insert(schema.poolMembers).values({
      poolId: pool.poolId,
      userId,
      roleName: 'owner',
    });

    return pool;
  }

  async getPools(userId: string, filterOwner = false) {
    if (filterOwner) {
      return this.db.select().from(schema.pools).where(eq(schema.pools.ownerId, userId));
    }

    // Return all pools the user is a member of
    const memberships = await this.db.select().from(schema.poolMembers).where(eq(schema.poolMembers.userId, userId));
    const poolIds = memberships.map(m => m.poolId);

    if (poolIds.length === 0) {
      return [];
    }

    return this.db.select().from(schema.pools).where(inArray(schema.pools.poolId, poolIds));
  }

  async getPoolById(poolId: string): Promise<PoolDetail | null> {
    const [poolRow] = await this.db
      .select({
        poolId: schema.pools.poolId,
        ownerId: schema.pools.ownerId,
        locationId: schema.pools.locationId,
        name: schema.pools.name,
        volumeGallons: schema.pools.volumeGallons,
        surfaceType: schema.pools.surfaceType,
        sanitizerType: schema.pools.sanitizerType,
        saltLevelPpm: schema.pools.saltLevelPpm,
        shadeLevel: schema.pools.shadeLevel,
        enclosureType: schema.pools.enclosureType,
        hasCover: schema.pools.hasCover,
        pumpGpm: schema.pools.pumpGpm,
        filterType: schema.pools.filterType,
        hasHeater: schema.pools.hasHeater,
        isActive: schema.pools.isActive,
        createdAt: schema.pools.createdAt,
        updatedAt: schema.pools.updatedAt,
        ownerUserId: schema.users.userId,
        ownerEmail: schema.users.email,
        ownerName: schema.users.name,
      })
      .from(schema.pools)
      .leftJoin(schema.users, eq(schema.pools.ownerId, schema.users.userId))
      .where(eq(schema.pools.poolId, poolId));

    if (!poolRow) {
      return null;
    }

    const [memberRows, testRows] = await Promise.all([
      this.db
        .select({
          poolId: schema.poolMembers.poolId,
          userId: schema.poolMembers.userId,
          roleName: schema.poolMembers.roleName,
          permissions: schema.poolMembers.permissions,
          invitedBy: schema.poolMembers.invitedBy,
          invitedAt: schema.poolMembers.invitedAt,
          addedAt: schema.poolMembers.addedAt,
          lastAccessAt: schema.poolMembers.lastAccessAt,
          memberEmail: schema.users.email,
          memberName: schema.users.name,
        })
        .from(schema.poolMembers)
        .leftJoin(schema.users, eq(schema.poolMembers.userId, schema.users.userId))
        .where(eq(schema.poolMembers.poolId, poolId))
        .orderBy(asc(schema.poolMembers.addedAt)),
      this.db
        .select({
          sessionId: schema.testSessions.sessionId,
          testedAt: schema.testSessions.testedAt,
          testedBy: schema.testSessions.testedBy,
          freeChlorinePpm: schema.testSessions.freeChlorinePpm,
          totalChlorinePpm: schema.testSessions.totalChlorinePpm,
          phLevel: schema.testSessions.phLevel,
          totalAlkalinityPpm: schema.testSessions.totalAlkalinityPpm,
          cyanuricAcidPpm: schema.testSessions.cyanuricAcidPpm,
          calciumHardnessPpm: schema.testSessions.calciumHardnessPpm,
          saltPpm: schema.testSessions.saltPpm,
          waterTempF: schema.testSessions.waterTempF,
          testerId: schema.users.userId,
          testerEmail: schema.users.email,
          testerName: schema.users.name,
        })
        .from(schema.testSessions)
        .leftJoin(schema.users, eq(schema.testSessions.testedBy, schema.users.userId))
        .where(eq(schema.testSessions.poolId, poolId))
        .orderBy(desc(schema.testSessions.testedAt))
        .limit(10),
    ]);

    const members: PoolMemberDetail[] = memberRows.map((member) => ({
      poolId: member.poolId,
      userId: member.userId,
      roleName: member.roleName,
      permissions: member.permissions,
      invitedBy: member.invitedBy,
      invitedAt: member.invitedAt,
      addedAt: member.addedAt,
      lastAccessAt: member.lastAccessAt,
      user: member.userId
        ? {
            id: member.userId,
            email: member.memberEmail ?? '',
            name: member.memberName ?? null,
          }
        : null,
    }));

    const tests: PoolTestDetail[] = testRows.map((test) => ({
      id: test.sessionId,
      testedAt: test.testedAt,
      freeChlorine: toNumber(test.freeChlorinePpm),
      totalChlorine: toNumber(test.totalChlorinePpm),
      ph: toNumber(test.phLevel),
      totalAlkalinity: test.totalAlkalinityPpm ?? null,
      cyanuricAcid: test.cyanuricAcidPpm ?? null,
      calciumHardness: test.calciumHardnessPpm ?? null,
      salt: test.saltPpm ?? null,
      waterTempF: test.waterTempF ?? null,
      tester: test.testerId
        ? {
            id: test.testerId,
            email: test.testerEmail ?? '',
            name: test.testerName ?? null,
          }
        : null,
    }));

    const lastTestedAt = tests[0]?.testedAt ?? null;

    return {
      id: poolRow.poolId,
      ownerId: poolRow.ownerId,
      locationId: poolRow.locationId,
      name: poolRow.name,
      volumeGallons: poolRow.volumeGallons,
      surfaceType: poolRow.surfaceType ?? null,
      sanitizerType: poolRow.sanitizerType ?? null,
      saltLevelPpm: poolRow.saltLevelPpm ?? null,
      shadeLevel: poolRow.shadeLevel ?? null,
      enclosureType: poolRow.enclosureType ?? null,
      hasCover: poolRow.hasCover ?? null,
      pumpGpm: poolRow.pumpGpm ?? null,
      filterType: poolRow.filterType ?? null,
      hasHeater: poolRow.hasHeater ?? null,
      isActive: poolRow.isActive ?? null,
      createdAt: poolRow.createdAt,
      updatedAt: poolRow.updatedAt,
      owner: poolRow.ownerUserId
        ? {
            id: poolRow.ownerUserId,
            email: poolRow.ownerEmail ?? '',
            name: poolRow.ownerName ?? null,
          }
        : null,
      members,
      tests,
      lastTestedAt,
    } satisfies PoolDetail;
  }

  async updatePool(poolId: string, data: Partial<CreatePoolData>) {
    const [pool] = await this.db
      .update(schema.pools)
      .set(mapUpdatePoolData(data))
      .where(eq(schema.pools.poolId, poolId))
      .returning();
    return pool;
  }

  async deletePool(poolId: string) {
    await this.db.delete(schema.pools).where(eq(schema.pools.poolId, poolId));
  }

  async getPoolMembers(poolId: string) {
    return this.db.select().from(schema.poolMembers).where(eq(schema.poolMembers.poolId, poolId));
  }

  async addPoolMember(poolId: string, userId: string, role: string) {
    const [member] = await this.db.insert(schema.poolMembers).values({
      poolId,
      userId,
      roleName: role,
    }).returning();
    return member;
  }

  async updatePoolMember(poolId: string, userId: string, role: string) {
    const [member] = await this.db.update(schema.poolMembers)
      .set({ roleName: role })
      .where(and(
        eq(schema.poolMembers.poolId, poolId),
        eq(schema.poolMembers.userId, userId)
      ))
      .returning();
    return member;
  }

  async removePoolMember(poolId: string, userId: string) {
    await this.db.delete(schema.poolMembers)
      .where(and(
        eq(schema.poolMembers.poolId, poolId),
        eq(schema.poolMembers.userId, userId)
      ));
  }

  async createTest(poolId: string, userId: string, data: CreateTestData) {
    let cc;
    if (typeof data.tc === 'number' && typeof data.fc === 'number') {
      cc = Math.max(0, data.tc - data.fc);
    }

    const dbData = {
      poolId,
      testedBy: userId,
      testedAt: data.collectedAt ? new Date(data.collectedAt) : new Date(),
      freeChlorinePpm: data.fc?.toString(),
      totalChlorinePpm: data.tc?.toString(),
      phLevel: data.ph?.toString(),
      totalAlkalinityPpm: data.ta,
      cyanuricAcidPpm: data.cya,
      calciumHardnessPpm: data.ch,
      saltPpm: data.salt,
      waterTempF: data.temp,
    };

    const [test] = await this.db.insert(schema.testSessions).values(dbData).returning();

    return { ...test, cc };
  }

  async getTestsByPoolId(
    poolId: string,
    limit: number,
    cursor?: { testedAt: Date; sessionId?: string }
  ) {
    let whereClause = eq(schema.testSessions.poolId, poolId);

    if (cursor) {
      const paginationDate = cursor.testedAt;
      if (Number.isNaN(paginationDate.getTime())) {
        throw new Error('Invalid cursor testedAt value');
      }

      const paginationCondition = cursor.sessionId
        ? or(
            lt(schema.testSessions.testedAt, paginationDate),
            and(
              eq(schema.testSessions.testedAt, paginationDate),
              lt(schema.testSessions.sessionId, cursor.sessionId)
            )
          )
        : lt(schema.testSessions.testedAt, paginationDate);

      whereClause = and(whereClause, paginationCondition);
    }

    const query = this.db
      .select()
      .from(schema.testSessions)
      .where(whereClause)
      .orderBy(desc(schema.testSessions.testedAt), desc(schema.testSessions.sessionId))
      .limit(limit);

    const items = await query;
    let nextCursor: { testedAt: string; sessionId: string | null } | null = null;
    if (items.length === limit) {
      const last = items[items.length - 1];
      nextCursor = {
        testedAt: last.testedAt.toISOString(),
        sessionId: last.sessionId,
      };
    }

    const itemsWithCC = items.map((item) => {
      let cc;
      if (item.totalChlorinePpm && item.freeChlorinePpm) {
        cc = Math.max(0, parseFloat(item.totalChlorinePpm) - parseFloat(item.freeChlorinePpm));
      }
      return { ...item, cc };
    });

    return { items: itemsWithCC, nextCursor };
  }

  async getTestById(sessionId: string) {
    const [test] = await this.db
      .select()
      .from(schema.testSessions)
      .where(eq(schema.testSessions.sessionId, sessionId));

    if (!test) {
      return null;
    }

    let cc;
    if (test.totalChlorinePpm && test.freeChlorinePpm) {
      cc = Math.max(0, parseFloat(test.totalChlorinePpm) - parseFloat(test.freeChlorinePpm));
    }

    return { ...test, cc };
  }

  async createDosingEvent(poolId: string, userId: string, data: CreateDosingData) {
    const [chemical] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.productId, data.chemicalId));

    if (!chemical) {
      throw new Error('Chemical not found');
    }

    if (data.linkedTestId) {
      const [test] = await this.db
        .select()
        .from(schema.testSessions)
        .where(eq(schema.testSessions.sessionId, data.linkedTestId));

      if (!test || test.poolId !== poolId) {
        throw new Error('Test does not belong to this pool');
      }
    }

    const dbData = {
      poolId,
      productId: data.chemicalId,
      addedBy: userId,
      linkedTestId: data.linkedTestId,
      amount: data.amount.toString(),
      unit: data.unit,
      notes: data.notes,
    };

    const [dosingEvent] = await this.db
      .insert(schema.chemicalActions)
      .values(dbData)
      .returning();

    return dosingEvent;
  }
}

export const poolsService = new PoolsService();
