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
