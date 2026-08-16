# OIDC provider module (F21 bootstrap)

NestJS integration for [`oidc-provider`](https://github.com/panva/node-oidc-provider) per [ADR-001](../../../docs/adr/ADR-001-oidc-provider-strategy.md).

## Components

| File | Role |
|------|------|
| `oidc-boot.config.ts` | Fail-fast issuer / JWKS validation at boot |
| `oidc-client.mapper.ts` | `oauth_clients` row → oidc-provider Client payload |
| `oidc-client.registry.ts` | Read-through cache (60s TTL) |
| `oidc-client.adapter.ts` | `Client` storage adapter `find()` |
| `oidc-adapter.factory.ts` | Client adapter + in-memory adapters for other models (dev) |
| `oidc-provider.factory.ts` | Dynamic ESM import + Provider construction |
| `oidc.service.ts` | Init on module boot; mount Express middleware |

## HTTP mount

OIDC routes are mounted at the **issuer root** (not under `/api`), e.g.:

- `/.well-known/openid-configuration` (F22)
- `/auth`, `/token`, …

Authorize/interaction UX ships in F23+.

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
