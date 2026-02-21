import { pgTable, uuid, varchar, integer, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { pools } from './pools';

export const poolEquipment = pgTable(
  'pool_equipment',
  {
    equipmentId: uuid('equipment_id').primaryKey().defaultRandom(),
    poolId: uuid('pool_id').notNull().references(() => pools.poolId, { onDelete: 'cascade' }),
    equipmentType: varchar('equipment_type', { length: 24 }).notNull().default('none'),
    energySource: varchar('energy_source', { length: 30 }).notNull().default('unknown'),
    status: varchar('status', { length: 20 }).notNull().default('enabled'),
    capacityBtu: integer('capacity_btu'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    poolUnique: uniqueIndex('pool_equipment_pool_id_key').on(table.poolId),
  })
);
