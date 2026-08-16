# Session module

Admin session persistence for platform operators.

**Schema:** `src/_db/drizzle/schema/session/admin-session.schema.ts`

## Table: `admin_sessions`

| Field | Notes |
|-------|-------|
| `admin_id` | FK → `platform_admins` |
| `device_info` | JSONB user-agent / device metadata |
| `ip` | `inet`, nullable |
| `refresh_token_hash` | Hashed refresh token |
| `revoked_at` | Set on logout / revocation |
| `expires_at` | Session expiry |

## Repository

`AdminSessionRepository` — insert, find by id, list active by adminId, revoke, update.

Login/session HTTP API in F6.
