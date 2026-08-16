import type { Request, Response } from 'express';

export function createCapturingInteractionResponse(): {
  res: Response;
  getRedirectUrl(): string | undefined;
} {
  const headers = new Map<string, string>();

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | string[]) {
      headers.set(name.toLowerCase(), Array.isArray(value) ? value[0] : value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    end() {},
  } as unknown as Response;

  return {
    res,
    getRedirectUrl: () => headers.get('location'),
  };
}

export function extractInteractionUid(returnTo: string): string | null {
  try {
    const url = new URL(returnTo);
    const match = url.pathname.match(/^\/interaction\/([^/]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function createInteractionRequest(
  uid: string,
  cookieHeader: string,
): Request {
  const req = {
    headers: {
      cookie: cookieHeader,
      host: 'localhost:3010',
    },
    params: { uid },
    protocol: 'http',
    secure: false,
    socket: { encrypted: false },
    get(name: string) {
      if (name.toLowerCase() === 'host') {
        return 'localhost:3010';
      }

      return undefined;
    },
  } as unknown as Request;

  return req;
}
