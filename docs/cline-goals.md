
## Implementation Steps (Cline)

1. **Bootstrap API**
   - Create `api/src/app.ts` with Fastify, CORS, sensible helmet, cookie/session.
   - Add health route `GET /healthz` → `{ ok: true }`.
2. **Drizzle Setup**
   - Create `api/src/db/index.ts` for pg `Pool` + Drizzle; run `SELECT 1` on boot.
   - Mirror tables for: users, sessions, api_tokens, user_locations, pools, pool_members, test_sessions, test_kits, photos, products/product_categories, chemical_actions, recommendations (+status), prediction_outcomes, costs/cost_categories, notifications/notification_templates, weather_data, devices/device_readings (optional).
3. **Auth**
   - Registration: validate password ≥ 8, Argon2id hash, unique email.
   - Login: verify hash; set secure session cookie.
   - Token issue: store **hash** of token; return `preview` once.
4. **RBAC**
   - PreHandler `requireAuth`.
   - PreHandler `requirePoolRole('viewer'|'editor'|'owner'|'admin')`.
5. **Pools**
   - CRUD + list; owner becomes pool member (role: owner).
6. **Tests**
   - POST: validate ranges; insert; return computed `combined_chlorine_ppm`.
   - GET: cursor pagination by `(pool_id, tested_at DESC)`.
7. **Chemicals**
   - List: filter by category or name.
   - Initial seed a few common items (liquid chlorine, muriatic acid, sodium bicarb).
8. **Dosing**
   - POST: compute cost if chemical has `average_cost_per_unit` and unit → optional field.
9. **Recommendations (preview)**
   - Read latest test + pool volume + product effects → propose actions.
   - Return 1 primary + up to 2 alternatives.
10. **Costs**
   - Create + list; add view endpoint `/pools/:id/costs/summary?window=month`.
11. **Notifications**
   - Templates table + `/notifications/preview` to render with simple `mustache` (server‑only).
12. **Web**
   - SvelteKit page with chemistry tiles, environment card, recommendation list, quick test form.
   - Wire to API using `PUBLIC_API_BASE`.
13. **Tests**
   - Vitest + Supertest e2e:
     - auth flow
     - create pool
     - add test
     - preview recommendation
     - RBAC checks
14. **Docker Compose**
   - `postgres`, `api`, `web` services; volumes for db data.

## Coding Conventions

- TypeScript strict, ESM.
- Zod for all request bodies/query params.
- Return 4xx with explicit messages; never expose stack traces in prod.
- Use parameterized queries only (Drizzle handles).
- Date/time: ISO 8601 UTC.

## Acceptance Criteria

- `docker compose up -d --build` starts **postgres, api, web**.
- `GET /healthz` → 200.
- Register/login works; cookie set.
- Create pool → list pools shows it.
- Add a test → list tests shows it with `cc`.
- `/recommendations/preview` returns at least one action using seeded chemicals.
- Frontend dashboard renders tiles + can submit a test.
- Vitest e2e passes locally.

## Nice-to-haves (stretch)

- Woodpecker pipeline running lint/test/build.
- Seed script for demo data.
- Basic admin page (chemicals list).

