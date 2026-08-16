# User auth module

End-user account registration and email verification (F15). Login/session APIs ship in F16.

## Routes

| Method | Path |
|--------|------|
| `POST` | `/api/v1/auth/register` |
| `POST` | `/api/v1/auth/verify-email` |

## Register body

```json
{
  "email": "user@example.com",
  "password": "Password1!",
  "name": "Jane Doe"
}
```

## Verify body

```json
{
  "token": "<token from verification email>"
}
```

## Dev flow

1. `POST /api/v1/auth/register`
2. Read verification URL from console mail log (`MAIL_PROVIDER=console`)
3. `POST /api/v1/auth/verify-email` with the `token` query param value

## Policy: unverified users and OIDC

Until F16/F20 ship login and OIDC authorize:

- New users are created with `user_credentials.email_verified = false`.
- **OIDC authorize and token issuance must reject unverified accounts** once those endpoints exist (login will also require verified email before establishing a session).
- Registration always succeeds for new emails even if mail delivery fails; the user remains unverified until `verify-email` succeeds.

## Schema

`user_email_verifications` — one-time SHA-256 hashed tokens, 24h expiry. User-owned migration required after schema change.
