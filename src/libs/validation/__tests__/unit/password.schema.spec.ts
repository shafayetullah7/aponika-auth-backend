import { passwordSchema } from '../../password.schema';

describe('passwordSchema', () => {
  it('accepts a policy-compliant password', () => {
    const result = passwordSchema.safeParse('Secret123!');
    expect(result.success).toBe(true);
  });

  it('rejects passwords that are too short', () => {
    const result = passwordSchema.safeParse('Se1!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('at least 8');
    }
  });

  it('rejects passwords missing complexity requirements', () => {
    const result = passwordSchema.safeParse('secretsecret');
    expect(result.success).toBe(false);
  });
});
