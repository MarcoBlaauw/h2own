# 💧 H2Own

**Smart Pool Chemistry Advisor** — a lean open-source platform to help pool owners track, predict, and optimize water chemistry.

---

## 📌 Overview

H2Own lets you:

- Enter and track **water test results** per pool
- Store and manage **chemicals** and their effects on water properties
- Run **recommendation algorithms** to adjust chemistry efficiently
- Suggest **next tests** and when to perform them
- Import **weather data** per location to explain water property changes
- Track **usage & features** (bathers, bubbler/sprinkler activity, refills)
- Visualize **trends over time** with charts and reports
- Send **reminders and notifications** via email
- Manage **users, roles, and pools** with an admin panel

---

## 📂 Project Structure

```text
h2own/
├── api/          # Fastify backend (TypeScript, Drizzle ORM)
├── web/          # SvelteKit + Tailwind frontend
├── db/           # SQL migrations & seed data
├── docs/         # Documentation, diagrams, implementation plan
├── docker-compose.yaml
├── docker-compose.release.yaml
├── .woodpecker.yml
├── .gitignore
└── README.md

---

## 🛠️ Developer Tooling

Common workflows are available through pnpm scripts from the repository root:

- `pnpm dev` — run the API and web app in watch mode for live-reload development.
- `pnpm lint` — run ESLint for both the API and web app plus `svelte-check` for Svelte-specific diagnostics.
- `pnpm format:check` — verify Prettier formatting across API and web sources.
- `pnpm test` — execute API unit tests (Redis interactions are mocked).
- `pnpm test:web` — execute SvelteKit unit/component tests with Vitest.
- `pnpm test:cloud` — run Cloud-safe verification (`test`, `test:web`, `check`, and `audit --prod`) without requiring full web lint compliance.
- `pnpm test:web:e2e` — run Playwright end-to-end smoke tests against a local preview build of the web app.
- `pnpm test:e2e` — launch the Docker Compose release stack (Postgres + Redis + API) and run smoke tests that cover the login/session lifecycle.

Use Docker Compose for infrastructure only during development:

- `docker compose up -d` — start Postgres + Redis via `docker-compose.yaml`.
- `docker compose -f docker-compose.release.yaml up -d --build` — start the full Dockerized stack for release parity.

> ℹ️ Playwright requires browser binaries. Install them once with `pnpm --dir web exec playwright install --with-deps`.

## 🚀 Frontend Onboarding Cheatsheet

The web app’s theme is powered by CSS custom properties in [`web/src/lib/styles/tokens.css`](web/src/lib/styles/tokens.css) and Tailwind component utilities in [`web/src/app.css`](web/src/app.css). When you need to extend the design system:

1. **Add or tweak a semantic token.** Update `tokens.css` with a light and dark value for the new `--color-*`, `--shadow-*`, or typography variable. Tokens are stored as RGB tuples so Tailwind’s `withOpacityValue` helper can apply opacity modifiers.
2. **Expose the token in Tailwind.** Register the variable in [`tailwind.config.ts`](web/tailwind.config.ts) under the matching `theme.extend` section (for example, append to the `colorTokens` map or `spacing`). This enables `bg-{token}`/`text-{token}` utilities and keeps both modes in sync.
3. **Promote shared component styles.** If the change affects multiple components, create or update a utility class inside the `@layer components` block of `app.css` using `@apply`. These classes should consume tokens (e.g., `rgb(var(--color-accent))`) instead of hard-coded values so dark mode and future palette changes remain automatic.
4. **Document the addition.** Add a quick blurb to the relevant design or engineering doc (see [`docs/theme-review.md`](docs/theme-review.md)) so the next teammate knows which component class or token to reuse.

> ✅ Tip: After adding tokens or component classes, run `pnpm --filter web lint` to pick up Tailwind usage errors and `pnpm --filter web test:visual` to refresh Playwright visual baselines before opening a PR.

## ✅ Continuous Integration

GitHub Actions automatically runs linting, formatting, unit tests, and the Docker-based smoke test workflow for every pull request and pushes to the `main` branch. The workflow definition lives at [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
