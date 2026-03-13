import { eq } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { hasAccountCapability } from './authorization.js';

export type BillingSummary = {
  featureStatus: 'hooked';
  plan: {
    tier: string;
    isPaid: boolean;
  };
  status: string;
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
      })
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    const tier = row?.subscriptionTier?.trim().toLowerCase() || 'free';
    const status = row?.subscriptionStatus?.trim().toLowerCase() || 'active';
    const isPaid = !['free', 'trial', 'basic_free'].includes(tier);

    return {
      featureStatus: 'hooked',
      plan: {
        tier,
        isPaid,
      },
      status,
      capabilities: {
        read: hasAccountCapability(role, 'billing.read'),
        manage: hasAccountCapability(role, 'billing.manage'),
      },
    };
  }
}

export const billingService = new BillingService();
