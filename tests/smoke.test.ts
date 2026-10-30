import { absoluteUrl, BRAND } from '@/app/api/(services)/email/brand';

describe('jest harness', () => {
  it('resolves the @/ alias and stubs server-only', () => {
    expect(absoluteUrl('/login', 'https://example.org')).toBe('https://example.org/login');
    expect(BRAND.navy).toBe('#16303d');
  });
});
