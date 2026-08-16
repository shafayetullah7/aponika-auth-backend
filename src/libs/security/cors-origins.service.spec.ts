import { CorsOriginsService } from './cors-origins.service';

describe('CorsOriginsService', () => {
  const appEnv = {
    CORS_ORIGINS: 'http://localhost:3011,http://localhost:3012',
    AUTH_FRONTEND_URL: 'http://localhost:3011',
  };

  const oauthClientRepository = {
    listCorsUrisForActiveClients: jest.fn(),
  };

  let service: CorsOriginsService;

  beforeEach(() => {
    jest.clearAllMocks();
    oauthClientRepository.listCorsUrisForActiveClients.mockResolvedValue([
      'http://localhost:3000/auth/callback',
      'http://localhost:3000/',
    ]);
    service = new CorsOriginsService(
      appEnv as never,
      oauthClientRepository as never,
    );
  });

  it('merges env origins with active OAuth client redirect origins', async () => {
    const origins = await service.refresh();

    expect(origins).toEqual(
      expect.arrayContaining([
        'http://localhost:3011',
        'http://localhost:3012',
        'http://localhost:3000',
      ]),
    );
  });

  it('rejects unknown browser origins', async () => {
    await service.refresh();

    expect(await service.isAllowed('http://evil.example')).toBe(false);
    expect(await service.isAllowed('http://localhost:3000')).toBe(true);
  });
});
