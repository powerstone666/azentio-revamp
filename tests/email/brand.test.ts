import fs from 'node:fs';
import { BRAND, absoluteUrl, logoAttachment } from '@/app/api/(services)/email/brand';

const ORIGIN = 'https://portal.example.test';

describe('BRAND tokens', () => {
  it.each([
    ['navy', '#16303d'],
    ['mint', '#55ffbe'],
    ['green', '#2ed88e'],
  ])('uses the Azentio %s colour %s', (key, hex) => {
    expect(BRAND[key as 'navy' | 'mint' | 'green']).toBe(hex);
  });

  it('uses a cid-style logo id that cannot collide with a URL', () => {
    expect(BRAND.logoCid).toBe('azentio-logo@azentio');
  });
});

describe('absoluteUrl', () => {
  it.each([
    ['a relative path is resolved on the origin', '/portal/client', `${ORIGIN}/portal/client`],
    ['a path with a query string keeps it', '/search?q=audit&page=2', `${ORIGIN}/search?q=audit&page=2`],
    ['an absolute https URL is kept as given', 'https://other.example.test/x', 'https://other.example.test/x'],
    ['an absolute http URL is kept as given', 'http://other.example.test/y', 'http://other.example.test/y'],
  ])('%s', (_label, input, expected) => {
    expect(absoluteUrl(input, ORIGIN)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://files.example.test/report.pdf',
    'mailto:someone@example.test',
  ])('rejects the non-http(s) URL %s', (input) => {
    expect(() => absoluteUrl(input, ORIGIN)).toThrow(/http\(s\)/);
  });
});

describe('logoAttachment', () => {
  it('attaches the white logo inline under the brand cid', () => {
    const attachment = logoAttachment();
    expect(attachment.cid).toBe(BRAND.logoCid);
    expect(attachment.contentDisposition).toBe('inline');
    expect(attachment.filename).toBe('azentio-logo.png');
  });

  it('points at an existing PNG file in public/brand', () => {
    const { path } = logoAttachment();
    expect(path).toMatch(/public[\\/]brand[\\/]azentio-logo-white\.png$/);
    expect(fs.existsSync(path)).toBe(true);
    const header = fs.readFileSync(path).subarray(0, 4);
    expect([...header]).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG signature
  });
});
