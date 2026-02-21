# Pool Equipment + Sensor Implementation Backlog

## Objective
Execute `docs/pool-equipment-and-sensor-integration-plan.md` in phases with minimal rework and clear delivery gates.

## Phase 1 (Now): Heater/Cooler Foundation
Status: In progress

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
Status: Pending

1. Include pool equipment + setpoints in recommendation context.
2. Add recommendation messaging for out-of-range temperature vs preferred bounds.
3. Add tests for equipment-aware recommendation behavior.

## Phase 3: Integration Framework
Status: Pending

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

## Phase 4: Govee Pilot
Status: Pending

1. Implement Govee adapter (read-only).
2. Device discovery + pool link workflow.
3. Ingestion normalization + source tagging in telemetry timeline.
4. Feature flag provider rollout.

## Phase 5: Weather Station Expansion
Status: Pending

1. Add station adapters under the same provider abstraction.
2. Blend station readings with forecast + pool test/readings for guidance.
3. Introduce retention policy controls (hot/warm/cold tiers if required).

## Open Decisions to Resolve Before Phase 3
1. Setpoint edit rights: owner-only vs operator-capable.
2. Multiple active integrations per provider per user.
3. Push vs pull vs hybrid ingestion model.
4. Historical retention and cost constraints.
