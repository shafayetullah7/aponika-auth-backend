# User auth module

End-user registration, email verification (F15), and login/session APIs (F16).

## Routes

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/v1/auth/register` | Public |
| `POST` | `/api/v1/auth/verify-email` | Public |
| `POST` | `/api/v1/auth/resend-verification` | Public |
| `POST` | `/api/v1/auth/login` | Public |
| `POST` | `/api/v1/auth/refresh` | Cookie refresh |
| `POST` | `/api/v1/auth/logout` | `UserAuthGuard` |
| `GET` | `/api/v1/auth/check` | `UserAuthGuard` |
| `GET` | `/api/v1/account/me` | `UserAuthGuard` |
| `PATCH` | `/api/v1/account/profile` | `UserAuthGuard` |
| `POST` | `/api/v1/account/change-password` | `UserAuthGuard` |

## Cookies (auth frontend BFF)

| Cookie | httpOnly | Notes |
|--------|----------|-------|
| `userAccessToken` | yes | Short-lived JWT |
| `userRefreshToken` | yes | Long-lived JWT; rotated on refresh |
| `user-xsrf-token` | no | CSRF double-submit for state-changing routes |

Separate from admin cookies (`adminAccessToken`, `adminRefreshToken`, `xsrf-token`).

## Register body

```json
{
  "email": "user@example.com",
  "password": "Password1!",
  "name": "Jane Doe"
}
```

## Login body

```json
{
  "email": "user@example.com",
  "password": "Password1!"
}
```

## Dev flow

1. `POST /api/v1/auth/register`
2. Read verification URL from console mail log (`MAIL_PROVIDER=console`)
3. `POST /api/v1/auth/verify-email` with the `token` value
4. `POST /api/v1/auth/login` — sets cookies
5. `GET /api/v1/account/me` with cookies (and `x-xsrf-token` header for POST logout)

## Policy: unverified users

- New users start with `email_verified = false`.
- **Login is rejected** until email is verified (same generic `invalidCredentials` response).
- OIDC authorize (F20) must also reject unverified accounts.
- Verification links expire after **24 hours** and are one-time.
- `POST /api/v1/auth/resend-verification` issues a fresh link for unverified accounts only; response is always generic (anti-enumeration). Previous unconsumed tokens are invalidated.

## Rate limiting

In-memory login rate limit: 10 attempts per 15 minutes per `ip:email` key.

Resend verification: 5 requests per 15 minutes per IP (email fallback), 60s cooldown per email between sends.

## Schema

- `user_email_verifications` — one-time SHA-256 hashed tokens, 24h expiry (F15)
- `user_sessions` — refresh token hash, device info, expiry (F16)

User-owned migrations required after schema changes.
