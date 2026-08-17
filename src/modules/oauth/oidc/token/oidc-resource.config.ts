import { Injectable } from '@nestjs/common';
import { AppEnvService } from '@/libs/config/app-env.service';

type OidcClientLike = {
  clientId: string;
};

type ResourceServerInfo = {
  audience: string;
  scope: string;
  accessTokenTTL: number;
  accessTokenFormat: 'jwt';
  jwt: {
    sign: { alg: 'RS256' };
  };
};

@Injectable()
export class OidcResourceConfigService {
  constructor(private readonly appEnv: AppEnvService) {}

  get defaultResourceIndicator(): string {
    return this.appEnv.OIDC_DEFAULT_RESOURCE;
  }

  defaultResource = async (
    _ctx: unknown,
    _client: OidcClientLike,
    oneOf?: string,
  ): Promise<string | undefined> => {
    if (oneOf) {
      return oneOf;
    }

    return this.defaultResourceIndicator;
  };

  /**
   * When true, token exchange reuses the resource indicator bound at authorize time
   * (oidc-provider default is false; without this, access tokens stay opaque when
   * openid scope + userinfo are enabled).
   */
  useGrantedResource = async (): Promise<boolean> => true;

  getResourceServerInfo = async (
    _ctx: unknown,
    resourceIndicator: string,
    _client: OidcClientLike,
  ): Promise<ResourceServerInfo> => {
    return {
      audience: resourceIndicator,
      scope: 'openid profile email',
      accessTokenTTL: this.appEnv.OIDC_ACCESS_TOKEN_TTL,
      accessTokenFormat: 'jwt',
      jwt: {
        sign: { alg: 'RS256' },
      },
    };
  };
}
