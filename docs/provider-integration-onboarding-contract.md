# Provider Integration Onboarding Contract

## Purpose
Define the minimum technical contract for adding a new sensor/integration provider without changing pool-domain schema.

## Adapter Contract
Each provider adapter must implement the `IntegrationAdapter` contract in `api/src/services/integration-adapters.ts`.

Required methods:
- `connect(input)`: return normalized account linkage output.
- `callback(input)`: complete handshake and return normalized linkage output.
- `discoverDevices(input)`: return provider devices in normalized shape.
- `verifyWebhook(input)`: validate webhook signature/auth for provider path.
- `webhook(input)`: parse provider payload into normalized readings.
- `pollReadings(input)`: optional pull-based ingestion path for feature-flagged workers.

## Security Requirements
- Webhook requests must be rejected when signature/auth is missing or invalid.
- Provider-specific secret validation must use constant-time comparison.
- Provider credentials remain user-scoped and are not shared across users.
- Device-to-pool links must respect pool access authorization checks.

## Data Contract
- Adapters emit normalized readings only:
  - `providerDeviceId`
  - `metric`
  - `value`
  - optional `unit`, `recordedAt`, `quality`, `rawPayload`
- Unknown/invalid readings are dropped before persistence.
- Domain model separation is mandatory:
  - Measured values stay in `sensor_readings` or test sessions.
  - Pool policy/configuration stays in pool/equipment fields.

## Reliability Contract
- Webhook ingestion failures must be captured in `integration_ingestion_failures`.
- Failed payloads are retried by `IntegrationRetryWorker` using backoff.
- After max attempts, failures are marked `dead` for operator review.
- Webhook route must emit audit events for:
  - webhook received
  - queued for retry (dead-letter enqueue path)

## Feature Flag + Rollout
- New providers must be feature-flagged for staged rollout.
- Pilot starts read-only unless explicit write/control use cases are approved.
- Providers with insufficient API/device coverage must be decommissionable without schema changes.

## Minimum Test Expectations
- Adapter unit tests:
  - payload normalization
  - webhook signature rejection path
- Route integration tests:
  - connect/callback/disconnect/device-link flows
  - webhook accepted path
  - webhook unauthorized path
  - webhook queued-for-retry path + audit assertions
- Worker/service tests:
  - retry worker enabled/disabled behavior
  - retry processing counters and logging

## Operational Checklist
1. Add provider adapter + tests.
2. Add env vars/secrets and deployment defaults.
3. Add route/service audit coverage.
4. Run migrations and verify dead-letter table presence.
5. Confirm staged rollout guardrails and decommission switch.
