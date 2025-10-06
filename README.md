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
├── docs/         # Documentation, diagrams, cline goals
├── docker-compose.yml
├── .woodpecker.yml
├── .gitignore
└── README.md

---

## 🛠️ Developer Tooling

Common workflows are available through pnpm scripts from the repository root:

- `pnpm lint` — run ESLint for both the API and web app plus `svelte-check` for Svelte-specific diagnostics.
- `pnpm format:check` — verify Prettier formatting across API and web sources.
- `pnpm test` — execute API unit tests (Redis interactions are mocked).
- `pnpm test:web` — execute SvelteKit unit/component tests with Vitest.
- `pnpm test:web:e2e` — run Playwright end-to-end smoke tests against a local preview build of the web app.
- `pnpm test:e2e` — launch the Docker Compose stack (Postgres + Redis + API) and run smoke tests that cover the login/session lifecycle.

> ℹ️ Playwright requires browser binaries. Install them once with `pnpm --dir web exec playwright install --with-deps`.

## ✅ Continuous Integration

GitHub Actions automatically runs linting, formatting, unit tests, and the Docker-based smoke test workflow for every pull request and pushes to the `main` branch. The workflow definition lives at [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
