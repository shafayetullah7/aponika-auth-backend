export class AdminUserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'AdminUserNotFoundError';
  }
}

export class AdminUserSessionNotFoundError extends Error {
  constructor(message = 'Session not found') {
    super(message);
    this.name = 'AdminUserSessionNotFoundError';
  }
}
