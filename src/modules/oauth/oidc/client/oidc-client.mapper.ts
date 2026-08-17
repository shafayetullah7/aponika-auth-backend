import { OAuthClientUriKindEnum } from '@/_db/drizzle/enum';
import { OAuthClientStatusEnum } from '@/_db/drizzle/enum/oauth-client-status.enum';
import { OAuthClientTypeEnum } from '@/_db/drizzle/enum/oauth-client-type.enum';
import { TOAuthClientWithUris } from '@/modules/oauth/repositories/oauth-client.repository';

/** Payload shape returned by the oidc-provider Client storage adapter `find` method. */
export type OidcClientPayload = {
  client_id: string;
  grant_types: string[];
  response_types: string[];
  redirect_uris: string[];
  post_logout_redirect_uris?: string[];
  token_endpoint_auth_method: 'none' | 'client_secret_post' | 'client_secret_basic';
  scope: string;
  application_type: 'web';
};

export function mapOAuthClientToOidcPayload(
  bundle: TOAuthClientWithUris,
): OidcClientPayload | undefined {
  if (bundle.client.status !== OAuthClientStatusEnum.ACTIVE) {
    return undefined;
  }

  const redirectUris = bundle.uris
    .filter((uri) => uri.kind === OAuthClientUriKindEnum.REDIRECT)
    .map((uri) => uri.uri);

  const postLogoutRedirectUris = bundle.uris
    .filter((uri) => uri.kind === OAuthClientUriKindEnum.POST_LOGOUT)
    .map((uri) => uri.uri);

  const isPublic = bundle.client.clientType === OAuthClientTypeEnum.PUBLIC;

  const grantTypes = bundle.client.grantTypes.filter(
    (grant) =>
      grant === 'authorization_code' ||
      grant === 'implicit' ||
      grant === 'refresh_token',
  );

  if (grantTypes.length === 0 && bundle.client.responseTypes.includes('code')) {
    grantTypes.push('authorization_code');
  }

  return {
    client_id: bundle.client.clientId,
    grant_types: grantTypes,
    response_types: bundle.client.responseTypes,
    redirect_uris: redirectUris,
    post_logout_redirect_uris:
      postLogoutRedirectUris.length > 0 ? postLogoutRedirectUris : undefined,
    token_endpoint_auth_method: isPublic ? 'none' : 'client_secret_post',
    scope: bundle.client.scopes.join(' '),
    application_type: 'web',
  };
}
