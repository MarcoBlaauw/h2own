import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const roleCapabilityTemplates = pgTable(
  'role_capability_templates',
  {
    templateId: uuid('template_id').primaryKey().defaultRandom(),
    role: varchar('role', { length: 24 }).notNull(),
    scope: varchar('scope', { length: 24 }).notNull(),
    capability: varchar('capability', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roleScopeCapabilityUnique: uniqueIndex('role_capability_templates_role_scope_capability_idx').on(
      table.role,
      table.scope,
      table.capability
    ),
  })
);
