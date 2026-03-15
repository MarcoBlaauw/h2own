import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inventoryRoutes } from './inventory.js';
import { vendorsRoutes } from './vendors.js';
import { inventoryService } from '../services/inventory.js';
import { poolCostsService } from '../services/pools/costs.js';
import { vendorsService } from '../services/vendors.js';

describe('Inventory routes', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: 'business' };
        req.session = { id: 'session-1' };
      }),
      requireRole: () => async () => {},
    } as any);
    app.decorate('audit', {
      log: vi.fn(async () => undefined),
    } as any);

    await app.register(inventoryRoutes, { prefix: '/inventory' });
    await app.register(vendorsRoutes, { prefix: '/vendors' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists account inventory', async () => {
    vi.spyOn(inventoryService, 'listInventory').mockResolvedValue({
      items: [
        {
          stockId: 'stock-1',
          productId: 'product-1',
          productName: 'Liquid Chlorine',
        },
      ],
      pools: [],
      scope: { poolId: null },
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/inventory',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          stockId: 'stock-1',
          productId: 'product-1',
          productName: 'Liquid Chlorine',
        },
      ],
      pools: [],
      scope: { poolId: null },
    });
    expect(inventoryService.listInventory).toHaveBeenCalledWith(currentUserId, {});
  });

  it('creates an inventory transaction and writes an audit log', async () => {
    vi.spyOn(inventoryService, 'createTransaction').mockResolvedValue({
      transaction: {
        transactionId: 'tx-1',
        poolId: 'pool-1',
      },
      stock: {
        stockId: 'stock-1',
      },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/inventory/transactions',
      payload: {
        poolId: '11111111-1111-1111-1111-111111111111',
        productId: '22222222-2222-2222-2222-222222222222',
        transactionType: 'restock',
        quantityDelta: 4,
        unit: 'gal',
        unitPrice: 9.99,
      },
    });

    expect(response.statusCode).toBe(201);
    const [, payload] = (inventoryService.createTransaction as any).mock.calls[0];
    expect(payload.poolId).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.productId).toBe('22222222-2222-2222-2222-222222222222');
    expect(payload.transactionType).toBe('restock');
    expect(payload.unit).toBe('ml');
    expect(payload.quantityDelta).toBeCloseTo(15141.647136, 6);
    expect(payload.unitPrice).toBeCloseTo(9.99 / 3785.411784, 9);
    expect(app.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inventory.transaction.created',
        entity: 'inventory_transaction',
        entityId: 'tx-1',
      }),
    );
  });

  it('allows members to create inventory transactions', async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: 'member' };
        req.session = { id: 'session-1' };
      }),
      requireRole: () => async () => {},
    } as any);
    app.decorate('audit', {
      log: vi.fn(async () => undefined),
    } as any);

    await app.register(inventoryRoutes, { prefix: '/inventory' });
    await app.ready();

    vi.spyOn(inventoryService, 'createTransaction').mockResolvedValue({
      transaction: {
        transactionId: 'tx-2',
        poolId: 'pool-1',
      },
      stock: {
        stockId: 'stock-2',
      },
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/inventory/transactions',
      payload: {
        poolId: '11111111-1111-1111-1111-111111111111',
        productId: '22222222-2222-2222-2222-222222222222',
        transactionType: 'adjustment',
        quantityDelta: 3,
        unit: 'item',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(inventoryService.createTransaction).toHaveBeenCalledWith(currentUserId, {
      poolId: '11111111-1111-1111-1111-111111111111',
      productId: '22222222-2222-2222-2222-222222222222',
      transactionType: 'adjustment',
      quantityDelta: 3,
      unit: 'item',
    });
  });

  it('updates inventory stock settings and writes an audit log', async () => {
    vi.spyOn(inventoryService, 'updateStockSettings').mockResolvedValue({
      stockId: 'stock-1',
      poolId: 'pool-1',
      reorderPoint: '2.000',
    } as any);

    const response = await app.inject({
      method: 'PATCH',
      url: '/inventory/11111111-1111-1111-1111-111111111111',
      payload: {
        reorderPoint: 2,
        preferredCurrency: 'USD',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(inventoryService.updateStockSettings).toHaveBeenCalledWith(
      currentUserId,
      '11111111-1111-1111-1111-111111111111',
      {
        reorderPoint: 2,
        preferredCurrency: 'USD',
      },
    );
    expect(app.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'inventory.stock.updated',
        entity: 'inventory_stock',
        entityId: 'stock-1',
      }),
    );
  });

  it('returns account-level inventory costs', async () => {
    vi.spyOn(poolCostsService, 'getAccountCosts').mockResolvedValue({
      items: [{ costId: 'cost-1', amount: '8.50' }],
      pools: [],
    } as any);
    vi.spyOn(poolCostsService, 'getAccountCostsSummary').mockResolvedValue({
      window: 'month',
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-02-01T00:00:00.000Z',
      total: '8.50',
      currency: 'USD',
      byCategory: [],
      byPool: [],
      pools: [],
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: '/inventory/costs?window=month&limit=5',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [{ costId: 'cost-1', amount: '8.50' }],
      summary: {
        window: 'month',
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-02-01T00:00:00.000Z',
        total: '8.50',
        currency: 'USD',
        byCategory: [],
        byPool: [],
        pools: [],
      },
      pools: [],
    });
  });

  it('lists vendors for selectors', async () => {
    vi.spyOn(vendorsService, 'listVendors').mockResolvedValue([
      {
        vendorId: 'vendor-1',
        name: 'Home Depot',
        slug: 'home-depot',
        websiteUrl: 'https://www.homedepot.com',
        provider: 'manual',
        isActive: true,
      },
    ] as any);

    const response = await app.inject({
      method: 'GET',
      url: '/vendors',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        vendorId: 'vendor-1',
        name: 'Home Depot',
        slug: 'home-depot',
        websiteUrl: 'https://www.homedepot.com',
        provider: 'manual',
        isActive: true,
      },
    ]);
  });
});
