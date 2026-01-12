# H2Own Implementation Plan

## Purpose

Capture the current feature state and outline the next implementation steps to reach the MVP goals described in the repo documentation.

## Current State (Summary)

### Implemented
- Auth/session lifecycle (`/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`) and admin API tokens.
- Pools CRUD + membership management.
- Test session creation and listing by pool, plus single test lookup by ID.
- Dosing event creation.
- Recommendations preview endpoint.
- Chemicals CRUD (admin) and public chemical list.
- Admin endpoints for users, locations, pools, and audit log.
- SvelteKit dashboard shell with a quick test form and basic admin UI pages.

### Partial/Placeholder
- Recommendations UI actions are still static (apply/save flows not wired).

### Missing (relative to MVP goals)
- Persisted recommendations lifecycle (create + update status).
- Dosing history listing.
- Costs endpoints (create, list, and summary view).
- Notifications templating/preview endpoint.
- Weather data API route(s) and ingestion pipeline.
- Photos upload confirmation/presigned workflow.

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

### 3) Dosing and history (Not started)
- Add `GET /pools/:poolId/dosing` endpoint.
- Render dosing history in the UI.

### 4) Costs (Not started)
- Add costs CRUD endpoints.
- Add `/pools/:id/costs/summary?window=month`.
- Add a basic costs view in the web app.

### 5) Notifications (Not started)
- Add templates table and `/notifications/preview` endpoint.
- Wire preview flows in admin UI.

### 6) Weather (Not started)
- Add locations weather query endpoint.
- Implement ingestion (batch import or scheduled job).
- Use weather data as a recommendation input.

### 7) Photos (Not started)
- Add presigned upload endpoint and confirm endpoint.
- Attach photos to test sessions in the UI.

## QA / Verification
- Run `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:web`, and `pnpm test:web:e2e`.
- Run `pnpm audit` (or `npm audit`) to check for known vulnerabilities.
