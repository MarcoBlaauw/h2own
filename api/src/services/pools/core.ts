import { db as dbClient } from '../../db/index.js';
import * as schema from '../../db/schema/index.js';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  canAssignPoolOwner,
  hasPoolCapability,
  requiresOwnerForCapability,
  type PoolCapability,
} from '../authorization.js';

export class PoolNotFoundError extends Error {
  constructor(poolId: string) {
    super(`Pool ${poolId} not found`);
    this.name = 'PoolNotFoundError';
  }
}

export class PoolForbiddenError extends Error {
  constructor(poolId: string) {
    super(`Pool ${poolId} forbidden`);
    this.name = 'PoolForbiddenError';
  }
}

export class PoolOwnerRequiredError extends Error {
  constructor(poolId: string) {
    super(`Owner role required for pool ${poolId}`);
    this.name = 'PoolOwnerRequiredError';
  }
}

export class PoolCreateOwnerForbiddenError extends Error {
  constructor() {
    super('Only business/admin users can create pools for another owner');
    this.name = 'PoolCreateOwnerForbiddenError';
  }
}

export class PoolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoolValidationError';
  }
}

const CHLORINE_SANITIZER_TYPE = 'chlorine';
const BROMINE_SANITIZER_TYPE = 'bromine';
const sanitizerTypes = new Set([CHLORINE_SANITIZER_TYPE, BROMINE_SANITIZER_TYPE]);

const CHLORINE_SOURCE_MANUAL = 'manual';
const CHLORINE_SOURCE_SWG = 'swg';
const chlorineSources = new Set([CHLORINE_SOURCE_MANUAL, CHLORINE_SOURCE_SWG]);

type ResolvePoolChemistryInput = {
  currentSanitizerType?: string | null;
  currentChlorineSource?: string | null;
  currentSaltLevelPpm?: number | null;
  currentTargetMinPpm?: string | number | null;
  currentTargetMaxPpm?: string | number | null;
  nextSanitizerType?: string | null;
  nextChlorineSource?: string | null;
  nextSaltLevelPpm?: number | null;
  nextTargetMinPpm?: number | null;
  nextTargetMaxPpm?: number | null;
};

const normalizeSanitizerType = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return sanitizerTypes.has(normalized) ? normalized : null;
};

const normalizeChlorineSource = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return chlorineSources.has(normalized) ? normalized : null;
};

export function resolvePoolChemistryConfig(input: ResolvePoolChemistryInput) {
  const currentSanitizerType = normalizeSanitizerType(input.currentSanitizerType);
  const nextSanitizerType = normalizeSanitizerType(
    input.nextSanitizerType ?? currentSanitizerType ?? null
  );
  if (!nextSanitizerType) {
    throw new PoolValidationError('Sanitizer type must be either chlorine or bromine.');
  }

  const currentChlorineSource = normalizeChlorineSource(input.currentChlorineSource);
  const nextChlorineSource = normalizeChlorineSource(
    input.nextChlorineSource ?? currentChlorineSource ?? null
  );

  let resolvedChlorineSource: string | null = null;
  if (nextSanitizerType === CHLORINE_SANITIZER_TYPE) {
    if (!nextChlorineSource) {
      throw new PoolValidationError('Chlorine source is required for chlorine pools.');
    }
    resolvedChlorineSource = nextChlorineSource;
  }

  const nextTargetMin = input.nextTargetMinPpm ?? toNumber(input.currentTargetMinPpm);
  const nextTargetMax = input.nextTargetMaxPpm ?? toNumber(input.currentTargetMaxPpm);
  if (
    nextTargetMin === null ||
    nextTargetMax === null ||
    Number.isNaN(nextTargetMin) ||
    Number.isNaN(nextTargetMax) ||
    nextTargetMin <= 0 ||
    nextTargetMax <= 0 ||
    nextTargetMin > nextTargetMax
  ) {
    throw new PoolValidationError(
      'Sanitizer target range (min/max ppm) is required and must be positive with min less than or equal to max.'
    );
  }

  let resolvedSaltLevelPpm: number | null = null;
  if (
    nextSanitizerType === CHLORINE_SANITIZER_TYPE &&
    resolvedChlorineSource === CHLORINE_SOURCE_SWG
  ) {
    const nextSaltLevel =
      input.nextSaltLevelPpm !== undefined ? Number(input.nextSaltLevelPpm) : input.currentSaltLevelPpm;
    if (
      nextSaltLevel === null ||
      nextSaltLevel === undefined ||
      Number.isNaN(nextSaltLevel) ||
      nextSaltLevel <= 0
    ) {
      throw new PoolValidationError(
        'Salt target ppm is required when chlorine source is SWG and must be a positive number.'
      );
    }
    resolvedSaltLevelPpm = nextSaltLevel;
  }

  return {
    sanitizerType: nextSanitizerType,
    chlorineSource: resolvedChlorineSource,
    saltLevelPpm: resolvedSaltLevelPpm,
    sanitizerTargetMinPpm: nextTargetMin,
    sanitizerTargetMaxPpm: nextTargetMax,
  };
}

export interface CreatePoolData {
  ownerId?: string;
  name: string;
  volumeGallons: number;
  sanitizerType: string;
  chlorineSource?: string | null;
  surfaceType: string;
  locationId?: string | null;
  saltLevelPpm?: number | null;
  sanitizerTargetMinPpm?: number | null;
  sanitizerTargetMaxPpm?: number | null;
  shadeLevel?: string;
  enclosureType?: string;
  hasCover?: boolean;
  pumpGpm?: number;
  filterType?: string;
  hasHeater?: boolean;
}

export type UpdatePoolData = Partial<CreatePoolData> & {
  locationId?: string | null;
};

export type AdminUpdatePoolData = UpdatePoolData & {
  isActive?: boolean;
};

type PoolInsert = typeof schema.pools.$inferInsert;

type PoolUpdate = Partial<PoolInsert>;

export function buildPoolUpdate(data: UpdatePoolData | AdminUpdatePoolData): PoolUpdate {
  const mapped: PoolUpdate = {};

  if (data.name !== undefined) mapped.name = data.name;
  if (data.volumeGallons !== undefined) mapped.volumeGallons = data.volumeGallons;
  if (data.sanitizerType !== undefined) mapped.sanitizerType = data.sanitizerType;
  if (data.chlorineSource !== undefined) mapped.chlorineSource = data.chlorineSource;
  if (data.surfaceType !== undefined) mapped.surfaceType = data.surfaceType;
  if (data.locationId !== undefined) mapped.locationId = data.locationId;
  if (data.saltLevelPpm !== undefined) mapped.saltLevelPpm = data.saltLevelPpm;
  if (data.sanitizerTargetMinPpm !== undefined) {
    mapped.sanitizerTargetMinPpm =
      data.sanitizerTargetMinPpm === null ? null : data.sanitizerTargetMinPpm.toString();
  }
  if (data.sanitizerTargetMaxPpm !== undefined) {
    mapped.sanitizerTargetMaxPpm =
      data.sanitizerTargetMaxPpm === null ? null : data.sanitizerTargetMaxPpm.toString();
  }
  if (data.shadeLevel !== undefined) mapped.shadeLevel = data.shadeLevel;
  if (data.enclosureType !== undefined) mapped.enclosureType = data.enclosureType;
  if (data.hasCover !== undefined) mapped.hasCover = data.hasCover;
  if (data.pumpGpm !== undefined) mapped.pumpGpm = data.pumpGpm;
  if (data.filterType !== undefined) mapped.filterType = data.filterType;
  if (data.hasHeater !== undefined) mapped.hasHeater = data.hasHeater;
  if ('isActive' in data && data.isActive !== undefined) mapped.isActive = data.isActive;

  return mapped;
}

function mapCreatePoolData(userId: string, data: CreatePoolData): PoolInsert {
  const mapped: PoolInsert = {
    ownerId: userId,
    isActive: true,
    name: data.name,
    volumeGallons: data.volumeGallons,
    sanitizerType: data.sanitizerType,
    chlorineSource: data.chlorineSource,
    surfaceType: data.surfaceType,
    saltLevelPpm: data.saltLevelPpm,
    sanitizerTargetMinPpm:
      data.sanitizerTargetMinPpm === null || data.sanitizerTargetMinPpm === undefined
        ? null
        : data.sanitizerTargetMinPpm.toString(),
    sanitizerTargetMaxPpm:
      data.sanitizerTargetMaxPpm === null || data.sanitizerTargetMaxPpm === undefined
        ? null
        : data.sanitizerTargetMaxPpm.toString(),
    shadeLevel: data.shadeLevel,
    enclosureType: data.enclosureType,
    hasCover: data.hasCover,
    pumpGpm: data.pumpGpm,
    filterType: data.filterType,
    hasHeater: data.hasHeater,
  } satisfies PoolInsert;

  if (data.locationId !== undefined) {
    mapped.locationId = data.locationId;
  }

  return mapped;
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

export class PoolLocationAccessError extends Error {
  constructor(public readonly locationId: string) {
    super(`Location ${locationId} is not accessible for this pool`);
    this.name = 'PoolLocationAccessError';
  }
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
  chlorineSource: string | null;
  saltLevelPpm: number | null;
  sanitizerTargetMinPpm: number | null;
  sanitizerTargetMaxPpm: number | null;
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

export interface AdminPoolMemberSummary {
  poolId: string;
  userId: string;
  roleName: string;
  email: string | null;
  name: string | null;
}

export interface AdminPoolSummary {
  id: string;
  ownerId: string;
  name: string;
  volumeGallons: number;
  surfaceType: string | null;
  sanitizerType: string | null;
  chlorineSource: string | null;
  saltLevelPpm: number | null;
  sanitizerTargetMinPpm: number | null;
  sanitizerTargetMaxPpm: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
  memberCount: number;
  lastTestedAt: Date | null;
  members: AdminPoolMemberSummary[];
}

export class PoolCoreService {
  constructor(private readonly db = dbClient) {}

  async ensurePoolExists(poolId: string) {
    const [pool] = await this.db
      .select({ poolId: schema.pools.poolId })
      .from(schema.pools)
      .where(eq(schema.pools.poolId, poolId))
      .limit(1);

    if (!pool) {
      throw new PoolNotFoundError(poolId);
    }

    return pool;
  }

  async ensurePoolAccess(poolId: string, userId: string) {
    const [pool] = await this.db
      .select({ poolId: schema.pools.poolId, ownerId: schema.pools.ownerId })
      .from(schema.pools)
      .where(eq(schema.pools.poolId, poolId));

    if (!pool) {
      throw new PoolNotFoundError(poolId);
    }

    if (pool.ownerId === userId) {
      return pool;
    }

    const memberships = await this.db
      .select({ userId: schema.poolMembers.userId })
      .from(schema.poolMembers)
      .where(and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, userId)))
      .limit(1);

    if (memberships.length === 0) {
      throw new PoolForbiddenError(poolId);
    }

    return pool;
  }

  async getPoolAccess(poolId: string, userId: string) {
    const [pool] = await this.db
      .select({ poolId: schema.pools.poolId, ownerId: schema.pools.ownerId })
      .from(schema.pools)
      .where(eq(schema.pools.poolId, poolId))
      .limit(1);

    if (!pool) {
      throw new PoolNotFoundError(poolId);
    }

    if (pool.ownerId === userId) {
      return { pool, isOwner: true, roleName: 'owner' } as const;
    }

    const [membership] = await this.db
      .select({ roleName: schema.poolMembers.roleName })
      .from(schema.poolMembers)
      .where(and(eq(schema.poolMembers.poolId, poolId), eq(schema.poolMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      throw new PoolForbiddenError(poolId);
    }

    return { pool, isOwner: false, roleName: membership.roleName ?? 'viewer' } as const;
  }

  async ensurePoolOwner(poolId: string, userId: string) {
    return this.ensurePoolCapability(poolId, userId, 'pool.update');
  }

  async ensurePoolCapability(poolId: string, userId: string, capability: PoolCapability) {
    const access = await this.getPoolAccess(poolId, userId);
    const allowed = hasPoolCapability(capability, {
      isOwner: access.isOwner,
      poolRole: access.roleName,
    });
    if (!allowed) {
      if (requiresOwnerForCapability(capability)) {
        throw new PoolOwnerRequiredError(poolId);
      }
      throw new PoolForbiddenError(poolId);
    }
    return access.pool;
  }

  async ensureLocationAccessible(locationId: string, userId: string) {
    const [location] = await this.db
      .select({
        userId: schema.userLocations.userId,
        isActive: schema.userLocations.isActive,
      })
      .from(schema.userLocations)
      .where(eq(schema.userLocations.locationId, locationId))
      .limit(1);

    if (!location || location.isActive === false || location.userId !== userId) {
      throw new PoolLocationAccessError(locationId);
    }
  }

  async createPool(requestingUserId: string, data: CreatePoolData, requesterRole?: string) {
    const ownerId = data.ownerId && data.ownerId !== requestingUserId ? data.ownerId : requestingUserId;

    if (ownerId !== requestingUserId && !canAssignPoolOwner(requesterRole)) {
      throw new PoolCreateOwnerForbiddenError();
    }

    if (data.locationId) {
      await this.ensureLocationAccessible(data.locationId, ownerId);
    }

    const chemistry = resolvePoolChemistryConfig({
      nextSanitizerType: data.sanitizerType,
      nextChlorineSource: data.chlorineSource,
      nextSaltLevelPpm: data.saltLevelPpm,
      nextTargetMinPpm: data.sanitizerTargetMinPpm,
      nextTargetMaxPpm: data.sanitizerTargetMaxPpm,
    });

    const [pool] = await this.db
      .insert(schema.pools)
      .values(
        mapCreatePoolData(ownerId, {
          ...data,
          sanitizerType: chemistry.sanitizerType,
          chlorineSource: chemistry.chlorineSource,
          saltLevelPpm: chemistry.saltLevelPpm,
          sanitizerTargetMinPpm: chemistry.sanitizerTargetMinPpm,
          sanitizerTargetMaxPpm: chemistry.sanitizerTargetMaxPpm,
        })
      )
      .returning();

    await this.db.insert(schema.poolMembers).values({
      poolId: pool.poolId,
      userId: ownerId,
      roleName: 'owner',
    });

    if (ownerId !== requestingUserId) {
      await this.db
        .insert(schema.poolMembers)
        .values({
          poolId: pool.poolId,
          userId: requestingUserId,
          roleName: 'operator',
        })
        .onConflictDoNothing();
    }

    return pool;
  }

  async getPools(userId: string, filterOwner = false) {
    if (filterOwner) {
      const ownerPools = await this.db.select().from(schema.pools).where(eq(schema.pools.ownerId, userId));
      return ownerPools.map((pool) => ({ ...pool, accessRole: 'owner' }));
    }

    const memberships = await this.db
      .select({ poolId: schema.poolMembers.poolId, roleName: schema.poolMembers.roleName })
      .from(schema.poolMembers)
      .where(eq(schema.poolMembers.userId, userId));
    const poolIds = memberships.map((m) => m.poolId);

    if (poolIds.length === 0) {
      return [];
    }

    const pools = await this.db.select().from(schema.pools).where(inArray(schema.pools.poolId, poolIds));
    const rolesByPool = new Map(memberships.map((m) => [m.poolId, m.roleName ?? 'viewer']));
    return pools.map((pool) => ({
      ...pool,
      accessRole: pool.ownerId === userId ? 'owner' : rolesByPool.get(pool.poolId) ?? 'viewer',
    }));
  }

  async getPoolById(
    poolId: string,
    requestingUserId: string | null,
    options?: { asAdmin?: boolean }
  ): Promise<PoolDetail | null> {
    if (options?.asAdmin) {
      await this.ensurePoolExists(poolId);
    } else {
      if (!requestingUserId) {
        throw new PoolForbiddenError(poolId);
      }
      await this.ensurePoolAccess(poolId, requestingUserId);
    }

    const [poolRow] = await this.db
      .select({
        poolId: schema.pools.poolId,
        ownerId: schema.pools.ownerId,
        locationId: schema.pools.locationId,
        name: schema.pools.name,
        volumeGallons: schema.pools.volumeGallons,
        surfaceType: schema.pools.surfaceType,
        sanitizerType: schema.pools.sanitizerType,
        chlorineSource: schema.pools.chlorineSource,
        saltLevelPpm: schema.pools.saltLevelPpm,
        sanitizerTargetMinPpm: schema.pools.sanitizerTargetMinPpm,
        sanitizerTargetMaxPpm: schema.pools.sanitizerTargetMaxPpm,
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
      throw new PoolNotFoundError(poolId);
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
      chlorineSource: poolRow.chlorineSource ?? null,
      saltLevelPpm: poolRow.saltLevelPpm ?? null,
      sanitizerTargetMinPpm: toNumber(poolRow.sanitizerTargetMinPpm),
      sanitizerTargetMaxPpm: toNumber(poolRow.sanitizerTargetMaxPpm),
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

  async updatePool(poolId: string, requestingUserId: string, data: UpdatePoolData) {
    await this.ensurePoolCapability(poolId, requestingUserId, 'pool.update');

    if (data.locationId && typeof data.locationId === 'string') {
      await this.ensureLocationAccessible(data.locationId, requestingUserId);
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
    return pool;
  }

  async deletePool(poolId: string, requestingUserId: string) {
    await this.ensurePoolCapability(poolId, requestingUserId, 'pool.delete');
    await this.db.delete(schema.pools).where(eq(schema.pools.poolId, poolId));
  }
}

export const poolCoreService = new PoolCoreService();
