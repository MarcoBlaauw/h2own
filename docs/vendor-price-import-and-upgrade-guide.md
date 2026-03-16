# Vendor Price Import And Upgrade Guide

## Current Phase
The current implementation now spans:
- Phase 1 manual admin import workflow
- Phase 2 background sync run infrastructure
- first real external adapter coverage through Home Depot and Leslie's

Implemented:
- Admin vendor registry CRUD
- Manual sync trigger endpoint scaffold
- Home Depot sync adapter with `auto`, `direct`, and `serpapi` modes
- Leslie's direct product-page sync adapter
- Vendor price import endpoint
- CSV and JSON import support
- Dry-run preview mode
- Admin-side sample template helpers for CSV and JSON
- Persistent import history with summary results
- Persistent sync-run history with summary results
- Upsert into `product_vendor_prices`
- Optional primary-price updates for `products.average_cost_per_unit`

## Import Endpoint
- `POST /admin/vendors/:vendorId/import-prices`
- `GET /admin/vendors/import-history`

Request body:
```json
{
  "format": "csv",
  "payload": "productName,brand,vendorSku,unitPrice,currency,packageSize,unitLabel,isPrimary\nChampion Muriatic Acid,Champion,CH516,10.49,USD,1 gal,jug,true",
  "dryRun": true
}
```

Supported fields:
- `productId`
- `productName`
- `brand`
- `vendorSku`
- `productUrl`
- `unitPrice`
- `currency`
- `packageSize`
- `unitLabel`
- `isPrimary`

Matching rules:
1. If `productId` is present, match directly.
2. Otherwise match by exact normalized `productName`.
3. If `brand` is present, use it to disambiguate exact name matches.
4. Ambiguous or unmatched rows are skipped.

## Recommended Import Format
Preferred CSV header:
```text
productName,brand,vendorSku,unitPrice,currency,packageSize,unitLabel,isPrimary,productUrl
```

Preferred JSON shape:
```json
[
  {
    "productName": "Champion Muriatic Acid",
    "brand": "Champion",
    "vendorSku": "CH516",
    "unitPrice": 10.49,
    "currency": "USD",
    "packageSize": "1 gal",
    "unitLabel": "jug",
    "isPrimary": true,
    "productUrl": "https://example.com/product/ch516"
  }
]
```

## Automated Sync Status
Implemented:
- scheduled/background vendor sync runs
- sync-run result logging
- stale-price visibility in the UI

Best next upgrade:
- keep the current import result contract
- expand more adapters to produce the same normalized row shape
- pass all adapter output through the same upsert pipeline used by manual import

Current live adapter note:
- `VENDOR_PRICE_HOME_DEPOT_PROVIDER=auto` is the default.
- In `auto` mode, the sync uses SerpApi when `VENDOR_PRICE_SERPAPI_API_KEY` is configured, then falls back to direct product-page sync.
- In `direct` mode, the sync only uses `product_vendor_prices.productUrl` values that already point to Home Depot product pages.
- In `serpapi` mode, the sync uses Home Depot search/product APIs through SerpApi to discover product URLs and prices from existing catalog rows even when `productUrl` is missing.
- Leslie's currently uses direct product-page sync only and requires `product_vendor_prices.productUrl` to already point at a Leslie's PDP.

Recommended env for the SerpApi-backed path:
```text
VENDOR_PRICE_HOME_DEPOT_PROVIDER=serpapi
VENDOR_PRICE_SERPAPI_API_KEY=replace-me
VENDOR_PRICE_HOME_DEPOT_DELIVERY_ZIP=78701
VENDOR_PRICE_HOME_DEPOT_STORE_ID=
```

Suggested architecture:
- `VendorPriceAdapter.fetchRows()`
- `VendorPriceSyncService.importVendorPrices()` remains the shared write path
- adapters only fetch/normalize; they do not write directly

## Next Adapter Direction
Preferred direction:
1. shopping search API adapter
2. retailer API adapter if available
3. retailer scraping only when API/search options are insufficient

Reason:
- lower maintenance than scraping
- more stable contracts
- easier rate limiting and retry behavior

## Background Job Upgrades
When automated imports are added, extend what already exists:
- per-run status and timing
- row-level error capture
- retry strategy
- stale-price warnings
- “last successful import” in admin UI

## Matching Upgrades
If exact name + brand becomes too strict, future upgrades can add:
- canonical vendor SKU mapping
- normalized package-size matching
- product alias table
- manual review queue for ambiguous matches

## Guardrails
- keep `dryRun` available even after automation exists
- never overwrite prices without tracking `fetchedAt`
- preserve `source = manual | external`
- treat one `productId + vendorId` row as canonical in automated flows
- keep imports idempotent wherever possible
