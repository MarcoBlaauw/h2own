import { and, eq } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

const POSTGRES_UNIQUE_VIOLATION = '23505';

const isPostgresError = (error: unknown): error is { code: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
};

export class ProfileEmailConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'ProfileEmailConflict';

  constructor(message = 'An account with that email already exists.') {
    super(message);
    this.name = 'ProfileEmailConflictError';
  }
}

export type ProfileData = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  address: string | null;
  supervisors: Array<{
    userId: string;
    email: string;
    name: string | null;
  }>;
};

export type UpdateProfileData = {
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  address?: string | null;
};

const normalizeNullableText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const deriveDisplayName = (firstName: string | null, lastName: string | null, nickname: string | null) => {
  const fullName = [firstName, lastName].filter((part): part is string => Boolean(part)).join(' ').trim();
  if (fullName) return fullName;
  return nickname ?? null;
};

export class ProfileService {
  constructor(private readonly db = dbClient) {}

  async getProfile(userId: string): Promise<ProfileData | null> {
    const [row] = await this.db
      .select({
        userId: schema.users.userId,
        email: schema.users.email,
        firstName: schema.userProfiles.firstName,
        lastName: schema.userProfiles.lastName,
        nickname: schema.userProfiles.nickname,
        address: schema.userProfiles.address,
      })
      .from(schema.users)
      .leftJoin(schema.userProfiles, eq(schema.users.userId, schema.userProfiles.userId))
      .where(eq(schema.users.userId, userId))
      .limit(1);

    if (!row) return null;

    const supervisorRows = await this.db
      .select({
        userId: schema.users.userId,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.poolMembers)
      .innerJoin(schema.pools, eq(schema.poolMembers.poolId, schema.pools.poolId))
      .innerJoin(schema.users, eq(schema.pools.ownerId, schema.users.userId))
      .where(
        and(
          eq(schema.poolMembers.userId, userId),
          eq(schema.pools.isActive, true)
        )
      );

    const supervisors = Array.from(
      new Map(
        supervisorRows
          .filter((supervisor) => supervisor.userId !== userId)
          .map((supervisor) => [supervisor.userId, supervisor])
      ).values()
    );

    return {
      userId: row.userId,
      email: row.email,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      nickname: row.nickname ?? null,
      address: row.address ?? null,
      supervisors,
    } satisfies ProfileData;
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<ProfileData | null> {
    try {
      await this.db.transaction(async (tx) => {
        const [currentUser] = await tx
          .select({ email: schema.users.email })
          .from(schema.users)
          .where(eq(schema.users.userId, userId))
          .limit(1);

        if (!currentUser) {
          return;
        }

        const profilePatch = {
          firstName: normalizeNullableText(data.firstName),
          lastName: normalizeNullableText(data.lastName),
          nickname: normalizeNullableText(data.nickname),
          address: normalizeNullableText(data.address),
        };

        const includesProfileChange = Object.values(profilePatch).some((value) => value !== undefined);

        if (includesProfileChange) {
          const [currentProfile] = await tx
            .select({
              firstName: schema.userProfiles.firstName,
              lastName: schema.userProfiles.lastName,
              nickname: schema.userProfiles.nickname,
              address: schema.userProfiles.address,
            })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.userId, userId))
            .limit(1);

          const merged = {
            firstName: profilePatch.firstName === undefined ? currentProfile?.firstName ?? null : profilePatch.firstName,
            lastName: profilePatch.lastName === undefined ? currentProfile?.lastName ?? null : profilePatch.lastName,
            nickname: profilePatch.nickname === undefined ? currentProfile?.nickname ?? null : profilePatch.nickname,
            address: profilePatch.address === undefined ? currentProfile?.address ?? null : profilePatch.address,
          };

          if (currentProfile) {
            await tx
              .update(schema.userProfiles)
              .set({ ...merged, updatedAt: new Date() })
              .where(eq(schema.userProfiles.userId, userId));
          } else {
            await tx.insert(schema.userProfiles).values({
              userId,
              ...merged,
            });
          }

          await tx
            .update(schema.users)
            .set({
              name: deriveDisplayName(merged.firstName, merged.lastName, merged.nickname),
              updatedAt: new Date(),
            })
            .where(eq(schema.users.userId, userId));
        }
      });
    } catch (error) {
      if (isPostgresError(error) && error.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ProfileEmailConflictError();
      }
      throw error;
    }

    return this.getProfile(userId);
  }
}

export const profileService = new ProfileService();
