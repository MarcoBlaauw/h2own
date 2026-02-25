type RedisLike = {
  zadd: (key: string, score: number, member: string) => Promise<number>;
  zremrangebyscore: (key: string, min: string | number, max: string | number) => Promise<number>;
  zcount: (key: string, min: string | number, max: string | number) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  incr: (key: string) => Promise<number>;
  expireat: (key: string, timestampSeconds: number) => Promise<number>;
  psetex: (key: string, milliseconds: number, value: string) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  del: (...keys: string[]) => Promise<number>;
};

export interface LockoutStatus {
  locked: boolean;
  offenseLevel: 0 | 1 | 2 | 3;
  until: string | null;
  remainingSeconds: number;
  supportRequired: boolean;
  warning: string | null;
}

export interface RecordFailureResult extends LockoutStatus {
  attemptsLastMinute: number;
  attemptsLastFiveMinutes: number;
}

const ATTEMPT_WINDOW_1M_MS = 60_000;
const ATTEMPT_WINDOW_5M_MS = 5 * ATTEMPT_WINDOW_1M_MS;
const THRESHOLD_1M = 5;
const THRESHOLD_5M = 10;
const WARNING_1M = 4;
const WARNING_5M = 8;
const FIRST_LOCKOUT_MS = 15 * 60_000;
const SECOND_LOCKOUT_MS = 60 * 60_000;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const encodeScope = (email: string, ipAddress: string) =>
  `${encodeURIComponent(normalizeEmail(email))}:${encodeURIComponent(ipAddress.trim() || "unknown")}`;

const lockoutKey = (scope: string) => `auth:lockout:${scope}`;
const failureSetKey = (scope: string) => `auth:failed:${scope}`;
const dayOffenseKey = (scope: string, dayKey: string) =>
  `auth:lockout:offenses:${dayKey}:${scope}`;

const offenseLevelForCount = (offenseCount: number): 1 | 2 | 3 => {
  if (offenseCount <= 1) return 1;
  if (offenseCount === 2) return 2;
  return 3;
};

const dayKeyUtc = (now: Date) => now.toISOString().slice(0, 10);

const secondsUntilEndOfUtcDay = (now: Date) => {
  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return Math.max(1, Math.floor((end.getTime() - now.getTime()) / 1000));
};

const endOfUtcDayMs = (now: Date) => {
  const seconds = secondsUntilEndOfUtcDay(now);
  return seconds * 1000;
};

const warningMessage = (attemptsLastMinute: number, attemptsLastFiveMinutes: number) => {
  if (attemptsLastMinute >= WARNING_1M && attemptsLastMinute < THRESHOLD_1M) {
    return "Warning: one more failed attempt in the next minute will temporarily lock your account.";
  }
  if (attemptsLastFiveMinutes >= WARNING_5M && attemptsLastFiveMinutes < THRESHOLD_5M) {
    return "Warning: more failed attempts in the next five minutes will temporarily lock your account.";
  }
  return null;
};

const parseLockoutPayload = (raw: string | null) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { offenseLevel?: number; until?: string };
    const offenseLevelRaw = Number(parsed.offenseLevel ?? 0);
    const offenseLevel: 1 | 2 | 3 =
      offenseLevelRaw >= 3 ? 3 : offenseLevelRaw === 2 ? 2 : 1;
    const until = typeof parsed.until === "string" ? parsed.until : null;
    return { offenseLevel, until };
  } catch {
    return null;
  }
};

export class AuthLockoutService {
  async getStatus(
    redis: RedisLike,
    email: string,
    ipAddress: string,
    now: Date = new Date(),
  ): Promise<LockoutStatus> {
    const scope = encodeScope(email, ipAddress);
    const data = parseLockoutPayload(await redis.get(lockoutKey(scope)));
    if (!data?.until) {
      return {
        locked: false,
        offenseLevel: 0,
        until: null,
        remainingSeconds: 0,
        supportRequired: false,
        warning: null,
      };
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil((new Date(data.until).getTime() - now.getTime()) / 1000),
    );
    if (remainingSeconds <= 0) {
      await redis.del(lockoutKey(scope));
      return {
        locked: false,
        offenseLevel: 0,
        until: null,
        remainingSeconds: 0,
        supportRequired: false,
        warning: null,
      };
    }

    return {
      locked: true,
      offenseLevel: data.offenseLevel,
      until: data.until,
      remainingSeconds,
      supportRequired: data.offenseLevel >= 3,
      warning: null,
    };
  }

  async clearFailureHistory(redis: RedisLike, email: string, ipAddress: string) {
    const scope = encodeScope(email, ipAddress);
    await redis.del(failureSetKey(scope));
  }

  async recordFailure(
    redis: RedisLike,
    email: string,
    ipAddress: string,
    now: Date = new Date(),
  ): Promise<RecordFailureResult> {
    const scope = encodeScope(email, ipAddress);
    const nowMs = now.getTime();
    const failuresKey = failureSetKey(scope);
    await redis.zadd(
      failuresKey,
      nowMs,
      `${nowMs}:${Math.random().toString(36).slice(2, 10)}`,
    );
    await redis.zremrangebyscore(failuresKey, "-inf", nowMs - ATTEMPT_WINDOW_5M_MS);
    await redis.expire(failuresKey, 60 * 60 * 24);

    const attemptsLastMinute = await redis.zcount(failuresKey, nowMs - ATTEMPT_WINDOW_1M_MS, "+inf");
    const attemptsLastFiveMinutes = await redis.zcount(
      failuresKey,
      nowMs - ATTEMPT_WINDOW_5M_MS,
      "+inf",
    );

    const thresholdExceeded =
      attemptsLastMinute >= THRESHOLD_1M || attemptsLastFiveMinutes >= THRESHOLD_5M;

    if (!thresholdExceeded) {
      return {
        locked: false,
        offenseLevel: 0,
        until: null,
        remainingSeconds: 0,
        supportRequired: false,
        warning: warningMessage(attemptsLastMinute, attemptsLastFiveMinutes),
        attemptsLastMinute,
        attemptsLastFiveMinutes,
      };
    }

    const dayKey = dayKeyUtc(now);
    const offenseCount = await redis.incr(dayOffenseKey(scope, dayKey));
    await redis.expireat(
      dayOffenseKey(scope, dayKey),
      Math.floor(now.getTime() / 1000) + secondsUntilEndOfUtcDay(now),
    );

    const offenseLevel = offenseLevelForCount(offenseCount);
    const lockoutMs =
      offenseLevel === 1
        ? FIRST_LOCKOUT_MS
        : offenseLevel === 2
          ? SECOND_LOCKOUT_MS
          : endOfUtcDayMs(now);

    const until = new Date(nowMs + lockoutMs).toISOString();
    await redis.psetex(
      lockoutKey(scope),
      lockoutMs,
      JSON.stringify({ offenseLevel, until }),
    );

    return {
      locked: true,
      offenseLevel,
      until,
      remainingSeconds: Math.ceil(lockoutMs / 1000),
      supportRequired: offenseLevel >= 3,
      warning: null,
      attemptsLastMinute,
      attemptsLastFiveMinutes,
    };
  }
}

export const authLockoutService = new AuthLockoutService();
