# OIDC provider module (F21–F28)

NestJS integration for [`oidc-provider`](https://github.com/panva/node-oidc-provider) per [ADR-001](../../../docs/adr/ADR-001-oidc-provider-strategy.md).

**How to navigate the code:** [CODE_FLOW.md](./CODE_FLOW.md) — lifecycle diagrams, logical groups, and a debugging guide. For error/edge-case coverage see [ERROR_HANDLING_AUDIT.md](./ERROR_HANDLING_AUDIT.md).

## Entry points

| File | Role |
|------|------|
| `oidc.module.ts` | NestJS module — providers, `OidcConsentController`, exports |
| `oidc.service.ts` | Init on boot; mount Express middleware + `/interaction/:uid` |
| `src/main.ts` | Global prefix exclusions; calls `mountOnExpress()` |

Exported for other modules: `OidcService`, `OidcClientRegistry`, `OidcJwksService`.

## HTTP mount

OIDC routes are mounted at the **issuer root** (not under `/api`):

| Endpoint | Path |
|----------|------|
| OpenID Configuration | `/.well-known/openid-configuration` |
| JWKS | `/jwks` |
| Authorization | `/auth` |
| Interaction resume | `/interaction/:uid` |
| Token | `/token` |
| End session | `/session/end` |

Path constants and prefix exclusions: `provider/oidc-routes.constants.ts`.

## Code map (by flow)

Files are listed in **runtime order**, not alphabetically. Full detail: [CODE_FLOW.md](./CODE_FLOW.md).

### Boot

| File | Role |
|------|------|
| `boot/oidc-boot.config.ts` | Fail-fast issuer / JWKS path validation at boot |
| `boot/oidc-issuer.validation.ts` | Issuer URL validation |
| `boot/oidc-jwks.service.ts` | Load RS256 PEM → signing JWKS; public key strip |

### Provider

| File | Role |
|------|------|
| `provider/oidc-provider.factory.ts` | Dynamic ESM import + Provider construction |
| `provider/oidc-provider.types.ts` | Provider event/context types |
| `provider/oidc-routes.constants.ts` | Protocol paths, global prefix exclusions, path helpers |
| `provider/oidc-adapter.factory.ts` | `Client` adapter + postgres (runtime) or memory (`NODE_ENV=test`) |
| `provider/oidc-postgres.adapter.ts` | Postgres-backed oidc-provider storage adapter |
| `provider/oidc-provider-storage.repository.ts` | `oidc_provider_storage` table access |
| `provider/oidc-client.adapter.ts` | `Client` storage adapter `find()` |

### Client resolution

| File | Role |
|------|------|
| `client/oidc-client.mapper.ts` | `oauth_clients` row → oidc-provider Client payload |
| `client/oidc-client.registry.ts` | Read-through cache (60s TTL) |

1. oidc-provider requests client by `client_id`
2. `OidcClientAdapter.find()` → `OidcClientRegistry`
3. Cache miss → `OAuthClientRepository.findByClientIdWithUris()`
4. `mapOAuthClientToOidcPayload()` — disabled clients return `undefined`

Confidential client secrets are stored hashed in DB; token auth for confidential clients is deferred.

### Login and authorize (F23, F27)

| File | Role |
|------|------|
| `login/oidc-interaction.service.ts` | `/interaction/:uid` resume + login redirect |
| `login/oidc-interaction-request.util.ts` | Interaction request/response helpers |
| `login/oidc-user-session.bridge.ts` | F16 cookie session → OIDC login |
| `login/oidc-account.service.ts` | `findAccount` + OIDC claims |
| `login/oidc-hosted-error.service.ts` | `renderError` → auth frontend `/oauth/error` |

Unauthenticated users are sent to the auth frontend login; after F16 session cookies are present, `/interaction/:uid` completes login.

`COOKIE_DOMAIN=localhost` shares F16 cookies across issuer and auth UI ports. Authorize errors that cannot redirect to the client go to `{AUTH_FRONTEND_URL}/oauth/error`.

### Consent (F26)

| File | Role |
|------|------|
| `consent/oidc-consent-grant.service.ts` | Grants, remembered consent, first-party auto-consent |
| `consent/oidc-consent.controller.ts` | API for auth frontend consent UI |

Third-party clients redirect to `/consent` on the auth frontend; `trusted_first_party` clients auto-consent. Remembered consent skips the prompt via `loadExistingGrant`.

### Token (F24, F25)

| File | Role |
|------|------|
| `token/oidc-resource.config.ts` | Resource indicators → JWT access tokens (`aud`, RS256) |
| `token/oidc-token-claims.service.ts` | `extraTokenClaims` (`email`, `email_verified` on access tokens) |
| `token/oidc-token-rate-limiter.service.ts` | Rate limit on `POST /token` |
| `token/oidc-token-audit.listener.ts` | `grant.success` → `oidc.token.issued` audit |

`POST /token` with `authorization_code` + PKCE issues JWT access token (`aud` = `OIDC_DEFAULT_RESOURCE`), `id_token`, and refresh token. See `scripts/oidc-pkce-token-exchange.sh`.

`grant_type=refresh_token` rotates refresh tokens; reuse detection revokes the grant family. TTLs: `OIDC_ACCESS_TOKEN_TTL`, `OIDC_REFRESH_TOKEN_TTL`.

### Logout (F28)

| File | Role |
|------|------|
| `logout/oidc-logout-ui.service.ts` | RP-initiated logout UI (auto-submit confirm) |
| `logout/oidc-end-session.listener.ts` | `end_session.success` → revoke F16 session + clear cookies |

`GET/POST /session/end` for RP-initiated logout; `post_logout_redirect_uri` must be registered per client.

## Boot requirements

| Env | Dev | Production |
|-----|-----|------------|
| `OIDC_ISSUER` | Required, no trailing slash | Required |
| `OIDC_JWKS_PRIVATE_KEY_PATH` | Optional (library dev keystore) | **Required** |

Generate a dev signing key:

```bash
bash scripts/generate-oidc-signing-key.sh
```

See [INTEGRATION.md](../../../docs/INTEGRATION.md) §8 for rotation runbook.
