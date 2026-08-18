import { Injectable } from '@nestjs/common';
import {
  OAuthClientStatusEnum,
  OAuthClientTypeEnum,
  OAuthClientUriKindEnum,
} from '@/_db/drizzle/enum';
import { TOAuthClient } from '@/_db/drizzle/schema/oauth';
import { OidcClientRegistry } from './oidc/client/oidc-client.registry';
import {
  OAuthClientConflictError,
  OAuthClientNotFoundError,
  OAuthClientValidationError,
} from './domain/oauth-client.errors';
import { validateUriBundle } from './domain/oauth-client-uri.validation';
import {
  createOAuthClientSchema,
  TCreateOAuthClientInput,
  TUpdateOAuthClientInput,
  updateOAuthClientSchema,
} from './dto/oauth-client.schema';
import {
  OAuthClientRepository,
  TOAuthClientUriInput,
  TOAuthClientWithUris,
} from './repositories/oauth-client.repository';

const DEFAULT_GRANT_TYPES = ['authorization_code', 'refresh_token'];
const DEFAULT_RESPONSE_TYPES = ['code'];
const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

export type TCreateOAuthClientResult = TOAuthClientWithUris & {
  clientSecret?: string;
};

@Injectable()
export class OAuthClientService {
  constructor(
    private readonly oauthClientRepository: OAuthClientRepository,
    private readonly oidcClientRegistry: OidcClientRegistry,
  ) {}

  async create(
    input: TCreateOAuthClientInput,
    createdBy?: string | null,
  ): Promise<TCreateOAuthClientResult> {
    const dto = createOAuthClientSchema.parse(input);
    if (dto.clientType === OAuthClientTypeEnum.CONFIDENTIAL) {
      throw new OAuthClientValidationError(
        'Confidential OAuth clients are not supported until client-secret authentication is implemented',
      );
    }

    await this.assertClientIdAvailable(dto.clientId);

    const uriBundle = validateUriBundle({
      redirectUris: dto.redirectUris,
      postLogoutRedirectUris: dto.postLogoutRedirectUris,
      allowedOrigins: dto.allowedOrigins,
    });

    const pkceRequired = this.resolvePkceRequired(
      dto.clientType,
      dto.pkceRequired,
    );
    let clientSecret: string | undefined;
    let clientSecretHash: string | null = null;

    if (
      dto.clientType === OAuthClientTypeEnum.PUBLIC &&
      dto.pkceRequired === false
    ) {
      throw new OAuthClientValidationError('Public clients must require PKCE');
    }

    const created = await this.oauthClientRepository.createWithUris(
      {
        clientId: dto.clientId,
        name: dto.name,
        description: dto.description ?? null,
        clientType: dto.clientType,
        grantTypes: dto.grantTypes ?? DEFAULT_GRANT_TYPES,
        responseTypes: dto.responseTypes ?? DEFAULT_RESPONSE_TYPES,
        scopes: dto.scopes ?? DEFAULT_SCOPES,
        pkceRequired,
        trustedFirstParty: dto.trustedFirstParty ?? false,
        clientSecretHash,
        status: OAuthClientStatusEnum.ACTIVE,
        createdBy: createdBy ?? null,
      },
      this.toUriRows(uriBundle),
    );

    this.oidcClientRegistry.invalidate(dto.clientId);

    return {
      ...created,
      clientSecret,
    };
  }

  async update(
    id: string,
    input: TUpdateOAuthClientInput,
  ): Promise<TOAuthClientWithUris> {
    const dto = updateOAuthClientSchema.parse(input);
    const existing = await this.oauthClientRepository.findByIdWithUris(id);

    if (!existing) {
      throw new OAuthClientNotFoundError();
    }

    const pkceRequired = dto.pkceRequired ?? existing.client.pkceRequired;

    if (
      existing.client.clientType === OAuthClientTypeEnum.PUBLIC &&
      pkceRequired === false
    ) {
      throw new OAuthClientValidationError('Public clients must require PKCE');
    }

    const updatedClient = await this.oauthClientRepository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.grantTypes !== undefined ? { grantTypes: dto.grantTypes } : {}),
      ...(dto.responseTypes !== undefined
        ? { responseTypes: dto.responseTypes }
        : {}),
      ...(dto.scopes !== undefined ? { scopes: dto.scopes } : {}),
      ...(dto.pkceRequired !== undefined ? { pkceRequired } : {}),
      ...(dto.trustedFirstParty !== undefined
        ? { trustedFirstParty: dto.trustedFirstParty }
        : {}),
    });

    if (!updatedClient) {
      throw new OAuthClientNotFoundError();
    }

    const shouldReplaceUris =
      dto.redirectUris !== undefined ||
      dto.postLogoutRedirectUris !== undefined ||
      dto.allowedOrigins !== undefined;

    if (!shouldReplaceUris) {
      this.oidcClientRegistry.invalidate(existing.client.clientId);
      return {
        client: updatedClient,
        uris: existing.uris,
      };
    }

    const currentBundle = this.fromUriRows(existing.uris);
    const uriBundle = validateUriBundle({
      redirectUris: dto.redirectUris ?? currentBundle.redirectUris,
      postLogoutRedirectUris:
        dto.postLogoutRedirectUris ?? currentBundle.postLogoutRedirectUris,
      allowedOrigins: dto.allowedOrigins ?? currentBundle.allowedOrigins,
    });
    const uris = await this.oauthClientRepository.replaceUris(
      id,
      this.toUriRows(uriBundle),
    );

    this.oidcClientRegistry.invalidate(existing.client.clientId);

    return {
      client: updatedClient,
      uris,
    };
  }

  async disable(id: string): Promise<TOAuthClient> {
    const updated = await this.oauthClientRepository.update(id, {
      status: OAuthClientStatusEnum.DISABLED,
    });

    if (!updated) {
      throw new OAuthClientNotFoundError();
    }

    this.oidcClientRegistry.invalidate(updated.clientId);
    return updated;
  }

  async enable(id: string): Promise<TOAuthClient> {
    const updated = await this.oauthClientRepository.update(id, {
      status: OAuthClientStatusEnum.ACTIVE,
    });

    if (!updated) {
      throw new OAuthClientNotFoundError();
    }

    this.oidcClientRegistry.invalidate(updated.clientId);
    return updated;
  }

  async findById(id: string): Promise<TOAuthClientWithUris> {
    const client = await this.oauthClientRepository.findByIdWithUris(id);

    if (!client) {
      throw new OAuthClientNotFoundError();
    }

    return client;
  }

  async list(options: {
    page: number;
    limit: number;
    status?: (typeof OAuthClientStatusEnum)[keyof typeof OAuthClientStatusEnum];
  }): Promise<{ items: TOAuthClient[]; total: number; page: number; limit: number }> {
    const offset = (options.page - 1) * options.limit;
    const [items, total] = await Promise.all([
      this.oauthClientRepository.list({
        limit: options.limit,
        offset,
        status: options.status,
      }),
      this.oauthClientRepository.count(options.status),
    ]);

    return {
      items,
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async findByClientId(clientId: string): Promise<TOAuthClientWithUris | null> {
    const client = await this.oauthClientRepository.findByClientId(clientId);
    if (!client) {
      return null;
    }

    const uris = await this.oauthClientRepository.findUrisByClientId(client.id);
    return { client, uris };
  }

  private async assertClientIdAvailable(clientId: string): Promise<void> {
    const existing = await this.oauthClientRepository.findByClientId(clientId);
    if (existing) {
      throw new OAuthClientConflictError(
        `OAuth client already exists: ${clientId}`,
      );
    }
  }

  private resolvePkceRequired(
    clientType: (typeof OAuthClientTypeEnum)[keyof typeof OAuthClientTypeEnum],
    pkceRequired?: boolean,
  ): boolean {
    if (clientType === OAuthClientTypeEnum.PUBLIC) {
      return true;
    }

    return pkceRequired ?? true;
  }

  private toUriRows(bundle: {
    redirectUris: string[];
    postLogoutRedirectUris: string[];
    allowedOrigins: string[];
  }): TOAuthClientUriInput[] {
    return [
      ...bundle.redirectUris.map((uri) => ({
        uri,
        kind: OAuthClientUriKindEnum.REDIRECT,
      })),
      ...bundle.postLogoutRedirectUris.map((uri) => ({
        uri,
        kind: OAuthClientUriKindEnum.POST_LOGOUT,
      })),
      ...bundle.allowedOrigins.map((uri) => ({
        uri,
        kind: OAuthClientUriKindEnum.ALLOWED_ORIGIN,
      })),
    ];
  }

  private fromUriRows(uris: TOAuthClientWithUris['uris']): {
    redirectUris: string[];
    postLogoutRedirectUris: string[];
    allowedOrigins: string[];
  } {
    return {
      redirectUris: uris
        .filter((uri) => uri.kind === OAuthClientUriKindEnum.REDIRECT)
        .map((uri) => uri.uri),
      postLogoutRedirectUris: uris
        .filter((uri) => uri.kind === OAuthClientUriKindEnum.POST_LOGOUT)
        .map((uri) => uri.uri),
      allowedOrigins: uris
        .filter((uri) => uri.kind === OAuthClientUriKindEnum.ALLOWED_ORIGIN)
        .map((uri) => uri.uri),
    };
  }
}
