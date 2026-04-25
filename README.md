# Studio CRM — Full-Stack Demo

Multi-module CRM for outstaff/talent agencies. Public demo with read-write sandbox.

**Live demo:** https://crm.ekuznetsov.dev — auto-login as `demo@studio.crm`. The shared sandbox can be reset to clean fixtures at any time by clicking **Reset** in the demo banner.

![Stack](https://img.shields.io/badge/Backend-Django%205%20%2B%20DRF%20%2B%20Channels-green?style=flat-square)
![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%20%2B%20Tailwind-blue?style=flat-square)
![DB](https://img.shields.io/badge/DB-Postgres%2016%20%2B%20Redis%207-purple?style=flat-square)
![Demo](https://img.shields.io/badge/Demo-shared%20sandbox%20%2B%20auto--reset-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## What it does

A complete CRM workflow in one app:

| Module | What it covers |
|--------|----------------|
| **Dashboard** | KPI cards (revenue, pipeline, win rate, active deals), recent activity, quick actions |
| **Leads** | Inbound lead capture, qualification, conversion to clients/deals |
| **Clients** | Company profiles, contacts, ratecards, tech stack, status pipeline |
| **Deals** | Kanban + table view, stages, probability, value, dnd-kit drag-and-drop |
| **Tasks** | Linked to clients/deals, priorities, deadlines, assignment |
| **Calendar** | Events, reminders, busy slots, integration with tasks/deals |
| **Chat** | Team chat (WebSocket), channels, replies, reactions, file attachments |
| **KPI** | Per-user goals, team scoreboards, period comparisons |
| **Backlog** | Idea tracking with voting and lifecycle (idea → in_progress → testing → done) |
| **Reports** | Funnel charts, conversion rates, period analytics |
| **Search** | Global full-text across all entities |
| **Settings** | Workspace, team, custom fields, integrations |

## Live demo — shared sandbox

The public demo on `crm.ekuznetsov.dev` is read-write but bounded:

- **No login.** `BYPASS_AUTH=true` auto-authenticates everyone as the demo user.
- **One shared database.** Visitors see and edit the same dataset. This is by design — the WebSocket chat, KPI scoreboards, and team calendar would not be meaningful per-cookie.
- **Manual reset.** A button in the demo banner triggers an immediate flush + reseed.
- **AI / external integrations are stubbed.** Endpoints that would call DeepSeek, Anthropic, or HH return canned responses in demo mode — no keys exposed.

## Tech stack

- **Backend:** Django 5 + DRF + Channels (ASGI), Daphne, async background tasks
- **Frontend:** React 19 + Vite + Tailwind v4 + dnd-kit + zustand + i18next (RU/EN)
- **Database:** Postgres 16 (primary) + Redis 7 (channel layer + cache)
- **Auth:** JWT (production) or `BYPASS_AUTH=true` (demo)
- **Realtime:** Django Channels WebSocket for chat
- **Deploy:** docker compose, nginx (frontend), Caddy (TLS)

## Architecture in one screen

```
Browser (React SPA, Vite build)
          │
          ▼
┌─────────────────────┐
│ nginx :80           │   multi-stage Docker: Vite build → nginx:alpine
│  /            dist/ │
│  /api/* ─┐          │
│  /ws/*  ─┼── backend│
│  /media/*┘          │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐       ┌────────────┐     ┌────────────┐
│ backend :8000       │◄─────►│ Postgres 16│     │  Redis 7   │
│ Django 5 + DRF      │       │ studio_crm │     │  channels  │
│ Channels (ASGI)     │       └────────────┘     └────────────┘
│ Daphne              │
└─────────────────────┘
```

## Getting started (local)

Requires Docker Desktop.

```bash
git clone https://github.com/kuznetsov-ai/crm.git
cd crm

# 1. create .env (gitignored — keep your own)
cp backend/.env.example .env
# adjust DB_PASSWORD, SECRET_KEY, AI keys if you want them live

# 2. bring up the stack
docker compose up -d --build

# 3. wait for migrations + fixtures to load
docker compose logs -f backend   # look for "Listening on TCP address 0.0.0.0:8000"
```

Open `http://localhost:3300`. With `BYPASS_AUTH=true` you land directly on the dashboard.

## Repository structure

```
crm/
├── backend/                 # Django 5 + DRF + Channels
│   ├── apps/                # 21 Django apps (clients, deals, tasks, chat, kpi, …)
│   ├── config/              # settings, urls, asgi, wsgi
│   ├── fixtures/            # demo seed data
│   └── Dockerfile
│
├── frontend/                # React 19 + Vite + Tailwind v4 + dnd-kit
│   ├── src/                 # api/, components/, pages/, stores/, hooks/, i18n/
│   ├── vite.config.ts
│   └── Dockerfile
│
├── idev-ui/                 # internal design system (tokens + components)
├── testMe/                  # Titan E2E / visual-regression scenarios
├── nginx.conf               # reverse-proxy config (api / ws / media)
└── docker-compose.yml
```

## Configuration

Environment variables (in `.env`):

| Var | Default | Description |
|-----|---------|-------------|
| `SECRET_KEY` | required | Django secret |
| `DB_NAME` | `studio_crm` | Postgres database name |
| `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | postgres/postgres/db/5432 | Postgres connection |
| `REDIS_URL` | `redis://redis:6379/0` | Channel layer + cache |
| `BYPASS_AUTH` | `true` (demo) | Auto-login as the demo user |
| `DEMO_MODE` | `true` (demo) | Stubs AI/HH integrations, enables reset endpoint |
| `DEEPSEEK_API_KEY` | empty | Optional, server-only |
| `ANTHROPIC_API_KEY` | empty | Optional, server-only |
| `ALLOWED_HOSTS` | localhost | Comma-separated |
| `CORS_ALLOWED_ORIGINS` | localhost:5173 | Comma-separated |

## Deployment (crm.ekuznetsov.dev)

Hosted on Silver Server (Hetzner) behind Caddy. The full stack runs as `docker compose` services, fronted by Caddy on 443.

Auto-deploy on push to `main` via GitHub Actions. Restricted SSH user `crm-deploy` rsyncs the repo, runs `docker compose up -d --build`, smoke-tests the public URL.

See `docs/ARCHITECTURE.md` for the full path.

## Tests

`testMe/` holds Titan + Playwright E2E scenarios covering pages, actions, and the demo sandbox at three viewports (393 / 768 / 1440).

## License

MIT
