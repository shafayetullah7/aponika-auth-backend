import { OidcClientAdapter } from './oidc-client.adapter';
import { OidcClientRegistry } from '../client/oidc-client.registry';

type MemoryAdapterModule = {
  default: new (name: string) => OidcStorageAdapter;
};

export type OidcStorageAdapter = {
  find(id: string): Promise<unknown>;
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

export async function createOidcAdapterFactory(registry: OidcClientRegistry) {
  const MemoryAdapter = await getMemoryAdapterCtor();
  const memoryAdapters = new Map<string, OidcStorageAdapter>();

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
