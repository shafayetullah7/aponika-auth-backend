# @aponika/auth-backend

NestJS API for the Aponika identity platform: OIDC issuer, identity/session store, and platform-admin APIs.

**Local port:** `3010`  
**Setup status:** Scaffold — see [platform setup plan](../docs/PLATFORM_SETUP_PLAN.md).

## Prerequisites

- Node.js 22 (`nvm use` reads `.nvmrc`)
- pnpm 10
- Docker (for Postgres, or full stack)

## Local development

Copy env once: `cp .env.example .env.development`

### Option A — API on host (Postgres in Docker)

```bash
pnpm install
pnpm docker:db                     # Postgres on localhost:5436
# In .env.development set DB_HOST=localhost and DB_PORT=5436 for host API only
pnpm start:dev                     # http://localhost:3010
curl http://localhost:3010/health  # { "status": "ok", "db": "ok" }
```

### Option B — Full stack in Docker (default, like byte-forge-auth)

```bash
pnpm install
pnpm docker:dev                    # app + db, live reload via bind mount
pnpm docker:logs                   # follow API logs
pnpm docker:down                   # stop app + db
```

Uses `DB_HOST=db` and `DB_PORT=5432` from `.env.development`. API is exposed at `http://localhost:3010`.

### Production image

```bash
cp .env.example .env.production   # configure for your environment
pnpm docker:prod                  # build production target + run detached
pnpm docker:prod:down
```

## Other commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm db:migrate:docker            # run migrations inside the app container
pnpm db:seed:docker               # seed OAuth dev clients inside the app container
pnpm db:studio:docker             # Drizzle Studio inside the app container
pnpm docker:purge                 # remove dev containers, volumes, and local images
```

Migrations are user-owned: `pnpm db:generate` then `pnpm db:migrate` (or `db:migrate:docker`) after schema changes.

### OAuth dev clients

After migrations, seed local first-party clients (`byte-forge-web`, `byte-forge-admin`, `aponika-auth-admin`):

```bash
pnpm db:seed                  # host API, Docker Postgres on :5436
pnpm db:seed:docker           # app running in docker:dev
```

Idempotent — existing `client_id`s are skipped. See [INTEGRATION.md](../docs/INTEGRATION.md#local-dev-clients-seed) and `src/_db/seeds/README.md`.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CORS_ORIGINS` | `http://localhost:3011,http://localhost:3012` | Allowed browser origins for credentialed API calls |
| `OIDC_ISSUER` | `http://localhost:3010` | OIDC issuer / discovery base URL |
| `OIDC_ACCESS_TOKEN_TTL` | `900` | OIDC access token lifetime (seconds) |
| `COOKIE_DOMAIN` | `localhost` | Session cookie domain |
| `SESSION_MAX_AGE` | `604800000` | Session cookie max-age (ms) |
| `JWT_*_SECRET` | 32+ chars | Admin/user BFF session JWT signing — see `.env.example` |
| `ADMIN_REGISTRATION_OTP_EMAIL` | Gatekeeper inbox for admin OTP (F5) |
| `MAIL_PROVIDER` | `console` (dev) or `smtp` (future) |
| `AUTH_FRONTEND_URL` | Base URL for email verification links (F15) |
| `DB_HOST` / `DB_PORT` | `db` / `5432` | Docker Compose service networking |
| `DB_EXTERNAL_PORT` | `5436` | Host port to reach Postgres (`localhost:5436`) |
| `APP_EXTERNAL_PORT` | `3010` | Host port mapped to the API container |
| `COMPOSE_PROJECT_NAME` | `aponika-auth` | Docker Compose project name |
| `DOCKER_BUILD_TARGET` | `development` | Dockerfile stage (`development` or `production`) |

Health is at `GET /health` (outside `/api` prefix). Frontends use `VITE_HEALTH_URL` to smoke-test connectivity in dev.

## Documentation

| Doc | Purpose |
|-----|---------|
| [../docs/PLATFORM_SETUP_PLAN.md](../docs/PLATFORM_SETUP_PLAN.md) | Phased bootstrap (start here) |
| [../docs/STACK.md](../docs/STACK.md) | Locked dependency versions |
| [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | Platform boundaries |

Consumer apps (e.g. Byte Forge) integrate via OIDC only — no shared runtime dependency.
