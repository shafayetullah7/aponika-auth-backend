type SerializedMap = {
  __oidcMap: true;
  entries: [string, number][];
};

function isSerializedMap(value: unknown): value is SerializedMap {
  return (
    typeof value === 'object'
    && value !== null
    && '__oidcMap' in value
    && Array.isArray((value as SerializedMap).entries)
  );
}

export function serializeOidcStorageValue(value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __oidcMap: true,
      entries: [...value.entries()].map(
        ([key, expiresAt]) => [key, expiresAt] as [string, number],
      ),
    } satisfies SerializedMap;
  }

  return value;
}

export function deserializeOidcStorageValue(value: unknown): unknown {
  if (isSerializedMap(value)) {
    return new Map(value.entries);
  }

  return value;
}
