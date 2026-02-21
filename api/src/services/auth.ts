import { randomBytes } from 'crypto';
import { db } from '../db/index.js';
import { env } from '../env.js';
import * as schema from '../db/schema/index.js';
import { and, desc, eq, sql } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './passwords.js';

const POSTGRES_UNIQUE_VIOLATION = '23505';

const isPostgresError = (error: unknown): error is { code: string } => {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as any).code === 'string';
};

export class UserAlreadyExistsError extends Error {
  readonly statusCode = 409;
  readonly code = 'UserAlreadyExists';

  constructor(message = 'An account with that email already exists') {
    super(message);
    this.name = 'UserAlreadyExistsError';
  }
}

export interface CreateUserData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  async createUser(data: CreateUserData) {
    const passwordHash = await hashPassword(data.password);
    
    try {
      return await db.transaction(async (tx) => {
        const userCountResult = await tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(schema.users);

        const userCount = Number(userCountResult[0]?.count ?? 0);
        const isFirstUser = userCount === 0;

        const [user] = await tx
          .insert(schema.users)
          .values({
            email: data.email,
            passwordHash,
            name: data.name || null,
            isActive: true,
            ...(isFirstUser ? { role: 'admin' } : {}),
          })
          .returning({
            userId: schema.users.userId,
          });

        return user.userId;
      });
    } catch (error) {
      if (isPostgresError(error) && error.code === POSTGRES_UNIQUE_VIOLATION) {
        throw new UserAlreadyExistsError();
      }

      throw error;
    }
  }

  async validateCredentials(data: LoginData) {
    const [user] = await db
      .select({
        userId: schema.users.userId,
        email: schema.users.email,
        name: schema.users.name,
        passwordHash: schema.users.passwordHash,
        isActive: schema.users.isActive,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.email, data.email));

    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await verifyPassword(user.passwordHash, data.password);
    if (!isValid) {
      return null;
    }

    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  async getUserByEmail(email: string) {
    const [user] = await db
      .select({
        userId: schema.users.userId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        isActive: schema.users.isActive,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email));

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  async updatePasswordByUserId(userId: string, password: string) {
    const passwordHash = await hashPassword(password);
    const [updated] = await db
      .update(schema.users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.users.userId, userId))
      .returning({ userId: schema.users.userId });

    return Boolean(updated);
  }

  async updateEmailByUserId(userId: string, email: string) {
    const [updated] = await db
      .update(schema.users)
      .set({ email, emailVerified: true, updatedAt: new Date() })
      .where(eq(schema.users.userId, userId))
      .returning({ userId: schema.users.userId });

    return Boolean(updated);
  }

  async verifyPasswordByUserId(userId: string, password: string) {
    const [user] = await db
      .select({
        passwordHash: schema.users.passwordHash,
        isActive: schema.users.isActive,
      })
      .from(schema.users)
      .where(eq(schema.users.userId, userId))
      .limit(1);

    if (!user || !user.isActive) {
      return false;
    }

    return verifyPassword(user.passwordHash, password);
  }

  async verifyCaptcha(token: string): Promise<boolean> {
    if (!env.CAPTCHA_PROVIDER || !env.CAPTCHA_SECRET) {
      return false;
    }

    const params = new URLSearchParams();
    params.append('secret', env.CAPTCHA_SECRET);
    params.append('response', token);

    let url: string;
    if (env.CAPTCHA_PROVIDER === 'turnstile') {
      url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    } else {
      url = 'https://hcaptcha.com/siteverify';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: params,
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('CAPTCHA verification failed:', error);
      return false;
    }
  }

  async createApiToken(userId: string, name: string, permissions?: any) {
    const token = `tok_${randomBytes(32).toString('hex')}`;
    const tokenHash = await hashPassword(token);

    const [apiToken] = await db
      .insert(schema.apiTokens)
      .values({
        userId,
        name,
        tokenHash,
        permissions: permissions || {},
        lastUsedAt: null,
      })
      .returning({
        tokenId: schema.apiTokens.tokenId,
        name: schema.apiTokens.name,
        createdAt: schema.apiTokens.createdAt,
      });

    return {
      ...apiToken,
      preview: token, // Only returned once
    };
  }

  async listApiTokens(userId: string) {
    const tokens = await db
      .select({
        tokenId: schema.apiTokens.tokenId,
        name: schema.apiTokens.name,
        createdAt: schema.apiTokens.createdAt,
        lastUsedAt: schema.apiTokens.lastUsedAt,
        revoked: schema.apiTokens.revoked,
        permissions: schema.apiTokens.permissions,
      })
      .from(schema.apiTokens)
      .where(eq(schema.apiTokens.userId, userId))
      .orderBy(desc(schema.apiTokens.createdAt));

    return tokens;
  }

  async revokeApiToken(userId: string, tokenId: string) {
    const [updated] = await db
      .update(schema.apiTokens)
      .set({ revoked: true })
      .where(
        and(
          eq(schema.apiTokens.tokenId, tokenId),
          eq(schema.apiTokens.userId, userId)
        )
      )
      .returning({ tokenId: schema.apiTokens.tokenId });

    return Boolean(updated);
  }

  async validateApiToken(token: string) {
    // Get all active tokens (we need to check hash for each)
    const tokens = await db.select().from(schema.apiTokens)
      .where(eq(schema.apiTokens.revoked, false));

    for (const apiToken of tokens) {
      const isValid = await verifyPassword(apiToken.tokenHash, token);
      if (isValid) {
        // Update last used timestamp
        await db.update(schema.apiTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(schema.apiTokens.tokenId, apiToken.tokenId));
        
        return {
          tokenId: apiToken.tokenId,
          userId: apiToken.userId,
          permissions: apiToken.permissions,
        };
      }
    }

    return null;
  }

  async getUserById(userId: string) {
    const [user] = await db
      .select({
        userId: schema.users.userId,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.userId, userId));

    return user;
  }
}

export const authService = new AuthService();
