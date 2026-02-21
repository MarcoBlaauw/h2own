import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

export interface AuditWriteInput {
  action: string;
  entity?: string | null;
  entityId?: string | null;
  userId?: string | null;
  poolId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  data?: unknown;
}

export class AuditWriterService {
  constructor(private readonly db = dbClient) {}

  async write(entry: AuditWriteInput) {
    await this.db.insert(schema.auditLog).values({
      action: entry.action,
      entity: entry.entity ?? null,
      entityId: entry.entityId ?? null,
      userId: entry.userId ?? null,
      poolId: entry.poolId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      sessionId: entry.sessionId ?? null,
      data: entry.data ?? null,
    });
  }
}

export const auditWriterService = new AuditWriterService();
