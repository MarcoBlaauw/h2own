import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { poolsRoutes } from './pools.js';
import { poolCostsService } from '../services/pools/index.js';

describe('Costs endpoints', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(poolsRoutes, { prefix: '/pools' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('creates a cost entry', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const incurredAt = new Date('2024-03-10T12:00:00.000Z');
    const createdAt = new Date('2024-03-10T12:01:00.000Z');
    const cost = {
      costId: '9b93d8f1-0e7a-4f3d-b76a-5f7a9e1a0ed1',
      poolId,
      categoryId: null,
      amount: '42.50',
      currency: 'USD',
      description: 'Filter replacement',
      chemicalActionId: null,
      maintenanceEventId: null,
      equipmentId: null,
      vendor: 'Pool Supply',
      receiptUrl: null,
      incurredAt,
      createdAt,
    };

    vi.spyOn(poolCostsService, 'createCost').mockResolvedValue(cost as any);

    const response = await app.inject({
      method: 'POST',
      url: `/pools/${poolId}/costs`,
      payload: {
        amount: 42.5,
        currency: 'USD',
        description: 'Filter replacement',
        vendor: 'Pool Supply',
        incurredAt: incurredAt.toISOString(),
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ...cost,
      incurredAt: incurredAt.toISOString(),
      createdAt: createdAt.toISOString(),
    });
    expect(poolCostsService.createCost).toHaveBeenCalledWith(poolId, currentUserId, {
      amount: 42.5,
      currency: 'USD',
      description: 'Filter replacement',
      vendor: 'Pool Supply',
      incurredAt: incurredAt.toISOString(),
    });
  });

  it('lists costs for a pool', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const incurredAt = new Date('2024-02-28T08:00:00.000Z');

    vi.spyOn(poolCostsService, 'getCostsByPoolId').mockResolvedValue({
      items: [
        {
          costId: '0c7e5f25-6d2d-4211-b1b3-13c1d6a1b589',
          amount: '18.25',
          currency: 'USD',
          categoryId: 'b6e2a1f0-2fe5-4bf5-927a-1a7d9d1c6ce2',
          categoryName: 'utilities',
          incurredAt,
          description: 'Water top-off',
          vendor: null,
          chemicalActionId: null,
          receiptUrl: null,
        },
      ],
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: `/pools/${poolId}/costs?from=2024-02-01T00:00:00.000Z&to=2024-03-01T00:00:00.000Z`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          costId: '0c7e5f25-6d2d-4211-b1b3-13c1d6a1b589',
          amount: '18.25',
          currency: 'USD',
          categoryId: 'b6e2a1f0-2fe5-4bf5-927a-1a7d9d1c6ce2',
          categoryName: 'utilities',
          incurredAt: incurredAt.toISOString(),
          description: 'Water top-off',
          vendor: null,
          chemicalActionId: null,
          receiptUrl: null,
        },
      ],
    });
    expect(poolCostsService.getCostsByPoolId).toHaveBeenCalledWith(poolId, currentUserId, {
      from: new Date('2024-02-01T00:00:00.000Z'),
      to: new Date('2024-03-01T00:00:00.000Z'),
      limit: 50,
    });
  });

  it('returns a costs summary', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';

    vi.spyOn(poolCostsService, 'getCostsSummary').mockResolvedValue({
      window: 'month',
      from: '2024-02-10T00:00:00.000Z',
      to: '2024-03-10T00:00:00.000Z',
      total: '120.00',
      currency: 'USD',
      byCategory: [
        {
          categoryId: 'b6e2a1f0-2fe5-4bf5-927a-1a7d9d1c6ce2',
          categoryName: 'utilities',
          total: '80.00',
        },
      ],
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: `/pools/${poolId}/costs/summary?window=month`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      window: 'month',
      from: '2024-02-10T00:00:00.000Z',
      to: '2024-03-10T00:00:00.000Z',
      total: '120.00',
      currency: 'USD',
      byCategory: [
        {
          categoryId: 'b6e2a1f0-2fe5-4bf5-927a-1a7d9d1c6ce2',
          categoryName: 'utilities',
          total: '80.00',
        },
      ],
    });
    expect(poolCostsService.getCostsSummary).toHaveBeenCalledWith(poolId, currentUserId, 'month');
  });
});
