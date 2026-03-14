import { env } from '../env.js';
import { mailerService } from './mailer.js';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';
export type ErrorCategory = 'provider_unavailable' | 'invalid_recipient' | 'rate_limited' | 'transient' | 'unknown';

export type DispatchPayload = {
  userId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  email?: string | null;
  phone?: string | null;
  pushDeviceRegistered?: boolean;
  metadata?: Record<string, unknown>;
};

export type DispatchResult = {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  errorCategory?: ErrorCategory;
};

type ChannelPlugin = {
  dispatch: (payload: DispatchPayload) => Promise<DispatchResult>;
  healthCheck: () => { ready: boolean; details: string };
};

type ChannelCounters = { success: number; failure: number };

const makeProviderMessageId = (channel: NotificationChannel) => `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const plugins: Record<NotificationChannel, ChannelPlugin> = {
  in_app: {
    async dispatch() {
      return { ok: true, providerMessageId: makeProviderMessageId('in_app') };
    },
    healthCheck: () => ({ ready: true, details: 'In-app channel available.' }),
  },
  email: {
    async dispatch(payload) {
      if (!payload.email) {
        return { ok: false, errorCategory: 'invalid_recipient', errorMessage: 'No email address available.' };
      }
      try {
        await mailerService.send({ to: payload.email, subject: payload.title, text: payload.message });
        return { ok: true, providerMessageId: makeProviderMessageId('email') };
      } catch (error) {
        return {
          ok: false,
          errorCategory: 'provider_unavailable',
          errorMessage: error instanceof Error ? error.message : 'Email provider error',
        };
      }
    },
    healthCheck: () => {
      const ready = Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM_EMAIL);
      return { ready, details: ready ? 'SMTP configured.' : 'SMTP credentials missing.' };
    },
  },
  sms: {
    async dispatch(payload) {
      if (!payload.phone) {
        return { ok: false, errorCategory: 'invalid_recipient', errorMessage: 'Phone number is not registered/verified.' };
      }
      const ready = Boolean(env.SMS_PROVIDER_API_KEY);
      if (!ready) {
        return { ok: false, errorCategory: 'provider_unavailable', errorMessage: 'SMS provider credentials missing.' };
      }
      return { ok: true, providerMessageId: makeProviderMessageId('sms') };
    },
    healthCheck: () => {
      const ready = Boolean(env.SMS_PROVIDER_API_KEY);
      return { ready, details: ready ? 'SMS provider configured.' : 'SMS provider credentials missing.' };
    },
  },
  push: {
    async dispatch(payload) {
      if (!payload.pushDeviceRegistered) {
        return { ok: false, errorCategory: 'invalid_recipient', errorMessage: 'No push device registered.' };
      }
      const ready = Boolean(env.PUSH_PROVIDER_API_KEY);
      if (!ready) {
        return { ok: false, errorCategory: 'provider_unavailable', errorMessage: 'Push provider credentials missing.' };
      }
      return { ok: true, providerMessageId: makeProviderMessageId('push') };
    },
    healthCheck: () => {
      const ready = Boolean(env.PUSH_PROVIDER_API_KEY);
      return { ready, details: ready ? 'Push provider configured.' : 'Push provider credentials missing.' };
    },
  },
};

class NotificationDispatcherService {
  private counters: Record<NotificationChannel, ChannelCounters> = {
    email: { success: 0, failure: 0 },
    in_app: { success: 0, failure: 0 },
    sms: { success: 0, failure: 0 },
    push: { success: 0, failure: 0 },
  };

  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    const plugin = plugins[payload.channel];
    const result = await plugin.dispatch(payload);
    if (result.ok) this.counters[payload.channel].success += 1;
    else this.counters[payload.channel].failure += 1;
    return result;
  }

  getCounters() {
    return this.counters;
  }

  getChannelHealth() {
    return (Object.keys(plugins) as NotificationChannel[]).map((channel) => ({
      channel,
      ...plugins[channel].healthCheck(),
    }));
  }
}

export const notificationDispatcherService = new NotificationDispatcherService();
