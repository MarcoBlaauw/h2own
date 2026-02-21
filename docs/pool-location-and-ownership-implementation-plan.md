# Pool Location and Ownership Implementation Plan

## Status
- Drafted: February 20, 2026
- Scope: Pool setup UX simplification, Google Maps integration hardening, ownership model for single users and business users, and future-ready permission framework.
- Phase 1: Implemented
- Phase 2: Implemented
- Phase 3: Implemented
- Phase 4: In progress (initial capability registry + policy wiring)
- Follow-up hardening (February 20, 2026): In progress
  - Centralized system capability checks added for admin users/audit services.
  - Audit write path added and wired to key auth/admin/pool actions.
  - User management UI now shows role capability previews.

## Goals
1. Make Google Maps location selection the primary and required source of pool location data.
2. Reduce manual location management complexity while keeping location browsing useful.
3. Support two operational modes:
   - Individual pool owners
   - Business/supervisor users managing pools on behalf of owners
4. Enforce owner data control by default while allowing business operations without dispute.
5. Prepare architecture for future role/permission tooling.

## Core Product Decisions

### 1) Location Entry Model
- Pool creation must include location selection using Google Maps search + pin placement.
- Manual free-form location creation/edit flows are removed from the primary path.
- Required stored fields from map selection:
  - `formattedAddress`
  - `googlePlaceId`
  - `latitude`
  - `longitude`
  - `timezone` (auto-derived from coordinates, user-overridable only if needed)

### 2) Map UX Requirements
- Google map in pool creation must support:
  - Address/place search
  - Pin placement and drag-to-refine
  - Satellite view toggle (required)
- Satellite mode is required so users can visually identify outdoor pool geometry.

### 3) Ownership and Authority Rules
- The pool owner is the data owner.
- Business/supervisor accounts can be granted operational access but cannot delete owner pool data.
- Business/supervisor users may:
  - Create pools for an owner
  - Add tests
  - Add dosages
- Business/supervisor users may not:
  - Delete pools
  - Remove historical pool data
  - Override owner authority after transfer/sign-over
- After pool sign-over to owner, business account is not in charge unless explicitly re-granted access.

### 4) Future Permission Model
- Introduce capability-based permission mapping later (role/permission management tool).
- Avoid hard-coding only role names in new code paths; define feature capabilities as policy checks.

## Implementation Phases

## Phase 1: Pool Creation UX Consolidation
### Deliverables
- Move map search + pin UI into `Create new pool` card.
- Require location before enabling pool submission.
- Auto-populate timezone from pin coordinates.
- Keep address display visible for user confirmation.

### API/Data Changes
- Ensure pool create/update endpoints accept and persist standardized location payload.
- Preserve backward compatibility for existing pools with legacy/no location records.

### Acceptance Criteria
- User cannot create a pool without selecting map location.
- Created pool contains lat/lng and timezone.
- Satellite toggle is visible and functional in map component.

## Phase 2: Location Browsing (Read-Oriented)
### Deliverables
- Replace manual location management with browsing and filtering:
  - Filter by city
  - Filter by state
  - Optional free-text search
- Add map view with pool pins.
- Selecting a pin reveals pool summary and quick navigation.

### Acceptance Criteria
- Large lists remain usable via filters + map.
- Location data comes from Google selection-derived fields, not manual arbitrary input.

## Phase 3: Ownership and Business Access Enforcement
### Deliverables
- Introduce explicit pool access model:
  - Owner (full control)
  - Business operator (limited operational control)
- Enforce policy in API and UI.

### Required Policy Rules (Initial)
- Owner:
  - Full CRUD on own pool
  - Full history visibility
- Business operator:
  - Can create pool for owner
  - Can add tests/dosages
  - Read-only for core ownership metadata
  - No pool deletion
  - No destructive history actions

### Acceptance Criteria
- Forbidden actions return consistent `403` and clear UI error messaging.
- No endpoint path allows business user to delete owner pool data.

## Phase 4: Permission Management Framework (Future)
### Deliverables
- Introduce capability registry and role mapping, e.g.:
  - `pool.create`
  - `pool.read`
  - `pool.update`
  - `pool.delete`
  - `pool.tests.create`
  - `pool.dosing.create`
- Admin UI for role templates and capability assignment.

### Acceptance Criteria
- New features can be permissioned without schema rewrites.
- Policy checks are centralized and testable.

## Data Model Evolution (Planned)
1. Add/standardize location fields on pool records (or normalized linked table with strict source constraints).
2. Add access control tables for owner/business relationships.
3. Track grant provenance and transfer events in audit log.

## API and UI Guardrails
- API is source-of-truth for authorization; UI mirrors API capabilities.
- All destructive actions require owner-level permission.
- Transfer/sign-over must produce immutable audit events.

## Testing Plan
1. Unit tests
- Permission checks for owner vs business users.
- Location normalization and timezone derivation.

2. Integration tests
- Pool creation with map-derived payload.
- Business user can add tests/dosages but cannot delete.
- Sign-over behavior removes business authority unless explicit re-assignment exists.

3. UI tests
- Satellite view presence and map interaction path.
- Filtered location/pool map list behavior.
- Permission-gated button visibility and disabled states.

## Rollout Strategy
1. Ship Phase 1 behind a feature flag if needed.
2. Migrate old creation UI after telemetry confirms success.
3. Ship Phase 3 policy checks before exposing business-management workflows broadly.

## Open Questions
1. Should business users be allowed to edit non-destructive pool metadata (name/volume/surface), or only tests/dosages?
2. On sign-over, should existing business access be automatically revoked (default recommended: yes)?
3. Do we want owner-invoked temporary access windows for service visits (future enhancement)?

## Recommended Defaults
1. Business users can create pools and add operational records only.
2. Owner retains all destructive rights and final authority.
3. Satellite map is enabled by default with roadmap to persist user map type preference.
