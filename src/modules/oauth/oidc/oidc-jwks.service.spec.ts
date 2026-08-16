import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import type { AppEnvService } from '@/libs/config/app-env.service';
import { OidcBootConfigError } from './oidc-issuer.validation';
import {
  OIDC_SIGNING_KID,
  OidcJwksService,
} from './oidc-jwks.service';

function createAppEnv(
  overrides: Partial<AppEnvService> = {},
): AppEnvService {
  return {
    OIDC_JWKS_PRIVATE_KEY_PATH: '',
    ...overrides,
  } as AppEnvService;
}

describe('OidcJwksService', () => {
  let service: OidcJwksService;

  beforeEach(() => {
    service = new OidcJwksService(createAppEnv());
  });

  it('returns undefined when no private key path is configured', async () => {
    await expect(service.loadSigningJwks()).resolves.toBeUndefined();
  });

  it(
    'loads RS256 signing JWKS from PEM file',
    async () => {
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const pem = privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString();
      const dir = await mkdtemp(join(tmpdir(), 'aponika-oidc-jwks-'));
      const keyPath = join(dir, 'signing.pem');
      await writeFile(keyPath, pem, 'utf8');

      service = new OidcJwksService(
        createAppEnv({ OIDC_JWKS_PRIVATE_KEY_PATH: keyPath }),
      );

      const jwks = await service.loadSigningJwks();

      expect(jwks?.keys).toHaveLength(1);
      expect(jwks?.keys[0]).toMatchObject({
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: OIDC_SIGNING_KID,
      });
      expect(jwks?.keys[0].d).toBeDefined();
    },
    30_000,
  );

  it(
    'strips private JWK fields for public JWKS',
    async () => {
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const pem = privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString();
      const dir = await mkdtemp(join(tmpdir(), 'aponika-oidc-jwks-'));
      const keyPath = join(dir, 'signing.pem');
      await writeFile(keyPath, pem, 'utf8');

      service = new OidcJwksService(
        createAppEnv({ OIDC_JWKS_PRIVATE_KEY_PATH: keyPath }),
      );

      const privateJwks = await service.loadSigningJwks();
      const publicJwks = service.toPublicJwks(privateJwks!);

      expect(publicJwks.keys[0].d).toBeUndefined();
      expect(publicJwks.keys[0].n).toBeDefined();
      expect(publicJwks.keys[0].e).toBeDefined();
    },
    30_000,
  );

  it('throws when configured key file is missing', async () => {
    service = new OidcJwksService(
      createAppEnv({ OIDC_JWKS_PRIVATE_KEY_PATH: '/tmp/does-not-exist.pem' }),
    );

    await expect(service.assertPrivateKeyAvailable()).rejects.toThrow(
      OidcBootConfigError,
    );
  });
});
