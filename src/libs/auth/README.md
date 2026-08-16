# Resource-server JWT guard (reference)

Copy these files into consumer APIs (e.g. `byte-forge-auth`) and register `JwtResourceGuardModule`.

| File | Purpose |
|------|---------|
| `libs/auth/oidc-jwks-client.service.ts` | JWKS fetch + 15 min cache; retry once on signature failure |
| `libs/auth/jwt-resource.guard.ts` | `Authorization: Bearer` verification (`iss`, `aud`, `exp`) |
| `libs/auth/jwt-resource.guard.module.ts` | Nest module export |
| `libs/types/oidc-access-token.type.ts` | Request context type |
| `libs/decorators/oidc-access-token.decorator.ts` | `@OidcAccessToken()` param decorator |

**Example route:** `GET /api/v1/example/protected` (`modules/example/`).

## Environment

| Variable | Example |
|----------|---------|
| `OIDC_ISSUER` | `http://localhost:3010` |
| `OIDC_DEFAULT_RESOURCE` | `http://localhost:3005` (must match access token `aud`) |

## Usage

```typescript
@UseGuards(JwtResourceGuard)
@Get('orders')
listOrders(@OidcAccessToken() token: OidcAccessTokenContext) {
  return this.ordersService.listForUser(token.sub);
}
```

The guard validates JWT signature via `{OIDC_ISSUER}/jwks` and does **not** call the auth server per request. Domain authorization (seller, shop owner) stays in the consumer app.
