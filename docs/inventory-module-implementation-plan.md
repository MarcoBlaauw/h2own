# Inventory Module Implementation Plan

## Goal
Move cost tracking out of Pool Overview and make Inventory the account-shared operations module for chemical stock, non-chemical maintenance supplies, replenishment settings, vendor pricing, and spend visibility.

## Implemented Scope
- Costs removed from Overview and relocated to Inventory.
- Inventory upgraded from placeholder to account-shared chemical inventory.
- Shared inventory keyed by `ownerId + productId`.
- Inventory transactions now track:
  - `ownerId`
  - optional `poolId`
  - `productId`
  - `stockId`
  - `transactionType`
  - `quantityDelta`
  - `unit`
  - `source`
  - optional `chemicalActionId`
  - optional `vendorId`
  - optional `unitPrice`
  - optional `currency`
- Vendor registry added with normalized IDs/slugs.
- Chemical catalog extended with multi-vendor price lists and primary vendor/price summary.
- Inventory stock extended with preferred vendor, preferred unit price, and preferred currency.
- Inventory page now shows:
  - owner-shared stock summary
  - low-stock state
  - 30-day consumption
  - forecasted depletion
  - manual restock/adjustment/decrement entry
  - account-level costs with optional pool filter
- Non-chemical maintenance supplies are implemented in the shared catalog/inventory model.
- Vendor price import history is implemented.
- Background vendor sync runs and sync-run history are implemented.
- Stale-price visibility is implemented in catalog and inventory views.
- A real external vendor adapter is implemented for Home Depot.

## Explicitly Out Of Scope Today
- Pool devices, smart hardware, and external equipment integrations are not part of the current inventory implementation.
- Equipment/device inventory remains a later expansion from the current chemical-and-supply scope.

## Layering
### Layer 1: Core system
- Pool chemical dosing still records pool-scoped actions.
- Inventory aggregation now rolls stock up to the pool owner account.
- Cost creation remains pool-level for compatibility.
- Inventory page becomes the primary account operations surface.
- Future supply inventory should share the same owner/account scope and transaction model as chemicals, but without dosing-specific behavior.

### Layer 2: Service abstraction
- `inventoryService` resolves accessible owner scope from the authenticated user’s accessible pools.
- `poolCostsService` now supports both pool-level and account-level spend queries.
- `chemicalsService` now manages vendor price lists and primary pricing metadata.
- `vendorsService` exposes normalized vendor records for selectors and future price sync tools.
- A future `inventoryCatalogService` or equivalent abstraction should separate generic stock items from chemical-specific dosing metadata.

### Layer 3: Provider / adapter readiness
- Vendor pricing is manual today.
- Schema now supports future external price sync by storing:
  - provider/vendor identity
  - listing URL / SKU
  - fetched timestamp
  - source (`manual` or `external`)

## API Surface
- `GET /inventory`
- `GET /inventory/transactions`
- `POST /inventory/transactions`
- `PATCH /inventory/:stockId`
- `GET /inventory/costs`
- `GET /vendors`
- `GET /pools/:poolId/inventory` retained as compatibility view

## Data Model
- `vendors`
- `product_vendor_prices`
- `inventory_stock`
  - now owner-shared
  - unique on `ownerId + productId`
- `inventory_transactions`
  - now owner-aware and vendor-aware

## Completed Extensions
- Non-chemical maintenance supplies are supported through `itemClass = chemical | supply`.
- Supply-oriented categories and seeded examples are in place.
- Vendor sync runs and stale-price visibility are active.
- Home Depot is implemented as the first real external price adapter.

## Remaining Follow-Ups
- Improve vendor adapter coverage beyond Home Depot.
- Harden production operations around external sync:
  - richer sync observability
  - adapter failure diagnostics
  - better product matching controls for ambiguous search results
- Extend inventory abstractions for equipment/device inventory later without conflating that with supplies.

## Guardrails
- Shared inventory scope is derived from pools the authenticated user can access.
- Pool filters remain optional for account-wide views.
- Duplicate stock rows are merged during migration only when units match.
- Mixed-unit duplicate stock is intentionally blocked in migration rather than auto-converted.
- Manual imports and external sync both write through the same normalized vendor pricing model.
