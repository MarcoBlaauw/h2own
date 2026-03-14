import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { env } from '../env.js';
import { recommenderService } from './recommender.js';
import { OpenAiCompatibleProvider } from './llm/openai-provider.js';
import { AnthropicCompatibleProvider } from './llm/anthropic-provider.js';
import type { LlmProvider } from './llm/provider.js';
import { PoolCoreService } from './pools/core.js';

const treatmentPlanSchema = z.object({
  interpretationSummary: z.string().min(1),
  stepByStepPlan: z.array(z.object({
    action: z.string().min(1),
    amount: z.number().nonnegative().nullable(),
    unit: z.string().nullable(),
    timing: z.string().min(1),
    rationale: z.string().min(1),
    riskFlags: z.array(z.string()).default([]),
    recommendedDueAt: z.string().datetime({ offset: true }).nullable().optional(),
    eventType: z.enum(['dosage', 'test', 'maintenance']).nullable().optional(),
    leadMinutes: z.number().int().min(0).max(60 * 24 * 30).nullable().optional(),
    recurrence: z.enum(['once', 'daily', 'weekly', 'monthly']).nullable().optional(),
  })).min(1),
  monitoringChecks: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string().min(1)).default([]),
  safetyDisclaimer: z.string().min(1),
});

export type TreatmentPlanPayload = z.infer<typeof treatmentPlanSchema>;

const advisoryDisclaimer =
  'Advisory only: follow product labels and local code, verify chemistry with a fresh test before dosing, and consult a qualified technician for safety-critical decisions.';

const hasProhibitedCombinations = (steps: TreatmentPlanPayload['stepByStepPlan']) => {
  const normalized = steps.map((step) => step.action.toLowerCase());
  const hasCalHypo = normalized.some((v) => v.includes('cal-hypo') || v.includes('calcium hypochlorite'));
  const hasTrichlor = normalized.some((v) => v.includes('trichlor'));
  const hasAcid = normalized.some((v) => v.includes('muriatic acid') || v.includes('dry acid'));
  return (hasCalHypo && hasTrichlor) || (hasCalHypo && hasAcid);
};

const enforceDosingCeiling = (
  steps: TreatmentPlanPayload['stepByStepPlan'],
  poolVolumeGallons: number | null,
) => {
  if (!poolVolumeGallons) return true;
  const maxOzPer10k = 128;
  const volumeFactor = poolVolumeGallons / 10000;
  return steps.every((step) => {
    if (step.amount === null || !step.unit) return true;
    if (step.unit.toLowerCase() !== 'oz') return true;
    return step.amount <= maxOzPer10k * volumeFactor;
  });
};

const buildProvider = (): LlmProvider | null => {
  if (env.LLM_PROVIDER === 'none' || !env.LLM_API_KEY) return null;

  const config = {
    apiKey: env.LLM_API_KEY,
    modelId: env.LLM_MODEL_ID,
    timeoutMs: env.LLM_TIMEOUT_MS,
    maxRetries: env.LLM_MAX_RETRIES,
    circuitBreakerThreshold: env.LLM_CIRCUIT_BREAKER_THRESHOLD,
    circuitBreakerCooldownMs: env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS,
  };

  if (env.LLM_PROVIDER === 'anthropic') return new AnthropicCompatibleProvider(config);
  return new OpenAiCompatibleProvider(config);
};

export class TreatmentPlannerService {
  private readonly provider = buildProvider();

  constructor(
    private readonly db = dbClient,
    private readonly core = new PoolCoreService(db),
  ) {}

  async generate(poolId: string, userId: string) {
    await this.core.ensurePoolAccess(poolId, userId);

    const context = await this.buildContext(poolId);
    const contextHash = createHash('sha256').update(JSON.stringify(context)).digest('hex');
    const prompt = this.buildPrompt(context);
    const promptHash = createHash('sha256').update(prompt).digest('hex');

    const nextVersion = await this.getNextVersion(poolId);

    if (!this.provider) {
      return this.persistFallbackPlan({
        poolId,
        userId,
        linkedTestId: context.latestTest?.sessionId ?? null,
        promptHash,
        contextHash,
        version: nextVersion,
        context,
        errorMessage: 'LLM provider unavailable',
      });
    }

    try {
      const [interpretation, plan] = await Promise.all([
        this.provider.generateInterpretation({
          prompt,
          maxTokens: env.LLM_MAX_TOKENS,
          temperature: env.LLM_TEMPERATURE,
          timeoutMs: env.LLM_TIMEOUT_MS,
          systemPrompt: 'You are a conservative pool chemistry advisor. Return strict JSON only.',
        }),
        this.provider.generatePlan({
          prompt,
          maxTokens: env.LLM_MAX_TOKENS,
          temperature: env.LLM_TEMPERATURE,
          timeoutMs: env.LLM_TIMEOUT_MS,
          systemPrompt: 'You are a conservative pool chemistry advisor. Return strict JSON only.',
        }),
      ]);

      const parsed = treatmentPlanSchema.parse(JSON.parse(plan.content));
      if (!parsed.safetyDisclaimer.toLowerCase().includes('advisory only')) {
        throw new Error('Safety disclaimer missing required advisory-only language');
      }
      if (hasProhibitedCombinations(parsed.stepByStepPlan)) {
        throw new Error('Prohibited chemical combination detected in generated plan');
      }
      if (!enforceDosingCeiling(parsed.stepByStepPlan, context.pool.volumeGallons)) {
        throw new Error('Generated dosage exceeds ceiling guardrail');
      }

      const [inserted] = await this.db.insert(schema.treatmentPlans).values({
        poolId,
        generatedBy: userId,
        linkedTestId: context.latestTest?.sessionId ?? null,
        version: nextVersion,
        status: 'generated',
        provider: plan.provider,
        modelId: plan.modelId,
        promptHash,
        contextHash,
        requestPayload: { prompt, context },
        responsePayload: {
          ...parsed,
          interpretationSummary: parsed.interpretationSummary || interpretation.content,
        },
      }).returning();

      return inserted;
    } catch (error) {
      if (env.LLM_FALLBACK_BEHAVIOR === 'computed_preview') {
        return this.persistFallbackPlan({
          poolId,
          userId,
          linkedTestId: context.latestTest?.sessionId ?? null,
          promptHash,
          contextHash,
          version: nextVersion,
          context,
          errorMessage: error instanceof Error ? error.message : 'generation_failed',
        });
      }

      const [failed] = await this.db.insert(schema.treatmentPlans).values({
        poolId,
        generatedBy: userId,
        linkedTestId: context.latestTest?.sessionId ?? null,
        version: nextVersion,
        status: 'failed',
        provider: env.LLM_PROVIDER === 'none' ? null : env.LLM_PROVIDER,
        modelId: env.LLM_MODEL_ID,
        promptHash,
        contextHash,
        requestPayload: { prompt, context },
        responsePayload: null,
        errorMessage: error instanceof Error ? error.message : 'generation_failed',
      }).returning();
      return failed;
    }
  }

  async list(poolId: string, userId: string, limit = 20) {
    await this.core.ensurePoolAccess(poolId, userId);
    return this.db.select().from(schema.treatmentPlans)
      .where(eq(schema.treatmentPlans.poolId, poolId))
      .orderBy(desc(schema.treatmentPlans.createdAt), desc(schema.treatmentPlans.version))
      .limit(limit);
  }

  async get(poolId: string, planId: string, userId: string) {
    await this.core.ensurePoolAccess(poolId, userId);
    const [plan] = await this.db.select().from(schema.treatmentPlans)
      .where(and(eq(schema.treatmentPlans.poolId, poolId), eq(schema.treatmentPlans.planId, planId)));
    return plan ?? null;
  }

  private async getNextVersion(poolId: string) {
    const [row] = await this.db.select({ version: sql<number>`coalesce(max(${schema.treatmentPlans.version}), 0)` })
      .from(schema.treatmentPlans)
      .where(eq(schema.treatmentPlans.poolId, poolId));
    return Number(row?.version ?? 0) + 1;
  }

  private async buildContext(poolId: string) {
    const [[pool], [latestTest], recommendationPreview, recentDosing, recentCosts, latestWeatherRows, sensorReadings] = await Promise.all([
      this.db.select().from(schema.pools).where(eq(schema.pools.poolId, poolId)).limit(1),
      this.db.select().from(schema.testSessions).where(eq(schema.testSessions.poolId, poolId)).orderBy(desc(schema.testSessions.testedAt)).limit(1),
      recommenderService.getRecommendations(poolId),
      this.db.select({
        actionId: schema.chemicalActions.actionId,
        amount: schema.chemicalActions.amount,
        unit: schema.chemicalActions.unit,
        addedAt: schema.chemicalActions.addedAt,
        productName: schema.products.name,
      }).from(schema.chemicalActions)
      .leftJoin(schema.products, eq(schema.chemicalActions.productId, schema.products.productId))
      .where(eq(schema.chemicalActions.poolId, poolId))
      .orderBy(desc(schema.chemicalActions.addedAt)).limit(5),
      this.db.select().from(schema.costs).where(eq(schema.costs.poolId, poolId)).orderBy(desc(schema.costs.incurredAt)).limit(5),
      this.db.select().from(schema.weatherData).innerJoin(schema.pools, eq(schema.weatherData.locationId, schema.pools.locationId))
      .where(eq(schema.pools.poolId, poolId)).orderBy(desc(schema.weatherData.recordedAt)).limit(1),
      this.db.select({ metric: schema.sensorReadings.metric, value: schema.sensorReadings.value, recordedAt: schema.sensorReadings.recordedAt })
        .from(schema.sensorReadings)
        .where(and(eq(schema.sensorReadings.poolId, poolId), inArray(schema.sensorReadings.metric, ['water_temp_f', 'air_temp_f', 'humidity_percent', 'uv_index'])))
        .orderBy(desc(schema.sensorReadings.recordedAt))
        .limit(10),
    ]);

    return {
      pool,
      latestTest,
      recommendationPreview,
      recentDosing,
      recentCosts,
      weatherSnapshot: latestWeatherRows[0]?.weather_data ?? null,
      sensorReadings,
      quality: {
        hasLatestTest: Boolean(latestTest),
        hasWeatherData: latestWeatherRows.length > 0,
      },
    };
  }

  private buildPrompt(context: Awaited<ReturnType<TreatmentPlannerService['buildContext']>>) {
    if (!context.quality.hasLatestTest) {
      throw new Error('Refusal: insufficient data quality (missing latest test session).');
    }

    return [
      'Generate a pool treatment plan as strict JSON with keys: interpretationSummary, stepByStepPlan, monitoringChecks, confidence, assumptions, safetyDisclaimer.',
      'Guardrails: no prohibited combinations (cal-hypo + trichlor, cal-hypo + acid), conservative dosing ceilings, advisory-only disclaimer required.',
      `Context: ${JSON.stringify(context)}`,
    ].join('\n');
  }

  private async persistFallbackPlan(input: {
    poolId: string;
    userId: string;
    linkedTestId: string | null;
    promptHash: string;
    contextHash: string;
    version: number;
    context: Awaited<ReturnType<TreatmentPlannerService['buildContext']>>;
    errorMessage: string;
  }) {
    if (!input.context.quality.hasLatestTest) {
      const [failed] = await this.db.insert(schema.treatmentPlans).values({
        poolId: input.poolId,
        generatedBy: input.userId,
        linkedTestId: input.linkedTestId,
        version: input.version,
        status: 'refused',
        provider: 'fallback',
        modelId: 'deterministic-preview',
        promptHash: input.promptHash,
        contextHash: input.contextHash,
        requestPayload: { context: input.context },
        responsePayload: null,
        errorMessage: 'Refusal policy triggered: insufficient latest test data.',
      }).returning();
      return failed;
    }

    const preview = input.context.recommendationPreview;
    const payload: TreatmentPlanPayload = {
      interpretationSummary: preview?.primary?.reason ?? 'Stable chemistry trend, monitor and adjust gradually.',
      stepByStepPlan: preview?.primary
        ? [{
            action: `Add ${preview.primary.chemicalName}`,
            amount: Number(preview.primary.amount),
            unit: preview.primary.unit ?? 'oz',
            timing: 'Today',
            rationale: preview.primary.predictedOutcome,
            riskFlags: [],
            recommendedDueAt: null,
            eventType: 'dosage',
            leadMinutes: null,
            recurrence: 'once',
          }]
        : [{
            action: 'No immediate chemical addition',
            amount: null,
            unit: null,
            timing: 'Today',
            rationale: 'Latest deterministic recommendation indicates values are in range.',
            riskFlags: [],
            recommendedDueAt: null,
            eventType: null,
            leadMinutes: null,
            recurrence: 'once',
          }],
      monitoringChecks: ['Retest FC/pH in 12-24 hours', 'Confirm circulation and filter runtime are normal'],
      confidence: 0.45,
      assumptions: ['Fallback deterministic preview used due to provider unavailability or generation failure.'],
      safetyDisclaimer: advisoryDisclaimer,
    };

    const [inserted] = await this.db.insert(schema.treatmentPlans).values({
      poolId: input.poolId,
      generatedBy: input.userId,
      linkedTestId: input.linkedTestId,
      version: input.version,
      status: 'fallback',
      provider: 'fallback',
      modelId: 'deterministic-preview',
      promptHash: input.promptHash,
      contextHash: input.contextHash,
      requestPayload: { context: input.context },
      responsePayload: payload,
      errorMessage: input.errorMessage,
    }).returning();

    return inserted;
  }
}

export const treatmentPlannerService = new TreatmentPlannerService();
export { treatmentPlanSchema };
