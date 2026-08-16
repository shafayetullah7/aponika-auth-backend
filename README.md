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
pnpm start:dev                     # http://localhost:3010
curl http://localhost:3010/health  # { "status": "ok", "db": "ok" }
```

Uses `DB_HOST=localhost` and `DB_PORT=5436` from `.env.development`.

### Option B — Full stack in Docker (like byte-forge-auth)

```bash
pnpm install
pnpm docker:dev                    # app + db, live reload via bind mount
pnpm docker:logs                   # follow API logs
pnpm docker:down                   # stop app + db
```

Compose sets `DB_HOST=db` and `DB_PORT=5432` on the app container. API is still exposed at `http://localhost:3010`.

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
pnpm db:studio:docker             # Drizzle Studio inside the app container
pnpm docker:purge                 # remove dev containers, volumes, and local images
```

Migrations are user-owned: `pnpm db:generate` then `pnpm db:migrate` (or `db:migrate:docker`) after schema changes.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CORS_ORIGINS` | `http://localhost:3011,http://localhost:3012` | Allowed browser origins for credentialed API calls |
| `DB_HOST` / `DB_PORT` | `localhost` / `5436` | Host dev; overridden to `db` / `5432` in `docker:dev` |
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
