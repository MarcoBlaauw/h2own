import { and, eq, inArray } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

export interface LocationPoolSummary {
  poolId: string;
  name: string;
}

export interface LocationUserSummary {
  userId: string;
  email: string | null;
  name: string | null;
}

export interface LocationDetail {
  locationId: string;
  userId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  user: LocationUserSummary | null;
  pools: LocationPoolSummary[];
}

export interface CreateLocationData {
  userId: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface UpdateLocationData {
  userId?: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  isPrimary?: boolean;
  assignPools?: string[];
  unassignPools?: string[];
}

export interface DeactivateLocationOptions {
  transferPoolsTo?: string | null;
}

type LocationInsert = typeof schema.userLocations.$inferInsert;

type LocationRow = {
  locationId: string;
  userId: string;
  name: string;
  latitude: string | number | null;
  longitude: string | number | null;
  timezone: string | null;
  isPrimary: boolean | null;
  isActive: boolean | null;
  createdAt: Date;
  userEmail: string | null;
  userName: string | null;
};

type PoolRow = {
  poolId: string;
  name: string;
  locationId?: string | null;
};

function toOptionalDecimal(value?: number | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.toString();
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return numeric;
}

function mapCreateLocationData(data: CreateLocationData): LocationInsert {
  const mapped: LocationInsert = {
    userId: data.userId,
    name: data.name,
    isPrimary: data.isPrimary,
    isActive: data.isActive ?? true,
  };

  const latitude = toOptionalDecimal(data.latitude ?? undefined);
  if (latitude !== undefined) {
    mapped.latitude = latitude;
  }

  const longitude = toOptionalDecimal(data.longitude ?? undefined);
  if (longitude !== undefined) {
    mapped.longitude = longitude;
  }

  if (data.timezone !== undefined) {
    mapped.timezone = data.timezone ?? null;
  }

  return mapped;
}

function mapUpdateLocationData(data: UpdateLocationData): Partial<LocationInsert> {
  const mapped: Partial<LocationInsert> = {};

  if (data.userId !== undefined) {
    mapped.userId = data.userId;
  }

  if (data.name !== undefined) {
    mapped.name = data.name;
  }

  if (data.latitude !== undefined) {
    mapped.latitude = toOptionalDecimal(data.latitude);
  }

  if (data.longitude !== undefined) {
    mapped.longitude = toOptionalDecimal(data.longitude);
  }

  if (data.timezone !== undefined) {
    mapped.timezone = data.timezone ?? null;
  }

  if (data.isPrimary !== undefined) {
    mapped.isPrimary = data.isPrimary;
  }

  return mapped;
}

export class LocationTransferTargetError extends Error {
  constructor(public readonly targetLocationId: string) {
    super(`Cannot transfer pools to location ${targetLocationId}`);
    this.name = 'LocationTransferTargetError';
  }
}

export class LocationsService {
  constructor(private readonly db = dbClient) {}

  private mapLocation(row: LocationRow, pools: PoolRow[]): LocationDetail {
    return {
      locationId: row.locationId,
      userId: row.userId,
      name: row.name,
      latitude: toNullableNumber(row.latitude),
      longitude: toNullableNumber(row.longitude),
      timezone: row.timezone ?? null,
      isPrimary: Boolean(row.isPrimary),
      isActive: row.isActive ?? true,
      createdAt: row.createdAt,
      user: row.userId
        ? {
            userId: row.userId,
            email: row.userEmail,
            name: row.userName,
          }
        : null,
      pools: pools.map((pool) => ({
        poolId: pool.poolId,
        name: pool.name,
      })),
    } satisfies LocationDetail;
  }

  private async getLocationDetail(locationId: string) {
    const [row] = await this.db
      .select({
        locationId: schema.userLocations.locationId,
        userId: schema.userLocations.userId,
        name: schema.userLocations.name,
        latitude: schema.userLocations.latitude,
        longitude: schema.userLocations.longitude,
        timezone: schema.userLocations.timezone,
        isPrimary: schema.userLocations.isPrimary,
        isActive: schema.userLocations.isActive,
        createdAt: schema.userLocations.createdAt,
        userEmail: schema.users.email,
        userName: schema.users.name,
      })
      .from(schema.userLocations)
      .leftJoin(schema.users, eq(schema.userLocations.userId, schema.users.userId))
      .where(eq(schema.userLocations.locationId, locationId))
      .limit(1);

    if (!row) {
      return null;
    }

    const pools = await this.db
      .select({
        poolId: schema.pools.poolId,
        name: schema.pools.name,
      })
      .from(schema.pools)
      .where(eq(schema.pools.locationId, locationId));

    return this.mapLocation(row, pools);
  }

  async listLocations(): Promise<LocationDetail[]> {
    const rows = await this.db
      .select({
        locationId: schema.userLocations.locationId,
        userId: schema.userLocations.userId,
        name: schema.userLocations.name,
        latitude: schema.userLocations.latitude,
        longitude: schema.userLocations.longitude,
        timezone: schema.userLocations.timezone,
        isPrimary: schema.userLocations.isPrimary,
        isActive: schema.userLocations.isActive,
        createdAt: schema.userLocations.createdAt,
        userEmail: schema.users.email,
        userName: schema.users.name,
      })
      .from(schema.userLocations)
      .leftJoin(schema.users, eq(schema.userLocations.userId, schema.users.userId));

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.locationId);
    const poolRows = await this.db
      .select({
        poolId: schema.pools.poolId,
        name: schema.pools.name,
        locationId: schema.pools.locationId,
      })
      .from(schema.pools)
      .where(inArray(schema.pools.locationId, ids));

    const poolsByLocation = new Map<string, PoolRow[]>();
    for (const pool of poolRows) {
      if (!pool.locationId) continue;
      const list = poolsByLocation.get(pool.locationId) ?? [];
      list.push(pool);
      poolsByLocation.set(pool.locationId, list);
    }

    return rows.map((row) => this.mapLocation(row, poolsByLocation.get(row.locationId) ?? []));
  }

  async createLocation(data: CreateLocationData) {
    const [inserted] = await this.db
      .insert(schema.userLocations)
      .values(mapCreateLocationData(data))
      .returning({ locationId: schema.userLocations.locationId });

    if (!inserted) {
      return null;
    }

    return this.getLocationDetail(inserted.locationId);
  }

  async updateLocation(locationId: string, data: UpdateLocationData) {
    const mapped = mapUpdateLocationData(data);

    if (Object.keys(mapped).length > 0) {
      const [updated] = await this.db
        .update(schema.userLocations)
        .set(mapped)
        .where(eq(schema.userLocations.locationId, locationId))
        .returning({ locationId: schema.userLocations.locationId });

      if (!updated) {
        return null;
      }
    } else {
      const exists = await this.db
        .select({ locationId: schema.userLocations.locationId })
        .from(schema.userLocations)
        .where(eq(schema.userLocations.locationId, locationId))
        .limit(1);

      if (exists.length === 0) {
        return null;
      }
    }

    if (data.assignPools && data.assignPools.length > 0) {
      await this.db
        .update(schema.pools)
        .set({ locationId })
        .where(inArray(schema.pools.poolId, data.assignPools));
    }

    if (data.unassignPools && data.unassignPools.length > 0) {
      await this.db
        .update(schema.pools)
        .set({ locationId: null })
        .where(
          and(
            eq(schema.pools.locationId, locationId),
            inArray(schema.pools.poolId, data.unassignPools)
          )
        );
    }

    return this.getLocationDetail(locationId);
  }

  async deactivateLocation(locationId: string, options: DeactivateLocationOptions = {}) {
    const [updated] = await this.db
      .update(schema.userLocations)
      .set({ isActive: false, isPrimary: false })
      .where(eq(schema.userLocations.locationId, locationId))
      .returning({ locationId: schema.userLocations.locationId });

    if (!updated) {
      return null;
    }

    if (options.transferPoolsTo !== undefined) {
      const target = options.transferPoolsTo;
      if (target === null) {
        await this.db
          .update(schema.pools)
          .set({ locationId: null })
          .where(eq(schema.pools.locationId, locationId));
      } else {
        if (target === locationId) {
          // nothing to do, already assigned
          // fall through to return detail
        } else {
          const [targetLocation] = await this.db
            .select({
              locationId: schema.userLocations.locationId,
              isActive: schema.userLocations.isActive,
            })
            .from(schema.userLocations)
            .where(eq(schema.userLocations.locationId, target))
            .limit(1);

          if (!targetLocation || targetLocation.isActive === false) {
            throw new LocationTransferTargetError(target);
          }

          await this.db
            .update(schema.pools)
            .set({ locationId: target })
            .where(eq(schema.pools.locationId, locationId));
        }
      }
    }

    return this.getLocationDetail(locationId);
  }
}

export const locationsService = new LocationsService();
