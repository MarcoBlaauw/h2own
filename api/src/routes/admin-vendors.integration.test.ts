import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminVendorsRoutes } from './admin-vendors.js';
import { vendorsService } from '../services/vendors.js';
import { vendorPriceSyncService } from '../services/vendor-price-sync.js';

describe('Admin vendors routes', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: 'admin' };
        req.session = { id: 'session-1' };
      }),
      requireRole: () => async () => {},
    } as any);
    app.decorate('audit', {
      log: vi.fn(async () => undefined),
    } as any);

    await app.register(adminVendorsRoutes, { prefix: '/admin/vendors' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('lists vendors including inactive entries', async () => {
    vi.spyOn(vendorsService, 'listVendors').mockResolvedValue([
      { vendorId: 'vendor-1', name: 'Home Depot', slug: 'home-depot', isActive: true },
      { vendorId: 'vendor-2', name: 'Legacy Vendor', slug: 'legacy-vendor', isActive: false },
    ] as any);

    const response = await app.inject({ method: 'GET', url: '/admin/vendors' });

    expect(response.statusCode).toBe(200);
    expect(vendorsService.listVendors).toHaveBeenCalledWith({ includeInactive: true });
    expect(response.json()).toHaveLength(2);
  });

  it('creates a vendor', async () => {
    vi.spyOn(vendorsService, 'createVendor').mockResolvedValue({
      vendorId: 'vendor-1',
      name: 'Amazon',
      slug: 'amazon',
      websiteUrl: 'https://www.amazon.com',
      provider: 'manual',
      isActive: true,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/vendors',
      payload: {
        name: 'Amazon',
        websiteUrl: 'https://www.amazon.com',
        provider: 'manual',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(vendorsService.createVendor).toHaveBeenCalledWith({
      name: 'Amazon',
      websiteUrl: 'https://www.amazon.com',
      provider: 'manual',
    });
    expect(app.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.vendor.created',
        entity: 'vendor',
      }),
    );
  });

  it('lists vendor import history', async () => {
    vi.spyOn(vendorPriceSyncService, 'listImportHistory').mockResolvedValue([
      {
        runId: 'run-1',
        vendorId: 'vendor-1',
        vendorName: 'Home Depot',
        vendorSlug: 'home-depot',
        actorUserId: currentUserId,
        format: 'csv',
        dryRun: true,
        status: 'dry_run',
        importedRows: 1,
        createdPrices: 1,
        updatedPrices: 0,
        skippedRows: 0,
        rowResults: [],
        message: 'Dry run complete.',
        createdAt: new Date(),
      },
    ] as any);

    const response = await app.inject({
      method: 'GET',
      url: '/admin/vendors/import-history?limit=10',
    });

    expect(response.statusCode).toBe(200);
    expect(vendorPriceSyncService.listImportHistory).toHaveBeenCalledWith({ limit: 10 });
  });

  it('lists vendor sync runs', async () => {
    vi.spyOn(vendorPriceSyncService, 'listSyncRuns').mockResolvedValue([
      {
        runId: 'run-1',
        vendorId: 'vendor-1',
        vendorName: 'Home Depot',
        vendorSlug: 'home-depot',
        actorUserId: null,
        triggerSource: 'manual',
        status: 'unsupported',
        updatedPrices: 0,
        linkedProducts: 1,
        message: 'home-depot price sync is not configured yet.',
        createdAt: new Date(),
      },
    ] as any);

    const response = await app.inject({
      method: 'GET',
      url: '/admin/vendors/sync-runs?limit=10',
    });

    expect(response.statusCode).toBe(200);
    expect(vendorPriceSyncService.listSyncRuns).toHaveBeenCalledWith({ limit: 10 });
  });

  it('updates a vendor', async () => {
    vi.spyOn(vendorsService, 'updateVendor').mockResolvedValue({
      vendorId: 'vendor-1',
      name: 'Home Depot',
      slug: 'home-depot',
      provider: 'manual',
      isActive: false,
    } as any);

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/vendors/11111111-1111-1111-1111-111111111111',
      payload: {
        isActive: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(vendorsService.updateVendor).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      { isActive: false },
    );
    expect(app.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.vendor.updated',
        entity: 'vendor',
      }),
    );
  });

  it('triggers vendor price sync', async () => {
    vi.spyOn(vendorPriceSyncService, 'syncVendor').mockResolvedValue({
      vendorId: 'vendor-1',
      vendorName: 'Home Depot',
      vendorSlug: 'home-depot',
      status: 'unsupported',
      updatedPrices: 0,
      linkedProducts: 1,
      message: 'home-depot price sync is not configured yet. Vendor registry and price records are ready for a future adapter.',
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/vendors/11111111-1111-1111-1111-111111111111/sync-prices',
    });

    expect(response.statusCode).toBe(200);
    expect(vendorPriceSyncService.syncVendor).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      {
        triggerSource: 'manual',
        actorUserId: currentUserId,
      },
    );
    expect(app.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.vendor.price_sync.triggered',
        entity: 'vendor',
      }),
    );
  });

  it('imports vendor prices', async () => {
    vi.spyOn(vendorPriceSyncService, 'importVendorPrices').mockResolvedValue({
      vendorId: 'vendor-1',
      vendorName: 'Home Depot',
      vendorSlug: 'home-depot',
      status: 'dry_run',
      importedRows: 1,
      createdPrices: 1,
      updatedPrices: 0,
      skippedRows: 0,
      rows: [],
      message: 'Dry run complete. 1 prices would be created, 0 updated, 0 skipped.',
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/vendors/11111111-1111-1111-1111-111111111111/import-prices',
      payload: {
        format: 'csv',
        payload: 'productName,unitPrice\nChampion Muriatic Acid,10.49',
        dryRun: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(vendorPriceSyncService.importVendorPrices).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      {
        actorUserId: currentUserId,
        format: 'csv',
        payload: 'productName,unitPrice\nChampion Muriatic Acid,10.49',
        dryRun: true,
      },
    );
    expect(app.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.vendor.price_import.triggered',
        entity: 'vendor',
      }),
    );
  });
});
