import { randomBytes } from 'crypto';
import { hash } from 'argon2';
import { and, eq, ilike, or, SQL, asc } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

const HASH_OPTIONS = {
  type: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class UsersForbiddenError extends Error {
  readonly statusCode = 403;
  readonly code = 'UsersForbidden';

  constructor(message = 'Only administrators can manage users.') {
    super(message);
    this.name = 'UsersForbiddenError';
  }
}

export interface UsersServiceFilters {
  search?: string;
  role?: string;
  isActive?: boolean;
}

export interface UsersServiceUpdate {
  role?: string;
  isActive?: boolean;
}

export interface ResetPasswordResult {
  userId: string;
  temporaryPassword: string;
}

type SessionRole = string | null | undefined;

function buildFilters(filters: UsersServiceFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.role) {
    conditions.push(eq(schema.users.role, filters.role));
  }

  if (typeof filters.isActive === 'boolean') {
    conditions.push(eq(schema.users.isActive, filters.isActive));
  }

  if (filters.search) {
    const query = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(schema.users.email, query),
        ilike(schema.users.name, query)
      )!
    );
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

function generatePassword() {
  return randomBytes(12).toString('base64url').slice(0, 18);
}

export class UsersService {
  constructor(private readonly db = dbClient) {}

  private ensureAdmin(role: SessionRole) {
    if (role !== 'admin') {
      throw new UsersForbiddenError();
    }
  }

  async listUsers(role: SessionRole, filters: UsersServiceFilters = {}) {
    this.ensureAdmin(role);

    const where = buildFilters(filters);

    const query = this.db
      .select({
        userId: schema.users.userId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users);

    if (where) {
      return query.where(where).orderBy(asc(schema.users.createdAt));
    }

    return query.orderBy(asc(schema.users.createdAt));
  }

  async updateUser(role: SessionRole, userId: string, updates: UsersServiceUpdate) {
    this.ensureAdmin(role);

    const payload: Partial<typeof schema.users.$inferInsert> = {};

    if (updates.role !== undefined) {
      payload.role = updates.role;
    }

    if (updates.isActive !== undefined) {
      payload.isActive = updates.isActive;
    }

    if (Object.keys(payload).length === 0) {
      return null;
    }

    payload.updatedAt = new Date();

    const [user] = await this.db
      .update(schema.users)
      .set(payload)
      .where(eq(schema.users.userId, userId))
      .returning({
        userId: schema.users.userId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      });

    return user ?? null;
  }

  async resetPassword(role: SessionRole, userId: string, newPassword?: string) {
    this.ensureAdmin(role);

    const password = newPassword?.trim() ? newPassword.trim() : generatePassword();
    const passwordHash = await hash(password, HASH_OPTIONS);

    const [user] = await this.db
      .update(schema.users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.users.userId, userId))
      .returning({ userId: schema.users.userId });

    if (!user) {
      return null;
    }

    return { userId: user.userId, temporaryPassword: password } satisfies ResetPasswordResult;
  }
}

export const usersService = new UsersService();
