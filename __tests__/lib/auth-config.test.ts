/**
 * Unit-тесты для lib/auth-config.
 */
import { isCredentialsDefault } from '@/lib/auth-config';

describe('isCredentialsDefault', () => {
  const origAuthUser = process.env.AUTH_USER;

  afterEach(() => {
    process.env.AUTH_USER = origAuthUser;
  });

  it('returns true when AUTH_USER is not set', () => {
    delete process.env.AUTH_USER;
    expect(isCredentialsDefault()).toBe(true);
  });

  it('returns true when AUTH_USER is empty or whitespace', () => {
    process.env.AUTH_USER = '';
    expect(isCredentialsDefault()).toBe(true);

    process.env.AUTH_USER = '   ';
    expect(isCredentialsDefault()).toBe(true);
  });

  it('returns false when AUTH_USER is set', () => {
    process.env.AUTH_USER = 'myuser';
    expect(isCredentialsDefault()).toBe(false);
  });
});
