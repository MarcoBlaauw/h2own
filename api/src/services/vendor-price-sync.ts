import { and, eq, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { vendorsService } from './vendors.js';
import { env } from '../env.js';

type VendorRecord = { vendorId: string; name: string; slug: string; provider?: string | null };
const POSTGRES_UNDEFINED_TABLE = '42P01';

function isUndefinedTableError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === POSTGRES_UNDEFINED_TABLE
  );
}

export type VendorPriceSyncResult = {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  status: 'unsupported' | 'completed';
  updatedPrices: number;
  linkedProducts: number;
  message: string;
};

export type VendorPriceSyncRunEntry = {
  runId: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  actorUserId: string | null;
  triggerSource: string;
  status: string;
  updatedPrices: number;
  linkedProducts: number;
  message: string | null;
  createdAt: Date;
};

export type VendorPriceImportResult = {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  status: 'dry_run' | 'completed';
  importedRows: number;
  createdPrices: number;
  updatedPrices: number;
  skippedRows: number;
  rows: Array<{
    rowNumber: number;
    action: 'create' | 'update' | 'skip';
    productId?: string;
    productName?: string;
    reason?: string;
  }>;
  message: string;
};

export type VendorPriceImportHistoryEntry = {
  runId: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  actorUserId: string | null;
  format: string;
  dryRun: boolean;
  status: string;
  importedRows: number;
  createdPrices: number;
  updatedPrices: number;
  skippedRows: number;
  rowResults: VendorPriceImportResult['rows'] | null;
  message: string | null;
  createdAt: Date;
};

type VendorPriceAdapter = {
  sync: (input: { vendor: VendorRecord; linkedProducts: number }) => Promise<VendorPriceSyncResult>;
};

type LinkedVendorPriceRecord = {
  productId: string;
  productName: string;
  productBrand: string | null;
  priceId: string;
  vendorSku: string | null;
  productUrl: string | null;
  packageSize: string | null;
  unitLabel: string | null;
  isPrimary: boolean;
};

type VendorPriceUpsertResult = {
  createdPrices: number;
  updatedPrices: number;
  skippedRows: number;
  rows: VendorPriceImportResult['rows'];
};

type VendorPriceImportRow = {
  productId?: string;
  productName?: string;
  brand?: string;
  vendorSku?: string;
  productUrl?: string;
  unitPrice: number;
  currency?: string;
  packageSize?: string;
  unitLabel?: string;
  isPrimary?: boolean;
};

class UnsupportedVendorPriceAdapter implements VendorPriceAdapter {
  constructor(private readonly providerName: string) {}

  async sync(input: { vendor: VendorRecord; linkedProducts: number }) {
    return {
      vendorId: input.vendor.vendorId,
      vendorName: input.vendor.name,
      vendorSlug: input.vendor.slug,
      status: 'unsupported',
      updatedPrices: 0,
      linkedProducts: input.linkedProducts,
      message: `${this.providerName} price sync is not configured yet. Vendor registry and price records are ready for a future adapter.`,
    } satisfies VendorPriceSyncResult;
  }
}

type HomeDepotParsedProduct = {
  name?: string;
  brand?: string;
  sku?: string;
  url?: string;
  price?: number;
  currency?: string;
};

type HomeDepotSearchCandidate = {
  productId?: string;
  name?: string;
  brand?: string;
  sku?: string;
  url?: string;
  price?: number;
  currency?: string;
};

const HOME_DEPOT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
};

const LD_JSON_SCRIPT_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function normalizeJsonLike(input: string) {
  return input.replace(/^\uFEFF/, '').trim();
}

function asArray<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function normalizeComparableText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizeComparableText(value: string | null | undefined) {
  const normalized = normalizeComparableText(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

export function extractHomeDepotProductId(value: string | null | undefined) {
  if (!value) return undefined;
  const fromQuery = value.match(/[?&]productId=(\d{6,})/i)?.[1];
  if (fromQuery) return fromQuery;
  const fromPath = value.match(/\/(\d{6,})(?:[/?#]|$)/)?.[1];
  return fromPath;
}

function findProductNode(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findProductNode(entry);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const typeValues = asArray(record['@type']).map((entry) => String(entry));
  if (typeValues.includes('Product')) {
    return record;
  }

  for (const nested of Object.values(record)) {
    const found = findProductNode(nested);
    if (found) return found;
  }

  return null;
}

export function parseHomeDepotProductDocument(html: string): HomeDepotParsedProduct | null {
  const scripts = Array.from(html.matchAll(LD_JSON_SCRIPT_RE));
  for (const match of scripts) {
    const raw = normalizeJsonLike(match[1] ?? '');
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const product = findProductNode(parsed);
      if (!product) continue;
      const offers = asArray(product.offers)[0] as Record<string, unknown> | undefined;
      const rawPrice = offers?.price ?? product.price;
      const price = rawPrice === undefined ? undefined : Number(rawPrice);
      return {
        name: typeof product.name === 'string' ? product.name : undefined,
        brand:
          typeof product.brand === 'string'
            ? product.brand
            : typeof (product.brand as Record<string, unknown> | undefined)?.name === 'string'
              ? String((product.brand as Record<string, unknown>).name)
              : undefined,
        sku: typeof product.sku === 'string' ? product.sku : typeof product.mpn === 'string' ? product.mpn : undefined,
        url: typeof product.url === 'string' ? product.url : undefined,
        price: Number.isFinite(price) ? price : undefined,
        currency:
          typeof offers?.priceCurrency === 'string'
            ? String(offers.priceCurrency).toUpperCase()
            : undefined,
      };
    } catch {
      continue;
    }
  }

  const priceMatch =
    html.match(/"price"\s*:\s*"?(?<price>\d+(?:\.\d+)?)"?/i) ??
    html.match(/"currentPrice"\s*:\s*"?(?<price>\d+(?:\.\d+)?)"?/i);
  if (!priceMatch?.groups?.price) {
    return null;
  }

  const fallbackPrice = Number(priceMatch.groups.price);
  if (!Number.isFinite(fallbackPrice)) {
    return null;
  }

  return {
    price: fallbackPrice,
    currency: 'USD',
  };
}

export function parseHomeDepotSerpApiSearchResponse(payload: unknown): HomeDepotSearchCandidate[] {
  if (!payload || typeof payload !== 'object') return [];
  const products = Array.isArray((payload as { products?: unknown[] }).products)
    ? (payload as { products: unknown[] }).products
    : [];
  const candidates: Array<HomeDepotSearchCandidate | null> = [];

  for (const entry of products) {
    if (!entry || typeof entry !== 'object') {
      candidates.push(null);
      continue;
    }
    const record = entry as Record<string, unknown>;
    const rawPrice = record.price ?? record.current_price ?? record.extracted_price;
    const price = rawPrice === undefined ? undefined : Number(rawPrice);
    const url =
      typeof record.link === 'string'
        ? record.link
        : typeof record.product_page_url === 'string'
          ? record.product_page_url
          : undefined;
    candidates.push({
      productId:
        typeof record.product_id === 'string'
          ? record.product_id
          : extractHomeDepotProductId(url),
      name:
        typeof record.title === 'string'
          ? record.title
          : typeof record.name === 'string'
            ? record.name
            : undefined,
      brand:
        typeof record.brand === 'string'
          ? record.brand
          : typeof record.brand_name === 'string'
            ? record.brand_name
            : undefined,
      sku:
        typeof record.model_number === 'string'
          ? record.model_number
          : typeof record.model === 'string'
            ? record.model
            : undefined,
      url,
      price: Number.isFinite(price) ? price : undefined,
      currency:
        typeof record.currency === 'string'
          ? record.currency.toUpperCase()
          : typeof record.price_currency === 'string'
            ? record.price_currency.toUpperCase()
            : 'USD',
    });
  }

  return candidates.filter((entry): entry is HomeDepotSearchCandidate => entry !== null);
}

export function parseHomeDepotSerpApiProductResponse(payload: unknown): HomeDepotParsedProduct | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const productResult =
    record.product_result && typeof record.product_result === 'object'
      ? (record.product_result as Record<string, unknown>)
      : record.product_results && typeof record.product_results === 'object'
        ? (record.product_results as Record<string, unknown>)
        : null;

  if (!productResult) return null;

  const rawPrice =
    productResult.price ??
    productResult.current_price ??
    productResult.final_price ??
    productResult.extracted_price;
  const price = rawPrice === undefined ? undefined : Number(rawPrice);
  const url =
    typeof productResult.product_url === 'string'
      ? productResult.product_url
      : typeof productResult.url === 'string'
        ? productResult.url
        : undefined;

  return {
    name:
      typeof productResult.title === 'string'
        ? productResult.title
        : typeof productResult.name === 'string'
          ? productResult.name
          : undefined,
    brand:
      typeof productResult.brand === 'string'
        ? productResult.brand
        : typeof productResult.brand_name === 'string'
          ? productResult.brand_name
          : undefined,
    sku:
      typeof productResult.model_number === 'string'
        ? productResult.model_number
        : typeof productResult.model === 'string'
          ? productResult.model
          : undefined,
    url,
    price: Number.isFinite(price) ? price : undefined,
    currency:
      typeof productResult.currency === 'string'
        ? productResult.currency.toUpperCase()
        : typeof productResult.price_currency === 'string'
          ? productResult.price_currency.toUpperCase()
          : 'USD',
  };
}

export function selectBestHomeDepotSearchCandidate(
  candidates: HomeDepotSearchCandidate[],
  row: Pick<LinkedVendorPriceRecord, 'productName' | 'productBrand' | 'vendorSku'>,
) {
  const targetName = normalizeComparableText(row.productName);
  const targetBrand = normalizeComparableText(row.productBrand);
  const targetSku = normalizeComparableText(row.vendorSku);
  const targetTokens = tokenizeComparableText(row.productName);

  let bestCandidate: HomeDepotSearchCandidate | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    let score = 0;
    const candidateName = normalizeComparableText(candidate.name);
    const candidateBrand = normalizeComparableText(candidate.brand);
    const candidateSku = normalizeComparableText(candidate.sku);

    if (targetSku && candidateSku === targetSku) score += 8;
    if (targetSku && candidateName.includes(targetSku)) score += 5;
    if (targetBrand && candidateBrand === targetBrand) score += 4;
    if (targetName && candidateName === targetName) score += 6;
    if (targetName && candidateName.includes(targetName)) score += 4;

    const matchedTokens = targetTokens.filter((token) => candidateName.includes(token)).length;
    score += matchedTokens;
    if (candidate.productId) score += 1;
    if (candidate.price && candidate.price > 0) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestScore >= 4 ? bestCandidate : null;
}

class HomeDepotVendorPriceAdapter implements VendorPriceAdapter {
  constructor(
    private readonly loadLinkedVendorPrices: (vendorId: string) => Promise<LinkedVendorPriceRecord[]>,
    private readonly upsertVendorPriceRows: (
      vendorId: string,
      rows: VendorPriceImportRow[],
      options?: { dryRun?: boolean },
    ) => Promise<VendorPriceUpsertResult>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async syncDirectPages(
    linkedRows: LinkedVendorPriceRecord[],
    vendor: VendorRecord,
    linkedProducts: number,
  ) {
    const syncedRows: VendorPriceImportRow[] = [];
    let skippedRows = 0;

    for (const row of linkedRows) {
      if (!row.productUrl || !/homedepot\.com/i.test(row.productUrl)) {
        skippedRows += 1;
        continue;
      }

      try {
        const response = await this.fetchImpl(row.productUrl, { headers: HOME_DEPOT_HEADERS });
        if (!response.ok) {
          skippedRows += 1;
          continue;
        }

        const html = await response.text();
        const parsed = parseHomeDepotProductDocument(html);
        if (!parsed?.price || parsed.price <= 0) {
          skippedRows += 1;
          continue;
        }

        syncedRows.push({
          productId: row.productId,
          productName: parsed.name ?? row.productName,
          brand: parsed.brand ?? row.productBrand ?? undefined,
          vendorSku: parsed.sku ?? row.vendorSku ?? undefined,
          productUrl: parsed.url ?? row.productUrl,
          unitPrice: parsed.price,
          currency: parsed.currency ?? 'USD',
          packageSize: row.packageSize ?? undefined,
          unitLabel: row.unitLabel ?? undefined,
          isPrimary: row.isPrimary,
        });
      } catch {
        skippedRows += 1;
      }
    }

    if (!syncedRows.length) {
      return {
        vendorId: vendor.vendorId,
        vendorName: vendor.name,
        vendorSlug: vendor.slug,
        status: 'completed',
        updatedPrices: 0,
        linkedProducts,
        message:
          linkedRows.length === 0
            ? 'No Home Depot-linked catalog prices are configured yet. Add Home Depot product URLs to vendor pricing first.'
            : `Home Depot sync completed with no price updates. ${skippedRows} linked products were skipped.`,
      } satisfies VendorPriceSyncResult;
    }

    const result = await this.upsertVendorPriceRows(vendor.vendorId, syncedRows, {
      dryRun: false,
    });

    return {
      vendorId: vendor.vendorId,
      vendorName: vendor.name,
      vendorSlug: vendor.slug,
      status: 'completed',
      updatedPrices: result.updatedPrices + result.createdPrices,
      linkedProducts,
      message: `Home Depot sync updated ${result.updatedPrices + result.createdPrices} prices and skipped ${result.skippedRows + skippedRows}.`,
    } satisfies VendorPriceSyncResult;
  }

  async sync(input: { vendor: VendorRecord; linkedProducts: number }) {
    const linkedRows = await this.loadLinkedVendorPrices(input.vendor.vendorId);
    const shouldUseSerpApi =
      env.VENDOR_PRICE_HOME_DEPOT_PROVIDER !== 'direct' &&
      Boolean(env.VENDOR_PRICE_SERPAPI_API_KEY);

    if (shouldUseSerpApi) {
      const client = new HomeDepotSerpApiClient(this.fetchImpl, env.VENDOR_PRICE_SERPAPI_API_KEY as string);
      const syncedRows: VendorPriceImportRow[] = [];
      let skippedRows = 0;

      for (const row of linkedRows) {
        try {
          const knownProductId = extractHomeDepotProductId(row.productUrl);
          let parsedProduct =
            knownProductId
              ? await client.getProduct(knownProductId)
              : null;

          if (!parsedProduct) {
            const candidates = await client.searchProducts(row);
            const match = selectBestHomeDepotSearchCandidate(candidates, row);
            if (match?.productId) {
              parsedProduct = await client.getProduct(match.productId);
              parsedProduct = parsedProduct ?? {
                name: match.name,
                brand: match.brand,
                sku: match.sku,
                url: match.url,
                price: match.price,
                currency: match.currency,
              };
            } else if (match?.price) {
              parsedProduct = {
                name: match.name,
                brand: match.brand,
                sku: match.sku,
                url: match.url,
                price: match.price,
                currency: match.currency,
              };
            }
          }

          if (!parsedProduct?.price || parsedProduct.price <= 0) {
            skippedRows += 1;
            continue;
          }

          syncedRows.push({
            productId: row.productId,
            productName: parsedProduct.name ?? row.productName,
            brand: parsedProduct.brand ?? row.productBrand ?? undefined,
            vendorSku: parsedProduct.sku ?? row.vendorSku ?? undefined,
            productUrl: parsedProduct.url ?? row.productUrl ?? undefined,
            unitPrice: parsedProduct.price,
            currency: parsedProduct.currency ?? 'USD',
            packageSize: row.packageSize ?? undefined,
            unitLabel: row.unitLabel ?? undefined,
            isPrimary: row.isPrimary,
          });
        } catch {
          skippedRows += 1;
        }
      }

      if (syncedRows.length) {
        const result = await this.upsertVendorPriceRows(input.vendor.vendorId, syncedRows, {
          dryRun: false,
        });
        return {
          vendorId: input.vendor.vendorId,
          vendorName: input.vendor.name,
          vendorSlug: input.vendor.slug,
          status: 'completed',
          updatedPrices: result.updatedPrices + result.createdPrices,
          linkedProducts: input.linkedProducts,
          message: `Home Depot sync updated ${result.updatedPrices + result.createdPrices} prices via SerpApi and skipped ${result.skippedRows + skippedRows}.`,
        } satisfies VendorPriceSyncResult;
      }

      if (env.VENDOR_PRICE_HOME_DEPOT_PROVIDER === 'serpapi') {
        return {
          vendorId: input.vendor.vendorId,
          vendorName: input.vendor.name,
          vendorSlug: input.vendor.slug,
          status: 'completed',
          updatedPrices: 0,
          linkedProducts: input.linkedProducts,
          message:
            linkedRows.length === 0
              ? 'No Home Depot-linked catalog prices are configured yet.'
              : `Home Depot SerpApi sync completed with no price updates. ${skippedRows} linked products were skipped.`,
        } satisfies VendorPriceSyncResult;
      }
    }

    return this.syncDirectPages(linkedRows, input.vendor, input.linkedProducts);
  }
}

class HomeDepotSerpApiClient {
  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly apiKey: string,
  ) {}

  private async fetchJson(params: Record<string, string>) {
    const url = new URL('https://serpapi.com/search.json');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('api_key', this.apiKey);
    if (env.VENDOR_PRICE_HOME_DEPOT_DELIVERY_ZIP) {
      url.searchParams.set('delivery_zip', env.VENDOR_PRICE_HOME_DEPOT_DELIVERY_ZIP);
    }
    if (env.VENDOR_PRICE_HOME_DEPOT_STORE_ID) {
      url.searchParams.set('store_id', env.VENDOR_PRICE_HOME_DEPOT_STORE_ID);
    }

    const response = await this.fetchImpl(url, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`SerpApi request failed with ${response.status}`);
    }
    return response.json();
  }

  private buildQueries(row: Pick<LinkedVendorPriceRecord, 'productName' | 'productBrand' | 'vendorSku'>) {
    return [
      [row.productBrand, row.productName, row.vendorSku].filter(Boolean).join(' '),
      [row.productBrand, row.productName].filter(Boolean).join(' '),
      row.productName,
      row.vendorSku,
    ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
  }

  async searchProducts(row: Pick<LinkedVendorPriceRecord, 'productName' | 'productBrand' | 'vendorSku'>) {
    const results: HomeDepotSearchCandidate[] = [];

    for (const query of this.buildQueries(row)) {
      const payload = await this.fetchJson({
        engine: 'home_depot',
        q: query,
      });
      results.push(...parseHomeDepotSerpApiSearchResponse(payload));
      if (results.length >= 5) break;
    }

    return results;
  }

  async getProduct(productId: string) {
    const payload = await this.fetchJson({
      engine: 'home_depot_product',
      product_id: productId,
    });
    return parseHomeDepotSerpApiProductResponse(payload);
  }
}

export class VendorNotFoundError extends Error {
  constructor(vendorId: string) {
    super(`Vendor ${vendorId} not found`);
    this.name = 'VendorNotFoundError';
  }
}

export class VendorPriceImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorPriceImportValidationError';
  }
}

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
  }
  return false;
};

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
};

const parseCsv = (input: string) => {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim() !== '')) {
    rows.push(row);
  }

  return rows;
};

const mapImportRow = (raw: Record<string, unknown>) => {
  const unitPrice = Number(raw.unitPrice ?? raw.unit_price ?? raw.price);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new VendorPriceImportValidationError('Each row requires a positive unitPrice.');
  }

  return {
    productId: normalizeText(raw.productId ?? raw.product_id),
    productName: normalizeText(raw.productName ?? raw.product_name ?? raw.name),
    brand: normalizeText(raw.brand),
    vendorSku: normalizeText(raw.vendorSku ?? raw.vendor_sku ?? raw.sku),
    productUrl: normalizeText(raw.productUrl ?? raw.product_url ?? raw.url),
    unitPrice,
    currency: normalizeText(raw.currency) ?? 'USD',
    packageSize: normalizeText(raw.packageSize ?? raw.package_size),
    unitLabel: normalizeText(raw.unitLabel ?? raw.unit_label),
    isPrimary: normalizeBoolean(raw.isPrimary ?? raw.is_primary),
  } satisfies VendorPriceImportRow;
};

export class VendorPriceSyncService {
  constructor(
    private readonly db = dbClient,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async getVendor(vendorId: string) {
    const vendors = await vendorsService.listVendors({ includeInactive: true });
    const vendor = vendors.find((entry) => entry.vendorId === vendorId);
    if (!vendor) {
      throw new VendorNotFoundError(vendorId);
    }
    return vendor;
  }

  private getAdapter(slug: string, provider?: string | null): VendorPriceAdapter {
    const key = (provider || slug).toLowerCase();
    switch (key) {
      case 'home-depot':
        return new HomeDepotVendorPriceAdapter(
          (vendorId) => this.loadLinkedVendorPrices(vendorId),
          (vendorId, rows, options) => this.upsertVendorPriceRows(vendorId, rows, options),
          this.fetchImpl,
        );
      case 'amazon':
      case 'leslies':
      case 'pool-supply':
      case 'manual':
        return new UnsupportedVendorPriceAdapter(slug);
      default:
        return new UnsupportedVendorPriceAdapter(slug);
    }
  }

  private parseImportPayload(format: 'csv' | 'json', payload: string) {
    if (!payload.trim()) {
      throw new VendorPriceImportValidationError('Import payload cannot be empty.');
    }

    if (format === 'json') {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) {
        throw new VendorPriceImportValidationError('JSON import must be an array of rows.');
      }
      return parsed.map((row) => mapImportRow(row as Record<string, unknown>));
    }

    const rows = parseCsv(payload);
    if (rows.length < 2) {
      throw new VendorPriceImportValidationError('CSV import requires a header row and at least one data row.');
    }
    const [header, ...dataRows] = rows;
    const keys = header.map((cell) => cell.trim());
    return dataRows.map((cells) => {
      const record = Object.fromEntries(keys.map((key, index) => [key, cells[index] ?? '']));
      return mapImportRow(record);
    });
  }

  private async resolveProduct(row: VendorPriceImportRow) {
    if (row.productId) {
      const [product] = await this.db
        .select({
          productId: schema.products.productId,
          name: schema.products.name,
        })
        .from(schema.products)
        .where(eq(schema.products.productId, row.productId))
        .limit(1);
      return product ?? null;
    }

    if (!row.productName) {
      return null;
    }

    const conditions = [
      sql`lower(trim(${schema.products.name})) = lower(trim(${row.productName}))`,
    ];
    if (row.brand) {
      conditions.push(sql`lower(trim(coalesce(${schema.products.brand}, ''))) = lower(trim(${row.brand}))`);
    }

    const products = await this.db
      .select({
        productId: schema.products.productId,
        name: schema.products.name,
      })
      .from(schema.products)
      .where(and(...conditions))
      .limit(2);

    return products.length === 1 ? products[0] : null;
  }

  private async loadLinkedVendorPrices(vendorId: string) {
    return this.db
      .select({
        productId: schema.productVendorPrices.productId,
        productName: schema.products.name,
        productBrand: schema.products.brand,
        priceId: schema.productVendorPrices.priceId,
        vendorSku: schema.productVendorPrices.vendorSku,
        productUrl: schema.productVendorPrices.productUrl,
        packageSize: schema.productVendorPrices.packageSize,
        unitLabel: schema.productVendorPrices.unitLabel,
        isPrimary: schema.productVendorPrices.isPrimary,
      })
      .from(schema.productVendorPrices)
      .innerJoin(schema.products, eq(schema.productVendorPrices.productId, schema.products.productId))
      .where(eq(schema.productVendorPrices.vendorId, vendorId));
  }

  private async upsertVendorPriceRows(
    vendorId: string,
    rows: VendorPriceImportRow[],
    options?: { dryRun?: boolean },
  ): Promise<VendorPriceUpsertResult> {
    const results: VendorPriceImportResult['rows'] = [];
    let createdPrices = 0;
    let updatedPrices = 0;
    let skippedRows = 0;

    for (const [index, row] of rows.entries()) {
      const resolvedProduct = await this.resolveProduct(row);
      if (!resolvedProduct) {
        skippedRows += 1;
        results.push({
          rowNumber: index + 1,
          action: 'skip',
          reason: 'Unable to match row to a single product.',
          productName: row.productName,
        });
        continue;
      }

      const [existing] = await this.db
        .select({
          priceId: schema.productVendorPrices.priceId,
        })
        .from(schema.productVendorPrices)
        .where(
          and(
            eq(schema.productVendorPrices.vendorId, vendorId),
            eq(schema.productVendorPrices.productId, resolvedProduct.productId),
          ),
        )
        .limit(1);

      const action: 'create' | 'update' = existing ? 'update' : 'create';
      results.push({
        rowNumber: index + 1,
        action,
        productId: resolvedProduct.productId,
        productName: resolvedProduct.name,
      });

      if (options?.dryRun) {
        if (existing) updatedPrices += 1;
        else createdPrices += 1;
        continue;
      }

      if (existing) {
        await this.db
          .update(schema.productVendorPrices)
          .set({
            vendorSku: row.vendorSku ?? null,
            productUrl: row.productUrl ?? null,
            unitPrice: row.unitPrice.toFixed(2),
            currency: (row.currency ?? 'USD').toUpperCase(),
            packageSize: row.packageSize ?? null,
            unitLabel: row.unitLabel ?? null,
            source: 'external',
            fetchedAt: new Date(),
            isPrimary: row.isPrimary ?? false,
            updatedAt: new Date(),
          })
          .where(eq(schema.productVendorPrices.priceId, existing.priceId));
        updatedPrices += 1;
      } else {
        await this.db.insert(schema.productVendorPrices).values({
          productId: resolvedProduct.productId,
          vendorId,
          vendorSku: row.vendorSku ?? null,
          productUrl: row.productUrl ?? null,
          unitPrice: row.unitPrice.toFixed(2),
          currency: (row.currency ?? 'USD').toUpperCase(),
          packageSize: row.packageSize ?? null,
          unitLabel: row.unitLabel ?? null,
          source: 'external',
          fetchedAt: new Date(),
          isPrimary: row.isPrimary ?? false,
        });
        createdPrices += 1;
      }

      if (row.isPrimary) {
        await this.db
          .update(schema.products)
          .set({
            averageCostPerUnit: row.unitPrice.toFixed(2),
          })
          .where(eq(schema.products.productId, resolvedProduct.productId));
      }
    }

    return { createdPrices, updatedPrices, skippedRows, rows: results };
  }

  async syncVendor(
    vendorId: string,
    options?: { triggerSource?: 'manual' | 'worker'; actorUserId?: string | null },
  ): Promise<VendorPriceSyncResult> {
    const vendor = await this.getVendor(vendorId);
    const [linkedProductRow] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(schema.productVendorPrices)
      .where(eq(schema.productVendorPrices.vendorId, vendorId));

    const linkedProducts = Number(linkedProductRow?.count ?? 0);
    const adapter = this.getAdapter(vendor.slug, vendor.provider);
    const result = await adapter.sync({
      vendor: {
        vendorId: vendor.vendorId,
        name: vendor.name,
        slug: vendor.slug,
        provider: vendor.provider,
      },
      linkedProducts,
    });
    try {
      await this.db.insert(schema.vendorPriceSyncRuns).values({
        vendorId: vendor.vendorId,
        actorUserId: options?.actorUserId ?? null,
        triggerSource: options?.triggerSource ?? 'manual',
        status: result.status,
        updatedPrices: result.updatedPrices,
        linkedProducts: result.linkedProducts,
        message: result.message,
      });
    } catch (error) {
      if (!isUndefinedTableError(error)) throw error;
    }
    return result;
  }

  async importVendorPrices(
    vendorId: string,
    input: { format: 'csv' | 'json'; payload: string; dryRun?: boolean; actorUserId?: string | null },
  ) {
    const vendor = await this.getVendor(vendorId);
    const rows = this.parseImportPayload(input.format, input.payload);
    const result = await this.upsertVendorPriceRows(vendorId, rows, {
      dryRun: input.dryRun ?? false,
    });

    const importResult = {
      vendorId: vendor.vendorId,
      vendorName: vendor.name,
      vendorSlug: vendor.slug,
      status: input.dryRun ? 'dry_run' : 'completed',
      importedRows: rows.length,
      ...result,
      message:
        input.dryRun
          ? `Dry run complete. ${result.createdPrices} prices would be created, ${result.updatedPrices} updated, ${result.skippedRows} skipped.`
          : `Import complete. ${result.createdPrices} prices created, ${result.updatedPrices} updated, ${result.skippedRows} skipped.`,
    } satisfies VendorPriceImportResult;

    try {
      await this.db.insert(schema.vendorPriceImportRuns).values({
        vendorId: vendor.vendorId,
        actorUserId: input.actorUserId ?? null,
        format: input.format,
        dryRun: input.dryRun ?? false,
        status: importResult.status,
        importedRows: importResult.importedRows,
        createdPrices: importResult.createdPrices,
        updatedPrices: importResult.updatedPrices,
        skippedRows: importResult.skippedRows,
        rowResults: importResult.rows,
        message: importResult.message,
      });
    } catch (error) {
      if (!isUndefinedTableError(error)) {
        throw error;
      }
    }

    return importResult;
  }

  async listImportHistory(input?: { vendorId?: string; limit?: number }) {
    const limit = Math.min(Math.max(input?.limit ?? 10, 1), 50);
    const query = this.db
      .select({
        runId: schema.vendorPriceImportRuns.runId,
        vendorId: schema.vendorPriceImportRuns.vendorId,
        vendorName: schema.vendors.name,
        vendorSlug: schema.vendors.slug,
        actorUserId: schema.vendorPriceImportRuns.actorUserId,
        format: schema.vendorPriceImportRuns.format,
        dryRun: schema.vendorPriceImportRuns.dryRun,
        status: schema.vendorPriceImportRuns.status,
        importedRows: schema.vendorPriceImportRuns.importedRows,
        createdPrices: schema.vendorPriceImportRuns.createdPrices,
        updatedPrices: schema.vendorPriceImportRuns.updatedPrices,
        skippedRows: schema.vendorPriceImportRuns.skippedRows,
        rowResults: schema.vendorPriceImportRuns.rowResults,
        message: schema.vendorPriceImportRuns.message,
        createdAt: schema.vendorPriceImportRuns.createdAt,
      })
      .from(schema.vendorPriceImportRuns)
      .innerJoin(schema.vendors, eq(schema.vendorPriceImportRuns.vendorId, schema.vendors.vendorId));

    try {
      if (input?.vendorId) {
        return await query
          .where(eq(schema.vendorPriceImportRuns.vendorId, input.vendorId))
          .orderBy(sql`${schema.vendorPriceImportRuns.createdAt} desc`)
          .limit(limit) as VendorPriceImportHistoryEntry[];
      }

      return await query
        .orderBy(sql`${schema.vendorPriceImportRuns.createdAt} desc`)
        .limit(limit) as VendorPriceImportHistoryEntry[];
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return [];
      }
      throw error;
    }
  }

  async listSyncRuns(input?: { vendorId?: string; limit?: number }) {
    const limit = Math.min(Math.max(input?.limit ?? 10, 1), 50);
    const query = this.db
      .select({
        runId: schema.vendorPriceSyncRuns.runId,
        vendorId: schema.vendorPriceSyncRuns.vendorId,
        vendorName: schema.vendors.name,
        vendorSlug: schema.vendors.slug,
        actorUserId: schema.vendorPriceSyncRuns.actorUserId,
        triggerSource: schema.vendorPriceSyncRuns.triggerSource,
        status: schema.vendorPriceSyncRuns.status,
        updatedPrices: schema.vendorPriceSyncRuns.updatedPrices,
        linkedProducts: schema.vendorPriceSyncRuns.linkedProducts,
        message: schema.vendorPriceSyncRuns.message,
        createdAt: schema.vendorPriceSyncRuns.createdAt,
      })
      .from(schema.vendorPriceSyncRuns)
      .innerJoin(schema.vendors, eq(schema.vendorPriceSyncRuns.vendorId, schema.vendors.vendorId));

    try {
      if (input?.vendorId) {
        return await query
          .where(eq(schema.vendorPriceSyncRuns.vendorId, input.vendorId))
          .orderBy(sql`${schema.vendorPriceSyncRuns.createdAt} desc`)
          .limit(limit) as VendorPriceSyncRunEntry[];
      }

      return await query
        .orderBy(sql`${schema.vendorPriceSyncRuns.createdAt} desc`)
        .limit(limit) as VendorPriceSyncRunEntry[];
    } catch (error) {
      if (isUndefinedTableError(error)) return [];
      throw error;
    }
  }

  async runScheduledSyncBatch(limit: number) {
    const vendors = (await vendorsService.listVendors({ includeInactive: false })).slice(0, limit);
    let completed = 0;
    let unsupported = 0;

    for (const vendor of vendors) {
      const result = await this.syncVendor(vendor.vendorId, { triggerSource: 'worker' });
      if (result.status === 'completed') completed += 1;
      else unsupported += 1;
    }

    return {
      processed: vendors.length,
      completed,
      unsupported,
    };
  }

  isPriceStale(fetchedAt: Date | string | null | undefined) {
    if (!fetchedAt) return true;
    const value = fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
    if (Number.isNaN(value.getTime())) return true;
    const ageMs = Date.now() - value.getTime();
    return ageMs > env.VENDOR_PRICE_STALE_DAYS * 24 * 60 * 60 * 1000;
  }
}

export const vendorPriceSyncService = new VendorPriceSyncService();
