import { OAuthClientStatusEnum } from '@/_db/drizzle/enum';
import { OAuthClientNotFoundError } from './domain/oauth-client.errors';
import { OAuthClientRepository } from './oauth-client.repository';
import { OAuthClientService } from './oauth-client.service';

jest.mock('@/libs/crypto/password', () => ({
  generateClientSecret: jest.fn(() => 'generated-client-secret'),
  hashPassword: jest.fn(async () => 'hashed-client-secret'),
}));

describe('OAuthClientService list/find/enable', () => {
  const repository = {
    list: jest.fn(),
    count: jest.fn(),
    findByIdWithUris: jest.fn(),
    update: jest.fn(),
  };

  let service: OAuthClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OAuthClientService(
      repository as unknown as OAuthClientRepository,
    );
  });

  it('lists clients with pagination meta', async () => {
    repository.list.mockResolvedValue([{ id: 'client-1' }]);
    repository.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, limit: 20 });

    expect(result).toEqual({
      items: [{ id: 'client-1' }],
      total: 1,
      page: 1,
      limit: 20,
    });
    expect(repository.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      status: undefined,
    });
  });

  it('finds client by id', async () => {
    repository.findByIdWithUris.mockResolvedValue({
      client: { id: 'client-1' },
      uris: [],
    });

    const result = await service.findById('client-1');
    expect(result.client.id).toBe('client-1');
  });

  it('throws when client id is missing', async () => {
    repository.findByIdWithUris.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      OAuthClientNotFoundError,
    );
  });

  it('enables a disabled client', async () => {
    repository.update.mockResolvedValue({
      id: 'client-1',
      status: OAuthClientStatusEnum.ACTIVE,
    });

    const result = await service.enable('client-1');
    expect(result.status).toBe(OAuthClientStatusEnum.ACTIVE);
  });
});
