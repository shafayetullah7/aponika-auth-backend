# OIDC provider module (F21–F28)

NestJS integration for [`oidc-provider`](https://github.com/panva/node-oidc-provider) per [ADR-001](../../../docs/adr/ADR-001-oidc-provider-strategy.md).

## Components

| File | Role |
|------|------|
| `oidc-boot.config.ts` | Fail-fast issuer / JWKS path validation at boot |
| `oidc-jwks.service.ts` | Load RS256 PEM → signing JWKS; public key strip |
| `oidc-routes.constants.ts` | Protocol paths, global prefix exclusions, path helpers |
| `oidc-account.service.ts` | `findAccount` + OIDC claims |
| `oidc-user-session.bridge.ts` | F16 cookie session → OIDC login |
| `oidc-interaction.service.ts` | `/interaction/:uid` resume + login redirect |
| `oidc-client.mapper.ts` | `oauth_clients` row → oidc-provider Client payload |
| `oidc-client.registry.ts` | Read-through cache (60s TTL) |
| `oidc-client.adapter.ts` | `Client` storage adapter `find()` |
| `oidc-adapter.factory.ts` | Client adapter + in-memory adapters for other models (dev) |
| `oidc-provider.factory.ts` | Dynamic ESM import + Provider construction |
| `oidc-resource.config.ts` | Resource indicators → JWT access tokens (`aud`, RS256) |
| `oidc-token-claims.service.ts` | `extraTokenClaims` (`email`, `email_verified` on access tokens) |
| `oidc-token-audit.listener.ts` | `grant.success` → `oidc.token.issued` audit |
| `oidc-hosted-error.service.ts` | `renderError` → auth frontend `/oauth/error` |
| `oidc-logout-ui.service.ts` | RP-initiated logout UI (auto-submit confirm) |
| `oidc-end-session.listener.ts` | `end_session.success` → revoke F16 session + clear cookies |
| `oidc.service.ts` | Init on module boot; mount Express middleware + interaction route |

## HTTP mount

OIDC routes are mounted at the **issuer root** (not under `/api`), e.g.:

| Endpoint | Path |
|----------|------|
| OpenID Configuration | `/.well-known/openid-configuration` |
| JWKS | `/jwks` |
| Authorization | `/auth` |
| Interaction resume | `/interaction/:uid` |
| Token | `/token` |

Authorization (F23): unauthenticated users are sent to the auth frontend login; after F16 session cookies are present, `/interaction/:uid` completes login.

Consent (F26): third-party clients redirect to `/consent` on the auth frontend; `trusted_first_party` clients auto-consent. Remembered consent skips the prompt via `loadExistingGrant`.

Hosted login (F27): `COOKIE_DOMAIN=localhost` shares F16 cookies across issuer and auth UI ports. Authorize errors that cannot redirect to the client are sent to `{AUTH_FRONTEND_URL}/oauth/error`.

Logout (F28): `GET/POST /session/end` for RP-initiated logout; `post_logout_redirect_uri` must be registered per client. Clears OIDC session and F16 cookies when present.

Token (F24): `POST /token` with `authorization_code` + PKCE issues JWT access token (`aud` = `OIDC_DEFAULT_RESOURCE`), `id_token`, and refresh token. See `scripts/oidc-pkce-token-exchange.sh`.

Refresh (F25): `POST /token` with `grant_type=refresh_token` rotates refresh tokens; reuse detection revokes the grant family. TTLs: `OIDC_ACCESS_TOKEN_TTL`, `OIDC_REFRESH_TOKEN_TTL`.

## Client resolution

1. oidc-provider requests client by `client_id`
2. `OidcClientAdapter.find()` → `OidcClientRegistry`
3. Cache miss → `OAuthClientRepository.findByClientIdWithUris()`
4. `mapOAuthClientToOidcPayload()` — disabled clients return `undefined`

Confidential client secrets are stored hashed in DB; token auth for confidential clients is deferred.

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
