import { parseDurationMs } from '../../parse-duration';

describe('parseDurationMs', () => {
  it('parses minutes', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60 * 1000);
  });

  it('parses days', () => {
    expect(parseDurationMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
