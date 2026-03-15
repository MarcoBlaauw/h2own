# Notifications, Billing, and Messages Implementation Plan

## Objective
Finish the remaining implementation work for Notifications, Billing, and Messages so the Admin Panel readiness card reflects real provider wiring instead of placeholder status. Messages are intentionally in-app only for now and should not depend on any external messaging provider.

Target providers for this plan:
- Transactional email: Amazon SES
- SMS: Telnyx
- Billing: Stripe

This plan is intentionally organized by layers rather than by provider-first implementation.

## Architecture Model

### Layer 1: Core system
Application-domain logic and user-facing workflows.

Examples in current codebase:
- Notification templates, preferences, unread/read state, schedule reminder records
- Message threads, messages, participants, deliveries
- Billing summary, plan status, invoice display, paid/free feature gating

### Layer 2: Service abstraction
Provider-agnostic service contracts owned by the app.

Target boundaries:
- `EmailService`
- `SmsService`
- `BillingService`
- no messaging relay abstraction is required while Messages remain in-app only

The codebase already trends this way in places:
- `api/src/services/notification-dispatcher.ts`
- `api/src/services/billing.ts`
- `api/src/services/messages.ts`
- `api/src/services/integrations.ts`

### Layer 3: Provider adapters
Provider-specific implementations behind Layer 2 contracts.

Target adapters:
- `SesEmailAdapter`
- `TelnyxSmsAdapter`
- `StripeBillingAdapter`

## Current State Summary

### Notifications
Implemented now:
- SMTP email delivery exists via `mailerService`
- Notification template CRUD exists
- Notification preferences/readiness UI exists
- In-app notifications and schedule reminder persistence exist
- Admin readiness already computes a live Notifications status

Missing now:
- SES adapter
- Telnyx SMS adapter
- real push provider adapter or explicit defer decision
- dead-letter retry/admin operations beyond current visibility
- provider-backed delivery receipts and richer status transitions

### Billing
Implemented now:
- Billing API and page exist
- Billing summary is persisted from user preferences
- Billing portal session flow expects an external provider API
- Billing webhook ingestion exists in generic form

Missing now:
- real Stripe adapter
- Stripe portal session creation
- Stripe invoice/subscription sync
- Stripe webhook verification and event mapping
- readiness logic tied to real integration state instead of hardcoded placeholder

### Messages
Implemented now:
- internal inbox, threads, participants, and deliveries
- pool-default threads and message sharing flows
- message read/send APIs and UI

Missing now:
- readiness logic tied to internal messaging health instead of a hardcoded placeholder

## Delivery Principles
1. Keep Layer 1 domain behavior provider-agnostic.
2. Move provider-specific fetch/signature logic into adapters only.
3. Use `.env` for bootstrap secrets and deployment defaults.
4. Use Admin Integrations for runtime overrides, enabling/disabling, health visibility, and key rotation.
5. Drive readiness from stored integration state plus runtime health, not hardcoded text.

## Phase 1: Finish the abstraction boundary
Status: Required before provider work

### Goals
- Normalize provider access behind explicit services.
- Remove direct provider fetch logic from route handlers where practical.
- Align existing integrations registry with actual usage by billing/sms/email.

### Work
1. Introduce a dedicated `EmailService` interface and implementation boundary.
2. Introduce a dedicated `SmsService` interface and implementation boundary.
3. Refactor `BillingService` so it depends on a provider adapter rather than hardcoded generic fetches.
4. Keep Messages internal-only and out of provider scope for this implementation pass.
5. Add integration lookup helpers so runtime services can read the admin-managed integration record, falling back to env-seeded defaults.

### Exit criteria
- Billing, SMS, and email logic no longer depend directly on raw env vars alone.
- Services can obtain provider credentials/config from the integrations registry.

## Phase 2: SES transactional email
Status: First provider implementation

### Layer 1 scope
- Preserve existing notification email behavior.
- Preserve auth/system email flows already using `mailerService`.
- Preserve treatment plan report email delivery.

### Layer 2 scope
- Define `EmailService.send(input)` contract covering:
- recipient
- subject
- body
- optional attachments
- provider message id
- normalized error category

### Layer 3 scope
- Implement `SesEmailAdapter`.
- Support AWS credential loading from env and/or integration config.
- Support SES sandbox/production distinctions in diagnostics.

### Implementation tasks
1. Refactor `mailerService` behind the new `EmailService`.
2. Add SES adapter with provider-specific request signing/client usage.
3. Add integration provider metadata for `email` or repurpose existing Notifications email config path.
4. Update readiness to report:
- configured
- sandbox-only
- send-failed
- healthy
5. Add admin “test email” capability.

### Exit criteria
- Auth emails, treatment reports, and notification emails can be sent through SES without SMTP.
- SMTP can remain as a fallback path until cutover is complete.

## Phase 3: Telnyx SMS
Status: Second provider implementation

### Layer 1 scope
- Notification preferences already expose phone number and SMS enablement.
- Schedule reminders and notification templates should be able to target SMS.

### Layer 2 scope
- Define `SmsService.send(input)` contract covering:
- destination phone
- message body
- provider message id
- normalized delivery/error state

### Layer 3 scope
- Implement `TelnyxSmsAdapter`.
- Support outbound SMS first.
- Defer inbound messaging unless required for Messages.

### Implementation tasks
1. Replace placeholder SMS success/failure logic in `notification-dispatcher`.
2. Validate phone number formatting requirements at app boundary.
3. Store provider message id on notification dispatch records where applicable.
4. Add Telnyx webhook route for delivery status callbacks if delivery tracking is required in v1.
5. Add admin “test SMS” capability and readiness diagnostics.

### Exit criteria
- SMS notifications can be sent through Telnyx.
- Admin readiness reports SMS provider configuration and health accurately.

## Phase 4: Stripe billing
Status: Third provider implementation

### Layer 1 scope
- Billing page should show real plan, status, invoices, and portal links.
- Paid/free gating should remain driven by normalized app-side billing state.

### Layer 2 scope
- Keep `BillingService` as the provider-agnostic facade.
- Add adapter methods for:
- create billing portal session
- fetch invoice history
- map customer/subscription state
- verify and ingest webhook events

### Layer 3 scope
- Implement `StripeBillingAdapter`.
- Use Stripe customer id and subscription id as canonical external references.

### Implementation tasks
1. Replace generic external billing fetch logic in `api/src/services/billing.ts` with Stripe adapter calls.
2. Map Stripe webhook events into:
- `billingCustomerId`
- `billingSubscriptionId`
- `billingProvider`
- `subscriptionTier`
- `subscriptionStatus`
- `billingPaymentStatus`
3. Decide plan-tier mapping table from Stripe products/prices to app tiers.
4. Support Stripe billing portal session creation.
5. Support invoice retrieval for the Billing page.
6. Add admin readiness logic based on Stripe integration config instead of placeholder.

### Exit criteria
- Billing readiness is dynamic and no longer placeholder.
- Billing page works against Stripe directly.
- Webhooks keep local subscription state current.

## Phase 5: Messages readiness alignment
Status: Required

Interpret readiness as “core messaging is implemented and healthy inside the app.”

### Work
1. Change Admin readiness logic so Messages is not placeholder when in-app threads/messages are healthy.
2. Report readiness from DB availability, route health, and message delivery persistence.
3. Explicitly document that no external chat, email, or SMS relay is in scope for Messages.

### Exit criteria
- Admin readiness semantics match the internal-only product decision.
- No provider credentials or external relay dependencies are required for Messages readiness.

## Phase 6: Admin readiness and integration UX
Status: Required to close the loop

### Goals
- Remove hardcoded placeholder statuses for Billing and Messages.
- Use real provider and runtime health data.

### Work
1. Refactor `api/src/routes/admin-readiness.ts` to compute readiness from:
- integrations table state
- provider health checks
- dead-letter / failure counts
- template counts where relevant
2. Extend Admin Integrations UI as needed for:
- SES or email-provider config
- Telnyx config
- Stripe config
3. Add provider-specific health details:
- credential present
- webhook secret present
- base URL or region configured
- last success / last failure
4. Add explicit readiness states:
- `placeholder`
- `not_configured`
- `configured`
- `degraded`
- `healthy`

### Exit criteria
- Readiness card reflects actual implementation state.
- Billing and Messages no longer show placeholder unless intentionally deferred.

## Env vs Admin Panel

### `.env` should own
- bootstrap secrets in development and initial deployment
- AWS credentials / SES region
- Stripe secret key and webhook secret
- Telnyx API key and webhook secret
- any emergency fallback configuration

### Admin Integrations should own
- enabled/disabled provider state
- runtime config overrides
- non-secret endpoint/base-url fields when needed
- API key rotation without redeploy
- health visibility and audit trail

### Recommended operating model
- `.env` seeds the first working configuration
- Admin panel persists operational overrides in `external_integrations`
- runtime services read the stored integration first, falling back to env defaults only when the DB value is missing

## Proposed module/provider mapping

### Notifications
- Core system: templates, preferences, unread state, reminder scheduling
- Service abstraction: `EmailService`, `SmsService`, optional `PushService`
- Provider adapters: SES, Telnyx, deferred push provider

### Billing
- Core system: subscription state, plan gating, invoice UI
- Service abstraction: `BillingService`
- Provider adapters: Stripe

### Messages
- Core system: inbox, threads, participants, pool-linked discussions
- Service abstraction: existing internal messaging service only
- Provider adapters: none in current scope

## Testing and rollout

### Tests to add
1. Provider adapter unit tests
2. Service-level contract tests using mocked adapters
3. Webhook signature tests for Stripe and Telnyx
4. Admin readiness integration tests for configured and unconfigured provider states
5. End-to-end smoke tests for:
- send test email
- send test SMS
- create Stripe portal session
- process Stripe webhook

### Rollout order
1. Abstraction cleanup
2. SES
3. Telnyx
4. Stripe
5. Messages readiness alignment
6. Admin readiness cleanup

## Open decisions
1. Do we want to keep SMTP as fallback after SES is added?
2. Do we want push notifications in the current milestone, or explicitly defer them?
3. Messages are considered complete when in-app messaging is healthy.
4. Do we want one generic email integration record or a dedicated `email` provider entry in admin integrations?
5. How should Stripe product/price ids map to app subscription tiers?

## What is needed from the user

### Not needed yet for planning
- API keys
- live provider credentials
- provider doc links

### Needed when implementation starts
- Stripe account and webhook endpoint details
- Telnyx account details and messaging profile requirements
- AWS SES region, sender identities, and whether sandbox is still enabled
- preferred plan-tier mapping for Stripe products/prices
- confirmation that Messages remain internal-only

## Recommended next execution order
1. Build the shared service/adapters boundary cleanup.
2. Implement SES and switch email flows to the new abstraction.
3. Implement Telnyx for SMS notifications.
4. Implement Stripe for billing.
5. Update readiness logic and admin integrations UI.
6. Resolve Messages readiness semantics around the existing internal system and remove the placeholder dependency on external relay.
