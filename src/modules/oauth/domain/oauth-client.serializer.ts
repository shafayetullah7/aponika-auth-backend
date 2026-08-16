import { OAuthClientUriKindEnum } from '@/_db/drizzle/enum';
import {
  TOAuthClient,
  TOAuthClientRedirectUri,
} from '@/_db/drizzle/schema/oauth';
import { TOAuthClientWithUris } from '../oauth-client.repository';

export type SerializedOAuthClient = {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  clientType: TOAuthClient['clientType'];
  grantTypes: string[];
  responseTypes: string[];
  scopes: string[];
  pkceRequired: boolean;
  status: TOAuthClient['status'];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
  allowedOrigins?: string[];
  clientSecret?: string;
};

export function serializeOAuthClientSummary(
  client: TOAuthClient,
): SerializedOAuthClient {
  return {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    description: client.description,
    clientType: client.clientType,
    grantTypes: client.grantTypes,
    responseTypes: client.responseTypes,
    scopes: client.scopes,
    pkceRequired: client.pkceRequired,
    status: client.status,
    createdBy: client.createdBy,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export function serializeOAuthClientDetail(
  result: TOAuthClientWithUris & { clientSecret?: string },
): SerializedOAuthClient {
  const uris = groupUris(result.uris);

  return {
    ...serializeOAuthClientSummary(result.client),
    redirectUris: uris.redirectUris,
    postLogoutRedirectUris: uris.postLogoutRedirectUris,
    allowedOrigins: uris.allowedOrigins,
    ...(result.clientSecret ? { clientSecret: result.clientSecret } : {}),
  };
}

function groupUris(uris: TOAuthClientRedirectUri[]): {
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
