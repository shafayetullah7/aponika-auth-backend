import { OidcClientRegistry } from './oidc-client.registry';

export class OidcClientAdapter {
  constructor(private readonly registry: OidcClientRegistry) {}

  async find(id: string) {
    return this.registry.findPayload(id);
  }
}
