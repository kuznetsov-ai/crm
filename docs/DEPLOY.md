# Studio CRM — Deployment

## Hosts

| Component | Host | Port |
|-----------|------|------|
| crm.ekuznetsov.dev | Caddy on Silver (Hetzner CX22) | 443 |
| nginx (docker) | Silver | 3500 (host) → 80 (container) |
| backend (Daphne) | Silver | 8000 (internal only) |
| Postgres 16 | Silver | internal docker network |
| Redis 7 | Silver | internal docker network |

Server: `89.167.108.210`. Caddy + docker run alongside other unrelated stacks (idev-crm on `:3300`, sentinel on `:3400`, etc.) — Studio CRM uses its own docker compose project name (`-p studio-crm`) and a unique host port.

## DNS

Cloudflare zone `ekuznetsov.dev`:

- `A crm → 89.167.108.210`, **proxied = false** (DNS-only).

DNS-only mode is required so Caddy can solve the HTTP-01 ACME challenge directly.

## TLS

Caddy auto-issues + auto-renews a Let's Encrypt cert. The Caddyfile block (in `/etc/caddy/Caddyfile` on Silver):

```
crm.ekuznetsov.dev {
    reverse_proxy localhost:3500
}
```

Reload after edits: `systemctl reload caddy` (validate first with `caddy validate --config /etc/caddy/Caddyfile`).

## User model on the server

Two system users back the deployment:

| User | Purpose | Shell | Sudoers |
|------|---------|-------|---------|
| `crm` | Owns running container files via group membership | nologin | none |
| `crm-deploy` | rsync + restarts via CI/CD | bash | `docker compose -f /opt/crm/docker-compose.yml *` and `--project-directory /opt/crm *` only |

`/opt/crm` is owned by `crm-deploy:crm`, mode `g+rwX` with **setgid** on directories so anything created by either user inherits `group=crm`. `crm-deploy` is also a member of the `docker` group so it can talk to the daemon without sudo for non-mutating commands.

A leaked deploy key cannot escalate beyond `docker compose` in `/opt/crm`.

## docker-compose

```yaml
services:
  db:      # postgres:16-alpine, internal-only, healthcheck on pg_isready
  redis:   # redis:7-alpine, internal-only
  backend: # built from backend/Dockerfile, expose 8000, runs migrations + seed_demo + Daphne
  nginx:   # built from frontend/Dockerfile (multi-stage Vite → nginx), publishes ${HOST_HTTP_PORT:-3500}:80
volumes:
  postgres_data
  media_data  # mounted into both backend and nginx for /media/
```

Project name is fixed to `studio-crm` via `-p studio-crm` to avoid clashes with other compose stacks on the same host.

## First-time bootstrap

(Run as root on Silver.)

```bash
# 1. Users & permissions
useradd --system --no-create-home --shell /usr/sbin/nologin crm
useradd -m -s /bin/bash crm-deploy
usermod -aG crm crm-deploy
usermod -aG docker crm-deploy

mkdir -p /opt/crm
chown -R crm-deploy:crm /opt/crm
chmod -R g+rwX /opt/crm
find /opt/crm -type d -exec chmod g+s {} \;

# 2. Sudoers — restrict to docker compose only
cat > /etc/sudoers.d/crm-deploy <<'EOF'
crm-deploy ALL=(root) NOPASSWD: /usr/bin/docker compose -f /opt/crm/docker-compose.yml *, /usr/bin/docker compose --project-directory /opt/crm *
EOF
chmod 440 /etc/sudoers.d/crm-deploy
visudo -cf /etc/sudoers.d/crm-deploy   # validate

# 3. SSH key for deploys (will be put in CRM_DEPLOY_KEY GitHub secret)
sudo -u crm-deploy mkdir -p /home/crm-deploy/.ssh
sudo -u crm-deploy ssh-keygen -t ed25519 -f /home/crm-deploy/.ssh/id_ed25519 -N "" -C "crm-deploy@silver"
cat /home/crm-deploy/.ssh/id_ed25519.pub >> /home/crm-deploy/.ssh/authorized_keys
chmod 600 /home/crm-deploy/.ssh/authorized_keys

# 4. Clone repo
cd /opt/crm
sudo -u crm-deploy git clone https://github.com/kuznetsov-ai/crm.git .

# 5. .env (NEVER commit)
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
DB_PASSWORD=$(python3 -c 'import secrets; print(secrets.token_urlsafe(20))')
cat > /opt/crm/.env <<ENV
SECRET_KEY=${SECRET_KEY}
DB_NAME=studio_crm
DB_USER=studio
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=db
DB_PORT=5432
REDIS_URL=redis://redis:6379/0
ALLOWED_HOSTS=crm.ekuznetsov.dev,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://crm.ekuznetsov.dev
DJANGO_SETTINGS_MODULE=config.settings.prod
DEMO_MODE=true
BYPASS_AUTH=true
DEEPSEEK_API_KEY=sk-...                # optional, server-only
ANTHROPIC_API_KEY=                     # optional, server-only
AI_PROVIDER=deepseek
AI_MODEL=deepseek-v4-flash
HOST_HTTP_PORT=3500
ENV
chown crm-deploy:crm /opt/crm/.env
chmod 640 /opt/crm/.env

# 6. Caddy block
cat >> /etc/caddy/Caddyfile <<'EOF'

crm.ekuznetsov.dev {
    reverse_proxy localhost:3500
}
EOF
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

# 7. First build & start
cd /opt/crm
sudo -u crm-deploy docker compose -p studio-crm up -d --build
```

Wait ~30 s, then `curl http://localhost:3500/` should return 200, and `https://crm.ekuznetsov.dev/` should return 200 once Caddy finishes the ACME flow.

## DNS record (Cloudflare API)

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone_id>/dns_records" \
  -H "X-Auth-Email: <cf_email>" \
  -H "X-Auth-Key: <cf_global_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"type":"A","name":"crm","content":"89.167.108.210","proxied":false,"ttl":1}'
```

## GitHub Actions auto-deploy

`.github/workflows/deploy.yml` triggers on push to `main` and on manual `workflow_dispatch`.

Repo secrets:

- `CRM_DEPLOY_KEY` — the **private** key from `/home/crm-deploy/.ssh/id_ed25519`. Set with `gh secret set CRM_DEPLOY_KEY --repo kuznetsov-ai/crm < id_ed25519`.

Workflow steps:

1. Checkout
2. Drop SSH private key into `~/.ssh/id_ed25519`, fingerprint Silver into `known_hosts`
3. `rsync -az --delete-after` to `crm-deploy@89.167.108.210:/opt/crm/`. Excludes:
   - `.git`, `.github`, `.env` — server-only state
   - `node_modules`, `**/__pycache__`, `**/.venv`
   - `frontend/dist`, `backend/media`
4. `ssh crm-deploy@…` runs `sudo /usr/bin/docker compose --project-directory /opt/crm -p studio-crm up -d --build`
5. Smoke-test `curl https://crm.ekuznetsov.dev/`, retry up to 5× with 5 s gaps

A successful deploy takes **~40 seconds** on a warm cache (~2 minutes for a cold rebuild of the frontend image).

## Manual deploy (only if CI is broken)

```bash
ssh root@89.167.108.210
cd /opt/crm
sudo -u crm-deploy git pull origin main
sudo -u crm-deploy docker compose -p studio-crm up -d --build
docker compose -p studio-crm ps
```

## env-var changes

Editing `/opt/crm/.env` requires **`up -d --force-recreate backend`**, not just `restart`. `env_file` is read at container creation time, so a plain restart re-uses the old environment.

```bash
sudo -u crm-deploy docker compose --project-directory /opt/crm -p studio-crm up -d --force-recreate backend
```

## Logs

```bash
docker logs studio-crm-backend-1 -f
docker logs studio-crm-nginx-1 -f
docker logs studio-crm-db-1 -f
```

Caddy: `journalctl -u caddy -f`.

## Resetting demo data

From any browser: click **Reset now** in the demo banner.

From CLI:

```bash
curl -X POST https://crm.ekuznetsov.dev/api/demo/reset
# {"ok": true, "reset_at": 1777143237.97}
```

Or directly inside the backend container:

```bash
docker exec studio-crm-backend-1 python manage.py flush --no-input
docker exec studio-crm-backend-1 python manage.py seed_demo --force
```

## Backups

The demo database is intentionally ephemeral — anyone can wipe it via the Reset button. There is no backup. If you want persistence, attach an external Postgres backup tool (e.g. `pgbackrest`) to the `studio-crm-db-1` volume.

## Updating dependencies

Backend:

```bash
docker exec studio-crm-backend-1 pip list --outdated
# Then update backend/requirements.txt and push to main → CI rebuilds the image
```

Frontend:

```bash
cd frontend
npm outdated
npm update
# Then commit package.json + package-lock.json and push
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 502 Bad Gateway from `/api/*` | Backend container restarting | `docker logs studio-crm-backend-1 -f` — usually a `migrate` or `seed_demo` error |
| Caddy TLS error | DNS not yet propagated, or Cloudflare proxy enabled | Verify `dig crm.ekuznetsov.dev +short` returns 89.167.108.210, set Cloudflare A record `proxied=false` |
| `Bind for 0.0.0.0:6379 failed: port is already allocated` | Some other compose stack exposes Redis on the host | We don't expose Redis — make sure your `docker-compose.yml` matches `main` |
| `set times: Operation not permitted` during rsync | `/opt/crm` was chowned to `crm:crm` instead of `crm-deploy:crm` | `chown -R crm-deploy:crm /opt/crm && find /opt/crm -type d -exec chmod g+s {} \;` |
| AI returns "AI stub — no provider key set" | `.env` was edited but backend was only restarted | `up -d --force-recreate backend` to pick up new env |

## Decommissioning

```bash
ssh root@89.167.108.210
cd /opt/crm
sudo -u crm-deploy docker compose -p studio-crm down -v   # -v wipes volumes
rm -rf /opt/crm
userdel crm
userdel -r crm-deploy
rm /etc/sudoers.d/crm-deploy
# Remove the Caddy block from /etc/caddy/Caddyfile, then `systemctl reload caddy`
# Remove Cloudflare A record for crm
```
