import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ChemicalsService, CreateChemicalData, UpdateChemicalData } from './chemicals.js';
import * as schema from '../db/schema/index.js';

describe('ChemicalsService', () => {
  describe('createChemical', () => {
    it('inserts mapped values and returns the persisted record', async () => {
      const insertMock = vi.fn();
      const valuesMock = vi.fn();
      const returningMock = vi.fn();

      insertMock.mockReturnValue({ values: valuesMock });
      valuesMock.mockReturnValue({ returning: returningMock });

      const persisted = {
        productId: 'b5f0f3fb-9d93-4f53-b624-7a9690cfb181',
        categoryId: '55b24041-49df-4f4f-b3e1-59d30e97e4c8',
        name: 'Calcium Hardness Increaser',
        brand: 'PoolCo',
        productType: 'calcium',
        activeIngredients: { calcium_chloride: 77 },
        concentrationPercent: '77',
        phEffect: '0',
        strengthFactor: '1.2',
        dosePer10kGallons: '1.5',
        doseUnit: 'lb',
        affectsFc: false,
        affectsPh: false,
        affectsTa: false,
        affectsCya: false,
        fcChangePerDose: '0',
        phChangePerDose: '0',
        taChangePerDose: 0,
        cyaChangePerDose: 0,
        form: 'granular',
        packageSizes: ['25 lb'],
        isActive: true,
        averageCostPerUnit: '28.5',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      } as const;

      returningMock.mockResolvedValue([persisted]);

      const service = new ChemicalsService({ insert: insertMock } as any);

      const data: CreateChemicalData = {
        categoryId: persisted.categoryId,
        name: persisted.name,
        brand: persisted.brand!,
        productType: persisted.productType!,
        activeIngredients: { calcium_chloride: 77 },
        concentrationPercent: 77,
        phEffect: 0,
        strengthFactor: 1.2,
        dosePer10kGallons: 1.5,
        doseUnit: 'lb',
        affectsFc: false,
        affectsPh: false,
        affectsTa: false,
        affectsCya: false,
        fcChangePerDose: 0,
        phChangePerDose: 0,
        taChangePerDose: 0,
        cyaChangePerDose: 0,
        form: 'granular',
        packageSizes: ['25 lb'],
        isActive: true,
        averageCostPerUnit: 28.5,
      };

      const result = await service.createChemical(data);

      expect(insertMock).toHaveBeenCalledWith(schema.products);
      expect(valuesMock).toHaveBeenCalledWith({
        categoryId: data.categoryId,
        name: data.name,
        brand: data.brand,
        productType: data.productType,
        activeIngredients: data.activeIngredients,
        concentrationPercent: '77',
        phEffect: '0',
        strengthFactor: '1.2',
        dosePer10kGallons: '1.5',
        doseUnit: data.doseUnit,
        affectsFc: data.affectsFc,
        affectsPh: data.affectsPh,
        affectsTa: data.affectsTa,
        affectsCya: data.affectsCya,
        fcChangePerDose: '0',
        phChangePerDose: '0',
        taChangePerDose: data.taChangePerDose,
        cyaChangePerDose: data.cyaChangePerDose,
        form: data.form,
        packageSizes: data.packageSizes,
        isActive: data.isActive,
        averageCostPerUnit: '28.5',
      });
      expect(returningMock).toHaveBeenCalled();
      expect(result).toEqual(persisted);
    });
  });

  describe('updateChemical', () => {
    it('updates with mapped values and returns the updated record', async () => {
      const updateMock = vi.fn();
      const setMock = vi.fn();
      const whereMock = vi.fn();
      const returningMock = vi.fn();

      updateMock.mockReturnValue({ set: setMock });
      setMock.mockReturnValue({ where: whereMock });
      whereMock.mockReturnValue({ returning: returningMock });

      const persisted = {
        productId: 'df6e9a66-4c72-4b0a-9a8e-8f8a1c8f3a1a',
        categoryId: '55b24041-49df-4f4f-b3e1-59d30e97e4c8',
        name: 'Updated Chemical',
        brand: 'PoolCo',
        concentrationPercent: '10.50',
        isActive: false,
      } as const;

      returningMock.mockResolvedValue([persisted]);

      const service = new ChemicalsService({ update: updateMock } as any);

      const data: UpdateChemicalData = {
        name: persisted.name,
        brand: persisted.brand!,
        concentrationPercent: 10.5,
        isActive: false,
      };

      const result = await service.updateChemical(persisted.productId, data);

      expect(updateMock).toHaveBeenCalledWith(schema.products);
      expect(setMock).toHaveBeenCalledWith({
        name: data.name,
        brand: data.brand,
        concentrationPercent: '10.5',
        isActive: false,
      });
      expect(whereMock).toHaveBeenCalledWith(eq(schema.products.productId, persisted.productId));
      expect(returningMock).toHaveBeenCalled();
      expect(result).toEqual(persisted);
    });
  });

  describe('deleteChemical', () => {
    it('deletes a chemical and returns the removed record', async () => {
      const deleteMock = vi.fn();
      const whereMock = vi.fn();
      const returningMock = vi.fn();

      deleteMock.mockReturnValue({ where: whereMock });
      whereMock.mockReturnValue({ returning: returningMock });

      const deleted = {
        productId: '84b73d0c-36ac-4b10-b92f-d0ea1f5cbfef',
        name: 'Old Chemical',
      } as const;

      returningMock.mockResolvedValue([deleted]);

      const service = new ChemicalsService({ delete: deleteMock } as any);

      const result = await service.deleteChemical(deleted.productId);

      expect(deleteMock).toHaveBeenCalledWith(schema.products);
      expect(whereMock).toHaveBeenCalledWith(eq(schema.products.productId, deleted.productId));
      expect(returningMock).toHaveBeenCalled();
      expect(result).toEqual(deleted);
    });
  });
});
