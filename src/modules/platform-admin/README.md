# Platform admin module

Operator identity: platform admins, local credentials, registration OTP state.

**Schema domain:** `src/_db/drizzle/schema/platform-admin/`  
**Sessions:** `src/_db/drizzle/schema/session/admin-session.schema.ts`

Not the Byte Forge marketplace admin (`byte-forge-admin`).

## HTTP (F5–F6)

| Method | Path |
|--------|------|
| `POST` | `/api/v1/admin/auth/register/request-otp` |
| `POST` | `/api/v1/admin/auth/register` |
| `POST` | `/api/v1/admin/auth/login` |
| `GET` | `/api/v1/admin/auth/check` |
| `POST` | `/api/v1/admin/auth/refresh` |
| `POST` | `/api/v1/admin/auth/logout` |
| `GET` | `/api/v1/admin/clients` (stub — guard test) |

OAuth client CRUD in F7.

| Table | Purpose |
|-------|---------|
| `platform_admins` | Profile: name, `user_name`, `email`, `status`, `role` |
| `platform_admin_local_auth` | Password hash + `verified` flag (1:1 with admin) |
| `admin_registration_attempts` | Pending gatekeeper OTP registrations |
| `admin_registration_rate_limit` | Singleton global OTP throttle (`id = global`) |

## Repositories

- `PlatformAdminRepository` — insert, find by id/email/userName, update
- `PlatformAdminLocalAuthRepository` — insert, find by adminId, update
- `AdminRegistrationAttemptRepository` — insert, find by email/userName, delete
- `AdminRegistrationRateLimitRepository` — find/upsert global throttle row

HTTP and services arrive in F5 (registration OTP) and F6 (login/session).
