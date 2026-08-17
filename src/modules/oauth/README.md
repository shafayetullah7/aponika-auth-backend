# OAuth module

OIDC/OAuth2 provider: clients, authorization codes, tokens, JWKS, consent.

**Schema domain:** `src/_db/drizzle/schema/oauth/`  
**OIDC provider bootstrap (F21):** `oidc/` — see [oidc/README.md](./oidc/README.md)

## F2 — OAuth client registry (schema + repository)

Persistent registry for OIDC/OAuth clients (Byte Forge web, admin app, etc.). HTTP APIs and validation ship in F3/F7.

### Tables

#### `oauth_clients`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `client_id` | varchar(128) | Unique, indexed — e.g. `byte-forge-web` |
| `client_secret_hash` | varchar(255) | Nullable — public clients have no secret |
| `name` | varchar(255) | Display name |
| `description` | text | Optional |
| `client_type` | enum | `public` \| `confidential` |
| `grant_types` | text[] | e.g. `authorization_code`, `refresh_token` |
| `response_types` | text[] | e.g. `code` |
| `scopes` | text[] | e.g. `openid`, `profile`, `email` |
| `pkce_required` | boolean | Default `true` |
| `status` | enum | `active` \| `disabled` (indexed) |
| `created_by` | uuid | Platform admin ref — nullable until F4/F6 |
| `created_at` / `updated_at` | timestamptz | |

#### `oauth_client_redirect_uris` (normalized)

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `oauth_client_id` | uuid | FK → `oauth_clients`, cascade delete |
| `uri` | text | Full URI or origin |
| `kind` | enum | `redirect` \| `post_logout` \| `allowed_origin` |
| `created_at` | timestamptz | |

Unique on `(oauth_client_id, kind, uri)`.

Maps to [INTEGRATION.md](../../../docs/INTEGRATION.md) registration fields:

| Integration field | Storage |
|-------------------|---------|
| Client ID | `oauth_clients.client_id` |
| Client type | `oauth_clients.client_type` |
| Redirect URIs | `oauth_client_redirect_uris` (`kind = redirect`) |
| Post-logout redirect | `oauth_client_redirect_uris` (`kind = post_logout`) |
| Allowed origins | `oauth_client_redirect_uris` (`kind = allowed_origin`) |

### Repository

`repositories/oauth-client.repository.ts` — `OAuthClientRepository` (CRUD primitives only, no HTTP):

- `insert`, `insertUris`, `createWithUris`
- `findById`, `findByClientId`, `findByIdWithUris`, `findUrisByClientId`
- `update`, `replaceUris`
- `list`, `count`

### F3 — Domain validation + service

- Zod: `CreateOAuthClientDto`, `UpdateOAuthClientDto` (`dto/`)
- URI rules: HTTPS required except `http://localhost` / `http://127.0.0.1`; no wildcards; `allowed_origins` must cover redirect origins
- Public clients: `pkce_required = true`, no `client_secret`
- Confidential clients: generated secret returned once on create; Argon2id hash at rest (`libs/crypto/password.ts`)
- `OAuthClientService` — `create`, `update`, `disable`, `findByClientId`

Exported via `OAuthModule`. Admin HTTP API is **F7**.

### Migration (user-owned)

```bash
cd aponika-auth-backend
pnpm db:generate
pnpm db:migrate
```
