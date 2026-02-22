# Calendar & Dosage Reminder Readiness

## Short answer
Not yet. The codebase has notification storage, template management, and preview rendering, but it does **not** yet include a scheduling model, a reminder job runner, or a delivery pipeline tied to dosage/testing due dates.

## What is already in place

### Notification foundation
- A `notifications` table exists with channels/status/read timestamps (`pending`, `sent`, `delivered`, etc.).
- Notification templates can be managed by admins and rendered with token substitution.
- Users can list notifications, mark individual notifications read, and mark all read.

### Communication primitives
- Email capabilities exist for account/security workflows (welcome, password reset, username reminder, email change verification).
- A messaging route exists, but direct messaging is still placeholder-only and does not queue/send delivery jobs.

## What is missing for calendar-based dosage/testing reminders

### 1) Domain model for planned events
Add explicit scheduling tables and APIs, for example:
- `schedule_events`: one-time or recurring events (dosage, test, maintenance), pool/user ownership, timezone, due date/time.
- `schedule_rules`: recurrence rules (`RRULE`-style), cadence, and end conditions.
- `schedule_event_occurrences`: materialized upcoming instances (optional but practical for worker throughput).

### 2) Delivery orchestration
Implement an async pipeline that can reliably send reminders:
- Job queue (Redis-backed preferred, since Redis already exists in stack).
- Worker process with retry, backoff, dead-letter handling, idempotency keys.
- Per-channel adapters (start with email + in-app, add SMS/push later).

### 3) Notification production workflow
Bridge scheduled events to notification rows:
1. scheduler identifies due occurrences,
2. creates notification records,
3. sends via channel adapters,
4. updates status fields and audit records.

### 4) User preferences and routing
Use/extend existing preferences to control reminder behavior:
- channel-level opt-ins,
- quiet hours/timezone,
- reminder lead times (e.g., 24h before, 1h before),
- per-pool override options.

### 5) Calendar UX + APIs
Add end-user scheduling and visibility:
- API endpoints to create/update/delete schedule events.
- API endpoint for calendar range view (month/week/day).
- UI calendar page with event editing and completion actions.
- Optional ICS export/import and webhook integration for external calendars.

### 6) Operational readiness
Before production rollout:
- throughput/load tests for scheduler + worker,
- failure path tests (provider outage, retry exhaustion),
- observability (queue depth, send success rate, latency, bounce/failure rate),
- alerting and runbooks.

## Recommended implementation sequence
1. **Schema + API foundation:** schedule events/rules + CRUD.
2. **Worker + queue:** start with a minute-level scheduler and email/in-app delivery.
3. **Reminder generation:** convert due events into notifications and send.
4. **Calendar UI:** visualize and manage schedules.
5. **Hardening:** retries, idempotency, rate limits, and metrics.
6. **Optional channels/integrations:** SMS/push + external calendars.

## Practical “definition of done” for v1
You are “set up” when all are true:
- users can schedule dosage/testing events,
- due events are turned into notifications automatically,
- reminders are delivered (at least email + in-app),
- users can tune preferences/timezone/lead-time,
- delivery is observable and retry-safe.
