# Pool Equipment + Sensor Implementation Backlog

## Overall Status
Completed and archived (February 24, 2026).

## Objective
Execute `docs/archived/pool-equipment-and-sensor-integration-plan.md` in phases with minimal rework and clear delivery gates.

## Phase 1 (Now): Heater/Cooler Foundation
Status: Implemented (February 22, 2026)

1. Data model
- Add `pool_equipment` table (type, energy source, status, optional capacity, metadata).
- Add `pool_temperature_prefs` table (preferred/min/max in canonical Fahrenheit + display unit).
- Keep `pools.has_heater` synchronized for backward compatibility.

2. API
- Add `GET /pools/:poolId/equipment`.
- Add `PUT /pools/:poolId/equipment`.
- Add `GET /pools/:poolId/temperature-preferences`.
- Add `PUT /pools/:poolId/temperature-preferences`.
- Add validation for temperature bounds (min <= preferred <= max when provided).

3. UI
- Add equipment + temperature preference fields to pool setup create/edit flow.
- Load existing pool equipment/preferences when editing.
- Save equipment/preferences after pool create/update.

4. Tests
- Add route integration coverage for the new equipment and temperature preference endpoints.

5. Exit criteria
- Users can configure pool thermal equipment and temperature preferences from pool setup.
- Settings persist and round-trip via API.

## Phase 2: Recommendation Engine Inputs
Status: Implemented (February 22, 2026)

1. Include pool equipment + setpoints in recommendation context.
2. Add recommendation messaging for out-of-range temperature vs preferred bounds.
3. Add tests for equipment-aware recommendation behavior.

Phase 2 implementation notes
- Recommendation context now includes pool equipment snapshot + temperature preference bounds.
- Recommendation reasons now include temperature guidance notes when water temperature is out of configured preferred bounds.
- Unit tests added for temperature guidance note behavior across heater/chiller capability scenarios.

## Phase 3: Integration Framework
Status: Implemented (February 24, 2026)

1. Add tables:
- `integrations`
- `integration_devices`
- `sensor_readings`

2. Add provider-agnostic service boundary:
- adapter interface
- account link lifecycle
- device discovery/association

3. Add API:
- `GET /integrations`
- `POST /integrations/:provider/connect`
- `POST /integrations/:provider/callback`
- `DELETE /integrations/:integrationId`
- `GET /integrations/:integrationId/devices`
- `POST /integrations/:integrationId/devices/:deviceId/link-pool`
- `GET /pools/:poolId/sensors/readings`
- `POST /integrations/:provider/webhook`

4. Add operational controls:
- webhook signature verification
- retry/dead-letter handling
- integration event auditing

Phase 3 implementation progress
- Added tables and schema exports:
  - `integrations`
  - `integration_devices`
  - `sensor_readings`
- Added provider-agnostic adapter boundary (`integration-adapters`) and account integration service lifecycle.
- Added API endpoints:
  - `GET /integrations`
  - `POST /integrations/:provider/connect`
  - `POST /integrations/:provider/callback`
  - `DELETE /integrations/:integrationId`
  - `GET /integrations/:integrationId/devices`
  - `POST /integrations/:integrationId/devices/:deviceId/link-pool`
  - `GET /pools/:poolId/sensors/readings`
  - `POST /integrations/:provider/webhook`
- Added provider-path webhook signature verification and audit events for connect/callback/disconnect/device-link/webhook.
- Added route integration tests for integration framework endpoints.
- Added ingestion retry/dead-letter controls:
  - `integration_ingestion_failures` table
  - retry scheduling with exponential backoff
  - feature-flagged retry worker (`INTEGRATION_RETRY_*` env controls)
- Added provider onboarding contract documentation:
  - `docs/provider-integration-onboarding-contract.md`
- Added webhook dead-letter audit event coverage (`integration.webhook.queued_retry`).

## Phase 4: Govee Pilot
Status: Closed (decommissioned) (February 22, 2026)

1. Implement Govee adapter (read-only).
2. Device discovery + pool link workflow.
3. Ingestion normalization + source tagging in telemetry timeline.
4. Feature flag provider rollout.

Phase 4 implementation progress
- Added Govee-specific adapter normalization for webhook readings:
  - `temperature|temp_f` -> `water_temp_f` (unit `F`)
  - Non-temperature metrics are ignored for Govee pilot ingestion.
- Added device discovery workflow endpoint:
  - `POST /integrations/:integrationId/devices/discover`
- Added provider rollout feature flag and disabled-path guard during pilot rollout.
- Enforced Govee pilot as read-only (`scopes`: `read.devices`, `read.sensors`) with no write/control path.
- Enforced per-user Govee API key + poll interval (`30-60` minutes) validation.
- Added user-facing integrations management page (`/integrations`) and linked it from hamburger menu.
- Added per-pool enablement workflow via device-to-pool linking in user integrations UI.
- Added tests for adapter normalization and discovery route behavior.
- Added feature-flagged Govee polling worker loop during pilot.
- Decommissioned user-facing Govee integration after API validation confirmed target thermometer devices were not exposed by Govee.

Decommission decision
- Govee remains removed from active provider rollout.
- User integrations surface remains in place for future providers.

## Phase 5: Weather Station Expansion
Status: Implemented (February 24, 2026)

1. Add station adapters under the same provider abstraction.
2. Blend station readings with forecast + pool test/readings for guidance.
3. Introduce retention policy controls (hot/warm/cold tiers if required).

Phase 5 implementation progress
- Added initial `weather_station` adapter under the existing provider abstraction.
- Added metric normalization for common weather station webhook inputs:
  - `temperature|temp_f|air_temperature_f` -> `air_temp_f`
  - `humidity` -> `humidity_percent`
  - `wind_speed|wind_mph` -> `wind_speed_mph`
  - `uv` -> `uv_index`
- Blended station + forecast + pool-test context in recommendations:
  - Recommendation reasons now append weather-station notes from latest ingested `sensor_readings`.
  - Temperature guidance now uses latest sensor `water_temp_f` as fallback when test-session water temperature is stale/missing.
- Added retention policy controls for `sensor_readings` with hot/warm/cold behavior:
  - Hot tier: retain full reading payloads for `SENSOR_RETENTION_HOT_DAYS` (default `30`).
  - Warm tier: keep readings but null out `raw_payload` until `SENSOR_RETENTION_WARM_DAYS` (default `365`).
  - Cold tier: purge readings older than warm retention.
- Added periodic worker with `SENSOR_RETENTION_TICK_SECONDS` (default `3600`).

## Chemistry Model Alignment
Status: Implemented (February 24, 2026)

1. Pool policy model updates
- Sanitizer type constrained to `chlorine` or `bromine`.
- Chlorine source split into separate pool field (`manual` or `swg`).
- Sanitizer target range stored as pool policy:
  - `sanitizerTargetMinPpm`
  - `sanitizerTargetMaxPpm`

2. Generator configuration updates
- Salt target (`saltLevelPpm`) remains generator configuration.
- Salt target is required only when chlorine source is `swg`.

3. Measured-state separation
- Sanitizer residual measurements remain test-session readings.
- Pool characteristics now represent targets/configuration only, not measured residual state.

## Open Decisions
1. Setpoint edit rights: owner-only vs operator-capable.
2. Multiple active integrations per provider per user.
3. Push vs pull vs hybrid ingestion model.
4. Historical retention and cost constraints.

## Next Plan Handoff
1. Next active implementation plan: `docs/feature-enhancements-and-ui-fixes-implementation-plan.md`.
2. Next phase to execute there: `Phase 1: Navigation + Portal Foundations`.
