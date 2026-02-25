import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chemicalsRoutes } from './chemicals.js';
import { chemicalsService } from '../services/chemicals.js';

describe('chemicals routes integration', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '71c8531a-71e7-4a6e-9c3b-37a9b2f4b6ad';
  let currentRole: string;
  let verifySessionMock: ReturnType<typeof vi.fn>;
  let requireRoleMock: ReturnType<typeof vi.fn>;
  let roleHandlers: Array<ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    app = Fastify();
    currentRole = 'admin';
    roleHandlers = [];

    verifySessionMock = vi.fn(async (req: any) => {
      req.user = { id: currentUserId, role: currentRole };
    });

    requireRoleMock = vi.fn((role: string) => {
      const handler = vi.fn(async (req: any, reply: any) => {
        if (req.user?.role !== role) {
          return reply.code(403).send({ error: 'Forbidden' });
        }
      });
      roleHandlers.push(handler);
      return handler;
    });

    app.decorate('auth', {
      verifySession: verifySessionMock,
      requireRole: requireRoleMock,
    } as any);

    await app.register(chemicalsRoutes, { prefix: '/chemicals' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('POST /chemicals', () => {
    it('allows admins to create chemicals', async () => {
      const payload = {
        categoryId: 'a6d9e562-3d8a-4b1c-9f5b-6d97a933fb3f',
        name: 'Liquid Chlorine 12.5%',
        brand: 'GenericCo',
        productType: 'liquid_chlorine',
        activeIngredients: { sodium_hypochlorite: 12.5 },
        concentrationPercent: 12.5,
        phEffect: 0.1,
        strengthFactor: 1.0,
        dosePer10kGallons: 10,
        doseUnit: 'oz_fl',
        affectsFc: true,
        affectsPh: true,
        affectsTa: false,
        affectsCya: false,
        fcChangePerDose: 0.5,
        phChangePerDose: 0.05,
        taChangePerDose: 0,
        cyaChangePerDose: 0,
        form: 'liquid',
        packageSizes: ['1 gal', '2.5 gal'],
        isActive: true,
        averageCostPerUnit: 4.5,
      } as const;

      const created = {
        productId: 'c6ffb1fd-5ee3-4a6f-a581-d848e87f6761',
        ...payload,
        concentrationPercent: '12.5',
        phEffect: '0.1',
        strengthFactor: '1',
        dosePer10kGallons: '10',
        fcChangePerDose: '0.5',
        phChangePerDose: '0.05',
        averageCostPerUnit: '4.5',
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      } as const;

      const spy = vi
        .spyOn(chemicalsService, 'createChemical')
        .mockResolvedValue(created as any);

      const response = await app.inject({
        method: 'POST',
        url: '/chemicals',
        payload,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        ...created,
        createdAt: created.createdAt.toISOString(),
      });
      expect(spy).toHaveBeenCalledWith({
        ...payload,
        strengthFactor: 1,
        dosePer10kGallons: 10,
        fcChangePerDose: 0.5,
        phChangePerDose: 0.05,
        averageCostPerUnit: 4.5,
      });
      expect(verifySessionMock).toHaveBeenCalled();
      expect(requireRoleMock).toHaveBeenCalledWith('admin');
    });

    it('rejects invalid payloads with validation errors', async () => {
      const spy = vi.spyOn(chemicalsService, 'createChemical');

      const response = await app.inject({
        method: 'POST',
        url: '/chemicals',
        payload: {
          categoryId: 'not-a-uuid',
          name: '',
          dosePer10kGallons: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('ValidationError');
      expect(Array.isArray(body.details)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects callers without the admin role', async () => {
      const spy = vi.spyOn(chemicalsService, 'createChemical');
      currentRole = 'member';

      const response = await app.inject({
        method: 'POST',
        url: '/chemicals',
        payload: {
          categoryId: 'a6d9e562-3d8a-4b1c-9f5b-6d97a933fb3f',
          name: 'Scale Inhibitor',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'Forbidden' });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /chemicals/:id', () => {
    const productId = 'b5f0f3fb-9d93-4f53-b624-7a9690cfb181';

    it('allows admins to update chemicals', async () => {
      const payload = {
        name: 'Updated Chlorine',
        isActive: false,
      } as const;

      const updated = {
        productId,
        categoryId: 'a6d9e562-3d8a-4b1c-9f5b-6d97a933fb3f',
        name: payload.name,
        isActive: false,
      } as const;

      const spy = vi
        .spyOn(chemicalsService, 'updateChemical')
        .mockResolvedValue(updated as any);

      const response = await app.inject({
        method: 'PATCH',
        url: `/chemicals/${productId}`,
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(updated);
      expect(spy).toHaveBeenCalledWith(productId, payload);
      expect(verifySessionMock).toHaveBeenCalled();
      expect(requireRoleMock).toHaveBeenCalledWith('admin');
    });

    it('returns 404 when the chemical is not found', async () => {
      const spy = vi
        .spyOn(chemicalsService, 'updateChemical')
        .mockResolvedValue(null as any);

      const response = await app.inject({
        method: 'PATCH',
        url: `/chemicals/${productId}`,
        payload: { name: 'Missing Chemical' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'NotFound' });
      expect(spy).toHaveBeenCalledWith(productId, { name: 'Missing Chemical' });
    });

    it('rejects invalid payloads', async () => {
      const spy = vi.spyOn(chemicalsService, 'updateChemical');

      const response = await app.inject({
        method: 'PATCH',
        url: `/chemicals/${productId}`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('ValidationError');
      expect(Array.isArray(body.details)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it('validates the identifier', async () => {
      const spy = vi.spyOn(chemicalsService, 'updateChemical');

      const response = await app.inject({
        method: 'PATCH',
        url: '/chemicals/not-a-uuid',
        payload: { name: 'Invalid' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('ValidationError');
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects callers without the admin role', async () => {
      const spy = vi.spyOn(chemicalsService, 'updateChemical');
      currentRole = 'member';

      const response = await app.inject({
        method: 'PATCH',
        url: `/chemicals/${productId}`,
        payload: { name: 'Not Allowed' },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'Forbidden' });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /chemicals/:id', () => {
    const productId = 'c6ffb1fd-5ee3-4a6f-a581-d848e87f6761';

    it('allows admins to delete chemicals', async () => {
      const deleted = {
        productId,
        name: 'Liquid Chlorine 12.5%',
      } as const;

      const spy = vi
        .spyOn(chemicalsService, 'deleteChemical')
        .mockResolvedValue(deleted as any);

      const response = await app.inject({
        method: 'DELETE',
        url: `/chemicals/${productId}`,
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');
      expect(spy).toHaveBeenCalledWith(productId);
      expect(verifySessionMock).toHaveBeenCalled();
      expect(requireRoleMock).toHaveBeenCalledWith('admin');
    });

    it('returns 404 when the chemical is missing', async () => {
      const spy = vi
        .spyOn(chemicalsService, 'deleteChemical')
        .mockResolvedValue(null as any);

      const response = await app.inject({
        method: 'DELETE',
        url: `/chemicals/${productId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'NotFound' });
      expect(spy).toHaveBeenCalledWith(productId);
    });

    it('validates the identifier', async () => {
      const spy = vi.spyOn(chemicalsService, 'deleteChemical');

      const response = await app.inject({
        method: 'DELETE',
        url: '/chemicals/not-a-uuid',
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('ValidationError');
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects callers without the admin role', async () => {
      const spy = vi.spyOn(chemicalsService, 'deleteChemical');
      currentRole = 'member';

      const response = await app.inject({
        method: 'DELETE',
        url: `/chemicals/${productId}`,
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'Forbidden' });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('GET /chemicals/categories', () => {
    it('allows admins to list chemical categories', async () => {
      const categories = [
        {
          categoryId: '30d5322c-0bcf-40dd-88e2-58cc8296c5af',
          name: 'Sanitizers',
          description: 'Primary sanitizing products',
          isActive: true,
        },
      ];

      const spy = vi.spyOn(chemicalsService, 'listCategories').mockResolvedValue(categories as any);

      const response = await app.inject({
        method: 'GET',
        url: '/chemicals/categories',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(categories);
      expect(spy).toHaveBeenCalled();
      expect(verifySessionMock).toHaveBeenCalled();
      expect(requireRoleMock).toHaveBeenCalledWith('admin');
    });

    it('rejects callers without the admin role', async () => {
      const spy = vi.spyOn(chemicalsService, 'listCategories');
      currentRole = 'member';

      const response = await app.inject({
        method: 'GET',
        url: '/chemicals/categories',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'Forbidden' });
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
