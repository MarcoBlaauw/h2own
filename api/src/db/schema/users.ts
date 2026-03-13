import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 120 }),
  role: varchar('role', { length: 24 }).notNull().default('member'),
  isActive: boolean('is_active').default(true),
  emailVerified: boolean('email_verified').default(false),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  totpSecretEncrypted: text('totp_secret_encrypted'),
  totpPendingSecretEncrypted: text('totp_pending_secret_encrypted'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
