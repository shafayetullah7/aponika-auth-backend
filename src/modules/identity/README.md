# Identity module

End-user accounts: registration, credentials, profile, MFA, email/phone verification.

**Schema domain:** `src/_db/drizzle/schema/identity/`

| Table | Purpose |
|-------|---------|
| `users` | Core account (`email`, `status`) — OIDC `sub` = `users.id` |
| `user_credentials` | Password hash + `email_verified` |
| `user_profiles` | Optional `display_name` (v1) |

**Repository:** `IdentityRepository` — `findByEmail`, `createUserWithCredential`

After schema changes, run `pnpm db:generate` and `pnpm db:migrate` locally.
