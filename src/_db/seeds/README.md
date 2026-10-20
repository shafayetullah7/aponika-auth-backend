# Database seeds

User-run scripts that populate **local dev** data after migrations.

## OAuth clients (`pnpm db:seed`)

Idempotent seed for first-party dev clients (see `dev-oauth-clients.data.ts`):

| `client_id` | App | Redirect URI |
|-------------|-----|--------------|
| `byte-forge-web` | Byte Forge marketplace | `http://localhost:3005/api/v1/user/auth/oidc/callback` (API-owned) |
| `byte-forge-admin` | Byte Forge operator console | `http://localhost:3050/auth/callback` |
| `aponika-auth-admin` | Aponika auth operator console | `http://localhost:3012/auth/callback` |

All are **public** clients with PKCE required. Scopes include `openid profile email offline_access`.

Re-running `db:seed` syncs `trusted_first_party` and URIs: it **adds** missing seed URIs and **removes** orphan URIs not in the seed definition (e.g. the legacy `http://localhost:3000/auth/callback` on `byte-forge-web`).

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

### One-shot SQL (if you cannot re-seed)

```sql
DELETE FROM oauth_client_redirect_uris u
USING oauth_clients c
WHERE u.oauth_client_id = c.id
  AND c.client_id = 'byte-forge-web'
  AND u.kind = 'redirect'
  AND u.uri = 'http://localhost:3000/auth/callback';
```

Canonical URIs are also documented in [INTEGRATION.md](../../docs/INTEGRATION.md).
