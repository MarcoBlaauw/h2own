import { db as dbClient } from '../../db/index.js';
import * as schema from '../../db/schema/index.js';
import { and, desc, eq } from 'drizzle-orm';
import { PoolCoreService } from './core.js';

export type RecommendationStatus = 'pending' | 'saved' | 'applied' | 'dismissed';

export interface CreateRecommendationData {
  type: string;
  title: string;
  description?: string;
  payload?: unknown;
  priorityScore?: number;
  confidenceScore?: number;
  factorsConsidered?: unknown;
  expiresAt?: string;
  linkedTestId?: string;
  status?: RecommendationStatus;
  userAction?: unknown;
}

export interface UpdateRecommendationData {
  status?: RecommendationStatus;
  userFeedback?: string;
  userAction?: unknown;
}

export class PoolRecommendationsService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  async createRecommendation(poolId: string, userId: string, data: CreateRecommendationData) {
    await this.core.ensurePoolAccess(poolId, userId);

    if (data.linkedTestId) {
      const [test] = await this.db
        .select({ poolId: schema.testSessions.poolId })
        .from(schema.testSessions)
        .where(eq(schema.testSessions.sessionId, data.linkedTestId));

      if (!test || test.poolId !== poolId) {
        throw new Error('Test does not belong to this pool');
      }
    }

    const dbData = {
      poolId,
      createdBy: userId,
      linkedTestId: data.linkedTestId,
      type: data.type,
      title: data.title,
      description: data.description,
      payload: data.payload,
      priorityScore: data.priorityScore,
      status: data.status,
      confidenceScore: data.confidenceScore?.toString(),
      factorsConsidered: data.factorsConsidered,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      userAction: data.userAction,
    };

    const [recommendation] = await this.db.insert(schema.recommendations).values(dbData).returning();

    return recommendation;
  }

  async updateRecommendation(
    poolId: string,
    recommendationId: string,
    userId: string,
    data: UpdateRecommendationData
  ) {
    await this.core.ensurePoolAccess(poolId, userId);

    const [recommendation] = await this.db
      .select()
      .from(schema.recommendations)
      .where(
        and(
          eq(schema.recommendations.recommendationId, recommendationId),
          eq(schema.recommendations.poolId, poolId)
        )
      );

    if (!recommendation) {
      return null;
    }

    const [updated] = await this.db
      .update(schema.recommendations)
      .set({
        status: data.status ?? recommendation.status,
        userFeedback: data.userFeedback ?? recommendation.userFeedback,
        userAction: data.userAction ?? recommendation.userAction,
        updatedAt: new Date(),
      })
      .where(eq(schema.recommendations.recommendationId, recommendationId))
      .returning();

    return updated;
  }

  async getRecommendationsByPoolId(
    poolId: string,
    userId: string,
    limit: number,
    status?: RecommendationStatus
  ) {
    await this.core.ensurePoolAccess(poolId, userId);

    const whereClause = status
      ? and(eq(schema.recommendations.poolId, poolId), eq(schema.recommendations.status, status))
      : eq(schema.recommendations.poolId, poolId);

    const items = await this.db
      .select()
      .from(schema.recommendations)
      .where(whereClause)
      .orderBy(desc(schema.recommendations.createdAt), desc(schema.recommendations.recommendationId))
      .limit(limit);

    return { items };
  }

  async getRecommendationById(poolId: string, recommendationId: string, userId: string) {
    await this.core.ensurePoolAccess(poolId, userId);

    const [recommendation] = await this.db
      .select()
      .from(schema.recommendations)
      .where(
        and(
          eq(schema.recommendations.poolId, poolId),
          eq(schema.recommendations.recommendationId, recommendationId)
        )
      );

    return recommendation ?? null;
  }
}

export const poolRecommendationsService = new PoolRecommendationsService();
