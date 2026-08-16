# Database seeds

User-run scripts that populate **local dev** data after migrations.

## OAuth clients (`pnpm db:seed`)

Idempotent seed for first-party dev clients (see `dev-oauth-clients.data.ts`):

| `client_id` | App | Local URL |
|-------------|-----|-----------|
| `byte-forge-web` | Byte Forge marketplace | http://localhost:3000 |
| `byte-forge-admin` | Byte Forge operator console | http://localhost:3050 |
| `aponika-auth-admin` | Aponika auth operator console | http://localhost:3012 |

All are **public** clients with PKCE required. Redirect path: `/auth/callback`.

### Host API + Docker Postgres

```bash
# DB_HOST=localhost DB_PORT=5436 in .env.development
pnpm docker:db
pnpm db:migrate
pnpm db:seed
```

### Full Docker stack

```bash
pnpm docker:dev
pnpm db:migrate:docker
pnpm db:seed:docker
```

Re-running `db:seed` skips clients that already exist (`client_id` unique).

Canonical URIs are also documented in [INTEGRATION.md](../../docs/INTEGRATION.md).
