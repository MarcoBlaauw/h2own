import { api } from '$lib/api';
import type { LayoutServerLoad } from './$types';

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  address?: string | null;
  supervisors?: Array<{
    userId: string;
    email: string;
    name: string | null;
  }>;
};

type SessionPayload = {
  user: SessionUser | null;
  monetization?: {
    adsEnabled: boolean;
    paidSubscriber: boolean;
    source: 'billing' | 'fallback';
  };
};

type BillingSummaryPayload = {
  status?: string | null;
  plan?: {
    tier?: string | null;
    name?: string | null;
    isPaid?: boolean | null;
    amountCents?: number | null;
  } | null;
};

const isAdminLikeRole = (role: string | null | undefined) => role === 'admin' || role === 'business';

const isPaidBillingSummary = (payload: BillingSummaryPayload | null) => {
  if (!payload) return false;
  if (payload.plan?.isPaid === true) return true;

  const tier = (payload.plan?.tier ?? payload.plan?.name ?? '').toString().trim().toLowerCase();
  if (tier && !['free', 'trial', 'basic_free'].includes(tier)) {
    return true;
  }

  const amountCents = typeof payload.plan?.amountCents === 'number' ? payload.plan.amountCents : 0;
  if (amountCents > 0) return true;

  const status = (payload.status ?? '').toString().trim().toLowerCase();
  return ['active', 'paid', 'trialing'].includes(status) && Boolean(tier && tier !== 'free');
};

export const load: LayoutServerLoad<{ session: SessionPayload | null }> = async ({
  fetch,
  request,
}) => {
  try {
    const cookie = request.headers.get('cookie') ?? '';
    const res = await api.auth.me((input, init = {}) =>
      fetch(input, {
        ...init,
        headers: {
          ...init.headers,
          cookie,
        },
      }),
    );
    if (res.ok) {
      const session = (await res.json()) as SessionPayload;
      if (session?.user?.id) {
        const profileRes = await api.me.profile((input, init = {}) =>
          fetch(input, {
            ...init,
            headers: {
              ...init.headers,
              cookie,
            },
          }),
        );
        if (profileRes.ok) {
          const profile = (await profileRes.json()) as {
            firstName?: string | null;
            lastName?: string | null;
            nickname?: string | null;
            address?: string | null;
            supervisors?: Array<{ userId: string; email: string; name: string | null }>;
          };
          session.user = {
            ...session.user,
            firstName: profile.firstName ?? null,
            lastName: profile.lastName ?? null,
            nickname: profile.nickname ?? null,
            address: profile.address ?? null,
            supervisors: profile.supervisors ?? [],
          };
        }

        let paidSubscriber = false;
        let source: 'billing' | 'fallback' = 'fallback';
        try {
          const billingRes = await api.billing.summary((input, init = {}) =>
            fetch(input, {
              ...init,
              headers: {
                ...init.headers,
                cookie,
              },
            }),
          );
          if (billingRes.ok) {
            const billing = (await billingRes.json()) as BillingSummaryPayload;
            paidSubscriber = isPaidBillingSummary(billing);
            source = 'billing';
          }
        } catch {
          // Billing can fail independently; default to fallback derivation.
        }

        session.monetization = {
          adsEnabled: !isAdminLikeRole(session.user.role) && !paidSubscriber,
          paidSubscriber,
          source,
        };

        return { session };
      }
      return { session };
    }
    return { session: null };
  } catch (err) {
    return { session: null };
  }
};
