import { and, asc, avg, desc, eq, inArray, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { PoolCoreService } from './pools/core.js';

const CHECKPOINTS = [24, 72] as const;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export class PredictionOutcomesService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  async createCheckpointsForRecommendation(input: {
    poolId: string;
    recommendationId: string;
    recommendationType?: string | null;
    predictedValues?: unknown;
    userId: string;
  }) {
    const now = new Date();
    await this.db.insert(schema.predictionOutcomes).values(
      CHECKPOINTS.map((hours) => ({
        poolId: input.poolId,
        recommendationId: input.recommendationId,
        checkpointHours: hours,
        dueAt: new Date(now.getTime() + hours * 60 * 60 * 1000),
        status: 'pending',
        recommendationType: input.recommendationType ?? null,
        predictedValues: input.predictedValues ?? {},
        createdBy: input.userId,
      }))
    );
  }

  async createCheckpointsForPlan(input: {
    poolId: string;
    planId: string;
    treatmentType?: string | null;
    predictedValues?: unknown;
    userId: string;
  }) {
    const now = new Date();
    await this.db.insert(schema.predictionOutcomes).values(
      CHECKPOINTS.map((hours) => ({
        poolId: input.poolId,
        planId: input.planId,
        checkpointHours: hours,
        dueAt: new Date(now.getTime() + hours * 60 * 60 * 1000),
        status: 'pending',
        treatmentType: input.treatmentType ?? null,
        predictedValues: input.predictedValues ?? {},
        createdBy: input.userId,
      }))
    );
  }

  async listDueOutcomes(poolId: string, userId: string) {
    await this.core.ensurePoolAccess(poolId, userId);
    const now = new Date();
    const items = await this.db
      .select()
      .from(schema.predictionOutcomes)
      .where(and(eq(schema.predictionOutcomes.poolId, poolId), eq(schema.predictionOutcomes.status, 'pending'), sql`${schema.predictionOutcomes.dueAt} <= ${now}`))
      .orderBy(asc(schema.predictionOutcomes.dueAt), asc(schema.predictionOutcomes.outcomeId));

    return { items };
  }

  async logOutcome(
    poolId: string,
    outcomeId: string,
    userId: string,
    data: {
      actualValues?: unknown;
      observedIssues?: string;
      outcomeLink?: string;
      status?: 'logged' | 'skipped';
      qualitySignal?: number;
    }
  ) {
    await this.core.ensurePoolAccess(poolId, userId);

    const [existing] = await this.db
      .select()
      .from(schema.predictionOutcomes)
      .where(and(eq(schema.predictionOutcomes.poolId, poolId), eq(schema.predictionOutcomes.outcomeId, outcomeId)));

    if (!existing) return null;

    const [updated] = await this.db
      .update(schema.predictionOutcomes)
      .set({
        actualValues: data.actualValues ?? existing.actualValues,
        observedIssues: data.observedIssues ?? existing.observedIssues,
        outcomeLink: data.outcomeLink ?? existing.outcomeLink,
        qualitySignal:
          typeof data.qualitySignal === 'number' ? data.qualitySignal.toFixed(2) : existing.qualitySignal,
        status: data.status ?? 'logged',
        recordedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.predictionOutcomes.outcomeId, outcomeId))
      .returning();

    return updated ?? null;
  }

  async getEffectivenessDashboard(poolId: string, userId: string) {
    await this.core.ensurePoolAccess(poolId, userId);

    const byTreatmentType = await this.db
      .select({
        treatmentType: schema.predictionOutcomes.treatmentType,
        outcomes: sql<number>`count(*)`,
        loggedOutcomes: sql<number>`count(*) filter (where ${schema.predictionOutcomes.status} = 'logged')`,
        averageQuality: avg(schema.predictionOutcomes.qualitySignal),
      })
      .from(schema.predictionOutcomes)
      .where(eq(schema.predictionOutcomes.poolId, poolId))
      .groupBy(schema.predictionOutcomes.treatmentType)
      .orderBy(desc(sql`count(*)`));

    const byPool = await this.db
      .select({
        poolId: schema.predictionOutcomes.poolId,
        outcomes: sql<number>`count(*)`,
        loggedOutcomes: sql<number>`count(*) filter (where ${schema.predictionOutcomes.status} = 'logged')`,
        averageQuality: avg(schema.predictionOutcomes.qualitySignal),
      })
      .from(schema.predictionOutcomes)
      .where(eq(schema.predictionOutcomes.poolId, poolId))
      .groupBy(schema.predictionOutcomes.poolId);

    return {
      byPool,
      byTreatmentType: byTreatmentType.map((row) => ({
        ...row,
        averageQuality: row.averageQuality === null ? null : clamp(Number(row.averageQuality)),
      })),
    };
  }

  async getRecommendationTypeQuality(poolId: string, recommendationTypes: string[]) {
    if (recommendationTypes.length === 0) return new Map<string, number>();

    const rows = await this.db
      .select({
        recommendationType: schema.predictionOutcomes.recommendationType,
        averageQuality: avg(schema.predictionOutcomes.qualitySignal),
      })
      .from(schema.predictionOutcomes)
      .where(
        and(
          eq(schema.predictionOutcomes.poolId, poolId),
          inArray(schema.predictionOutcomes.recommendationType, recommendationTypes)
        )
      )
      .groupBy(schema.predictionOutcomes.recommendationType);

    return new Map(
      rows
        .filter((row) => row.recommendationType && row.averageQuality !== null)
        .map((row) => [row.recommendationType!, clamp(Number(row.averageQuality))])
    );
  }
}

export const predictionOutcomesService = new PredictionOutcomesService();
