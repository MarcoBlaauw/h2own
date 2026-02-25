# Feature Enhancements and UI Fixes Implementation Plan

## Status
- Drafted: February 22, 2026
- Updated: February 25, 2026
- Scope: Navigation and pool-context UX fixes, auth/lockout hardening, monetization gating, user-facing integrations, AI-assisted maintenance planning, and production CAPTCHA readiness.
- Active phase: Complete (all phases implemented)
- Phase 1 status: Implemented (February 24, 2026)
- Phase 2 status: Implemented (February 24, 2026)
- Phase 3 status: Implemented (February 25, 2026)
- Phase 4 status: Implemented (February 25, 2026)
- Phase 5 status: Implemented (February 25, 2026)

## Objectives
1. Make active-pool selection explicit and user-controlled.
2. Separate visitor experience from authenticated user portal experience.
3. Harden authentication against abuse with progressive temporary lockouts.
4. Add monetization hooks for non-paying subscribers (Google Ads).
5. Introduce user-facing integration management (provider-agnostic) with safe polling defaults.
6. Add an AI-assisted maintenance module for phased recovery and planning.
7. Deploy a production-grade CAPTCHA aligned with Cloudflare infrastructure.

## Corrections Applied
- `Integrations` should be in the authenticated user hamburger menu, not the top navigation.

## Product Surface Changes

### 1) Navigation and Pool Context
- Top navigation (authenticated):
  - `My Pools` (replaces `Pool Setup`)
  - `Pool Overview` (active pool dashboard)
  - `Inventory` (placeholder module)
- User hamburger menu:
  - Add `Integrations` link.
- Pool context:
  - Add `defaultPoolId` preference as active pool source-of-truth.
  - Display active pool in `My Pools` page and preferences.

### 2) New Landing + Portal Split
- Visitor landing page (non-authenticated):
  - Product value messaging, trust/social proof, CTA to register/login.
  - Ads eligible for non-authenticated traffic where policy allows.
- Authenticated portal landing page:
  - Becomes post-login redirect target.
  - Active-pool-centered dashboard entry with overview actions and modal test entry points.

### 3) Authentication Lockout and Abuse Controls
- Enforce progressive rate/lockout controls per identity + source IP:
  - Threshold A: 5 failed attempts in 1 minute.
  - Threshold B: 10 failed attempts in 5 minutes.
  - Trigger lockout when either threshold is exceeded.
- Progressive penalties (per user/day):
  - 1st lockout offense: short lockout (recommended 15 minutes).
  - 2nd lockout offense in same day: 1 hour lockout.
  - 3rd lockout offense in same day: locked for remainder of day.
- UX requirements:
  - Warn users when nearing threshold (e.g., at 4/5 and 8/10 failed attempts).
  - Show clear lockout message once locked.
  - Redirect locked users to dedicated lockout page.
- Escalation requirements:
  - 2nd and 3rd offenses trigger admin email alerts.
  - 3rd offense lockout page includes contact-admin help form.

### 4) Google Ads for Non-Paying Subscribers
- Eligibility rules:
  - Show ads only to non-paying subscribers.
  - Suppress ads for paid tiers and internal/admin contexts.
- Placement rules:
  - Visitor landing and eligible authenticated surfaces.
  - Avoid critical workflow interruption (testing, dosing submission forms).
- Compliance:
  - Add consent/region-aware ad behavior.
  - Document ad-safe zones and ad-free premium behavior.

### 5) AI-Assisted Maintenance Advice
- Initial capabilities:
  - Multi-phased recovery plans from current chemistry state.
  - Long-term dosage planning recommendations.
  - Inventory-aware maintenance guidance (consumption + reorder hints).
- Product boundaries for v1:
  - Advisory-only output; no autonomous actuation.
  - Explicit confidence, assumptions, and safety disclaimers.
  - Human approval required before applying recommended actions.

### 6) CAPTCHA for Production (Cloudflare Fit)
- Integrate Cloudflare-compatible CAPTCHA in production auth flows:
  - Login
  - Registration
  - Password reset request
- Behavior:
  - Risk-based challenge where possible.
  - Fail-secure server-side token verification.
  - Full audit trail for challenge failures and bypass decisions.

## UI Fixes and Flow Adjustments

### A) My Pools Page (new)
- Left card:
  - Active pool indicator.
  - Pool selector dropdown.
  - `Open Pool` action to Pool Overview.
- Right card:
  - Map with all candidate pool pins.
  - Red pins for non-active pools, green pin for active pool.
  - Pin state updates immediately on dropdown change.

### B) Pool Overview Page (new primary active-pool workspace)
- Includes:
  - Test trends.
  - Weather trends + forecast-based context.
  - Pool weather quality summary.
  - Upcoming maintenance/dosage events.
- Test entry:
  - Convert quick and guided test forms to modals launched from this page.

### C) Link and Routing Fixes
- Fix `Guided Full Test` target (currently incorrect).
- Post-auth redirect should route to authenticated portal landing.

### D) Inventory Placeholder
- Add dedicated route + menu entry.
- Display staged module notice and supervisor/shared inventory direction.

## Architecture and Data Plan

### 1) Preferences and Active Pool
- Extend user preferences schema with `default_pool_id` (nullable UUID).
- Validate pool membership on set/update.
- Use this value for active-pool context resolution across pages.

### 2) User-Scoped Integrations
- Keep admin/global integration config separate from user integration credentials.
- Add user-scoped integration records for provider credentials and polling config.
- Provider polling policy (where pull-based providers are used):
  - Minimum interval guardrail: 30 minutes.
  - Default interval: 45 minutes.
  - Max recommended standard interval: 60 minutes.
  - Add jitter and backoff to reduce chatty behavior and API-key risk.

### 3) Auth Security Services
- Add lockout service tracking:
  - failed-attempt windows
  - offense count per day
  - lockout expiry
- Add event-driven admin alert emails for offense escalation.
- Add locked-user support request channel for third offense.

### 4) Monetization + Entitlement
- Add subscription entitlement check for ad gating.
- Centralize `adsEnabled` derivation in session/user context to avoid scattered checks.

### 5) AI Advisory Engine (phased)
- Inputs:
  - test history
  - weather trends
  - dosing history
  - inventory state
- Outputs:
  - phased plan steps
  - near-term and long-term recommendations
  - material usage forecast assumptions

## Delivery Phases

### Phase 1: Navigation + Portal Foundations
- Add visitor landing + authenticated portal landing.
- Implement `My Pools`, `Pool Overview`, and top-nav updates.
- Move `Integrations` to hamburger menu.
- Add `Inventory` placeholder route.

### Phase 2: Active Pool and UX Fixes
- Add `defaultPoolId` in preferences and enforce active-pool selection.
- Fix `Guided Full Test` routing.
- Convert test entry forms to overview-launched modals.

### Phase 3: Auth Hardening + CAPTCHA
- Implement lockout thresholds, warnings, lockout page, and progressive penalties.
- Add 2nd/3rd offense admin email alerts.
- Add 3rd-offense contact-admin form.
- Enable Cloudflare-aligned CAPTCHA on auth-sensitive flows.

### Phase 4: Integrations (User-Facing) + Provider Safety
- Add user `Integrations` page in hamburger menu path.
- Add provider credential/key management (provider-specific forms).
- Add poll interval controls with strict server-side minimum and cooldown behavior.

### Phase 5: Ads + AI Assistance
- Implement ad gating for non-paying subscribers.
- Launch first AI-assisted maintenance advice experience (read-only advisory).

## Acceptance Criteria
1. Users can clearly identify and change active pool in both preferences and `My Pools`.
2. Authenticated users land on the new portal page after login.
3. Integrations are available via hamburger menu and not top nav.
4. Lockout policy enforces 5/min and 10/5-min thresholds with progressive penalties and user messaging.
5. 2nd/3rd lockout offenses email admins; 3rd offense offers contact form.
6. CAPTCHA is active in production auth-sensitive flows and verified server-side.
7. Ads are shown only to non-paying subscribers.
8. AI maintenance advice can generate phased recovery + planning guidance without auto-execution.

## Risks and Mitigations
- False-positive lockouts:
  - Mitigate with clear warning copy, transparent timers, and support path.
- Provider API-key disablement risk from over-polling:
  - Mitigate with minimum interval guardrails, jitter, cooldowns, and backoff.
- Ad experience harming workflow:
  - Mitigate with ad-safe placement rules and premium ad suppression.
- AI recommendation safety:
  - Mitigate with confidence labels, explicit assumptions, and approval gates.

## Open Decisions
1. Confirm first-offense lockout duration (recommended: 15 minutes).
2. Decide whether portal landing is `/` for authenticated users or a dedicated path (e.g., `/portal`).
3. Decide initial ad placements for authenticated non-paying users (dashboard only vs broader).
4. Decide whether AI advice ships initially behind a feature flag.
