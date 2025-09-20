import type { FastifyBaseLogger } from "fastify";

export interface SessionRecord {
  userId: string;
  role?: string | null;
  expiresAt: number;
}

export interface KeyValueClient {
  set(key: string, value: string, ...args: any[]): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

export interface RedisSessionStore {
  readonly ttlSeconds: number;
  save(sid: string, record: SessionRecord): Promise<void>;
  find(sid: string): Promise<SessionRecord | null>;
  delete(sid: string): Promise<void>;
  touch(sid: string): Promise<void>;
}

interface CreateOptions {
  ttlSeconds: number;
  prefix?: string;
  logger?: FastifyBaseLogger;
}

function buildKey(prefix: string, sid: string) {
  return `${prefix}:${sid}`;
}

export function createRedisSessionStore(
  client: KeyValueClient,
  options: CreateOptions,
): RedisSessionStore {
  const prefix = options.prefix ?? "session";
  const ttlSeconds = options.ttlSeconds;
  const logger = options.logger;

  return {
    ttlSeconds,
    async save(sid, record) {
      const key = buildKey(prefix, sid);
      try {
        await client.set(key, JSON.stringify(record), "EX", ttlSeconds);
      } catch (error) {
        logger?.error({ err: error }, "failed to persist session");
        throw error;
      }
    },
    async find(sid) {
      const key = buildKey(prefix, sid);
      const raw = await client.get(key);
      if (!raw) return null;

      try {
        const record = JSON.parse(raw) as SessionRecord;
        return record;
      } catch (error) {
        logger?.warn({ err: error }, "removing corrupted session payload");
        await client.del(key);
        return null;
      }
    },
    async delete(sid) {
      const key = buildKey(prefix, sid);
      await client.del(key);
    },
    async touch(sid) {
      const key = buildKey(prefix, sid);
      await client.expire(key, ttlSeconds);
    },
  };
}
