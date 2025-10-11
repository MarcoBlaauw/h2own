import { db as dbClient } from '../../db/index.js';
import {
  PoolCoreService,
  poolCoreService as defaultCoreService,
  PoolNotFoundError,
  PoolForbiddenError,
  PoolLocationAccessError,
  type CreatePoolData,
  type UpdatePoolData,
  type AdminUpdatePoolData,
  type PoolDetail,
  type PoolMemberDetail,
  type PoolTestDetail,
  type AdminPoolSummary,
  type AdminPoolMemberSummary,
} from './core.js';
import { PoolAdminService, poolAdminService as defaultAdminService } from './admin.js';
import { PoolMembershipService, poolMembershipService as defaultMembershipService } from './members.js';
import { PoolTestingService, poolTestingService as defaultTestingService } from './tests.js';

export const poolsService = {
  core: defaultCoreService,
  admin: defaultAdminService,
  members: defaultMembershipService,
  tests: defaultTestingService,
};

export {
  PoolCoreService,
  PoolAdminService,
  PoolMembershipService,
  PoolTestingService,
  PoolNotFoundError,
  PoolForbiddenError,
  PoolLocationAccessError,
};

export type {
  CreatePoolData,
  UpdatePoolData,
  AdminUpdatePoolData,
  PoolDetail,
  PoolMemberDetail,
  PoolTestDetail,
  AdminPoolSummary,
  AdminPoolMemberSummary,
};

export { type CreateTestData, type CreateDosingData } from './tests.js';

export const poolCoreService = defaultCoreService;
export const poolAdminService = defaultAdminService;
export const poolMembershipService = defaultMembershipService;
export const poolTestingService = defaultTestingService;

export function createPoolsOrchestrator(db = dbClient) {
  const core = new PoolCoreService(db);
  const admin = new PoolAdminService(db, core);
  const members = new PoolMembershipService(db, core);
  const tests = new PoolTestingService(db, core);

  return { core, admin, members, tests };
}
