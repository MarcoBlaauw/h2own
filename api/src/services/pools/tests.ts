import { db as dbClient } from '../../db/index.js';
import * as schema from '../../db/schema/index.js';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { PoolCoreService } from './core.js';

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

export class PoolTestingService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  async createTest(poolId: string, userId: string, data: CreateTestData) {
    await this.core.ensurePoolAccess(poolId, userId);

    let cc: number | undefined;
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
    requestingUserId: string,
    limit: number,
    cursor?: { testedAt: Date; sessionId?: string }
  ) {
    await this.core.ensurePoolAccess(poolId, requestingUserId);

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
      let cc: number | undefined;
      if (item.totalChlorinePpm && item.freeChlorinePpm) {
        cc = Math.max(0, parseFloat(item.totalChlorinePpm) - parseFloat(item.freeChlorinePpm));
      }
      return { ...item, cc };
    });

    return { items: itemsWithCC, nextCursor };
  }

  async getTestById(sessionId: string, requestingUserId: string) {
    const [test] = await this.db
      .select()
      .from(schema.testSessions)
      .where(eq(schema.testSessions.sessionId, sessionId));

    if (!test) {
      return null;
    }

    await this.core.ensurePoolAccess(test.poolId, requestingUserId);

    let cc: number | undefined;
    if (test.totalChlorinePpm && test.freeChlorinePpm) {
      cc = Math.max(0, parseFloat(test.totalChlorinePpm) - parseFloat(test.freeChlorinePpm));
    }

    return { ...test, cc };
  }

  async createDosingEvent(poolId: string, userId: string, data: CreateDosingData) {
    await this.core.ensurePoolAccess(poolId, userId);

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

export const poolTestingService = new PoolTestingService();
