import { Test, TestingModule } from '@nestjs/testing';
import { JwtResourceGuard } from '@/libs/auth/jwt-resource.guard';
import { OidcJwksClientService } from '@/libs/auth/oidc-jwks-client.service';
import { ResponseService } from '@/libs/response/response.service';
import { ExampleController } from './example.controller';

describe('ExampleController', () => {
  let controller: ExampleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExampleController],
      providers: [ResponseService],
    })
      .overrideGuard(JwtResourceGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ExampleController);
  });

  it('returns verified subject from access token context', () => {
    const result = controller.getProtected({
      sub: 'user-1',
      email: 'user@example.com',
      email_verified: true,
      aud: 'http://localhost:3005',
      iss: 'http://localhost:3010',
      claims: { sub: 'user-1' },
    });

    expect(result.data).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      email_verified: true,
    });
  });
});
