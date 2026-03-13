import { describe, expect, it } from 'vitest';
import { addRecurrence } from './schedule-events.js';

describe('addRecurrence', () => {
  it('advances daily events', () => {
    const next = addRecurrence(new Date('2026-03-13T12:00:00.000Z'), 'daily', 2);
    expect(next.toISOString()).toBe('2026-03-15T12:00:00.000Z');
  });

  it('advances weekly events', () => {
    const next = addRecurrence(new Date('2026-03-13T12:00:00.000Z'), 'weekly', 1);
    expect(next.toISOString()).toBe('2026-03-20T12:00:00.000Z');
  });

  it('advances monthly events', () => {
    const next = addRecurrence(new Date('2026-03-13T12:00:00.000Z'), 'monthly', 1);
    expect(next.toISOString()).toBe('2026-04-13T12:00:00.000Z');
  });
});
