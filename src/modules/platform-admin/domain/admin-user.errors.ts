export class AdminUserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'AdminUserNotFoundError';
  }
}
