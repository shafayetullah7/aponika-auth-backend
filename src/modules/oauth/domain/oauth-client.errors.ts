export class OAuthClientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthClientValidationError';
  }
}

export class OAuthClientNotFoundError extends Error {
  constructor(message = 'OAuth client not found') {
    super(message);
    this.name = 'OAuthClientNotFoundError';
  }
}

export class OAuthClientConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthClientConflictError';
  }
}
