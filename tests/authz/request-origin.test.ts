import { createAuthApiRequest } from '@/app/api/(services)/auth/request-origin';

const AUTH_PATH = '/api/v1/auth/get-session';

function headersOf(entries: Record<string, string>) {
  return new Headers(entries);
}

const ORIGINAL_VERCEL = process.env.VERCEL;

afterEach(() => {
  if (ORIGINAL_VERCEL === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = ORIGINAL_VERCEL;
});

beforeEach(() => {
  delete process.env.VERCEL;
});

describe('createAuthApiRequest: origin from the Host header', () => {
  it.each([
    ['azentio.ai', 'https://azentio.ai'],
    ['www.azentio.ai', 'https://www.azentio.ai'],
    ['portal.azentio.ai:8443', 'https://portal.azentio.ai:8443'],
    ['localhost:3000', 'http://localhost:3000'],
    ['127.0.0.1:3000', 'http://127.0.0.1:3000'],
    ['[::1]:3000', 'http://[::1]:3000'],
  ])('builds the auth request for host %s as %s', (host, origin) => {
    const req = createAuthApiRequest(headersOf({ host }));
    expect(req.url).toBe(`${origin}${AUTH_PATH}`);
  });

  it('forwards only the cookie header to the auth request', () => {
    const req = createAuthApiRequest(headersOf({ host: 'azentio.ai', cookie: 'session=abc', authorization: 'Bearer x', 'x-user-id': 'u-1' }));
    expect(req.headers.get('cookie')).toBe('session=abc');
    expect(req.headers.get('authorization')).toBeNull();
    expect(req.headers.get('x-user-id')).toBeNull();
    expect(req.headers.get('host')).toBeNull();
  });

  it('sends no cookie header when the incoming request has none', () => {
    const req = createAuthApiRequest(headersOf({ host: 'azentio.ai' }));
    expect(req.headers.get('cookie')).toBeNull();
  });

  it.each([
    ['a missing host', {}],
    ['a host with embedded whitespace', { host: 'azentio .ai' }],
    ['a host containing a path', { host: 'azentio.ai/evil' }],
    ['a host containing userinfo', { host: 'user@azentio.ai' }],
    ['a host with an invalid port', { host: 'azentio.ai:99999' }],
    ['a host with a scheme', { host: 'https://azentio.ai' }],
  ])('throws for %s', (_label, entries) => {
    // Out-of-range ports are rejected by the URL parser itself, so the message is not asserted here.
    expect(() => createAuthApiRequest(headersOf(entries))).toThrow();
  });

  it('ignores x-forwarded-host and x-forwarded-proto outside Vercel', () => {
    const req = createAuthApiRequest(headersOf({
      host: 'azentio.ai', 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'http',
    }));
    expect(req.url).toBe(`https://azentio.ai${AUTH_PATH}`);
  });

  it('ignores a forwarded host that is invalid when not on Vercel', () => {
    const req = createAuthApiRequest(headersOf({ host: 'azentio.ai', 'x-forwarded-host': 'bad host' }));
    expect(req.url).toBe(`https://azentio.ai${AUTH_PATH}`);
  });
});

describe('createAuthApiRequest: forwarded headers on Vercel', () => {
  beforeEach(() => {
    process.env.VERCEL = '1';
  });

  it('prefers x-forwarded-host and x-forwarded-proto when on Vercel', () => {
    const req = createAuthApiRequest(headersOf({
      host: 'internal.vercel.local', 'x-forwarded-host': 'azentio.ai', 'x-forwarded-proto': 'https',
    }));
    expect(req.url).toBe(`https://azentio.ai${AUTH_PATH}`);
  });

  it('uses the first protocol when x-forwarded-proto lists several', () => {
    const req = createAuthApiRequest(headersOf({ host: 'azentio.ai', 'x-forwarded-proto': 'http, https' }));
    expect(req.url).toBe(`http://azentio.ai${AUTH_PATH}`);
  });

  it('rejects a forwarded protocol other than http or https', () => {
    expect(() => createAuthApiRequest(headersOf({ host: 'azentio.ai', 'x-forwarded-proto': 'javascript' })))
      .toThrow('The request protocol for authentication is invalid');
  });

  it('rejects a forwarded host that is not a valid hostname', () => {
    expect(() => createAuthApiRequest(headersOf({ host: 'azentio.ai', 'x-forwarded-host': 'evil.example/x' })))
      .toThrow('Cannot determine the request host for authentication');
  });

  it('falls back to the Host header when no forwarded host is sent', () => {
    const req = createAuthApiRequest(headersOf({ host: 'localhost:3000' }));
    expect(req.url).toBe(`http://localhost:3000${AUTH_PATH}`);
  });
});

describe('createAuthApiRequest: explicit request URL', () => {
  it('derives the origin from the supplied request URL and ignores headers', () => {
    const req = createAuthApiRequest(headersOf({ host: 'evil.example', 'x-forwarded-host': 'evil.example' }), 'https://azentio.ai/portal/admin?x=1');
    expect(req.url).toBe(`https://azentio.ai${AUTH_PATH}`);
  });
});
