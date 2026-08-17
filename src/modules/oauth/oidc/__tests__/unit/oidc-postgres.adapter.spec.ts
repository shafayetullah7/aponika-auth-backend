import { OidcPostgresAdapter } from '../../provider/oidc-postgres.adapter';
import type { OidcProviderStorageRepository } from '../../provider/oidc-provider-storage.repository';
import {
  deserializeOidcStorageValue,
  serializeOidcStorageValue,
} from '../../provider/oidc-provider-storage.serialization';

describe('oidc-provider storage serialization', () => {
  it('round-trips Map payloads used for grant membership', () => {
    const members = new Map<string, number>([
      ['AccessToken:token-1', Date.now() + 60_000],
      ['RefreshToken:token-2', Date.now() + 120_000],
    ]);

    const restored = deserializeOidcStorageValue(
      serializeOidcStorageValue(members),
    );

    expect(restored).toBeInstanceOf(Map);
    expect((restored as Map<string, number>).get('AccessToken:token-1')).toBe(
      members.get('AccessToken:token-1'),
    );
  });
});

describe('OidcPostgresAdapter', () => {
  function createRepositoryMock() {
    const rows = new Map<
      string,
      { payload: unknown; expiresAt: Date | null }
    >();

    const repository = {
      get: jest.fn(async (key: string) => {
        const row = rows.get(key);
        if (!row) {
          return undefined;
        }

        if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
          rows.delete(key);
          return undefined;
        }

        return deserializeOidcStorageValue(row.payload);
      }),
      set: jest.fn(
        async (key: string, value: unknown, maxAgeMs?: number) => {
          rows.set(key, {
            payload: serializeOidcStorageValue(value),
            expiresAt:
              typeof maxAgeMs === 'number'
                ? new Date(Date.now() + maxAgeMs)
                : null,
          });
        },
      ),
      delete: jest.fn(async (key: string) => {
        rows.delete(key);
      }),
      replacePayload: jest.fn(async (key: string, value: unknown) => {
        const row = rows.get(key);
        if (!row) {
          return;
        }

        row.payload = serializeOidcStorageValue(value);
      }),
    } satisfies Pick<
      OidcProviderStorageRepository,
      'get' | 'set' | 'delete' | 'replacePayload'
    >;

    return { repository, rows };
  }

  it('stores and retrieves interaction payloads with TTL', async () => {
    const { repository } = createRepositoryMock();
    const adapter = new OidcPostgresAdapter('Interaction', repository as never);

    await adapter.upsert(
      'interaction-1',
      {
        prompt: { name: 'login' },
        params: { client_id: 'byte-forge-web' },
        returnTo: 'http://localhost:3010/auth',
      },
      3600,
    );

    const stored = await adapter.find('interaction-1');
    expect(stored).toMatchObject({
      prompt: { name: 'login' },
      params: { client_id: 'byte-forge-web' },
    });
  });

  it('indexes session uid lookups', async () => {
    const { repository } = createRepositoryMock();
    const adapter = new OidcPostgresAdapter('Session', repository as never);

    await adapter.upsert('session-1', { uid: 'uid-1', accountId: 'user-1' }, 3600);

    const stored = await adapter.findByUid('uid-1');
    expect(stored).toMatchObject({
      uid: 'uid-1',
      accountId: 'user-1',
    });
  });

  it('destroys records and secondary indexes', async () => {
    const { repository } = createRepositoryMock();
    const adapter = new OidcPostgresAdapter('Session', repository as never);

    await adapter.upsert('session-1', { uid: 'uid-1', accountId: 'user-1' }, 3600);
    await adapter.destroy('session-1');

    expect(await adapter.find('session-1')).toBeUndefined();
    expect(await adapter.findByUid('uid-1')).toBeUndefined();
  });
});
