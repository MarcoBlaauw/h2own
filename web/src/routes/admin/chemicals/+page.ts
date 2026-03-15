import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

type ChemicalCategory = {
  categoryId: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
};

export type Chemical = {
  productId: string;
  categoryId: string;
  itemClass?: 'chemical' | 'supply' | null;
  name: string;
  brand?: string | null;
  sku?: string | null;
  productType?: string | null;
  activeIngredients?: Record<string, number> | null;
  concentrationPercent?: string | number | null;
  phEffect?: string | number | null;
  strengthFactor?: string | number | null;
  dosePer10kGallons?: string | number | null;
  doseUnit?: string | null;
  affectsFc?: boolean | null;
  affectsPh?: boolean | null;
  affectsTa?: boolean | null;
  affectsCya?: boolean | null;
  fcChangePerDose?: string | number | null;
  phChangePerDose?: string | number | null;
  taChangePerDose?: number | null;
  cyaChangePerDose?: number | null;
  form?: string | null;
  packageSizes?: string[] | null;
  replacementIntervalDays?: number | null;
  compatibleEquipmentType?: string | null;
  notes?: string | null;
  isActive?: boolean | null;
  averageCostPerUnit?: string | number | null;
  primaryVendor?: {
    vendorId: string;
    name?: string | null;
    slug?: string | null;
    websiteUrl?: string | null;
  } | null;
  primaryPrice?: {
    priceId?: string | null;
    unitPrice?: string | number | null;
    currency?: string | null;
    packageSize?: string | null;
    unitLabel?: string | null;
    source?: string | null;
    fetchedAt?: string | null;
  } | null;
  vendorPrices?: Array<{
    priceId: string;
    vendorId: string;
    vendorName?: string | null;
    vendorSlug?: string | null;
    websiteUrl?: string | null;
    vendorSku?: string | null;
    productUrl?: string | null;
    unitPrice: string | number;
    currency?: string | null;
    packageSize?: string | null;
    unitLabel?: string | null;
    source?: string | null;
    fetchedAt?: string | null;
    isPrimary?: boolean | null;
  }> | null;
};

type LoadOutput = {
  categories: ChemicalCategory[];
  chemicals: Chemical[];
  vendors: Array<{
    vendorId: string;
    name: string;
    slug: string;
    websiteUrl?: string | null;
    provider?: string | null;
    isActive?: boolean | null;
  }>;
  importHistory: Array<{
    runId: string;
    vendorId: string;
    vendorName: string;
    vendorSlug: string;
    actorUserId?: string | null;
    format: string;
    dryRun: boolean;
    status: string;
    importedRows: number;
    createdPrices: number;
    updatedPrices: number;
    skippedRows: number;
    message?: string | null;
    createdAt: string;
  }>;
  syncRuns: Array<{
    runId: string;
    vendorId: string;
    vendorName: string;
    vendorSlug: string;
    actorUserId?: string | null;
    triggerSource: string;
    status: string;
    updatedPrices: number;
    linkedProducts: number;
    message?: string | null;
    createdAt: string;
  }>;
  loadError: string | null;
};

export const load: PageLoad<LoadOutput> = async ({ fetch, parent }) => {
  const { session } = await parent();
  if (!session || session.user?.role !== 'admin') {
    throw redirect(302, '/');
  }

  try {
    const [categoriesResponse, chemicalsResponse, vendorsResponse, importHistoryResponse, syncRunsResponse] = await Promise.all([
      api.chemicals.listCategories(fetch),
      api.chemicals.list(fetch),
      api.adminVendors.list(fetch),
      api.adminVendors.listImportHistory(fetch, { limit: 10 }),
      api.adminVendors.listSyncRuns(fetch, { limit: 10 }),
    ]);

    let loadError: string | null = null;

    if (!categoriesResponse.ok || !chemicalsResponse.ok) {
      loadError = `Failed to load chemicals (${categoriesResponse.status}/${chemicalsResponse.status})`;
    }

    const categories = categoriesResponse.ok
      ? ((await categoriesResponse.json()) as ChemicalCategory[])
      : [];
    const chemicals = chemicalsResponse.ok
      ? ((await chemicalsResponse.json()) as Chemical[])
      : [];
    const vendors = vendorsResponse.ok ? await vendorsResponse.json() : [];
    const importHistory = importHistoryResponse.ok ? await importHistoryResponse.json() : [];
    const syncRuns = syncRunsResponse.ok ? await syncRunsResponse.json() : [];

    if (loadError) {
      return {
        categories,
        chemicals,
        vendors,
        importHistory,
        syncRuns,
        loadError,
      } satisfies LoadOutput;
    }

    return {
      categories,
      chemicals,
      vendors,
      importHistory,
      syncRuns,
      loadError: null,
    } satisfies LoadOutput;
  } catch (error) {
    console.error('Failed to load chemical catalog', error);
    return {
      categories: [],
      chemicals: [],
      vendors: [],
      importHistory: [],
      syncRuns: [],
      loadError: 'Unable to load chemical catalog. Please try again later.',
    } satisfies LoadOutput;
  }
};
