# Studio CRM — Full-Stack Demo

Multi-module CRM for outstaff/talent agencies. Public demo with read-write sandbox.

**Live demo:** https://crm.ekuznetsov.dev — auto-login as `demo@studio.crm`. The shared sandbox can be reset to clean fixtures at any time by clicking **Reset** in the demo banner.

![Stack](https://img.shields.io/badge/Backend-Django%205%20%2B%20DRF%20%2B%20Channels-green?style=flat-square)
![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%20%2B%20Tailwind-blue?style=flat-square)
![DB](https://img.shields.io/badge/DB-Postgres%2016%20%2B%20Redis%207-purple?style=flat-square)
![Demo](https://img.shields.io/badge/Demo-shared%20sandbox-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## What it does

A complete CRM workflow in one app:

| Module | What it covers |
|--------|----------------|
| **Dashboard** | KPI cards (active clients, pipeline value, my tasks, total deals, conversion), sales funnel with conversion rates, AI-powered Next Best Action, top managers leaderboard |
| **Leads** | Inbound lead capture, qualification, conversion to clients/deals |
| **Clients** | Company profiles, contacts, ratecards, tech stack, status pipeline, AI-assisted enrichment |
| **Deals** | Kanban + table view, stages, probability, value, dnd-kit drag-and-drop, item lines, AI summary + draft email + resource match |
| **Tasks** | Linked to clients/deals, priorities, deadlines, assignment |
| **Calendar** | Events, reminders, busy slots, integration with tasks/deals |
| **Chat** | Telegram-grade team chat — see [Chat features](#chat-telegram-grade) below |
| **KPI** | Per-user goals, team scoreboards, period comparisons |
| **Backlog** | Idea tracking with voting and lifecycle (idea → in_progress → testing → done) |
| **Reports** | Deals / clients / tasks export to CSV with filters and grouping |
| **Bench** | Available specialists roster (AI-augmented) |
| **Search** | Global full-text across all entities |
| **Settings** | Workspace, team, custom fields, pipelines, dictionaries, integrations |

## Live demo — shared sandbox

The public demo on `crm.ekuznetsov.dev` is read-write but bounded:

- **No login.** `BYPASS_AUTH=true` auto-authenticates everyone as `demo@studio.crm` (workspace owner).
- **One shared database.** Visitors see and edit the same dataset. WebSocket chat, KPI scoreboards, and team calendar would not be meaningful per-cookie.
- **Manual reset.** A button in the demo banner triggers a flush + reseed via `POST /api/demo/reset`.
- **AI keys are server-only.** DeepSeek / Anthropic keys live in `.env` on the server. Frontend never sees them.

## Chat — Telegram-grade

The team chat is built to feel like a Telegram replacement, not a basic message list:

- **Voice messages** with live waveform during recording, custom playback bubble with click-to-seek progress
- **Typing indicators** — animated dots + "X is typing…" debounced over WebSocket
- **Online presence** — green dot + "last seen 5 min ago" / "online" everywhere a user appears (DM header, group member list)
- **Read receipts** — single ✓ for sent, double ✓✓ once any other channel member has loaded the message
- **Reply** + **Forward** with `Forwarded from <author>` source preview
- **Pin messages** with navigable pinned banner at the top
- **Reactions** with optimistic UI (instant flip — REST fires in background)
  - Long-press / right-click on a bubble: picker bar above + action menu below (Telegram-style anchored layout, dim backdrop, lifted bubble z-index, haptic vibration on Android)
  - Click your own reaction badge to remove it; click someone else's to add yours
- **Edit your messages** inline, Enter to save, Esc to cancel, `(edited)` marker
- **Delete for everyone** with WS broadcast — sub-second propagation
- **Members panel** — add by email/name search, kick from group; presence dots next to each row
- **Media gallery** — three tabs (image / audio / file) over the channel's last 200 attachments
- **@mentions** with autocomplete + dedicated mention inbox
- **Search** within a channel, click-to-jump-and-highlight result
- **Mobile single-pane** — channel list ↔ message panel with back chevron (no Telegram-style split forced onto small screens)
- **iOS-friendly** — native `Copy / Search with Google` long-press menu suppressed; only the in-app picker shows
- **Image lightbox**, file attachments, audio messages
- **AI sentiment analysis** of channel mood (DeepSeek-powered)

WebSocket events: `message`, `reaction`, `typing`, `message_edited`, `message_deleted`, `presence`, `message_read`.

REST endpoints for chat operations:
- `POST /api/chat/messages/<id>/react/`  — toggle reaction (used as primary path, WS broadcasts to peers)
- `POST /api/chat/messages/<id>/forward/` — repost into another channel
- `PATCH /api/chat/messages/<id>/`        — edit own text
- `DELETE /api/chat/messages/<id>/`       — delete-for-all
- `GET   /api/chat/<channel>/search/?q=`  — full-text-ish search
- `GET   /api/chat/<channel>/presence/`   — member online + last_seen
- `POST  /api/chat/<channel>/mark-read/`  — record read receipts
- `POST  /api/chat/<channel>/members/`    — add to group
- `DELETE /api/chat/<channel>/members/<uid>/` — kick from group
- `GET   /api/chat/<channel>/media/?kind=image|audio|file` — gallery

## Tech stack

- **Backend:** Django 5 + DRF + Channels (ASGI), Daphne, async background tasks
- **Frontend:** React 19 + Vite + Tailwind v4 + dnd-kit + zustand + i18next (RU/EN)
- **Database:** Postgres 16 (primary) + Redis 7 (channel layer + cache)
- **Auth:** JWT (production) or `BYPASS_AUTH=true` (demo)
- **Realtime:** Django Channels WebSocket for chat
- **Deploy:** docker compose, nginx (frontend), Caddy (TLS), GitHub Actions CI/CD
- **Design system:** terminal-style monospace dark theme — see `design-system/`

## Architecture in one screen

```
Browser (React SPA, Vite build)
          │
          ▼
┌─────────────────────┐
│ nginx :3500 → :80   │   multi-stage Docker: Vite build → nginx:alpine
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

Full topology: see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started (local)

Requires Docker Desktop.

```bash
git clone https://github.com/kuznetsov-ai/crm.git
cd crm

# 1. create .env (gitignored)
cp backend/.env.example .env
# adjust DB_PASSWORD, SECRET_KEY, AI keys (optional)

# 2. bring up the stack
docker compose -p studio-crm up -d --build

# 3. wait for migrations + seed_demo to load
docker compose -p studio-crm logs -f backend   # look for "Listening on TCP address 0.0.0.0:8000"
```

Open `http://localhost:3500`. With `BYPASS_AUTH=true` you land directly on `/dashboard`.

## Repository structure

```
crm/
├── backend/                 # Django 5 + DRF + Channels
│   ├── apps/                # 22 Django apps (clients, deals, leads, tasks, chat, kpi, demo, …)
│   ├── config/              # settings, urls, asgi, wsgi
│   └── Dockerfile
│
├── frontend/                # React 19 + Vite + Tailwind v4 + dnd-kit
│   ├── src/                 # api/, components/, pages/, stores/, hooks/, i18n/
│   ├── vite.config.ts
│   └── Dockerfile
│
├── design-system/           # terminal-style design tokens + eds-* components
├── idev-ui/                 # legacy internal UI lib (still imported by some pages)
├── testMe/                  # Titan E2E / visual-regression scenarios
├── docs/
│   ├── ARCHITECTURE.md      # full topology, models, WS, demo-mode
│   └── DEPLOY.md            # Silver Server bootstrap, GitHub Actions, Caddy, Cloudflare
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
| `BYPASS_AUTH` | `true` (demo) | Auto-login as demo user |
| `DEMO_MODE` | `true` (demo) | Enables `/api/demo/reset` |
| `DEEPSEEK_API_KEY` | empty | Server-only |
| `ANTHROPIC_API_KEY` | empty | Server-only |
| `AI_PROVIDER` | `deepseek` | `anthropic` / `deepseek` / `openai` / `gemini` |
| `AI_MODEL` | `deepseek-v4-flash` | Override default model id |
| `ALLOWED_HOSTS` | localhost | Comma-separated |
| `CORS_ALLOWED_ORIGINS` | localhost:5173 | Comma-separated |
| `HOST_HTTP_PORT` | `3500` | Host port for nginx (only docker-compose) |

## Deployment

Hosted on Silver Server (Hetzner CX22) behind Caddy. The full stack runs as `docker compose` services, fronted by Caddy on 443.

**Auto-deploy on push to `main`** via GitHub Actions. Restricted SSH user `crm-deploy` rsyncs the repo, runs `docker compose -p studio-crm up -d --build`, smoke-tests `https://crm.ekuznetsov.dev/`.

Full bootstrap, ownership model, sudoers, Caddy block, Cloudflare DNS — see [docs/DEPLOY.md](docs/DEPLOY.md).

## Tests

`testMe/` holds Titan + Playwright E2E scenarios covering:

- Per-route content checks (Dashboard / Clients / Deals / Tasks / Backlog / KPI / Chat / Calendar / Leads / Reports / Settings)
- Mobile (393×852) and tablet (768×1024) no-overflow across 11 routes
- Demo banner + reset endpoint
- Mobile drawer solidness (verifies `rgba` alpha = 1 — guards against the "see-through bagels" bug)
- Desktop sidebar collapse + localStorage persistence
- Mobile screenshots of every route (visual evidence per run)

Run from a Titan checkout:

```bash
.venv/bin/python -m cli test \
  --system config/systems/crm.yaml \
  --scenario crm
```

Current state: **18/18 passing**.

## License

MIT
