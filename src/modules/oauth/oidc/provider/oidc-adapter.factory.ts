import { OidcClientAdapter } from './oidc-client.adapter';
import { OidcClientRegistry } from '../client/oidc-client.registry';
import { OidcPostgresAdapter } from './oidc-postgres.adapter';
import type { OidcProviderStorageRepository } from './oidc-provider-storage.repository';

type MemoryAdapterModule = {
  default: new (name: string) => OidcStorageAdapter;
};

export type OidcStorageAdapter = {
  find(id: string): Promise<unknown>;
  findByUid?(uid: string): Promise<unknown>;
  findByUserCode?(userCode: string): Promise<unknown>;
  upsert?(
    id: string,
    payload: Record<string, unknown>,
    expiresIn?: number,
  ): Promise<void>;
  destroy?(id: string): Promise<void>;
  consume?(id: string): Promise<void>;
  revokeByGrantId?(grantId: string): Promise<void>;
};

let memoryAdapterCtor: MemoryAdapterModule['default'] | null = null;

async function getMemoryAdapterCtor(): Promise<MemoryAdapterModule['default']> {
  if (!memoryAdapterCtor) {
    const mod = (await import(
      'oidc-provider/lib/adapters/memory_adapter.js'
    )) as MemoryAdapterModule;
    memoryAdapterCtor = mod.default;
  }

  return memoryAdapterCtor;
}

export type OidcAdapterStorageBackend = 'memory' | 'postgres';

export type CreateOidcAdapterFactoryOptions = {
  storage?: OidcAdapterStorageBackend;
  storageRepository?: OidcProviderStorageRepository;
};

export async function createOidcAdapterFactory(
  registry: OidcClientRegistry,
  options: CreateOidcAdapterFactoryOptions = {},
) {
  const storage = options.storage ?? 'memory';
  const memoryAdapters = new Map<string, OidcStorageAdapter>();
  const postgresAdapters = new Map<string, OidcPostgresAdapter>();

  if (storage === 'postgres') {
    if (!options.storageRepository) {
      throw new Error(
        'OidcProviderStorageRepository is required for postgres OIDC storage',
      );
    }

    const repository = options.storageRepository;

    return (modelName: string): OidcStorageAdapter => {
      if (modelName === 'Client') {
        return new OidcClientAdapter(registry);
      }

      let adapter = postgresAdapters.get(modelName);
      if (!adapter) {
        adapter = new OidcPostgresAdapter(modelName, repository);
        postgresAdapters.set(modelName, adapter);
      }

      return adapter;
    };
  }

  const MemoryAdapter = await getMemoryAdapterCtor();

  return (modelName: string): OidcStorageAdapter => {
    if (modelName === 'Client') {
      return new OidcClientAdapter(registry);
    }

    let adapter = memoryAdapters.get(modelName);
    if (!adapter) {
      adapter = new MemoryAdapter(modelName);
      memoryAdapters.set(modelName, adapter);
    }

    return adapter;
  };
}
