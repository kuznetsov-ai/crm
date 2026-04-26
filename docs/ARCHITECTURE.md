# Studio CRM — Architecture

## Topology

```
                                    ┌──────────────────────┐
                                    │  Cloudflare DNS      │
                                    │  crm.ekuznetsov.dev  │
                                    │  → 89.167.108.210    │
                                    │  (DNS-only)          │
                                    └──────────┬───────────┘
                                               │ HTTPS :443
                                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Silver Server (Hetzner CX22, Ubuntu)                         │
│                                                              │
│  ┌────────────────────────┐                                  │
│  │ Caddy (system service) │  Let's Encrypt cert auto-renew   │
│  │ :443 → :3500           │  HTTP/2, gzip                    │
│  └──────────┬─────────────┘                                  │
│             │                                                │
│             ▼                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ docker compose project: studio-crm                   │    │
│  │                                                      │    │
│  │  studio-crm-nginx :3500→:80                          │    │
│  │   ├─ /            → /usr/share/nginx/html (Vite dist)│    │
│  │   ├─ /api/*       → backend:8000                     │    │
│  │   ├─ /ws/*        → backend:8000 (WebSocket)         │    │
│  │   ├─ /admin/      → backend:8000                     │    │
│  │   ├─ /static/     → backend:8000                     │    │
│  │   └─ /media/      → /app/media (volume)              │    │
│  │                                                      │    │
│  │  studio-crm-backend :8000 (internal only)            │    │
│  │   Daphne ASGI · Django 5 · DRF · Channels            │    │
│  │                                                      │    │
│  │  studio-crm-db (Postgres 16-alpine, internal)        │    │
│  │  studio-crm-redis (Redis 7-alpine, internal)         │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

Only `studio-crm-nginx` exposes a host port (`3500`). Everything else is reachable only via the internal docker network — no Postgres/Redis exposure to the public internet.

## Backend layout (Django 5)

22 apps live under `backend/apps/`:

| App | Responsibility |
|-----|---------------|
| `users` | Custom `User` (email-based, with `last_seen`), JWT auth, BypassAuthentication for demo, role permissions |
| `workspaces` | Multi-tenant `Workspace` + `Membership`. Every business entity has `workspace_id` FK |
| `clients` | `Client`, `Contact`, `RateCard`, `ClientNote`, `BenchPerson`, custom-fields glue |
| `deals` | `Deal`, stages, `DealItem` (line items), renewals, document linking |
| `leads` | Inbound lead capture; converts to client + deal |
| `tasks` | `Task` linked to client/deal, priority, deadline, assigned_to |
| `chat` | `ChatChannel`, `ChatMessage`, `ChatReaction`, `ChatMention`, `ChatMessageRead`. `ChatMessage` has `forwarded_from` self-FK. ASGI consumer for realtime |
| `events` | Calendar events with reminders |
| `calendar` | Calendar API surface (events + free/busy) |
| `kpi` | Per-user KPI cards, period aggregations |
| `backlog` | Kanban-style ideas tracker (idea → in_progress → testing → done) |
| `dashboard` | Funnel, period stats, profitability roll-up, global search |
| `pipelines` | Custom deal pipelines per workspace |
| `dictionaries` | Reference data (industries, statuses, etc.) |
| `custom_fields` | Configurable fields per workspace |
| `activities` | Activity feed (who did what when) |
| `favorites` | Per-entity favorites |
| `products` | Service/product catalog used in deal items |
| `webhooks` | In/out webhooks with HMAC signature (`X-Studio-Signature`) |
| `ai` | Unified LLM client (Anthropic / DeepSeek / OpenAI-compat / Gemini), AI views (deal summary, draft email, sentiment, lead enrich, NBA, bench, candidate match, transcript) |
| `demo` | `/api/demo/info` + `/api/demo/reset` endpoints |

### LLM provider selection

`apps/ai/client.py` auto-selects a provider based on env vars (or `AI_PROVIDER` override):

1. `anthropic` — Claude Sonnet (production default if both keys set)
2. `deepseek` — `deepseek-v4-flash` (cheap, OpenAI-compatible — current demo default)
3. `openai` — generic OpenAI-compatible (Groq, Together, OpenRouter, Moonshot via `OPENAI_API_BASE`)
4. `gemini` — Gemini 2.0 Flash
5. `stub` — falls back to a placeholder text describing how to configure a provider

Errors from any provider surface inside the AI output rather than 500'ing the request.

### WebSocket protocol

`backend/apps/chat/consumers.py` is the `ChatConsumer`. URL: `wss://.../ws/chat/<channel_id>/?token=<jwt>&ws=<workspace_slug>`.

**Server → client events:**

| Type | Payload |
|------|---------|
| `message` | `{message: ChatMessage}` |
| `reaction` | `{result: {message_id, emoji, action, user_id}}` |
| `typing` | `{user_id, user_name, is_typing}` (own events filtered out) |
| `message_edited` | `{message: ChatMessage}` |
| `message_deleted` | `{message_id}` |
| `presence` | `{user_id, user_name, online, last_seen}` (broadcast on connect/disconnect) |
| `message_read` | `{message_id, user_id, read_at}` (broadcast when someone marks as read) |

**Client → server events:**

| Type | Payload |
|------|---------|
| `message` | `{text, reply_to?}` |
| `reaction` | `{message_id, emoji}` (toggle — kept as fallback only; primary path is REST) |
| `typing` | `{is_typing}` |

### Why reactions go through REST instead of WS

In React 19, `e.stopPropagation()` on a synthetic event does **not** stop the
native DOM bubble. The reaction picker had a document-level `mousedown` listener
(close-on-click-outside) that fired in the same tick as the click on the emoji
button — even with `stopPropagation`. The result: the click handler ran but the
WS frame queued by `wsRef.send(JSON.stringify(...))` was sometimes dropped
on iOS Safari and Chromium. Backend never received the frame, no
`ChatReaction` row was created.

Switching reactions to **REST `POST /api/chat/messages/<id>/react/`** (which
broadcasts via `chat_reaction` to the same WS group) eliminated the race
entirely. The WS reaction handler is kept as a fallback for code paths that
already had it wired.

The frontend additionally uses **optimistic UI**: `setMessages` flips the
local state synchronously, then `chatApi.messages.react()` runs in the
background. On error the messages list is reloaded from the server.

### REST endpoints (chat)

```
POST   /api/chat/messages/<id>/react/         { emoji }   toggle reaction
POST   /api/chat/messages/<id>/forward/       { channel_id } repost into another channel
PATCH  /api/chat/messages/<id>/               { text }    edit own message
DELETE /api/chat/messages/<id>/                          delete-for-all (broadcasts)
GET    /api/chat/<channel>/search/?q=                    full-text-ish search
GET    /api/chat/<channel>/presence/                     member online + last_seen
POST   /api/chat/<channel>/mark-read/         { message_ids: [..] }  read receipts
POST   /api/chat/<channel>/members/           { user_ids: [..] }  add to group
DELETE /api/chat/<channel>/members/<uid>/                kick from group
GET    /api/chat/<channel>/media/?kind=image|audio|file  gallery (last 200)
POST   /api/chat/<channel>/messages/          (multipart) send with optional attachment
```

### Long-press / right-click context menu — Telegram-style

Triggered by:
- **Right-click** (desktop) — `onContextMenu` handler
- **Long-press ≥ 500ms** (touch) — single `setTimeout` started on `touchstart`,
  cancelled by `touchend` / `touchmove`. Fires `navigator.vibrate(15)` on
  Android for haptic feel.

Layout (anchored to the bubble's `getBoundingClientRect()`, not click coords):
- **Reaction picker** rendered above the bubble (or below if no room)
- **Action menu** (Reply / Forward / Pin / Copy / Edit / Delete) below
- Both align horizontally to the bubble edge: own messages → right-aligned, others → left
- A `position:fixed` backdrop with `bg-black/40 backdrop-blur-[2px]` dims the rest
- The active bubble is lifted to `z-50` so it visually "stays" on top
- iOS native `Copy / Search with Google` selection menu is suppressed via
  `-webkit-touch-callout: none` + `user-select: none` on the chat root

## Frontend layout (React 19 + Vite)

```
frontend/src/
├── api/             # axios clients per backend module (clients.ts, deals.ts, chat.ts, demo.ts, …)
├── components/
│   ├── layout/      # AppLayout, Sidebar, Header, DemoBanner, NotificationBell, WorkspaceSwitcher
│   ├── chat/        # EmojiPicker, VoiceRecorder, AudioMessage
│   ├── clients/     # ClientStatusBadge, RiskBadge, BulkActionBar, CsvImportModal, CreateClientModal
│   ├── deals/       # DealItemsTable, kanban pieces
│   ├── search/      # GlobalSearch (Cmd+K)
│   ├── settings/    # WebhooksSection, …
│   ├── ai/          # LeadEnrichModal
│   └── common/      # StarButton, …
├── pages/           # one file per route — Dashboard, Clients, Deals, Tasks, Chat, Calendar, …
├── stores/          # zustand: auth, ui, favorites, workspace, currency
├── hooks/           # useChatSocket
└── i18n/            # ru.json, en.json
```

State is intentionally not over-engineered: zustand stores for cross-cutting concerns, page-local `useState` for everything else. No global query client — each page component owns its `useEffect` + axios call.

### Design system

`design-system/` (drop-in CSS, no build) — terminal-style monospace dark theme with palette swap (`data-palette="orange-warm" | "blue-cool" | "violet-dawn" | "matcha"`).

Applied two ways:

1. **Token bridge in `frontend/src/index.css`** — overrides legacy CSS vars (`--bg-card`, `--text`, `--accent` …) so existing Tailwind components inherit the dark/orange theme without per-component changes.
2. **`eds-*` opt-in classes** — used directly where the terminal aesthetic is the goal: KPI cards (`eds-stat`), demo banner (`eds-mono-label`), Sidebar logo, reset confirm (`eds-panel--accent`), buttons (`eds-btn`).

Anti-overflow defenses live at the bottom of `index.css` under `@media (max-width: 860px)`:
- `html, body { overflow-x: hidden }` — last-line clip.
- `main *  { min-width: 0 }` — lets CSS Grid/Flex children actually shrink.
- `[style*="grid-template-columns"] { grid-template-columns: 1fr !important }` — flattens inline 2-/3-column grids.
- `table { display: block; overflow-x: auto; white-space: nowrap; }` — wide tables scroll inside their card, never the page.
- `.col-hide-mobile` — opt-in column hiding.

## Demo mode

`DEMO_MODE=true` + `BYPASS_AUTH=true` in `.env` activate the public sandbox.

### `BypassAuthentication` (`apps/users/authentication.py`)

Custom DRF auth class that auto-resolves the request user as `demo@studio.crm`, ensures `Membership` in the `demo` workspace, and primes `request.user.current_workspace`.

If the user doesn't exist (e.g. right after a `flush`), it returns `None` and DRF falls through to `AllowAny` — every endpoint becomes anonymous-readable until `seed_demo` runs.

### `seed_demo` management command

`apps/workspaces/management/commands/seed_demo.py` is the single source of truth for demo data:

- Roles (Admin / Sales Manager / Recruiter / Viewer)
- 6 users — `demo@studio.crm` (owner) + 5 teammates (`alex|priya|marcus|elena|jamal@demo.local`)
- `demo` workspace with all 6 as Memberships
- 12 clients spanning industries (IT, Finance, E-commerce, Healthcare, Retail, Logistics, Gaming, …)
- 16 deals across all stages (new_lead, discovery, proposal, negotiation, active, closed, lost)
- 30 leads with random sources / quality scores
- Custom fields, KPI rows, sample chat messages, backlog items

Idempotent by default (skips if `Client.objects.count() > 5`). Pass `--force` to flush + reseed.

Deterministic via `DEMO_SEED` env var (default `42`) — the same seed always produces the same dataset.

### Reset endpoint (`apps/demo/views.py`)

`POST /api/demo/reset` (only when `DEMO_MODE=true`):

1. Filesystem lock (`/tmp/studio_crm_demo_reset.lock`) — concurrent calls return `429`.
2. `flush --no-input` wipes every row.
3. `seed_demo --force` repopulates.
4. Stamp `/tmp/studio_crm_demo_reset.stamp` for `/api/demo/info`.

`GET /api/demo/info` (always public when DEMO_MODE):

```json
{
  "demo_mode": true,
  "last_reset": 1777143237.97,
  "last_reset_iso": "2026-04-25T19:53:57Z",
  "reset_interval_hours": 24,
  "demo_user_email": "demo@studio.crm"
}
```

There is **no automatic cron / systemd timer** — the only reset happens when someone clicks the button. Day-to-day, the sandbox accumulates whatever visitors do, and stays that way until the next manual reset.

## Mobile / responsive

Three breakpoints supported by both the Tailwind `md:` prefix (768px) and the global anti-overflow CSS (860px):

- **Mobile (≤ 767px / actually tested 393):** sidebar becomes off-canvas drawer with backdrop. Burger button in Header toggles it. KPI grid drops to 2 columns. Inline grid templates flatten to `1fr`. Tables scroll horizontally inside their card, not as a page.
- **Tablet (768–860):** sidebar pinned 240px, but anti-overflow CSS still active until 860 because some nested grids only fit at 860+.
- **Desktop (> 860):** full layout. Sidebar can be collapsed to 64px icon rail via the chevron at the **bottom of the sidebar** (single button — no duplicate in Header). Collapsed state persists in `localStorage('crm_sidebar')`.

Drawer uses `var(--bg-card-solid)` (`#0a0e14`, opaque). Earlier semi-transparent `var(--bg-card)` made it see-through on mobile — a regression Titan S14 specifically guards against now.

## Security boundaries

- **No login on demo.** This is by design. The frontend has no privileged actions reachable from the public page.
- **AI keys are server-only.** Frontend talks to `/api/ai/*` which proxies through Django; raw provider keys never leave the container.
- **Postgres / Redis are not exposed to the host.** Only nginx binds a port (`3500`).
- **CSRF.** DRF endpoints accept JWT (or BypassAuth) — no cookie-session flows in the API.
- **Ownership of `/opt/crm`** is `crm-deploy:crm` with setgid. The `crm` system user has no shell login. The `crm-deploy` user can rsync + `docker compose` only (sudoers locked).
- **Webhooks** sign payloads with HMAC-SHA256 in `X-Studio-Signature` header.

## What's deliberately not built

- **Per-cookie tenancy.** WebSocket chat, KPI scoreboards, and team calendar lose their meaning per-visitor. We chose shared state + reset button instead.
- **End-to-end encryption in chat.** It's a CRM demo, not a privacy product.
- **Mobile native apps.** Mobile web is the contract.
- **Real-time collaborative editing.** Out of scope — we ship per-record CRUD with WS notifications, not OT/CRDT.
