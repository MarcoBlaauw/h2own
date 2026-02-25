import { db as dbClient } from '../../db/index.js';
import {
  PoolCoreService,
  poolCoreService as defaultCoreService,
  PoolNotFoundError,
  PoolForbiddenError,
  PoolOwnerRequiredError,
  PoolCreateOwnerForbiddenError,
  PoolLocationAccessError,
  PoolValidationError,
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
import {
  PoolRecommendationsService,
  poolRecommendationsService as defaultRecommendationsService,
} from './recommendations.js';
import { PoolCostsService, poolCostsService as defaultCostsService } from './costs.js';
import {
  PoolEquipmentService,
  poolEquipmentService as defaultEquipmentService,
} from './equipment.js';

export const poolsService = {
  core: defaultCoreService,
  admin: defaultAdminService,
  members: defaultMembershipService,
  tests: defaultTestingService,
  recommendations: defaultRecommendationsService,
  costs: defaultCostsService,
  equipment: defaultEquipmentService,
};

export {
  PoolCoreService,
  PoolAdminService,
  PoolMembershipService,
  PoolTestingService,
  PoolRecommendationsService,
  PoolCostsService,
  PoolEquipmentService,
  PoolNotFoundError,
  PoolForbiddenError,
  PoolOwnerRequiredError,
  PoolCreateOwnerForbiddenError,
  PoolLocationAccessError,
  PoolValidationError,
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
export type { RecommendationStatus, CreateRecommendationData, UpdateRecommendationData } from './recommendations.js';
export type { CreateCostData } from './costs.js';
export type {
  PoolEquipmentData,
  PoolEquipmentDetail,
  PoolTemperaturePreferencesData,
  PoolTemperaturePreferencesDetail,
  ThermalEquipmentType,
  ThermalEnergySource,
  ThermalStatus,
  TemperatureUnit,
} from './equipment.js';

export const poolCoreService = defaultCoreService;
export const poolAdminService = defaultAdminService;
export const poolMembershipService = defaultMembershipService;
export const poolTestingService = defaultTestingService;
export const poolRecommendationsService = defaultRecommendationsService;
export const poolCostsService = defaultCostsService;
export const poolEquipmentService = defaultEquipmentService;

export function createPoolsOrchestrator(db = dbClient) {
  const core = new PoolCoreService(db);
  const admin = new PoolAdminService(db, core);
  const members = new PoolMembershipService(db, core);
  const tests = new PoolTestingService(db, core);
  const recommendations = new PoolRecommendationsService(db, core);
  const costs = new PoolCostsService(db, core);
  const equipment = new PoolEquipmentService(db, core);

  return { core, admin, members, tests, recommendations, costs, equipment };
}
