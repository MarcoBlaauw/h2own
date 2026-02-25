import { eq } from 'drizzle-orm';
import { db as dbClient } from '../../db/index.js';
import * as schema from '../../db/schema/index.js';
import { PoolCoreService } from './core.js';

export type ThermalEquipmentType = 'none' | 'heater' | 'chiller' | 'combo';
export type ThermalEnergySource = 'gas' | 'electric' | 'heat_pump' | 'solar_assisted' | 'unknown';
export type ThermalStatus = 'enabled' | 'disabled';
export type TemperatureUnit = 'F' | 'C';

export interface PoolEquipmentData {
  equipmentType: ThermalEquipmentType;
  energySource: ThermalEnergySource;
  status: ThermalStatus;
  capacityBtu: number | null;
  metadata: unknown;
}

export interface PoolEquipmentDetail extends PoolEquipmentData {
  poolId: string;
  equipmentId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PoolTemperaturePreferencesData {
  preferredTemp: number | null;
  minTemp: number | null;
  maxTemp: number | null;
  unit: TemperatureUnit;
}

export interface PoolTemperaturePreferencesDetail extends PoolTemperaturePreferencesData {
  poolId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

const DEFAULT_EQUIPMENT: Omit<PoolEquipmentDetail, 'poolId'> = {
  equipmentId: null,
  equipmentType: 'none',
  energySource: 'unknown',
  status: 'disabled',
  capacityBtu: null,
  metadata: null,
  createdAt: null,
  updatedAt: null,
};

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const celsiusToFahrenheit = (value: number) => (value * 9) / 5 + 32;
const fahrenheitToCelsius = (value: number) => ((value - 32) * 5) / 9;

function convertToFahrenheit(value: number | null, unit: TemperatureUnit) {
  if (value === null) return null;
  const normalized = unit === 'C' ? celsiusToFahrenheit(value) : value;
  return Number(normalized.toFixed(2));
}

function convertFromFahrenheit(value: number | null, unit: TemperatureUnit) {
  if (value === null) return null;
  const display = unit === 'C' ? fahrenheitToCelsius(value) : value;
  return Number(display.toFixed(2));
}

function resolveHasHeater(equipmentType: ThermalEquipmentType) {
  return equipmentType === 'heater' || equipmentType === 'combo';
}

export class PoolEquipmentService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  private async getUserTemperatureUnit(userId: string): Promise<TemperatureUnit> {
    const [preferences] = await this.db
      .select({ temperatureUnit: schema.userPreferences.temperatureUnit })
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);

    return preferences?.temperatureUnit === 'C' ? 'C' : 'F';
  }

  async getEquipment(poolId: string, userId: string): Promise<PoolEquipmentDetail> {
    await this.core.ensurePoolCapability(poolId, userId, 'pool.read');
    return this.getEquipmentRecord(poolId);
  }

  async getEquipmentAsAdmin(poolId: string): Promise<PoolEquipmentDetail> {
    await this.core.ensurePoolExists(poolId);
    return this.getEquipmentRecord(poolId);
  }

  private async getEquipmentRecord(poolId: string): Promise<PoolEquipmentDetail> {

    const [equipment] = await this.db
      .select()
      .from(schema.poolEquipment)
      .where(eq(schema.poolEquipment.poolId, poolId))
      .limit(1);

    if (!equipment) {
      return {
        poolId,
        ...DEFAULT_EQUIPMENT,
      };
    }

    return {
      poolId: equipment.poolId,
      equipmentId: equipment.equipmentId,
      equipmentType: equipment.equipmentType as ThermalEquipmentType,
      energySource: equipment.energySource as ThermalEnergySource,
      status: equipment.status as ThermalStatus,
      capacityBtu: equipment.capacityBtu ?? null,
      metadata: equipment.metadata ?? null,
      createdAt: equipment.createdAt,
      updatedAt: equipment.updatedAt,
    };
  }

  async upsertEquipment(
    poolId: string,
    userId: string,
    data: PoolEquipmentData
  ): Promise<PoolEquipmentDetail> {
    await this.core.ensurePoolCapability(poolId, userId, 'pool.update');
    return this.upsertEquipmentRecord(poolId, data);
  }

  async upsertEquipmentAsAdmin(poolId: string, data: PoolEquipmentData): Promise<PoolEquipmentDetail> {
    await this.core.ensurePoolExists(poolId);
    return this.upsertEquipmentRecord(poolId, data);
  }

  private async upsertEquipmentRecord(poolId: string, data: PoolEquipmentData): Promise<PoolEquipmentDetail> {

    const now = new Date();
    const [existing] = await this.db
      .select({ equipmentId: schema.poolEquipment.equipmentId })
      .from(schema.poolEquipment)
      .where(eq(schema.poolEquipment.poolId, poolId))
      .limit(1);

    if (existing) {
      await this.db
        .update(schema.poolEquipment)
        .set({
          equipmentType: data.equipmentType,
          energySource: data.energySource,
          status: data.status,
          capacityBtu: data.capacityBtu,
          metadata: data.metadata,
          updatedAt: now,
        })
        .where(eq(schema.poolEquipment.poolId, poolId));
    } else {
      await this.db.insert(schema.poolEquipment).values({
        poolId,
        equipmentType: data.equipmentType,
        energySource: data.energySource,
        status: data.status,
        capacityBtu: data.capacityBtu,
        metadata: data.metadata,
      });
    }

    await this.db
      .update(schema.pools)
      .set({ hasHeater: resolveHasHeater(data.equipmentType), updatedAt: now })
      .where(eq(schema.pools.poolId, poolId));

    return this.getEquipmentRecord(poolId);
  }

  async getTemperaturePreferences(
    poolId: string,
    userId: string
  ): Promise<PoolTemperaturePreferencesDetail> {
    await this.core.ensurePoolCapability(poolId, userId, 'pool.read');
    return this.getTemperaturePreferencesRecord(poolId, userId);
  }

  async getTemperaturePreferencesAsAdmin(poolId: string): Promise<PoolTemperaturePreferencesDetail> {
    await this.core.ensurePoolExists(poolId);
    return this.getTemperaturePreferencesRecord(poolId);
  }

  private async getTemperaturePreferencesRecord(
    poolId: string,
    userId?: string
  ): Promise<PoolTemperaturePreferencesDetail> {
    const [prefs] = await this.db
      .select()
      .from(schema.poolTemperaturePrefs)
      .where(eq(schema.poolTemperaturePrefs.poolId, poolId))
      .limit(1);

    const fallbackUnit: TemperatureUnit = userId ? await this.getUserTemperatureUnit(userId) : 'F';

    if (!prefs) {
      return {
        poolId,
        preferredTemp: null,
        minTemp: null,
        maxTemp: null,
        unit: fallbackUnit,
        createdAt: null,
        updatedAt: null,
      };
    }

    const unit: TemperatureUnit = prefs.unit === 'C' ? 'C' : 'F';

    return {
      poolId,
      preferredTemp: convertFromFahrenheit(toNumber(prefs.preferredTempF), unit),
      minTemp: convertFromFahrenheit(toNumber(prefs.minTempF), unit),
      maxTemp: convertFromFahrenheit(toNumber(prefs.maxTempF), unit),
      unit,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    };
  }

  async upsertTemperaturePreferences(
    poolId: string,
    userId: string,
    data: PoolTemperaturePreferencesData
  ): Promise<PoolTemperaturePreferencesDetail> {
    await this.core.ensurePoolCapability(poolId, userId, 'pool.update');
    return this.upsertTemperaturePreferencesRecord(poolId, data, userId);
  }

  async upsertTemperaturePreferencesAsAdmin(
    poolId: string,
    data: PoolTemperaturePreferencesData
  ): Promise<PoolTemperaturePreferencesDetail> {
    await this.core.ensurePoolExists(poolId);
    return this.upsertTemperaturePreferencesRecord(poolId, data);
  }

  private async upsertTemperaturePreferencesRecord(
    poolId: string,
    data: PoolTemperaturePreferencesData,
    userId?: string
  ) {
    const unit = data.unit;
    const preferredTempF = convertToFahrenheit(data.preferredTemp, unit);
    const minTempF = convertToFahrenheit(data.minTemp, unit);
    const maxTempF = convertToFahrenheit(data.maxTemp, unit);

    const [existing] = await this.db
      .select({ poolId: schema.poolTemperaturePrefs.poolId })
      .from(schema.poolTemperaturePrefs)
      .where(eq(schema.poolTemperaturePrefs.poolId, poolId))
      .limit(1);

    if (existing) {
      await this.db
        .update(schema.poolTemperaturePrefs)
        .set({
          preferredTempF: preferredTempF === null ? null : preferredTempF.toFixed(2),
          minTempF: minTempF === null ? null : minTempF.toFixed(2),
          maxTempF: maxTempF === null ? null : maxTempF.toFixed(2),
          unit,
          updatedAt: new Date(),
        })
        .where(eq(schema.poolTemperaturePrefs.poolId, poolId));
    } else {
      await this.db.insert(schema.poolTemperaturePrefs).values({
        poolId,
        preferredTempF: preferredTempF === null ? null : preferredTempF.toFixed(2),
        minTempF: minTempF === null ? null : minTempF.toFixed(2),
        maxTempF: maxTempF === null ? null : maxTempF.toFixed(2),
        unit,
      });
    }

    return this.getTemperaturePreferencesRecord(poolId, userId);
  }

  async clearTemperaturePreferences(poolId: string, userId: string) {
    await this.core.ensurePoolCapability(poolId, userId, 'pool.update');

    await this.db.delete(schema.poolTemperaturePrefs).where(eq(schema.poolTemperaturePrefs.poolId, poolId));

    return this.getTemperaturePreferences(poolId, userId);
  }
}

export const poolEquipmentService = new PoolEquipmentService();
