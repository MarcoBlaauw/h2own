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

## Explicitly Out Of Scope Today
- Pool devices, smart hardware, and external equipment integrations are not part of the current inventory implementation.
- Non-chemical maintenance supplies are not implemented yet, even though they belong in inventory scope.
- Examples not yet modeled:
  - filter cartridges
  - DE / filter media accessories sold as supplies rather than dosing chemicals
  - skimmer nets
  - brushes
  - poles
  - vacuum heads and hoses
  - test strips and reagent kits
  - baskets, o-rings, seals, and cleaner replacement parts

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

## Planned Next Extension: Non-Chemical Maintenance Supplies
Goal:
- bring routine pool maintenance supplies into inventory without forcing them into the chemical catalog model

Examples:
- filter cartridges
- skimmer nets
- wall brushes
- telescoping poles
- vacuum heads
- vacuum hoses
- test strip packs
- liquid reagent refills
- baskets
- o-rings and seals

Recommended model direction:
- introduce an inventory item class such as `chemical | supply`
- keep owner-shared stock and transaction behavior the same
- keep vendor and price support shared across both classes
- do not route supplies through chemical dosing fields like `activeIngredients`, `dosePer10kGallons`, or water-balance effects

Likely supply-specific fields:
- `sku`
- `brand`
- `vendorId`
- `unit`
- `packageSize`
- `reorderPoint`
- `preferredVendorId`
- `preferredUnitPrice`
- optional `replacementIntervalDays`
- optional `compatibleEquipmentType`
- optional `notes`

UI implications:
- Inventory page should gain a class/type filter so chemicals and supplies can be viewed together or separately.
- Admin catalog should split into chemical fields vs supply fields instead of one form trying to represent both.
- Supply transactions should support restock, manual adjustment, assignment/use, and replacement history.

## Remaining Follow-Ups
- Implement non-chemical maintenance supply catalog and stock tracking as the next inventory extension.
- Add scheduled/background vendor import jobs that reuse the current vendor price import pipeline.
- Add stale-price visibility, retry behavior, and sync-run status around vendor imports.
- Add real external vendor/API adapters after the background import layer is stable.
- Extend inventory abstractions for equipment inventory in a later phase without conflating that with supplies.

## Guardrails
- Shared inventory scope is derived from pools the authenticated user can access.
- Pool filters remain optional for account-wide views.
- Duplicate stock rows are merged during migration only when units match.
- Mixed-unit duplicate stock is intentionally blocked in migration rather than auto-converted.
