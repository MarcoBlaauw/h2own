import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { and, desc, eq } from 'drizzle-orm';
import { PoolCoreService } from './pools/core.js';

export type RecommendationStatus = 'pending' | 'applied' | 'dismissed';

export interface CreateRecommendationData {
  type: string;
  title: string;
  description?: string;
  payload?: unknown;
  status?: RecommendationStatus;
  priorityScore?: number;
  confidenceScore?: number;
  factorsConsidered?: unknown;
  expiresAt?: Date;
  linkedTestId?: string;
  userAction?: unknown;
}

export interface UpdateRecommendationData {
  status?: RecommendationStatus;
  userFeedback?: string;
  userAction?: unknown;
}

export class RecommendationService {
  constructor(
    private readonly db = dbClient,
    private readonly poolCore = new PoolCoreService(db)
  ) {}

  async listRecommendations(poolId: string, userId: string, status?: RecommendationStatus) {
    await this.poolCore.ensurePoolAccess(poolId, userId);

    const filters = [eq(schema.recommendations.poolId, poolId)];
    if (status) {
      filters.push(eq(schema.recommendations.status, status));
    }

    const whereClause = filters.length > 1 ? and(...filters) : filters[0];

    return this.db
      .select()
      .from(schema.recommendations)
      .where(whereClause)
      .orderBy(desc(schema.recommendations.createdAt));
  }

  async createRecommendation(poolId: string, userId: string, data: CreateRecommendationData) {
    await this.poolCore.ensurePoolAccess(poolId, userId);

    if (data.linkedTestId) {
      const [test] = await this.db
        .select()
        .from(schema.testSessions)
        .where(eq(schema.testSessions.sessionId, data.linkedTestId));

      if (!test || test.poolId !== poolId) {
        throw new Error('Test does not belong to this pool');
      }
    }

    const [recommendation] = await this.db
      .insert(schema.recommendations)
      .values({
        poolId,
        createdBy: userId,
        linkedTestId: data.linkedTestId,
        type: data.type,
        priorityScore: data.priorityScore ?? 5,
        title: data.title,
        description: data.description,
        payload: data.payload,
        status: data.status ?? 'pending',
        confidenceScore: data.confidenceScore,
        factorsConsidered: data.factorsConsidered,
        expiresAt: data.expiresAt,
        userAction: data.userAction,
      })
      .returning();

    return recommendation;
  }

  async updateRecommendation(
    poolId: string,
    recommendationId: string,
    userId: string,
    data: UpdateRecommendationData
  ) {
    const [existing] = await this.db
      .select()
      .from(schema.recommendations)
      .where(eq(schema.recommendations.recommendationId, recommendationId));

    if (!existing || existing.poolId !== poolId) {
      return null;
    }

    await this.poolCore.ensurePoolAccess(existing.poolId, userId);

    const [updated] = await this.db
      .update(schema.recommendations)
      .set({
        status: data.status ?? existing.status,
        userFeedback: data.userFeedback ?? existing.userFeedback,
        userAction: data.userAction ?? existing.userAction,
        updatedAt: new Date(),
      })
      .where(eq(schema.recommendations.recommendationId, recommendationId))
      .returning();

    return updated;
  }
}

export const recommendationService = new RecommendationService();
