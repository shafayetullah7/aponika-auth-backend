# Account module

Authenticated account read/update for the auth frontend settings page.

All routes require `UserAuthGuard` (session cookies + CSRF on state-changing methods).

## Routes

| Method | Path | Body |
|--------|------|------|
| `GET` | `/api/v1/account/me` | — |
| `PATCH` | `/api/v1/account/profile` | `{ "name": "Jane Doe" }` |
| `POST` | `/api/v1/account/change-password` | `{ "currentPassword": "...", "newPassword": "..." }` |

`newPassword` uses the shared `passwordSchema` (min 8, upper/lower/digit/special).

Wrong current password → `401` + `INVALID_CREDENTIALS`.
