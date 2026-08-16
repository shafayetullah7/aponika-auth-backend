export type DeviceInfo = Record<string, unknown>;

export function parseDeviceInfo(userAgent: string): DeviceInfo {
  return {
    userAgent,
    isBot: /bot|crawl|spider|slurp/i.test(userAgent),
  };
}
