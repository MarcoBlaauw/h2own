import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleRoutes } from './schedule.js';
import { scheduleEventsService } from '../services/schedule-events.js';

describe('schedule routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: 'user-1', role: 'member' };
      }),
    } as any);
    app.decorate('audit', { log: vi.fn() } as any);

    await app.register(scheduleRoutes, { prefix: '/schedule' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists schedule events for the current user', async () => {
    vi.spyOn(scheduleEventsService, 'listEvents').mockResolvedValue([
      {
        eventId: 'event-1',
        userId: 'user-1',
        poolId: 'pool-1',
        poolName: 'Backyard Pool',
        eventType: 'test',
        title: 'Weekly chemistry check',
        notes: null,
        dueAt: '2026-03-14T12:00:00.000Z',
        timezone: 'UTC',
        recurrence: 'once',
        recurrenceInterval: 1,
        reminderLeadMinutes: 1440,
        status: 'scheduled',
        completedAt: null,
        canceledAt: null,
        lastReminderAt: null,
        createdAt: '2026-03-13T12:00:00.000Z',
        updatedAt: '2026-03-13T12:00:00.000Z',
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/schedule/events?status=scheduled',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ title: 'Weekly chemistry check' }],
    });
    expect(scheduleEventsService.listEvents).toHaveBeenCalledWith('user-1', {
      from: undefined,
      to: undefined,
      poolId: undefined,
      status: 'scheduled',
      limit: undefined,
    });
  });

  it('creates a schedule event', async () => {
    vi.spyOn(scheduleEventsService, 'createEvent').mockResolvedValue({
      eventId: 'event-1',
      userId: 'user-1',
      poolId: 'pool-1',
      poolName: 'Backyard Pool',
      eventType: 'dosage',
      title: 'Add chlorine',
      notes: 'Use liquid chlorine',
      dueAt: '2026-03-14T12:00:00.000Z',
      timezone: 'UTC',
      recurrence: 'weekly',
      recurrenceInterval: 1,
      reminderLeadMinutes: 60,
      status: 'scheduled',
      completedAt: null,
      canceledAt: null,
      lastReminderAt: null,
      createdAt: '2026-03-13T12:00:00.000Z',
      updatedAt: '2026-03-13T12:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/schedule/events',
      payload: {
        poolId: '766f727e-76e4-427b-a0fd-2e07dfe4e924',
        eventType: 'dosage',
        title: 'Add chlorine',
        dueAt: '2026-03-14T12:00:00.000Z',
        recurrence: 'weekly',
        reminderLeadMinutes: 60,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().title).toBe('Add chlorine');
  });

  it('completes a schedule event', async () => {
    vi.spyOn(scheduleEventsService, 'completeEvent').mockResolvedValue({
      eventId: 'event-1',
      userId: 'user-1',
      poolId: 'pool-1',
      poolName: 'Backyard Pool',
      eventType: 'test',
      title: 'Weekly chemistry check',
      notes: null,
      dueAt: '2026-03-21T12:00:00.000Z',
      timezone: 'UTC',
      recurrence: 'weekly',
      recurrenceInterval: 1,
      reminderLeadMinutes: 1440,
      status: 'scheduled',
      completedAt: null,
      canceledAt: null,
      lastReminderAt: null,
      createdAt: '2026-03-13T12:00:00.000Z',
      updatedAt: '2026-03-13T12:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/schedule/events/766f727e-76e4-427b-a0fd-2e07dfe4e924/complete',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().dueAt).toBe('2026-03-21T12:00:00.000Z');
  });
});
