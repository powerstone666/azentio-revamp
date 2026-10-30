import 'server-only';

import path from 'node:path';

/**
 * Azentio brand tokens for email, extracted from azentio.com (see app/globals.css, the az-* tokens).
 * Email clients cannot read CSS variables, so templates take these as {{brand.*}} values.
 */
export const BRAND = {
  navy: '#16303d',
  mint: '#55ffbe',
  green: '#2ed88e',
  mintTint: '#ddfff2',
  greyBg: '#efefef',
  text: '#333333',
  muted: '#76777a',
  white: '#ffffff',
  error: '#e74c3c',
  deepBlue: '#0d1c4f',
  // Poppins is the Azentio typeface. Clients that cannot load web fonts (Gmail, Outlook) fall back down the stack.
  fontStack: "'Poppins', 'Segoe UI', Helvetica, Arial, sans-serif",
  fontsUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  logoCid: 'azentio-logo@azentio',
  radius: '12px',
  shadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
} as const;

/** Absolute http(s) URL for a path, always resolved against the app origin. */
export function absoluteUrl(pathOrUrl: string, origin: string): string {
  const url = new URL(pathOrUrl, origin);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Email links must be http(s); got ${url.protocol}`);
  }
  return url.toString();
}

/**
 * The logo travels inside the email (inline CID attachment) instead of being fetched from the app origin.
 * Mail clients load remote images through their own servers, so an origin such as localhost would show a broken image.
 */
export function logoAttachment() {
  return {
    filename: 'azentio-logo.png',
    path: path.join(process.cwd(), 'public', 'brand', 'azentio-logo-white.png'),
    cid: BRAND.logoCid,
    contentDisposition: 'inline' as const,
  };
}
