import { UserStatusEnum } from '@/_db/drizzle/enum';
import { DrizzleService } from '@/_db/drizzle/drizzle.service';
import {
  CreateUserWithCredentialInput,
  IdentityRepository,
} from './identity.repository';

describe('IdentityRepository', () => {
  let repository: IdentityRepository;
  let drizzleService: {
    getExecutor: jest.Mock;
    transaction: jest.Mock;
  };

  const createdAt = new Date('2026-08-16T00:00:00.000Z');

  const sampleUser = {
    id: 'user-uuid',
    email: 'user@example.com',
    status: UserStatusEnum.ACTIVE,
    createdAt,
    updatedAt: createdAt,
  };

  beforeEach(() => {
    drizzleService = {
      getExecutor: jest.fn(),
      transaction: jest.fn(),
    };

    repository = new IdentityRepository(
      drizzleService as unknown as DrizzleService,
    );
  });

  it('findByEmail returns a user when one exists', async () => {
    const limit = jest.fn().mockResolvedValue([sampleUser]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });

    drizzleService.getExecutor.mockReturnValue({ select });

    const result = await repository.findByEmail('user@example.com');

    expect(select).toHaveBeenCalled();
    expect(from).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
    expect(limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(sampleUser);
  });

  it('findByEmail returns null when no user exists', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });

    drizzleService.getExecutor.mockReturnValue({ select });

    const result = await repository.findByEmail('missing@example.com');

    expect(result).toBeNull();
  });

  it('createUserWithCredential inserts user, credential, and optional profile in a transaction', async () => {
    const input: CreateUserWithCredentialInput = {
      email: 'user@example.com',
      passwordHash: 'argon2id-hash',
      displayName: 'Test User',
      emailVerified: false,
    };

    const credential = {
      userId: sampleUser.id,
      passwordHash: input.passwordHash,
      emailVerified: false,
      createdAt,
      updatedAt: createdAt,
    };

    const profile = {
      userId: sampleUser.id,
      displayName: 'Test User',
      createdAt,
      updatedAt: createdAt,
    };

    const userReturning = jest.fn().mockResolvedValue([sampleUser]);
    const credentialReturning = jest.fn().mockResolvedValue([credential]);
    const profileReturning = jest.fn().mockResolvedValue([profile]);

    const tx = {
      insert: jest
        .fn()
        .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ returning: userReturning }) })
        .mockReturnValueOnce({
          values: jest.fn().mockReturnValue({ returning: credentialReturning }),
        })
        .mockReturnValueOnce({
          values: jest.fn().mockReturnValue({ returning: profileReturning }),
        }),
    };

    drizzleService.transaction.mockImplementation(async (callback) =>
      callback(tx),
    );

    const result = await repository.createUserWithCredential(input);

    expect(drizzleService.transaction).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      user: sampleUser,
      credential,
      profile,
    });
  });

  it('createUserWithCredential skips profile when displayName is omitted', async () => {
    const input: CreateUserWithCredentialInput = {
      email: 'user@example.com',
      passwordHash: 'argon2id-hash',
    };

    const credential = {
      userId: sampleUser.id,
      passwordHash: input.passwordHash,
      emailVerified: false,
      createdAt,
      updatedAt: createdAt,
    };

    const userReturning = jest.fn().mockResolvedValue([sampleUser]);
    const credentialReturning = jest.fn().mockResolvedValue([credential]);

    const tx = {
      insert: jest
        .fn()
        .mockReturnValueOnce({ values: jest.fn().mockReturnValue({ returning: userReturning }) })
        .mockReturnValueOnce({
          values: jest.fn().mockReturnValue({ returning: credentialReturning }),
        }),
    };

    drizzleService.transaction.mockImplementation(async (callback) =>
      callback(tx),
    );

    const result = await repository.createUserWithCredential(input);

    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(result.profile).toBeNull();
  });
});
