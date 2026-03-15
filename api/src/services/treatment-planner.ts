import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { env } from '../env.js';
import { recommenderService } from './recommender.js';
import { OpenAiCompatibleProvider } from './llm/openai-provider.js';
import { AnthropicCompatibleProvider } from './llm/anthropic-provider.js';
import type { LlmProvider, LlmProviderConfig } from './llm/provider.js';
import {
  type LlmFallbackBehavior,
  type LlmModelFamily,
  type LlmProviderKind,
  resolveLlmModelId,
} from './llm/catalog.js';
import {
  integrationService,
  type IntegrationCredentials,
  type IntegrationRecord,
  type IntegrationService,
} from './integrations.js';
import { PoolCoreService } from './pools/core.js';

const freshnessSchema = z.enum(['fresh', 'stale', 'missing']);
const reportAudienceSchema = z.enum(['owner', 'service_tech', 'audit']);

const treatmentPlanStepSchema = z.object({
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
});

const treatmentPlanMetadataSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  dataSourcesUsed: z.array(z.object({
    kind: z.string().min(1),
    label: z.string().min(1),
    timestamp: z.string().datetime({ offset: true }).nullable(),
    freshness: freshnessSchema,
    details: z.string().nullable().optional(),
  })).default([]),
  timestampFreshness: z.object({
    latestTest: freshnessSchema,
    weather: freshnessSchema,
    sensor: freshnessSchema,
  }),
  explicitAssumptions: z.array(z.string().min(1)).default([]),
  blockedUnsafeAlternativesConsidered: z.array(z.object({
    alternative: z.string().min(1),
    reason: z.string().min(1),
    blockedBy: z.string().min(1),
    severity: z.enum(['warning', 'blocking']),
  })).default([]),
  policyChecks: z.object({
    passed: z.boolean(),
    issues: z.array(z.object({
      code: z.string().min(1),
      severity: z.enum(['warning', 'blocking']),
      message: z.string().min(1),
      blocksActions: z.boolean(),
      source: z.string().min(1),
    })).default([]),
  }),
  provenance: z.object({
    latestTestAt: z.string().datetime({ offset: true }).nullable(),
    weatherAt: z.string().datetime({ offset: true }).nullable(),
    sensorReadingAt: z.string().datetime({ offset: true }).nullable(),
    labels: z.array(z.string().min(1)).default([]),
  }),
  reportAudiences: z.array(reportAudienceSchema).default(['owner', 'service_tech', 'audit']),
});

const treatmentPlanSchema = z.object({
  interpretationSummary: z.string().min(1),
  stepByStepPlan: z.array(treatmentPlanStepSchema).min(1),
  monitoringChecks: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string().min(1)).default([]),
  safetyDisclaimer: z.string().min(1),
  planMetadata: treatmentPlanMetadataSchema.optional(),
});

export type TreatmentPlanPayload = z.infer<typeof treatmentPlanSchema>;
export type TreatmentPlanMetadata = z.infer<typeof treatmentPlanMetadataSchema>;
export type TreatmentReportAudience = z.infer<typeof reportAudienceSchema>;

export class TreatmentPlanRequirementError extends Error {
  readonly code = 'TreatmentPlanRequirementError';

  constructor(message: string) {
    super(message);
    this.name = 'TreatmentPlanRequirementError';
  }
}

type DataFreshness = z.infer<typeof freshnessSchema>;
type TreatmentPolicyIssue = {
  code: string;
  severity: 'warning' | 'blocking';
  message: string;
  blocksActions: boolean;
  source: string;
};

type TreatmentPlanContext = Awaited<ReturnType<TreatmentPlannerService['buildContext']>>;

const advisoryDisclaimer =
  'Advisory only: follow product labels and local code, verify chemistry with a fresh test before dosing, and consult a qualified technician for safety-critical decisions.';

type ResolvedLlmSettings = {
  enabled: boolean;
  provider: LlmProviderKind;
  modelFamily: LlmModelFamily;
  modelId: string | null;
  apiKey: string | null;
  baseUrl: string | null;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  circuitBreakerCooldownMs: number;
  fallbackBehavior: LlmFallbackBehavior;
  integration: IntegrationRecord | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stringFromRecord = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const numberFromRecord = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isProviderKind = (value: string | null): value is LlmProviderKind =>
  value === 'openai' || value === 'anthropic' || value === 'none';

const isModelFamily = (value: string | null): value is LlmModelFamily =>
  value === 'economy' || value === 'balanced' || value === 'quality';

const isFallbackBehavior = (value: string | null): value is LlmFallbackBehavior =>
  value === 'computed_preview' || value === 'refuse';

const formatTimestamp = (value: Date | null | undefined) => (value ? value.toISOString() : null);

const toNullableNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const computeFreshness = (value: Date | null | undefined, thresholdHours: number): DataFreshness => {
  if (!value) return 'missing';
  const ageMs = Date.now() - value.getTime();
  return ageMs <= thresholdHours * 60 * 60 * 1000 ? 'fresh' : 'stale';
};

const uniqueStrings = (items: Array<string | null | undefined>) =>
  Array.from(new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item))));

const truncatePdfLine = (value: string, maxLength = 108) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;

const escapePdfText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r/g, '');

const createSimplePdfBuffer = (lines: string[]) => {
  const sanitizedLines = lines.map((line) => truncatePdfLine(line.replace(/\n/g, ' ')));
  const pageContent = [
    'BT',
    '/F1 11 Tf',
    '50 780 Td',
    '14 TL',
    ...sanitizedLines.flatMap((line, index) => (index === 0 ? [`(${escapePdfText(line)}) Tj`] : ['T*', `(${escapePdfText(line)}) Tj`])),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(pageContent, 'utf8')} >>\nstream\n${pageContent}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const hasActionKeyword = (value: string, keywords: string[]) => {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
};

export class TreatmentPlannerService {
  constructor(
    private readonly db = dbClient,
    private readonly core = new PoolCoreService(db),
    private readonly integrations: IntegrationService = integrationService,
  ) {}

  private async resolveLlmSettings(): Promise<ResolvedLlmSettings> {
    const integration = await this.integrations.getIntegration('llm').catch(() => null);
    const config = asRecord(integration?.config);
    const credentials = (integration?.credentials ?? null) as IntegrationCredentials | null;

    const provider = (() => {
      const candidate = stringFromRecord(config, 'provider');
      return isProviderKind(candidate) ? candidate : env.LLM_PROVIDER;
    })();
    const modelFamily = (() => {
      const candidate = stringFromRecord(config, 'modelFamily');
      return isModelFamily(candidate) ? candidate : env.LLM_MODEL_FAMILY;
    })();
    const modelId = resolveLlmModelId(
      provider,
      modelFamily,
      stringFromRecord(config, 'modelId') ?? env.LLM_MODEL_ID ?? null,
    );
    const fallbackBehavior = (() => {
      const candidate = stringFromRecord(config, 'fallbackBehavior');
      return isFallbackBehavior(candidate) ? candidate : env.LLM_FALLBACK_BEHAVIOR;
    })();
    const apiKey = (() => {
      const candidate = credentials?.apiKey;
      return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : env.LLM_API_KEY ?? null;
    })();

    return {
      enabled: integration?.enabled ?? provider !== 'none',
      provider,
      modelFamily,
      modelId,
      apiKey,
      baseUrl: stringFromRecord(config, 'baseUrl'),
      maxTokens: numberFromRecord(config, 'maxTokens') ?? env.LLM_MAX_TOKENS,
      temperature: numberFromRecord(config, 'temperature') ?? env.LLM_TEMPERATURE,
      timeoutMs: numberFromRecord(config, 'timeoutMs') ?? env.LLM_TIMEOUT_MS,
      maxRetries: numberFromRecord(config, 'maxRetries') ?? env.LLM_MAX_RETRIES,
      circuitBreakerThreshold:
        numberFromRecord(config, 'circuitBreakerThreshold') ?? env.LLM_CIRCUIT_BREAKER_THRESHOLD,
      circuitBreakerCooldownMs:
        numberFromRecord(config, 'circuitBreakerCooldownMs') ?? env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS,
      fallbackBehavior,
      integration,
    };
  }

  private async ensurePlanningInfrastructureReady() {
    const rows = await this.db.execute(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'treatment_plans' and column_name in ('plan_id', 'pool_id', 'status', 'created_at'))
          or
          (table_name = 'prediction_outcomes' and column_name in ('pool_id', 'quality_signal', 'recommendation_type', 'treatment_type', 'status', 'recorded_at'))
        )
    `);

    const present = new Set(
      (rows as unknown as Array<{ table_name: string; column_name: string }>).map(
        (row) => `${row.table_name}.${row.column_name}`,
      ),
    );

    const required = [
      'treatment_plans.plan_id',
      'treatment_plans.pool_id',
      'treatment_plans.status',
      'treatment_plans.created_at',
      'prediction_outcomes.pool_id',
      'prediction_outcomes.quality_signal',
      'prediction_outcomes.recommendation_type',
      'prediction_outcomes.treatment_type',
      'prediction_outcomes.status',
      'prediction_outcomes.recorded_at',
    ];

    if (required.some((key) => !present.has(key))) {
      throw new TreatmentPlanRequirementError(
        'AI treatment plans are not ready yet because required database migrations are still missing.',
      );
    }
  }

  private buildProvider(settings: ResolvedLlmSettings): LlmProvider | null {
    if (!settings.enabled || settings.provider === 'none' || !settings.apiKey || !settings.modelId) {
      return null;
    }

    const config: LlmProviderConfig = {
      apiKey: settings.apiKey,
      modelId: settings.modelId,
      timeoutMs: settings.timeoutMs,
      maxRetries: settings.maxRetries,
      circuitBreakerThreshold: settings.circuitBreakerThreshold,
      circuitBreakerCooldownMs: settings.circuitBreakerCooldownMs,
    };

    if (settings.provider === 'anthropic') {
      return new AnthropicCompatibleProvider(config, settings.baseUrl ?? undefined);
    }
    return new OpenAiCompatibleProvider(config, settings.baseUrl ?? undefined);
  }

  private async recordLlmRuntimeSuccess(settings: ResolvedLlmSettings) {
    await this.integrations.updateRuntimeStatus('llm', {
      lastResponseCode: 200,
      lastResponseText: `${settings.provider}:${settings.modelId ?? 'unknown'}`,
      lastResponseAt: new Date(),
      lastSuccessAt: new Date(),
      nextAllowedRequestAt: null,
    }).catch(() => undefined);
  }

  private async recordLlmRuntimeFailure(settings: ResolvedLlmSettings, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'generation_failed';
    const circuitOpen = errorMessage.toLowerCase().includes('circuit breaker is open');
    await this.integrations.updateRuntimeStatus('llm', {
      lastResponseCode: circuitOpen ? 429 : 500,
      lastResponseText: errorMessage.slice(0, 500),
      lastResponseAt: new Date(),
      nextAllowedRequestAt: circuitOpen
        ? new Date(Date.now() + settings.circuitBreakerCooldownMs)
        : null,
    }).catch(() => undefined);
  }

  async generate(poolId: string, userId: string) {
    await this.core.ensurePoolAccess(poolId, userId);
    await this.ensurePlanningInfrastructureReady();

    const context = await this.buildContext(poolId);
    if (!context.latestTest) {
      throw new TreatmentPlanRequirementError(
        'Add at least one water test for this pool before generating an AI treatment plan.',
      );
    }
    const contextHash = createHash('sha256').update(JSON.stringify(context)).digest('hex');
    const prompt = this.buildPrompt(context);
    const promptHash = createHash('sha256').update(prompt).digest('hex');
    const nextVersion = await this.getNextVersion(poolId);
    const llmSettings = await this.resolveLlmSettings();
    const provider = this.buildProvider(llmSettings);

    if (!provider) {
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
        provider.generateInterpretation({
          prompt,
          maxTokens: llmSettings.maxTokens,
          temperature: llmSettings.temperature,
          timeoutMs: llmSettings.timeoutMs,
          systemPrompt: 'You are a conservative pool chemistry advisor. Return strict JSON only.',
        }),
        provider.generatePlan({
          prompt,
          maxTokens: llmSettings.maxTokens,
          temperature: llmSettings.temperature,
          timeoutMs: llmSettings.timeoutMs,
          systemPrompt: 'You are a conservative pool chemistry advisor. Return strict JSON only.',
        }),
      ]);

      const parsed = treatmentPlanSchema.parse(JSON.parse(plan.content));
      const hydrated = this.hydratePlanPayload({
        payload: {
          ...parsed,
          interpretationSummary: parsed.interpretationSummary || interpretation.content,
        },
        context,
      });

      const [inserted] = await this.db.insert(schema.treatmentPlans).values({
        poolId,
        generatedBy: userId,
        linkedTestId: context.latestTest?.sessionId ?? null,
        version: nextVersion,
        status: hydrated.planMetadata?.policyChecks.passed ? 'generated' : 'refused',
        provider: plan.provider,
        modelId: plan.modelId,
        promptHash,
        contextHash,
        requestPayload: { prompt, context },
        responsePayload: hydrated,
      }).returning();

      await this.recordLlmRuntimeSuccess(llmSettings);
      return inserted;
    } catch (error) {
      await this.recordLlmRuntimeFailure(llmSettings, error);

      if (llmSettings.fallbackBehavior === 'computed_preview') {
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
        provider: llmSettings.provider === 'none' ? null : llmSettings.provider,
        modelId: llmSettings.modelId,
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

  async updateStatus(poolId: string, planId: string, userId: string, status: 'generated' | 'fallback' | 'failed' | 'refused' | 'scheduled') {
    await this.core.ensurePoolAccess(poolId, userId);
    const [updated] = await this.db.update(schema.treatmentPlans).set({ status })
      .where(and(eq(schema.treatmentPlans.poolId, poolId), eq(schema.treatmentPlans.planId, planId)))
      .returning();
    return updated ?? null;
  }

  async buildSharePlanMessage(poolId: string, planId: string, userId: string) {
    const plan = await this.get(poolId, planId, userId);
    if (!plan) return null;

    const payload = plan.responsePayload as TreatmentPlanPayload | null;
    const topSteps = payload?.stepByStepPlan?.slice(0, 3) ?? [];
    const lines = topSteps.map((step, index) => `${index + 1}. ${step.action} (${step.timing})`);
    const summary = payload?.interpretationSummary ?? 'Treatment plan is ready to review.';
    const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
    const deepLink = `${appBaseUrl}/pools/${poolId}?tab=treatment-plans&planId=${planId}`;

    return {
      plan,
      summary,
      deepLink,
      messageBody: [
        'Shared treatment plan update',
        '',
        summary,
        lines.length ? `Top steps:\n${lines.join('\n')}` : null,
        `Open plan: ${deepLink}`,
      ].filter(Boolean).join('\n'),
      attachment: {
        kind: 'treatment_plan_share',
        planId,
        poolId,
        version: plan.version,
        status: plan.status,
        deepLink,
      },
    };
  }

  async buildTreatmentReport(poolId: string, planId: string, userId: string, audience: TreatmentReportAudience) {
    const plan = await this.get(poolId, planId, userId);
    if (!plan) return null;

    const [pool] = await this.db.select({
      poolId: schema.pools.poolId,
      poolName: schema.pools.name,
      ownerEmail: schema.users.email,
      ownerName: schema.users.name,
      locationName: schema.userLocations.name,
      formattedAddress: schema.userLocations.formattedAddress,
      timezone: schema.userLocations.timezone,
    })
      .from(schema.pools)
      .leftJoin(schema.users, eq(schema.pools.ownerId, schema.users.userId))
      .leftJoin(schema.userLocations, eq(schema.pools.locationId, schema.userLocations.locationId))
      .where(eq(schema.pools.poolId, poolId))
      .limit(1);

    if (!pool) return null;

    const payload = treatmentPlanSchema.safeParse(plan.responsePayload).success
      ? treatmentPlanSchema.parse(plan.responsePayload)
      : null;

    const metadata = payload?.planMetadata;
    const issues = metadata?.policyChecks.issues ?? [];
    const blocked = issues.filter((issue) => issue.blocksActions);
    const blockedAlternatives = metadata?.blockedUnsafeAlternativesConsidered ?? [];
    const steps = payload?.stepByStepPlan ?? [];
    const monitoring = payload?.monitoringChecks ?? [];

    const audienceHeading = audience === 'owner'
      ? 'Owner summary'
      : audience === 'service_tech'
        ? 'Service technician handoff'
        : 'Audit trace';

    const lines = [
      `H2Own Treatment Report: ${audienceHeading}`,
      `Pool: ${pool.poolName}`,
      `Plan version: ${plan.version}`,
      `Plan status: ${plan.status}`,
      `Generated at: ${formatTimestamp(plan.createdAt) ?? 'unknown'}`,
      `Provider/model: ${plan.provider ?? 'unknown'} / ${plan.modelId ?? 'unknown'}`,
      `Location: ${pool.locationName ?? pool.formattedAddress ?? 'Not set'}`,
      '',
      `Summary: ${payload?.interpretationSummary ?? 'No plan summary available.'}`,
      `Confidence: ${payload ? payload.confidence.toFixed(2) : 'n/a'}`,
      '',
      'Provenance',
      ...(metadata?.provenance.labels.length
        ? metadata.provenance.labels.map((label) => `- ${label}`)
        : ['- No provenance labels were captured.']),
      '',
      'Freshness',
      `- Latest test: ${metadata?.timestampFreshness.latestTest ?? 'missing'}`,
      `- Weather: ${metadata?.timestampFreshness.weather ?? 'missing'}`,
      `- Sensor: ${metadata?.timestampFreshness.sensor ?? 'missing'}`,
      '',
      'Action steps',
      ...(steps.length
        ? steps.map((step, index) => `- ${index + 1}. ${step.action} | ${step.timing} | ${step.rationale}`)
        : ['- No action steps available.']),
      '',
      'Monitoring checks',
      ...(monitoring.length ? monitoring.map((item) => `- ${item}`) : ['- No monitoring checks available.']),
      '',
      'Explicit assumptions',
      ...(metadata?.explicitAssumptions.length
        ? metadata.explicitAssumptions.map((item) => `- ${item}`)
        : payload?.assumptions?.map((item) => `- ${item}`) ?? ['- None recorded.']),
      '',
      'Policy checks',
      ...(issues.length
        ? issues.map((issue) => `- ${issue.severity.toUpperCase()}: ${issue.message} [${issue.source}]`)
        : ['- No policy issues recorded.']),
      '',
      'Blocked or unsafe alternatives considered',
      ...(blockedAlternatives.length
        ? blockedAlternatives.map((item) => `- ${item.alternative}: ${item.reason}`)
        : ['- None recorded.']),
      '',
      `Blocking issues present: ${blocked.length > 0 ? 'yes' : 'no'}`,
      `Report audience: ${audience}`,
      `Owner contact: ${pool.ownerName ?? 'Owner'} <${pool.ownerEmail ?? 'unknown'}>`,
      advisoryDisclaimer,
    ];

    const pdfBuffer = createSimplePdfBuffer(lines);
    const filenameBase = `treatment-report-v${plan.version}-${audience}`;
    const emailSubject = `H2Own treatment report for ${pool.poolName} (${audience.replace('_', ' ')})`;
    const emailText = lines.join('\n');

    return {
      plan,
      pool,
      audience,
      filename: `${filenameBase}.pdf`,
      pdfBuffer,
      emailSubject,
      emailText,
    };
  }

  private async getNextVersion(poolId: string) {
    const [row] = await this.db.select({ version: sql<number>`coalesce(max(${schema.treatmentPlans.version}), 0)` })
      .from(schema.treatmentPlans)
      .where(eq(schema.treatmentPlans.poolId, poolId));
    return Number(row?.version ?? 0) + 1;
  }

  private async buildContext(poolId: string) {
    const [[pool], [latestTest], recommendationPreview, recentDosing, recentCosts, location, [latestWeather], sensorReadings, outcomeQualityRows] = await Promise.all([
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
      this.db.select().from(schema.userLocations)
        .innerJoin(schema.pools, eq(schema.userLocations.locationId, schema.pools.locationId))
        .where(eq(schema.pools.poolId, poolId))
        .limit(1)
        .then((rows) => rows[0]?.user_locations ?? null),
      this.db.select().from(schema.weatherData)
        .innerJoin(schema.pools, eq(schema.weatherData.locationId, schema.pools.locationId))
        .where(eq(schema.pools.poolId, poolId)).orderBy(desc(schema.weatherData.recordedAt)).limit(1)
        .then((rows) => rows.map((row) => row.weather_data)),
      this.db.select({
        metric: schema.sensorReadings.metric,
        value: schema.sensorReadings.value,
        recordedAt: schema.sensorReadings.recordedAt,
      })
        .from(schema.sensorReadings)
        .where(and(eq(schema.sensorReadings.poolId, poolId), inArray(schema.sensorReadings.metric, ['water_temp_f', 'air_temp_f', 'humidity_percent', 'uv_index'])))
        .orderBy(desc(schema.sensorReadings.recordedAt))
        .limit(10),
      this.db.select({
        recommendationType: schema.predictionOutcomes.recommendationType,
        treatmentType: schema.predictionOutcomes.treatmentType,
        qualitySignal: schema.predictionOutcomes.qualitySignal,
        status: schema.predictionOutcomes.status,
      })
        .from(schema.predictionOutcomes)
        .where(eq(schema.predictionOutcomes.poolId, poolId))
        .orderBy(desc(schema.predictionOutcomes.recordedAt))
        .limit(20),
    ]);

    return {
      pool,
      latestTest,
      recommendationPreview,
      recentDosing,
      recentCosts,
      location,
      weatherSnapshot: latestWeather ?? null,
      sensorReadings,
      outcomeQualitySignals: outcomeQualityRows,
      quality: {
        hasLatestTest: Boolean(latestTest),
        hasWeatherData: Boolean(latestWeather),
      },
    };
  }

  private buildPrompt(context: TreatmentPlanContext) {
    if (!context.quality.hasLatestTest) {
      throw new Error('Refusal: insufficient data quality (missing latest test session).');
    }

    return [
      'Generate a pool treatment plan as strict JSON with keys: interpretationSummary, stepByStepPlan, monitoringChecks, confidence, assumptions, safetyDisclaimer.',
      'Each response must also account for data sources used, timestamp freshness, explicit assumptions, and blocked unsafe alternatives considered.',
      'Guardrails: no prohibited combinations (cal-hypo + trichlor, cal-hypo + acid), conservative dosing ceilings, no action steps when local safety constraints block dosing, advisory-only disclaimer required.',
      `Context: ${JSON.stringify(context)}`,
    ].join('\n');
  }

  private evaluatePolicyIssues(context: TreatmentPlanContext, steps: TreatmentPlanPayload['stepByStepPlan']) {
    const issues: TreatmentPolicyIssue[] = [];
    const normalizedActions = steps.map((step) => step.action.toLowerCase());
    const hasCalHypo = normalizedActions.some((value) => value.includes('cal-hypo') || value.includes('calcium hypochlorite'));
    const hasTrichlor = normalizedActions.some((value) => value.includes('trichlor'));
    const hasAcid = normalizedActions.some((value) => value.includes('muriatic acid') || value.includes('dry acid'));

    if (hasCalHypo && hasTrichlor) {
      issues.push({
        code: 'chemical_incompatibility_cal_hypo_trichlor',
        severity: 'blocking',
        message: 'Plan mixes cal-hypo and trichlor guidance, which is chemically incompatible.',
        blocksActions: true,
        source: 'chemical_policy',
      });
    }

    if (hasCalHypo && hasAcid) {
      issues.push({
        code: 'chemical_incompatibility_cal_hypo_acid',
        severity: 'blocking',
        message: 'Plan mixes cal-hypo and acid guidance, which is chemically incompatible.',
        blocksActions: true,
        source: 'chemical_policy',
      });
    }

    if (!this.enforceDosingCeiling(steps, context.pool.volumeGallons)) {
      issues.push({
        code: 'dosing_ceiling_exceeded',
        severity: 'blocking',
        message: 'At least one recommended dosage exceeds the conservative ceiling for this pool volume.',
        blocksActions: true,
        source: 'dosing_policy',
      });
    }

    const weather = context.weatherSnapshot;
    const windSpeed = toNullableNumber(weather?.windSpeedMph);
    const gustSpeed = toNullableNumber(weather?.windGustMph);
    const airTemp = toNullableNumber(weather?.airTempF);
    const heatStress = toNullableNumber(weather?.ezHeatStressIndex);
    const rainfall = toNullableNumber(weather?.rainfallIn);
    const latestTestFreshness = computeFreshness(context.latestTest?.testedAt ?? null, 48);

    if (latestTestFreshness === 'stale') {
      issues.push({
        code: 'stale_latest_test',
        severity: 'blocking',
        message: 'Latest chemistry test is stale; collect a fresh sample before surfacing dosing steps.',
        blocksActions: true,
        source: 'freshness_policy',
      });
    }

    if ((windSpeed !== null && windSpeed >= 20) || (gustSpeed !== null && gustSpeed >= 30)) {
      issues.push({
        code: 'local_high_wind',
        severity: 'blocking',
        message: 'Local weather indicates high wind. Delay manual chemical handling until conditions settle.',
        blocksActions: true,
        source: 'local_weather_policy',
      });
    }

    if ((airTemp !== null && airTemp >= 100) || (heatStress !== null && heatStress >= 4)) {
      issues.push({
        code: 'local_heat_stress',
        severity: 'warning',
        message: 'Local weather indicates elevated heat stress. Schedule chemical handling for cooler hours with hydration and PPE.',
        blocksActions: false,
        source: 'local_weather_policy',
      });
    }

    if (rainfall !== null && rainfall >= 0.5) {
      issues.push({
        code: 'local_rain_recent',
        severity: 'warning',
        message: 'Recent rain can shift chemistry. Re-test after circulation before locking in dosing.',
        blocksActions: false,
        source: 'local_weather_policy',
      });
    }

    return issues;
  }

  private hydratePlanPayload(input: {
    payload: TreatmentPlanPayload;
    context: TreatmentPlanContext;
  }): TreatmentPlanPayload {
    const { payload, context } = input;
    if (!payload.safetyDisclaimer.toLowerCase().includes('advisory only')) {
      throw new Error('Safety disclaimer missing required advisory-only language');
    }

    const generatedAt = new Date();
    const latestSensorAt = context.sensorReadings[0]?.recordedAt ?? null;
    const latestTestFreshness = computeFreshness(context.latestTest?.testedAt ?? null, 48);
    const weatherFreshness = computeFreshness(context.weatherSnapshot?.recordedAt ?? null, 12);
    const sensorFreshness = computeFreshness(latestSensorAt, 6);
    const policyIssues = this.evaluatePolicyIssues(context, payload.stepByStepPlan);
    const blockingIssues = policyIssues.filter((issue) => issue.blocksActions);

    const blockedAlternatives = blockingIssues.flatMap((issue) => {
      const matchingSteps = payload.stepByStepPlan.filter((step) => {
        if (issue.code.includes('cal_hypo')) {
          return hasActionKeyword(step.action, ['cal-hypo', 'calcium hypochlorite', 'trichlor', 'muriatic acid', 'dry acid']);
        }
        return true;
      });

      return matchingSteps.map((step) => ({
        alternative: step.action,
        reason: issue.message,
        blockedBy: issue.code,
        severity: issue.severity,
      }));
    });

    const safeSteps = blockingIssues.length > 0
      ? [{
          action: 'Hold chemical dosing and verify safe conditions',
          amount: null,
          unit: null,
          timing: 'Before any treatment action',
          rationale: uniqueStrings(blockingIssues.map((issue) => issue.message)).join(' '),
          riskFlags: blockingIssues.map((issue) => issue.code),
          recommendedDueAt: null,
          eventType: 'test' as const,
          leadMinutes: null,
          recurrence: 'once' as const,
        }]
      : payload.stepByStepPlan;

    const assumptions = uniqueStrings([
      ...payload.assumptions,
      'Pool volume and sanitizer configuration on file are current.',
      latestTestFreshness === 'missing' ? 'No recent chemistry test timestamp was available.' : null,
      weatherFreshness === 'missing' ? 'Weather-based local safety checks were limited because no local weather snapshot was available.' : null,
      sensorFreshness === 'missing' ? 'Sensor-derived adjustments were limited because no recent sensor reading was available.' : null,
      blockingIssues.length > 0 ? 'Action steps were reduced to a hold-and-verify step because blocking policy checks were triggered.' : null,
    ]);

    const dataSourcesUsed: TreatmentPlanMetadata['dataSourcesUsed'] = [
      {
        kind: 'latest_test',
        label: 'Latest chemistry test',
        timestamp: formatTimestamp(context.latestTest?.testedAt ?? null),
        freshness: latestTestFreshness,
        details: context.latestTest?.sessionId ?? null,
      },
      {
        kind: 'weather',
        label: 'Local weather snapshot',
        timestamp: formatTimestamp(context.weatherSnapshot?.recordedAt ?? null),
        freshness: weatherFreshness,
        details: context.location?.formattedAddress ?? null,
      },
      {
        kind: 'sensor',
        label: 'Most recent sensor reading',
        timestamp: formatTimestamp(latestSensorAt),
        freshness: sensorFreshness,
        details: context.sensorReadings[0]?.metric ?? null,
      },
      {
        kind: 'recommendation_preview',
        label: 'Deterministic recommendation preview',
        timestamp: formatTimestamp(context.latestTest?.testedAt ?? null),
        freshness: context.recommendationPreview ? 'fresh' : 'missing',
        details: context.recommendationPreview?.primary?.chemicalName ?? null,
      },
    ];

    const provenanceLabels = [
      `Derived from latest test at ${formatTimestamp(context.latestTest?.testedAt ?? null) ?? 'unknown'}`,
      `weather at ${formatTimestamp(context.weatherSnapshot?.recordedAt ?? null) ?? 'unavailable'}`,
      `sensor reading at ${formatTimestamp(latestSensorAt) ?? 'unavailable'}`,
    ];

    return {
      ...payload,
      stepByStepPlan: safeSteps,
      monitoringChecks: uniqueStrings([
        ...payload.monitoringChecks,
        blockingIssues.length > 0 ? 'Collect a fresh chemistry test once safety constraints clear before dosing.' : null,
      ]),
      assumptions,
      planMetadata: {
        generatedAt: generatedAt.toISOString(),
        dataSourcesUsed,
        timestampFreshness: {
          latestTest: latestTestFreshness,
          weather: weatherFreshness,
          sensor: sensorFreshness,
        },
        explicitAssumptions: assumptions,
        blockedUnsafeAlternativesConsidered: blockedAlternatives,
        policyChecks: {
          passed: blockingIssues.length === 0,
          issues: policyIssues,
        },
        provenance: {
          latestTestAt: formatTimestamp(context.latestTest?.testedAt ?? null),
          weatherAt: formatTimestamp(context.weatherSnapshot?.recordedAt ?? null),
          sensorReadingAt: formatTimestamp(latestSensorAt),
          labels: provenanceLabels,
        },
        reportAudiences: ['owner', 'service_tech', 'audit'],
      },
    };
  }

  private enforceDosingCeiling(
    steps: TreatmentPlanPayload['stepByStepPlan'],
    poolVolumeGallons: number | null,
  ) {
    if (!poolVolumeGallons) return true;
    const maxOzPer10k = 128;
    const volumeFactor = poolVolumeGallons / 10000;
    return steps.every((step) => {
      if (step.amount === null || !step.unit) return true;
      if (step.unit.toLowerCase() !== 'oz') return true;
      return step.amount <= maxOzPer10k * volumeFactor;
    });
  }

  private async persistFallbackPlan(input: {
    poolId: string;
    userId: string;
    linkedTestId: string | null;
    promptHash: string;
    contextHash: string;
    version: number;
    context: TreatmentPlanContext;
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
    const payload = this.hydratePlanPayload({
      context: input.context,
      payload: {
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
      },
    });

    const [inserted] = await this.db.insert(schema.treatmentPlans).values({
      poolId: input.poolId,
      generatedBy: input.userId,
      linkedTestId: input.linkedTestId,
      version: input.version,
      status: payload.planMetadata?.policyChecks.passed ? 'fallback' : 'refused',
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
export { treatmentPlanSchema, reportAudienceSchema };
