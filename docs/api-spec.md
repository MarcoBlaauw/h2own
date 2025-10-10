# H2Own API Specification (MVP)

Status: **DRAFT**  
Auth: **Session cookie** (username/password) and **API tokens** (Bearer)  
Format: `application/json`  
Errors: JSON problem+json style

```json
{
  "error": "BadRequest",
  "message": "ph must be between 6.0 and 9.0",
  "details": { "field": "ph" }
}


Pagination: ?limit=50&cursor=<opaque> → response includes { nextCursor }
Idempotency (writes): optional header Idempotency-Key (UUID)

Auth
POST /auth/register

Body: { email, password, name? }

201 → { user: { id, email, name }, session: { id, expiresAt } }

Sets httpOnly session cookie.

POST /auth/login

Body: { email, password }

200 → { user, session } (+ cookie)

POST /auth/logout

204

POST /auth/tokens

Create/rotate an API token for the caller.

Body: { name, permissions? }

201 → { id, name, createdAt, preview: "tok_abc…", expiresAt? }

Only the preview is returned once; server stores a hash.

Users & Membership
GET /me

200 → { user, memberships:[{ poolId, role }] }

GET /pools/:poolId/members

200 → [{ userId, role, invitedAt, lastAccessAt }]

RBAC: owner/editor

PUT /pools/:poolId/members/:userId

Body: { role }

200 → updated membership

DELETE /pools/:poolId/members/:userId

204

Pools
GET /pools

Query: ?owner=true|false (default: all visible to caller)

200 → [{ id, name, locationId, volumeGallons, sanitizer, surface, isActive }]

POST /pools

Body (subset):
{ name, locationId, volumeGallons, sanitizer, surface, shadeLevel?, enclosureType?, hasCover?, pumpGpm?, filterType?, hasHeater? }

201 → pool

GET /pools/:id

200 → full pool

PATCH /pools/:id

200 → pool

DELETE /pools/:id

204

Locations & Weather
GET /locations

200 → [{ id, name, lat, lon, timezone, isPrimary }]

POST /locations

201 → location

GET /locations/:id/weather

Query: ?from=ISO&to=ISO&granularity=hour|day

200 → [{ recordedAt, airTempF, uvIndex, rainfallIn, windSpeedMph, ... }]

Data sourced/stored in WEATHER_DATA, tied to location.

Test Sessions
GET /pools/:poolId/tests

Query: ?from&to&limit&cursorTestedAt&cursorSessionId

200 → { items:[{ id, testedAt, fc, tc, cc, ph, ta, ch, cya, salt, tempF, orp }], nextCursor?: { testedAt, sessionId } }

POST /pools/:poolId/tests

Body (any subset):
{ testedAt?, testedBy?, testKitId?, photoId?, fc?, tc?, ph?, ta?, ch?, cya?, salt?, tempF?, orp?, notes? }

201 → created test (server computes cc = tc - fc if both)

GET /tests/:id

200 → test

DELETE /tests/:id

204

Chemicals & Dosing
GET /chemicals

Query: ?q=string&category=sanitizer|ph_down|...

200 → [{ id, name, category, concentrationPercent, phEffect, fcChangePerDose, dosePer10kGallons, defaultUnit, ... }]

POST /chemicals

201 → chemical (admin only)

POST /pools/:poolId/dosing

Body:
{ chemicalId, amount, unit, addedAt?, reason?, additionMethod?, linkedTestId?, targetEffect? }

201 → dosing event

GET /pools/:poolId/dosing

200 → [{ id, chemicalId, amount, unit, addedAt, reason, targetEffect, actualEffect? }]

Recommendations
POST /pools/:poolId/recommendations/preview

Compute recommendation(s) without saving (dry‑run).

Body: { latestTestId? | inlineTest?:{...}, goals?:{ ph?:7.4, fc?:2.0 }, constraints?:{ budget?: number } }

200 →

[
  {
    "id": "temp",
    "type": "chem_adjustment",
    "priorityScore": 9,
    "title": "Raise FC to 2.0 ppm",
    "payload": { "actions":[{ "chemicalId":"...", "amount": "20", "unit":"oz_fl" }] },
    "alternatives": [...],
    "predictedOutcome": { "fc": { "delta": +1.2 } },
    "confidenceScore": 0.84,
    "factorsConsidered": { "uvIndex": 8, "bathers": 4 }
  }
]

POST /pools/:poolId/recommendations

Persist chosen recommendation.

Body: { fromPreview, payload, priorityScore?, title?, description? }

201 → recommendation

PATCH /recommendations/:id

Body: { status, userAction?, userFeedback? }

200 → recommendation

Costs
GET /pools/:poolId/costs?from&to

200 → [{ id, amount, currency, categoryId, incurredAt, description }]

POST /pools/:poolId/costs

201 → cost

Notifications
GET /notifications?status=pending|sent|...

200 → items

POST /notifications/preview

Body: { templateId|inline:{subject,body}, to:{ userId }, channel:"email", data:{} }

200 → rendered { subject, body }

Photos
POST /pools/:poolId/photos (presigned)

200 → { uploadUrl, fileUrl, fields? }

Client uploads directly to object storage, then calls:

POST /photos/confirm

Body: { fileUrl, poolId, testId? }

201 → photo

System/Audit
GET /audit?entity=pools&entityId=...&limit=...

200 → events

Security & RBAC

Global roles: admin, user

Per‑pool membership: viewer, editor, owner, service_tech

Checks:

viewer: read only

editor: create tests/dosing, view recs

owner: manage members, settings

admin: global

Webhooks (optional, future)

POST /integrations/webhooks/:id/test – ping endpoint

Event types: test.created, dosing.created, recommendation.status_changed, cost.created


---

# `docs/cline-goals.md`

```markdown
# Cline Goals — H2Own

> **Purpose:** Give Cline a clear plan to scaffold, wire, and validate the MVP stack.

## Context

- Repo: H2Own (Gitea)
- Stack:
  - **API:** Fastify (TypeScript), Drizzle ORM (Postgres), Zod for validation
  - **Web:** SvelteKit + Tailwind
  - **DB:** PostgreSQL (schema in `db/init.sql`, updated per latest merge)
- Run local via Docker Compose (postgres, api, web).  
- Auth: cookie sessions (fastify‑secure‑session) + API tokens (Bearer).

## High‑level Goals (MVP)

1. **Auth**
   - `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/tokens`
   - Session cookie (httpOnly, secure in prod)
   - Hash passwords (Argon2id), rate‑limit login
2. **Pools & Membership**
   - CRUD pools; link to `user_locations`  
   - Per‑pool RBAC via `pool_members`
3. **Tests**
   - Create/read tests per pool; compute `cc` (`tc - fc`)
   - Optional `testKitId`, `photoId`
4. **Chemicals & Dosing**
   - Catalog read (admin create for now)  
   - Log dosing events; link to test(s)
5. **Recommendations**
   - `/pools/:id/recommendations/preview` (deterministic dose math using product coefficients)
6. **Weather**
   - Read from DB (we’ll wire ingestion later)
7. **Costs**
   - Basic create + monthly summary view
8. **Notifications**
   - Template render preview; enqueue send (no real provider yet)
9. **Web UI**
   - Dashboard page replicating MVP (chemistry tiles, environment, recommendations list, quick test form)

## Folder Expectations
api/
src/
app.ts # Fastify bootstrap
env.ts # parse .env with zod
db/
index.ts # drizzle client
schema/ # tables mapped to latest SQL
routes/
auth.ts
pools.ts
pool-members.ts
tests.ts
chemicals.ts
dosing.ts
recommendations.ts
costs.ts
notifications.ts
photos.ts
plugins/
auth.ts # session, token, RBAC preHandlers
cors.ts
rate-limit.ts
lib/
rec-engine.ts # simple deterministic recommender
dosing.ts # dose calculations helpers
pagination.ts
test/
e2e/*.spec.ts # vitest + supertest
package.json
web/
src/
routes/+layout.svelte
routes/+page.svelte
lib/components/...
lib/api.ts # fetch wrapper with credentials
lib/stores.ts
package.json
db/
init.sql # latest schema
migrations/ # (optional)
docs/
api-spec.md
cline-goals.md

## Environment Variables

`api/.env.example`
NODE_ENV=development
PORT=3001
DATABASE_URL=postgres://h2own:h2own@postgres:5432/h2own
SESSION_SECRET=<random hex 32+>
CORS_ORIGIN=http://localhost:3000


`web/.env.example`
PUBLIC_API_BASE=http://localhost:3001