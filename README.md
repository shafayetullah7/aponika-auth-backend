# @aponika/auth-backend

NestJS API for the Aponika identity platform: OIDC issuer, identity/session store, and platform-admin APIs.

**Local port:** `3010`  
**Setup status:** Scaffold — see [platform setup plan](../docs/PLATFORM_SETUP_PLAN.md).

## Prerequisites

- Node.js 22 (`nvm use` reads `.nvmrc`)
- pnpm 10

## Commands

```bash
pnpm install
cp .env.example .env.development   # first time only
pnpm docker:db                     # Postgres on localhost:5436
pnpm run start:dev                 # http://localhost:3010
curl http://localhost:3010/health  # { status: 'ok', db: 'ok' }
pnpm run build
pnpm run lint
pnpm run typecheck
```

Migrations are user-owned: `pnpm db:generate` then `pnpm db:migrate` after schema changes.

## Documentation

| Doc | Purpose |
|-----|---------|
| [../docs/PLATFORM_SETUP_PLAN.md](../docs/PLATFORM_SETUP_PLAN.md) | Phased bootstrap (start here) |
| [../docs/STACK.md](../docs/STACK.md) | Locked dependency versions |
| [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) | Platform boundaries |

Consumer apps (e.g. Byte Forge) integrate via OIDC only — no shared runtime dependency.
