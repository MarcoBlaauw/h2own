# H2Own Implementation Plan

## Purpose

Capture the current feature state and outline the next implementation steps to reach the MVP goals described in the repo documentation.

## Current State (Summary)

### Implemented
- Auth/session lifecycle (`/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`) and admin API tokens.
- Pools CRUD + membership management.
- Test session creation and listing by pool, plus single test lookup by ID.
- Dosing event creation + history listing.
- Recommendations preview endpoint.
- Persisted recommendations lifecycle (create + update status + list/detail).
- Chemicals CRUD (admin) and public chemical list.
- Costs create/list + summary endpoints.
- Notification templates + preview endpoint (admin).
- Admin endpoints for users, locations, pools, and audit log.
- SvelteKit dashboard shell with quick test, recommendations, dosing history, and costs views.
- Admin UI for notification templates and preview.
- Locations weather endpoint + Tomorrow.io ingestion, weather-informed recommendations, and dashboard weather quality card.
- Photo presign/confirm endpoints + quick test attachment.

### Missing (relative to MVP goals)
- None.
## Implementation Plan

### 1) Wire live dashboard data (Completed)
- Replace hard-coded metric tiles with latest test measurements. ✅
- Fetch and render recommendations preview data. ✅
- Surface empty states when the pool has no tests. ✅

### 2) Complete recommendation workflow (Completed)
- [x] Add endpoint to persist recommendations.
- [x] Add endpoint to update recommendation status and feedback.
- [x] Extend the web UI to apply/track recommendations.
- [x] Add list/detail endpoints to view recommendation history per pool.

### 3) Dosing and history (Completed)
- [x] Add `GET /pools/:poolId/dosing` endpoint.
- [x] Render dosing history in the UI.

### 4) Costs (Completed)
- [x] Add costs create/list endpoints.
- [x] Add `/pools/:id/costs/summary?window=month`.
- [x] Add a basic costs view in the web app.

### 5) Notifications (Completed)
- [x] Add templates table and `/notifications/preview` endpoint.
- [x] Wire preview flows in admin UI.

### 6) Weather (Completed)
- [x] Add locations weather query endpoint.
- [x] Implement ingestion (on-demand from Tomorrow.io).
- [x] Use weather data as a recommendation input.

### 7) Photos (Completed)
- [x] Add presigned upload endpoint and confirm endpoint.
- [x] Attach photos to test sessions in the UI.

## QA / Verification
- Run `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:web`, and `pnpm test:web:e2e`.
- Run `pnpm audit` (or `npm audit`) to check for known vulnerabilities.
