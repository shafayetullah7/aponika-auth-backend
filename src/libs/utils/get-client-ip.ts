import type { Request } from 'express';

export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];

  let ipFromHeader: string | undefined;
  if (Array.isArray(xForwardedFor)) {
    ipFromHeader = xForwardedFor[0];
  } else if (typeof xForwardedFor === 'string') {
    ipFromHeader = xForwardedFor.split(',')[0];
  }

  const ip =
    ipFromHeader?.trim() ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown';

  if (ip === '::1') {
    return '127.0.0.1';
  }

  return ip;
}
