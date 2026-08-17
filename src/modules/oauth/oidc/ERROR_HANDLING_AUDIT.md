# OIDC + auth-frontend error handling audit

Audit of edge/error cases across the OIDC interaction flow and the aponika-auth-frontend
`returnTo` handoff. Captures what is handled gracefully today, what is partial, and what
is not — including the `SessionNotFound` / raw `400` failure on `GET /interaction/:uid`
after a stale or expired interaction.

**Related:** [CODE_FLOW.md](./CODE_FLOW.md) · [README.md](./README.md) · auth frontend `/oauth/error`

Last reviewed: 2026-08-17

---

## Summary

| Status | Count | Meaning |
|--------|------:|---------|
| **Handled gracefully** | ~22 | User sees a clear page or message and a next step |
| **Partially handled** | ~9 | Error caught or logged, but UX is generic, inconsistent, or can loop |
| **Not handled gracefully** | ~10 | Raw API response, dead end, or no user-facing recovery |

**Primary gap:** Expired or missing interactions after login are **not** routed to a friendly
page (unlike authorize errors, which redirect to `/oauth/error` on the auth frontend).

---

## Phase 1 — Authorize (`GET /auth`)

Handled via `oidc-provider` + `OidcHostedErrorService.renderError` → auth frontend `/oauth/error`.

| # | Edge case | Status |
|---|-----------|--------|
| 1 | Invalid `redirect_uri` | Handled — redirect to `/oauth/error` (integration test) |
| 2 | Invalid / unknown `client_id` | Handled — `/oauth/error` |
| 3 | Invalid request (malformed params) | Handled — `/oauth/error` |
| 4 | PKCE missing / invalid | Handled — provider error → `/oauth/error` |
| 5 | `access_denied` at authorize | Handled — `/oauth/error` |
| 6 | Provider `server_error` | Handled — `/oauth/error` |
| 7 | Valid unauthenticated authorize | Handled — redirect to `/interaction/:uid` |

**Phase score: 7 / 7 handled**

---

## Phase 2 — Interaction resume (`GET /interaction/:uid`)

Handler: `login/oidc-interaction.service.ts` → `resume()`.

This is where `SessionNotFound: interaction session not found` surfaces as a **raw 400**
(JSON body in the browser) instead of a hosted error page.

| # | Edge case | Status | Current behavior |
|---|-----------|--------|------------------|
| 8 | No `uid` in path | Partial | Plain `400` text: `Missing interaction id` |
| 9 | User not logged in | Handled | `302` → auth frontend `/login?returnTo=...` |
| 10 | Logged in + `login` prompt | Handled | `interactionFinished` → OIDC continues |
| 11 | Logged in + `consent` + first-party client | Handled | Auto-consent in-process |
| 12 | Logged in + `consent` + third-party client | Handled | `302` → `/consent?returnTo=...` |
| 13 | Unsupported prompt name | Handled | `interactionFinished` with `server_error` |
| 14 | Interaction expired (TTL) | **Not graceful** | `SessionNotFound` → **400 JSON** in browser |
| 15 | Interaction lost (server restart, in-memory store) | **Not graceful** | Same raw **400** |
| 16 | Missing OIDC interaction session cookie | **Not graceful** | `SessionNotFound` at `interactionDetails()` |
| 17 | Other `interactionDetails` failures | **Not graceful** | Uncaught → Nest **400/500** via `.catch(next)` |
| 18 | `interactionFinished` throws | **Not graceful** | Propagates to Express `next` |

### Code asymmetry

- **Consent API** paths use `toConsentInteractionError()` and return a readable
  `BadRequestException` message.
- **`resume()`** calls `provider.interactionDetails()` **without** try/catch, so browser
  navigation to `/interaction/:uid` does not get the same treatment.

```typescript
// login/oidc-interaction.service.ts — resume() (no try/catch today)
const details = await provider.interactionDetails(req, res);
```

**Phase score: 2 handled well, 1 partial, 8 not graceful**

---

## Phase 3 — Auth frontend (`returnTo` / login / register / verify / resend)

| # | Edge case | Status | Notes |
|---|-----------|--------|-------|
| 19 | Invalid `returnTo` | Handled | `safeReturnTo()` strips bad values |
| 20 | `returnTo` preserved across auth pages | Handled | Query param on login, register, resend, verify |
| 21 | Login invalid credentials / rate limit | Handled | Structured `loginAction` result (no thrown `ApiError` across server boundary) |
| 22 | Resend verification (incl. no account) | Handled | Generic success (anti-enumeration) |
| 23 | Register duplicate email | Handled | `registerAction` returns `{ success: false, kind }` |
| 24 | Verify-email invalid/expired token | Handled | `verifyEmailAction` returns structured result |
| 25 | After login, redirect to **stale** `returnTo` | Handled | `/oauth/resume` → issuer; stale → `/oauth/error?error=interaction_expired` |
| 26 | `(auth).tsx` auto-redirect when session exists | Handled | Uses `navigateAfterAuth()` → resume page for OIDC interactions |
| 27 | Logged-in user visits `/login?returnTo=...` | Handled | Same resume flow; no raw issuer JSON |

**Phase score: 4 handled, 4 partial, 1 not graceful**

---

## Phase 4 — Consent UI + API

Better than interaction resume for expired interactions.

| # | Edge case | Status |
|---|-----------|--------|
| 28 | Missing interaction id on consent page | Handled — `consent.missingInteraction` |
| 29 | Failed to load consent (expired interaction) | Handled — `consent.loadFailed` banner |
| 30 | Wrong user for interaction | Handled — API `403` |
| 31 | OAuth client not registered | Handled — API `404` |
| 32 | Allow / deny success | Handled — redirect to RP |
| 33 | Deny consent | Handled — `access_denied` back to RP |
| 34 | Allow/deny action errors | Partial — generic `error.message` |

**Phase score: 6 handled, 1 partial**

---

## Phase 5 — Token endpoint

| # | Edge case | Status |
|---|-----------|--------|
| 35 | Token rate limit | Handled — OAuth `too_many_requests` |
| 36 | `invalid_grant` (code reuse, bad PKCE) | Handled — standard OAuth error (integration tests) |
| 37 | Refresh token revoked / family invalid | Handled — `invalid_grant` (integration tests) |

RP (byte-forge) must still surface friendly UI for these errors.

**Phase score: 3 / 3 at protocol level**

---

## Phase 6 — Infrastructure (amplifies failures)

| # | Edge case | Status |
|---|-----------|--------|
| 38 | In-memory OIDC adapter — interactions lost on restart | Handled (dev/prod) | Postgres `oidc_provider_storage`; memory only when `NODE_ENV=test` |
| 39 | No `ttl.Interaction` configured (provider default) | Handled | `OIDC_INTERACTION_TTL` (default 3600s) |
| 40 | Long register/verify path while `returnTo` ages out | Partial | Survives restart; still expires after TTL |
| 41 | Multi-instance deployment (in-memory not shared) | Handled (postgres) | Shared `oidc_provider_storage` table |

Adapter: `provider/oidc-adapter.factory.ts` uses `memory_adapter.js` for Interaction (and
other models except Client).

---

## Test coverage gaps

**Covered today:**

- Unauthenticated authorize → redirect to login with `returnTo`
- Authenticated authorize → callback with authorization code
- Invalid `redirect_uri` → `/oauth/error`
- **Login-during-OIDC round trip** — authorize → login redirect → resume interaction → RP callback (`oidc-interaction-resume.integration.spec.ts`)
- **Stale interaction after restart** → `/oauth/error?error=interaction_expired`
- Missing / unknown interaction uid → hosted error redirect

**Not covered:**

- End-to-end through auth frontend `/oauth/resume` page (browser-only; backend path tested)
- Multi-instance deployment (in-memory not shared)

---

## Observed incident (2026-08-17)

**Symptom:** After register → verify → resend → login, browser `GET` to
`http://localhost:3010/interaction/:uid` returned **400**. Console showed JSON viewer hint
(raw JSON response body). Backend log:

```
SessionNotFound: invalid_request
error_description: 'interaction session not found'
at OidcInteractionService.resume → provider.interactionDetails()
```

**Likely cause:** Stale interaction — long auth detour plus backend hot-reload (~14:00:56 UTC)
wiped in-memory interaction state while `returnTo` on the login URL still pointed at the old uid.

**Why not graceful:** `resume()` does not catch `SessionNotFound` or redirect to
`/oauth/error` (unlike authorize validation errors).

---

## Target graceful flow

**Today:**

```
Login success (:3011) → location.assign(returnTo)
  → GET :3010/interaction/:uid → 400 JSON in browser
```

**Target:** ✅ Implemented for `resume()` (see `login/oidc-interaction.service.ts`).

```
Login success → GET /interaction/:uid
  → if missing/expired → 303 /oauth/error?error=interaction_expired
  → user message: start again from the application
```

`/oauth/error` handles `interaction_expired` via `oauthError.interactionExpired` (EN/BN).

---

## Recommended fixes (priority)

1. **`resume()` try/catch** — ✅ Implemented. On `SessionNotFound` / missing interaction, redirects to
   `/oauth/error?error=interaction_expired` instead of JSON 400. Missing `uid` → `/oauth/error?error=invalid_request`.
2. **Auth frontend** — ✅ Implemented. OIDC interaction `returnTo` targets route through
   `/oauth/resume` (loading UI) instead of blind `location.assign` to the issuer. Stale
   interactions still land on `/oauth/error` via backend redirect (fix #1).
3. **Integration test** — ✅ Implemented in `__tests__/integration/oidc-interaction-resume.integration.spec.ts`.
4. **Persistence + TTL** — ✅ Implemented. Postgres-backed `oidc_provider_storage` table
   (all OIDC adapter models except `Client`) + explicit `ttl.Interaction` (`OIDC_INTERACTION_TTL`,
   default 1h). Tests keep in-memory storage via `NODE_ENV=test`.
5. **Server actions** — ✅ Implemented. Register and verify-email actions return structured
   results (same pattern as login/resend); shared `readApiErrorShape` duck-typing.

---

## Debugging quick reference

| Symptom | Read first |
|---------|------------|
| Raw 400 JSON on `/interaction/:uid` | This doc §Phase 2; `resume()` lacks try/catch |
| Hosted error page on authorize | `login/oidc-hosted-error.service.ts` — working |
| Consent “invalid or expired” banner | Consent page — working |
| Login works but OIDC doesn’t complete | Stale `returnTo`; restart app; start sign-in from RP again |
| Login loop | `login/oidc-user-session.bridge.ts` (unverified/suspended → null session) |
