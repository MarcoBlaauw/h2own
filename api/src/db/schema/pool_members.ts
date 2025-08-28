import { pgTable, uuid, varchar, jsonb, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { pools } from './pools';

export const poolMembers = pgTable('pool_members', {
  poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  roleName: varchar('role_name', { length: 24 }).notNull().default('viewer'),
  permissions: jsonb('permissions'),
  invitedBy: uuid('invited_by').references(() => users.userId, { onDelete: 'set null' }),
  invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  lastAccessAt: timestamp('last_access_at', { withTimezone: true }),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.poolId, table.userId] }),
  };
});
