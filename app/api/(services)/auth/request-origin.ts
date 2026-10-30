import 'server-only';

/**
 * Better Auth can infer its public base URL from a Request. Server Components
 * only expose headers, so construct the internal auth Request with the current
 * deployment origin and the session cookie. Prefer the platform forwarded
 * host/protocol when present; otherwise use the request Host header.
 */
export function createAuthApiRequest(incomingHeaders: Headers, requestUrl?: string): Request {
  let origin: string;
  if (requestUrl) {
    origin = new URL(requestUrl).origin;
  } else {
    const trustVercelProxyHeaders = process.env.VERCEL === '1';
    const forwardedHost = trustVercelProxyHeaders ? incomingHeaders.get('x-forwarded-host') : null;
    const host = forwardedHost ?? incomingHeaders.get('host');
    if (!host || host !== host.trim()
      || !/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::\d{1,5})?$/i.test(host)) {
      throw new Error('Cannot determine the request host for authentication');
    }
    const forwardedProtocol = trustVercelProxyHeaders
      ? incomingHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim()
      : undefined;
    const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
    const protocol = forwardedProtocol ?? (isLoopback ? 'http' : 'https');
    if (protocol !== 'http' && protocol !== 'https') {
      throw new Error('The request protocol for authentication is invalid');
    }
    const parsed = new URL(`${protocol}://${host}`);
    if (parsed.origin === 'null' || parsed.host.toLowerCase() !== host.toLowerCase()) {
      throw new Error('The request host for authentication is invalid');
    }
    origin = parsed.origin;
  }

  const authHeaders = new Headers();
  const cookie = incomingHeaders.get('cookie');
  if (cookie) authHeaders.set('cookie', cookie);
  return new Request(new URL('/api/v1/auth/get-session', origin), { headers: authHeaders });
}
