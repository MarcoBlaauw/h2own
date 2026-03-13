# Calendar & Dosage Reminder Readiness

## Status
Archived as implemented for v1. The codebase now has the scheduling model, authenticated CRUD APIs, reminder worker, and email/in-app reminder generation that this guide originally called for.

## What shipped

### Scheduling foundation
- A `schedule_events` table stores user-owned pool events for `dosage`, `test`, and `maintenance`.
- Basic recurrence is supported via `once`, `daily`, `weekly`, and `monthly` cadence fields.
- Reminder deliveries are tracked in `schedule_event_notifications`.

### User APIs + UI
- Authenticated users can:
  - list schedule events by date range,
  - create/update/delete schedule events,
  - complete scheduled events,
  - view an agenda-style calendar page.
- Preferences include reminder timezone, default lead time, and quiet-hour fields.

### Reminder generation
- A schedule reminder worker runs on an interval and:
  1. finds due reminders,
  2. creates in-app notifications,
  3. sends reminder emails when enabled,
  4. records delivery attempts and audit entries.

## Remaining follow-on work
These are enhancements beyond the original v1 goal and should be tracked in a future backlog rather than kept as an active readiness plan:

### Rich recurrence rules
- `RRULE`-style recurrence definitions
- exception dates / skipped occurrences
- materialized occurrence tables for higher-throughput scheduling

### Delivery hardening
- retry/backoff/dead-letter handling dedicated to reminder delivery
- separate queue infrastructure if reminder volume grows

### Quiet-hours enforcement
- defer delivery around quiet windows

### Calendar UX depth
- month/week/day calendar views
- inline drag/drop rescheduling
- richer edit dialogs and completion history

### External calendar support
- ICS export/import
- webhook sync
- external calendar provider integration

### Operational readiness
- throughput/load tests for the reminder worker
- failure-path tests around mail outages and partial delivery
- metrics/alerting/runbooks for reminder throughput and failures
