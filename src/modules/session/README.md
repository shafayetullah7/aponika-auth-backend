# Session module

Session persistence for platform admins and end users.

**Schema:** `src/_db/drizzle/schema/session/`

## Tables

### `admin_sessions` (F6)

| Field | Notes |
|-------|-------|
| `admin_id` | FK → `platform_admins` |
| `device_info` | JSONB user-agent / device metadata |
| `ip` | `inet`, nullable |
| `refresh_token_hash` | Hashed refresh token |
| `revoked_at` | Set on logout / revocation |
| `expires_at` | Session expiry |

### `user_sessions` (F16)

Same shape as admin sessions; `user_id` FK → `users`.

## Refresh token rotation (users)

On `POST /api/v1/auth/refresh`, a **new refresh JWT** is issued and `refresh_token_hash` is updated. The previous refresh token becomes invalid (rotation). Admin refresh (F6) reuses the same refresh token — only access is reissued.

## Repositories

- `AdminSessionRepository` / `AdminSessionService`
- `UserSessionRepository` / `UserSessionService`
