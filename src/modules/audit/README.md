# Audit module

Security and compliance audit log: auth events, admin actions, client changes.

**Schema domain:** `src/_db/drizzle/schema/audit/`

## Table: `audit_events`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `actor_type` | enum | `PLATFORM_ADMIN`, `USER`, `SYSTEM` |
| `actor_id` | uuid | Nullable (e.g. `SYSTEM` events) |
| `action` | varchar(128) | Use `AuditActionEnum` constants |
| `resource_type` | varchar(64) | e.g. `oauth_client`, `user` |
| `resource_id` | uuid | Nullable |
| `metadata` | jsonb | Non-sensitive context only |
| `ip` | varchar(45) | IPv4/IPv6 |
| `user_agent` | varchar(512) | |
| `created_at` | timestamptz | Append-only |

## Usage

```ts
await this.auditService.record({
  actorType: AuditActorTypeEnum.PLATFORM_ADMIN,
  actorId: admin.id,
  action: AuditActionEnum.CLIENT_CREATED,
  resourceType: 'oauth_client',
  resourceId: client.id,
  metadata: { clientId: client.clientId },
  ip,
  userAgent,
});
```

Append-only — no update/delete APIs on this table.
