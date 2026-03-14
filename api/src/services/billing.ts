import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { hasAccountCapability } from './authorization.js';
import { env } from '../env.js';

export type BillingSummary = {
  featureStatus: 'hooked';
  provider: string | null;
  plan: {
    tier: string;
    isPaid: boolean;
  };
  status: string;
  paymentStatus: string;
  invoices: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    hostedUrl: string | null;
    issuedAt: string | null;
    paidAt: string | null;
  }>;
  capabilities: {
    read: boolean;
    manage: boolean;
  };
};

export class BillingService {
  constructor(private readonly db = dbClient) {}

  async getSummary(userId: string, role: string | null | undefined): Promise<BillingSummary> {
    const [row] = await this.db
      .select({
        subscriptionTier: schema.userPreferences.subscriptionTier,
        subscriptionStatus: schema.userPreferences.subscriptionStatus,
        billingPaymentStatus: schema.userPreferences.billingPaymentStatus,
        billingCustomerId: schema.userPreferences.billingCustomerId,
        billingProvider: schema.userPreferences.billingProvider,
      })
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    const tier = row?.subscriptionTier?.trim().toLowerCase() || 'free';
    const status = row?.subscriptionStatus?.trim().toLowerCase() || 'active';
    const paymentStatus = row?.billingPaymentStatus?.trim().toLowerCase() || 'unpaid';
    const provider = row?.billingProvider ?? null;
    const isPaid = !['free', 'trial', 'basic_free'].includes(tier);

    const invoices = await this.fetchInvoiceHistory({
      userId,
      customerId: row?.billingCustomerId ?? null,
      provider,
    });

    return {
      featureStatus: 'hooked',
      provider,
      plan: { tier, isPaid },
      status,
      paymentStatus,
      invoices,
      capabilities: {
        read: hasAccountCapability(role, 'billing.read'),
        manage: hasAccountCapability(role, 'billing.manage'),
      },
    };
  }

  async createPortalSession(userId: string, returnUrl?: string | null) {
    if (!env.BILLING_PROVIDER_BASE_URL || !env.BILLING_PROVIDER_API_KEY) {
      return {
        ok: false,
        featureStatus: 'provider_not_configured' as const,
        url: null,
        message: 'Billing provider is not configured.',
      };
    }

    const [pref] = await this.db
      .select({
        billingCustomerId: schema.userPreferences.billingCustomerId,
        billingProvider: schema.userPreferences.billingProvider,
      })
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    const response = await fetch(`${env.BILLING_PROVIDER_BASE_URL}/portal-sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.BILLING_PROVIDER_API_KEY}`,
      },
      body: JSON.stringify({
        userId,
        customerId: pref?.billingCustomerId ?? null,
        returnUrl: returnUrl ?? env.APP_BASE_URL,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Billing portal session request failed: ${response.status} ${message}`);
    }

    const payload = (await response.json()) as { url?: string | null; provider?: string | null };

    await this.db
      .update(schema.userPreferences)
      .set({
        billingProvider: payload.provider ?? pref?.billingProvider ?? 'external',
      })
      .where(eq(schema.userPreferences.userId, userId));

    return {
      ok: true,
      featureStatus: 'hooked' as const,
      url: payload.url ?? null,
      message: payload.url ? 'Billing portal session created.' : 'Billing portal session acknowledged.',
    };
  }

  async ingestSubscriptionWebhook(input: {
    signature?: string;
    body: {
      userId?: string;
      customerId?: string;
      subscriptionId?: string;
      provider?: string;
      tier?: string;
      status?: string;
      paymentStatus?: string;
    };
    rawBody: string;
  }) {
    if (env.BILLING_WEBHOOK_SECRET) {
      const digest = crypto
        .createHmac('sha256', env.BILLING_WEBHOOK_SECRET)
        .update(input.rawBody)
        .digest('hex');
      if (!input.signature || input.signature !== digest) {
        const error = new Error('Invalid webhook signature') as Error & { code?: string };
        error.code = 'invalid_signature';
        throw error;
      }
    }

    const userId = input.body.userId;
    if (!userId) {
      throw new Error('Missing userId in billing webhook payload');
    }

    await this.db
      .update(schema.userPreferences)
      .set({
        billingCustomerId: input.body.customerId,
        billingSubscriptionId: input.body.subscriptionId,
        billingProvider: input.body.provider,
        subscriptionTier: input.body.tier ?? 'free',
        subscriptionStatus: input.body.status ?? 'active',
        billingPaymentStatus: input.body.paymentStatus ?? 'unpaid',
        updatedAt: new Date(),
      })
      .where(eq(schema.userPreferences.userId, userId));

    return { ok: true };
  }

  private async fetchInvoiceHistory(input: {
    userId: string;
    customerId: string | null;
    provider: string | null;
  }): Promise<BillingSummary['invoices']> {
    if (!env.BILLING_PROVIDER_BASE_URL || !env.BILLING_PROVIDER_API_KEY) return [];

    const query = new URLSearchParams();
    query.set('userId', input.userId);
    if (input.customerId) query.set('customerId', input.customerId);

    try {
      const response = await fetch(`${env.BILLING_PROVIDER_BASE_URL}/invoices?${query.toString()}`, {
        headers: {
          authorization: `Bearer ${env.BILLING_PROVIDER_API_KEY}`,
        },
      });

      if (!response.ok) return [];
      const payload = (await response.json()) as { invoices?: BillingSummary['invoices'] };
      return payload.invoices ?? [];
    } catch {
      return [];
    }
  }
}

export const billingService = new BillingService();
