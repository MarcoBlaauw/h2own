# Pool Heater/Cooler and Sensor Integration Plan

## Status
- Drafted: February 20, 2026
- Scope: Add heater/cooler support now, and design a clean integration path for weather stations and pool sensors (including Govee API).

## Goals
1. Track pool heating/cooling capabilities and operating preferences.
2. Improve recommendations using equipment and ambient conditions.
3. Add a provider-agnostic integration framework for external devices.
4. Support staged rollout for Govee and future vendors without schema rewrites.

## Core Product Decisions

### 1) Equipment Model
- Each pool can have:
  - No thermal equipment
  - Heater only
  - Chiller/cooler only
  - Combo heater/chiller
- Persist equipment metadata:
  - Type
  - Fuel/energy source (gas, electric, heat pump, solar-assisted, unknown)
  - Optional capacity fields
  - Enabled/disabled status

### 2) Temperature Targets
- Add pool-level setpoints:
  - Preferred swim temperature
  - Min/Max automation bounds
  - Seasonal mode (optional future)
- Units respect user preferences (`F`/`C`) with normalized storage in backend.

### 3) Integration Architecture
- Introduce an integration provider abstraction:
  - `provider` (e.g. `govee`, `weather_station_x`)
  - `account_link` / auth credentials
  - `device_registry` (mapped to user/pool)
  - `ingestion_pipeline` for telemetry snapshots
- Keep vendor adapters isolated from domain logic.

### 4) Data Quality Rules
- Distinguish:
  - User-entered values
  - Device-reported values
  - Derived/forecast values
- Persist source + timestamp + confidence/health metadata per reading.

## Data Model Additions (Planned)
1. `pool_equipment`
- `equipment_id`, `pool_id`, `equipment_type`, `energy_source`, `status`, `metadata`, timestamps

2. `pool_temperature_prefs`
- `pool_id`, `preferred_temp`, `min_temp`, `max_temp`, `unit`, timestamps

3. `integrations`
- `integration_id`, `user_id`, `provider`, `status`, `scopes`, `external_account_id`, timestamps

4. `integration_devices`
- `device_id`, `integration_id`, `provider_device_id`, `device_type`, `label`, `pool_id`, `status`, metadata

5. `sensor_readings`
- `reading_id`, `pool_id`, `device_id`, `metric`, `value`, `unit`, `recorded_at`, `source`, `quality`, raw payload

6. Optional `weather_station_readings`
- Only if separate from existing weather model is useful for governance/latency.

## API Plan

### Equipment + Setpoints
- `GET /pools/:poolId/equipment`
- `PUT /pools/:poolId/equipment`
- `GET /pools/:poolId/temperature-preferences`
- `PUT /pools/:poolId/temperature-preferences`

### Integrations
- `GET /integrations`
- `POST /integrations/:provider/connect`
- `POST /integrations/:provider/callback`
- `DELETE /integrations/:integrationId`
- `GET /integrations/:integrationId/devices`
- `POST /integrations/:integrationId/devices/:deviceId/link-pool`

### Readings
- `GET /pools/:poolId/sensors/readings`
- `POST /integrations/:provider/webhook` (provider-authenticated ingestion path)

## Phased Delivery

## Phase 1: Heater/Cooler Foundation
- Add heater/cooler fields to pool setup/admin UI.
- Add preferred temp + unit-aware display/edit.
- Persist in DB and expose via API.

### Acceptance
- User can configure thermal equipment per pool.
- Temperature preferences save/load correctly.

## Phase 2: Recommendation Engine Inputs
- Feed equipment + setpoints into recommendation logic.
- Add guidance when temp is out of preferred range.

### Acceptance
- Recommendations reflect configured equipment capability.

## Phase 3: Integration Framework
- Implement provider-agnostic integration tables/services.
- Add connection lifecycle and device mapping endpoints.

### Acceptance
- New provider can be added with an adapter only.

## Phase 4: Govee Pilot
- Build Govee adapter:
  - Auth/link flow based on Govee API model
  - Device discovery
  - Reading ingestion + normalization
- Link Govee sensor device to pool.

### Acceptance
- Govee readings appear in pool telemetry timeline with source tagging.

## Phase 5: Weather Station Expansion
- Add station adapters (self-hosted/local vendor APIs as available).
- Combine station + forecast + pool readings for context-aware advice.

### Acceptance
- System can ingest and display station data alongside forecast/provider data.

## Security and Reliability
- Encrypt provider tokens at rest.
- Validate webhook signatures where supported.
- Add rate limits/retry/dead-letter queue for ingestion jobs.
- Log integration events in audit log (connect/disconnect/device link failures).

## Capability and Access
- Suggested capabilities:
  - `pool.equipment.read`, `pool.equipment.update`
  - `pool.temperature_prefs.read`, `pool.temperature_prefs.update`
  - `integrations.read`, `integrations.manage`
  - `sensor.readings.read`
- Owner controls destructive integration actions.
- Business operators may read telemetry and add operational records, but token ownership should remain user-scoped.

## Open Questions
1. Should thermal setpoints be pool-owner only or editable by business operators?
2. Do we allow multiple active integrations per provider per user?
3. Should sensor ingestion be near-real-time push, scheduled pull, or hybrid?
4. Do we need historical retention tiers (hot/warm/cold) from day one?

## Recommended Defaults
1. Normalize storage to a canonical unit internally, render in user preference units.
2. Make provider adapters stateless and queue-driven.
3. Start with Govee read-only ingestion; avoid write/control commands in first release.
4. Add feature flags for each provider rollout.
