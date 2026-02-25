# User Context Menu, Profile, Preferences, and Security Plan

## Status
- Drafted: February 20, 2026
- Scope: Replace top-right auth controls with a user context menu, add profile/preferences/security settings, and prepare notifications, messaging, and billing expansion.
- Phase 1: Completed (header/menu shell, guest light-theme default, menu ordering)
- Phase 2: Completed (admin navigation consolidated into dedicated Admin panel entry)
- Phase 3: Completed (editable profile with persisted fields, greeting fallback inputs, supervisor listing)
- Phase 4: Completed (preferences persistence and UI for notifications, units, currency, theme, and preferred pool temperature)
- Phase 5: Completed (password update flow implemented; 2FA and SSO sections added as staged "coming soon" placeholders)
- Phase 6: Completed (notifications center API, unread badge in header, notifications page with unread/history and mark-read actions)
- Phase 7: Completed (messaging/billing capability hooks, placeholder APIs/pages, and audit events for sensitive placeholder actions)
- Phase 8: Completed (email-change verification workflow with tokenized confirmation before updating login email)

## Goals
1. Reduce header clutter and centralize user actions in one context menu.
2. Add editable user profile and preferences settings with clear defaults.
3. Introduce a security settings area with staged rollout for password, 2FA, and SSO.
4. Add notification entry-point beside the menu and prepare for historical notifications.
5. Keep architecture extensible for direct messaging and billing.

## Required UX Behavior

### Unauthenticated Header
- Show only `Login` and `Register`.
- Force default theme to `light`.

### Authenticated Header
- Replace top-right controls with:
  1. Notification icon (outside, next to hamburger menu).
  2. Hamburger user context menu.
- Menu content order:
  1. User avatar
  2. Greeting (`Hi <nickname or first name>!`)
  3. `Profile`
  4. `Preferences`
  5. `Security`
  6. `Admin panel` (only for `admin` or `business`)
  7. Theme switcher
  8. Logout

## Information Architecture
- `Profile` page: editable identity/contact details.
- `Preferences` page: product behavior and unit preferences.
- `Security` page: authentication and account protection.
- `Notifications` panel/page: unread + historical notification stream.

## Data Model Plan

### Profile
- Preferred implementation: new `user_profiles` table keyed by `user_id`.
- Fields:
  - `first_name`
  - `last_name`
  - `nickname`
  - `address_line_1`
  - `address_line_2`
  - `city`
  - `state_region`
  - `postal_code`
  - `country_code`
- Keep `users.email` as source-of-truth for email with update flow + verification.

### Preferences
- New `user_preferences` table keyed by `user_id`.
- Fields:
  - `theme` (`light|dark|system`, default `light`)
  - `temperature_unit` (`F|C`)
  - `measurement_system` (`imperial|metric`)
  - `currency` (ISO 4217)
  - `preferred_pool_temp`
  - `notification_email_enabled`
  - `notification_sms_enabled` (future-ready)
  - `notification_push_enabled` (future-ready)
  - `notification_targets` (JSON: channels + destinations)

### Supervisor Relationship
- Add a relationship source for “List Supervisor account when present”.
- If pool-member model is canonical, expose supervisor from business/operator relationship via query projection.
- If account-level relationship is needed, add `user_supervisors` table (`user_id`, `supervisor_user_id`, `status`).

### Security
- Add `user_security` table or extend auth metadata:
  - `two_factor_enabled`
  - `two_factor_method`
  - `sso_provider`
  - `sso_subject`
  - `password_updated_at`

## API Plan

### Profile APIs
- `GET /me/profile`
- `PATCH /me/profile`
- `PATCH /me/email` (verification workflow)

### Preferences APIs
- `GET /me/preferences`
- `PATCH /me/preferences`

### Security APIs
- `POST /me/security/password`
- `POST /me/security/2fa/setup` (phase-gated)
- `POST /me/security/2fa/verify` (phase-gated)
- `DELETE /me/security/2fa` (phase-gated)
- `GET /me/security/sso` (phase-gated)

### Notifications APIs
- `GET /me/notifications?unreadOnly=&page=`
- `POST /me/notifications/:id/read`
- `POST /me/notifications/read-all`

## Implementation Phases

## Phase 1: Header and Menu Shell
### Deliverables
- Add notification icon next to hamburger.
- Build authenticated context menu with exact required order.
- Keep unauthenticated header as login/register only.
- Move theme switcher into context menu.
- Keep existing direct admin top-nav links temporarily during transition.

### Acceptance Criteria
- No `Logout` button outside menu.
- Admin panel link only appears for `admin|business`.
- Unauthenticated users see light theme by default.

## Phase 2: Admin Navigation Consolidation
### Deliverables
- Create Admin panel parity checklist for all current admin destinations:
  - Pools
  - Users
  - API tokens
  - Audit log
  - Notifications
  - Chemicals
- Ensure all admin routes are reachable from `/admin` landing page.
- Remove direct admin links from top header navigation after parity is complete.
- Keep only `Admin panel` entry in user context menu for admin/business users.

### Acceptance Criteria
- Top header has no direct admin links after cutover.
- All admin functions remain reachable through the Admin panel.
- Business users only see business-allowed destinations in Admin panel.

## Phase 3: Profile Management
### Deliverables
- New profile page and form.
- Editable fields:
  - First name
  - Last name
  - Nickname
  - Address
  - Email address
  - Supervisor account display (read-only at minimum in this phase)
- Greeting falls back in order: `nickname -> first_name -> email local part`.

### Acceptance Criteria
- Profile persists and reloads correctly.
- Greeting updates immediately after save.

## Phase 4: Preferences
### Deliverables
- Preferences page with:
  - Notification management
  - Preferred pool water temperature
  - Fahrenheit/Celsius
  - Metric/Imperial
  - Currency
  - Theme (`light|dark|system`, default selectable and saved)

### Acceptance Criteria
- Preferences are user-scoped and survive sessions/devices.
- Unauthorized visitors always default to light.

## Phase 5: Security Settings
### Deliverables
- Password update flow (current password + new password + confirm).
- 2FA section with staged “coming soon” or partial enable depending readiness.
- SSO section with staged “coming soon” unless provider integration is ready.

### Acceptance Criteria
- Password updates invalidate old sessions (except current session policy as decided).
- Clear status visibility for 2FA/SSO state.

## Phase 6: Notifications Center
### Deliverables
- Bell icon unread badge.
- Notification list with unread/historical views.
- Mark-as-read + mark-all-read.

### Acceptance Criteria
- Badge count matches unread records.
- Notification preference toggles affect delivery behavior.

## Phase 7: Future-Ready Messaging and Billing Hooks
### Deliverables
- Reserve navigation slots and capability keys:
  - `messages.read`, `messages.send`
  - `billing.read`, `billing.manage`
- Data contract placeholders (no full product implementation yet).
- Audit logging for sensitive account actions.

### Acceptance Criteria
- New modules can be added without reworking account navigation architecture.

## Capability and Access Model
- Reuse centralized capability framework.
- Add capabilities:
  - `account.profile.read`, `account.profile.update`
  - `account.preferences.read`, `account.preferences.update`
  - `account.security.read`, `account.security.update`
  - `notifications.read`, `notifications.manage`
  - `admin.panel.access`
- Role defaults:
  - `admin`: full
  - `business`: admin panel access + business domain capabilities
  - `member`: non-admin account capabilities

## Audit and Compliance Guardrails
- Audit-log these events:
  - Profile updates
  - Preference updates
  - Password changes
  - 2FA enable/disable
  - SSO link/unlink
  - Notification preference changes
- Never log plaintext secrets, passwords, tokens, or OTP values.

## Testing Plan
1. Unit tests:
- Greeting fallback logic.
- Preference normalization and defaults.
- Capability gating for menu items.

2. API integration tests:
- Profile read/update.
- Preferences read/update.
- Password change flow.
- Notifications read/mark-read.

3. UI tests:
- Header state unauthenticated vs authenticated.
- Menu ordering and visibility.
- Admin panel conditional rendering.
- Light theme default for unauthenticated visitors.

## Open Questions (Recommended Decisions)
1. Email change verification:
- Recommended: require verification to new email before switching login identifier.
2. Address format:
- Recommended: structured fields + optional formatted preview.
3. 2FA method priority:
- Recommended: TOTP first, SMS later.
4. SSO provider:
- Recommended: OIDC-first abstraction (Google/Microsoft/Okta via provider config).
5. Supervisor display source:
- Recommended: account-level mapping table if relationship is broader than one pool.

## Feedback on Your Requirements
- You did not say anything wrong; this is a strong product direction.
- The only critical additions to avoid rework later:
  - Explicit email-change verification flow.
  - Capability keys for each new menu domain.
  - Notification data model now (even if delivery channels roll out gradually).
  - Session invalidation policy after password/security changes.
