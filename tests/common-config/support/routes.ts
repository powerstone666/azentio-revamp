// Maps app/**/page.tsx files to URL patterns so tests can check that internal links point at real routes.
// Route groups such as (public) are transparent; [slug] and [...rest] are dynamic segments.
import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = path.resolve(__dirname, '../../../app');

function walk(dir: string, out: string[]): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Each entry is the URL pattern segments for one page, e.g. ['portal', 'client', 'observations', '[id]']. */
export const APP_ROUTES: string[][] = walk(APP_DIR, [])
  .map((file) => path.relative(APP_DIR, path.dirname(file)).split(path.sep).filter(Boolean))
  .map((segments) => segments.filter((s) => !(s.startsWith('(') && s.endsWith(')'))))
  .sort((a, b) => a.join('/').localeCompare(b.join('/')));

function matches(pattern: string[], target: string[]): boolean {
  let i = 0;
  for (; i < pattern.length; i++) {
    const seg = pattern[i];
    if (seg.startsWith('[...')) return target.length > i; // catch-all needs at least one segment
    if (i >= target.length) return false;
    if (seg.startsWith('[')) continue; // dynamic segment: any non-empty value
    if (seg !== target[i]) return false;
  }
  return i === target.length;
}

/** True when an internal href (path only; query and hash are ignored) is served by a page in app/. */
export function routeExists(href: string): boolean {
  const pathOnly = href.split('#')[0].split('?')[0];
  const target = pathOnly.split('/').filter(Boolean);
  return APP_ROUTES.some((pattern) => matches(pattern, target));
}
