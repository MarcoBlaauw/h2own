import { describe, expect, it } from 'vitest';
import { AuditLogService, AuditLogForbiddenError } from './audit-log.js';

describe('AuditLogService', () => {
  it('throws when a non-admin attempts to view the audit log', async () => {
    const service = new AuditLogService({} as any);

    await expect(service.listEntries('member')).rejects.toBeInstanceOf(
      AuditLogForbiddenError
    );
  });
});
