import { hash, verify } from 'argon2';
import { randomBytes } from 'crypto';
import { db } from '../db/index.js';
import { env } from '../env.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

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
  private static readonly HASH_OPTIONS = {
    type: 2, // argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  async createUser(data: CreateUserData) {
    const passwordHash = await hash(data.password, AuthService.HASH_OPTIONS);
    
    const [user] = await db.insert(schema.users).values({
      email: data.email,
      passwordHash,
      name: data.name || null,
      isActive: true,
    }).returning({
      userId: schema.users.userId,
    });

    return user.userId;
  }

  async validateCredentials(data: LoginData) {
    const [user] = await db.select().from(schema.users)
      .where(eq(schema.users.email, data.email));

    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await verify(user.passwordHash, data.password);
    if (!isValid) {
      return null;
    }

    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
    };
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
    const tokenHash = await hash(token, AuthService.HASH_OPTIONS);
    
    const [apiToken] = await db.insert(schema.apiTokens).values({
      userId,
      name,
      tokenHash,
      permissions: permissions || {},
      lastUsedAt: null,
    }).returning({
      tokenId: schema.apiTokens.tokenId,
      name: schema.apiTokens.name,
      createdAt: schema.apiTokens.createdAt,
    });

    return {
      ...apiToken,
      preview: token, // Only returned once
    };
  }

  async validateApiToken(token: string) {
    // Get all active tokens (we need to check hash for each)
    const tokens = await db.select().from(schema.apiTokens)
      .where(eq(schema.apiTokens.revoked, false));

    for (const apiToken of tokens) {
      const isValid = await verify(apiToken.tokenHash, token);
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
    const [user] = await db.select({
      userId: schema.users.userId,
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
    }).from(schema.users)
      .where(eq(schema.users.userId, userId));

    return user;
  }
}

export const authService = new AuthService();
