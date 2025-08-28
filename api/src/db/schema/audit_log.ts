import { pgTable, bigserial, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { pools } from './pools';

export const auditLog = pgTable('audit_log', {
  auditId: bigserial('audit_id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.userId, { onDelete: 'set null' }),
  poolId: uuid('pool_id').references(() => pools.poolId, { onDelete: 'set null' }),
  action: varchar('action', { length: 80 }).notNull(),
  entity: varchar('entity', { length: 80 }),
  entityId: varchar('entity_id', { length: 120 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  sessionId: varchar('session_id', { length: 100 }),
  data: jsonb('data'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
