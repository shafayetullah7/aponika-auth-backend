import type { OidcProviderStorageRepository } from './oidc-provider-storage.repository';

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
  'PreAuthorizedCode',
]);

function grantKeyFor(id: string): string {
  return `grant:${id}`;
}

function sessionUidKeyFor(id: string): string {
  return `sessionUid:${id}`;
}

function userCodeKeyFor(userCode: string): string {
  return `userCode:${userCode}`;
}

function storageOptions(
  expiresIn: number | undefined,
  clockTolerance: number,
): number | undefined {
  if (typeof expiresIn === 'number') {
    return (expiresIn + clockTolerance) * 1000;
  }

  return undefined;
}

function getGrantMembers(
  store: OidcProviderStorageRepository,
  grantId: string,
): Promise<Map<string, number>> {
  return store.get(grantKeyFor(grantId)).then((stored) => {
    if (stored instanceof Map) {
      return stored;
    }

    return new Map(
      [...((stored as Map<string, number> | undefined) ?? [])].map((key) => [
        key,
        Infinity,
      ]),
    );
  });
}

async function setGrantMembers(
  store: OidcProviderStorageRepository,
  grantId: string,
  members: Map<string, number>,
): Promise<void> {
  const now = Date.now();
  for (const [key, expiresAt] of members) {
    if (expiresAt <= now) {
      members.delete(key);
    }
  }

  const grantKey = grantKeyFor(grantId);
  if (members.size === 0) {
    await store.delete(grantKey);
    return;
  }

  const expiresAt = Math.max(...members.values());
  const maxAge =
    Number.isFinite(expiresAt) && expiresAt > now ? expiresAt - now : undefined;
  await store.set(grantKey, members, maxAge);
}

async function removeSecondaryIndexes(
  store: OidcProviderStorageRepository,
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (typeof payload.uid === 'string') {
    const sessionUidKey = sessionUidKeyFor(payload.uid);
    if ((await store.get(sessionUidKey)) === id) {
      await store.delete(sessionUidKey);
    }
  }

  if (typeof payload.userCode === 'string') {
    const userCodeKey = userCodeKeyFor(payload.userCode);
    if ((await store.get(userCodeKey)) === id) {
      await store.delete(userCodeKey);
    }
  }
}

async function removeIndexes(
  store: OidcProviderStorageRepository,
  model: string,
  id: string,
  key: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await removeSecondaryIndexes(store, id, payload);

  if (grantable.has(model) && typeof payload.grantId === 'string') {
    const members = await getGrantMembers(store, payload.grantId);
    members.delete(key);
    await setGrantMembers(store, payload.grantId, members);
  }
}

function epochTime(): number {
  return Math.floor(Date.now() / 1000);
}

export class OidcPostgresAdapter {
  constructor(
    private readonly model: string,
    private readonly store: OidcProviderStorageRepository,
    private readonly clockTolerance = 0,
  ) {}

  key(id: string): string {
    return `${this.model}:${id}`;
  }

  async destroy(id: string): Promise<void> {
    const key = this.key(id);
    const payload = await this.store.get(key);
    await this.store.delete(key);

    if (payload && typeof payload === 'object') {
      await removeIndexes(
        this.store,
        this.model,
        id,
        key,
        payload as Record<string, unknown>,
      );
    }
  }

  async consume(id: string): Promise<void> {
    const key = this.key(id);
    const payload = await this.store.get(key);
    if (!payload || typeof payload !== 'object') {
      return;
    }

    (payload as Record<string, unknown>).consumed = epochTime();
    await this.store.replacePayload(key, payload);
  }

  async find(id: string): Promise<unknown> {
    return this.store.get(this.key(id));
  }

  async findByUid(uid: string): Promise<unknown> {
    const id = await this.store.get(sessionUidKeyFor(uid));
    if (typeof id !== 'string') {
      return undefined;
    }

    return this.find(id);
  }

  async findByUserCode(userCode: string): Promise<unknown> {
    const id = await this.store.get(userCodeKeyFor(userCode));
    if (typeof id !== 'string') {
      return undefined;
    }

    return this.find(id);
  }

  async upsert(
    id: string,
    payload: Record<string, unknown>,
    expiresIn?: number,
  ): Promise<void> {
    const key = this.key(id);
    const maxAge = storageOptions(expiresIn, this.clockTolerance);
    const previous = await this.store.get(key);

    if (previous && typeof previous === 'object') {
      await removeIndexes(
        this.store,
        this.model,
        id,
        key,
        previous as Record<string, unknown>,
      );
    }

    if (this.model === 'Session' && typeof payload.uid === 'string') {
      await this.store.set(sessionUidKeyFor(payload.uid), id, maxAge);
    }

    const { grantId, userCode } = payload;
    if (grantable.has(this.model) && typeof grantId === 'string') {
      const members = await getGrantMembers(this.store, grantId);
      const expiresAt =
        typeof expiresIn === 'number'
          ? Date.now() + (expiresIn + this.clockTolerance) * 1000
          : Infinity;
      members.set(key, expiresAt);
      await setGrantMembers(this.store, grantId, members);
    }

    if (typeof userCode === 'string') {
      await this.store.set(userCodeKeyFor(userCode), id, maxAge);
    }

    await this.store.set(key, payload, maxAge);
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const grantKey = grantKeyFor(grantId);
    const members = await getGrantMembers(this.store, grantId);

    if (members.size === 0) {
      return;
    }

    for (const token of members.keys()) {
      const payload = await this.store.get(token);
      await this.store.delete(token);

      if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown> & { jti?: string };
        const tokenId =
          record.jti ?? token.slice(token.indexOf(':') + 1);
        await removeSecondaryIndexes(this.store, tokenId, record);
      }
    }

    await this.store.delete(grantKey);
  }
}
