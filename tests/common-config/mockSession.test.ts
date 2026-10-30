/**
 * @jest-environment jsdom
 */
import {
  MOCK_PERSONA_COOKIE, MOCK_ORG_COOKIE, isMockPersonaEmail, destinationFor,
  setMockPersonaCookie, setMockOrgCookie,
} from '@/app/(ui)/components/portal/signin/mockSession';
import { PERSONAS } from '@/app/(config)/personas';
import { routeExists } from './support/routes';

const persona = (name: string) => PERSONAS.find((p) => p.name === name)!;

function readCookie(name: string): string | undefined {
  const pair = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : undefined;
}

function clearCookies() {
  for (const name of [MOCK_PERSONA_COOKIE, MOCK_ORG_COOKIE]) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

afterEach(clearCookies);

describe('cookie names', () => {
  it('uses stable, distinct names for the persona and organisation cookies', () => {
    expect(MOCK_PERSONA_COOKIE).toBe('azentio_mock_persona');
    expect(MOCK_ORG_COOKIE).toBe('azentio_mock_org');
    expect(MOCK_PERSONA_COOKIE).not.toBe(MOCK_ORG_COOKIE);
  });
});

describe('isMockPersonaEmail', () => {
  it.each(PERSONAS.map((p) => [p.name, p.email] as const))('accepts the persona email of %s', (_name, email) => {
    expect(isMockPersonaEmail(email)).toBe(true);
  });

  it.each([
    ['upper-case', 'DANA.WHITFIELD@AZENTIO.COM'],
    ['surrounding spaces', '  dana.whitfield@azentio.com  '],
    ['percent-encoded at sign', 'dana.whitfield%40azentio.com'],
  ])('accepts a %s form of a persona email', (_name, value) => {
    expect(isMockPersonaEmail(value)).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['an unknown email', 'stranger@azentio.com'],
    ['a persona local part with another domain', 'dana.whitfield@example.com'],
    ['a malformed percent-encoding', '%E0%A4%A'],
  ])('rejects %s', (_name, value) => {
    expect(isMockPersonaEmail(value)).toBe(false);
  });
});

describe('destinationFor', () => {
  it.each([
    ['Dana Whitfield', '/portal/employee'],
    ['Marcus Oyelaran', '/portal/employee'],
    ['Ines Calderon', '/portal/moderator'],
    ['Tomas Reiniger', '/portal/product-owner'],
    ['Sunita Varghese', '/portal/admin'],
    ['Priya Natarajan', '/workspace/select'],
  ])('sends %s to the page for their role', (name, expected) => {
    expect(destinationFor(persona(name))).toBe(expected);
  });

  it.each([
    ['Amira Haddad'], ['Rahul Menon'], ['Tariq Bashir'], ['Elena Voss'], ['Wira Santoso'], ['Mei Lan Tran'], ['Grace Adeyemi'], ['Hana Berg'],
  ])('sends client user %s to the client portal', (name) => {
    expect(destinationFor(persona(name))).toBe('/portal/client');
  });

  it('only returns destinations that are real app routes', () => {
    for (const p of PERSONAS) expect(routeExists(destinationFor(p))).toBe(true);
  });

  it('falls back to the client portal for an unlisted persona', () => {
    expect(destinationFor({ ...persona('Dana Whitfield'), email: 'nobody@example.test' })).toBe('/portal/client');
  });
});

describe('cookie setters', () => {
  it('stores the persona email URL-encoded so it round-trips through isMockPersonaEmail', () => {
    setMockPersonaCookie('sunita.varghese@azentio.com');
    const raw = readCookie(MOCK_PERSONA_COOKIE);
    expect(raw).toBe('sunita.varghese%40azentio.com');
    expect(isMockPersonaEmail(raw)).toBe(true);
  });

  it('stores the org id under the organisation cookie name', () => {
    setMockOrgCookie('harborline');
    expect(readCookie(MOCK_ORG_COOKIE)).toBe('harborline');
  });

  it('overwrites an earlier persona cookie rather than adding a second one', () => {
    setMockPersonaCookie('dana.whitfield@azentio.com');
    setMockPersonaCookie('priya.natarajan@advisory-partner.example');
    const matches = document.cookie.split('; ').filter((c) => c.startsWith(`${MOCK_PERSONA_COOKIE}=`));
    expect(matches).toHaveLength(1);
    expect(readCookie(MOCK_PERSONA_COOKIE)).toBe('priya.natarajan%40advisory-partner.example');
  });

  it('encodes unusual characters in an org id instead of letting them split the cookie', () => {
    setMockOrgCookie('a; path=/evil');
    expect(readCookie(MOCK_ORG_COOKIE)).toBe('a%3B%20path%3D%2Fevil');
  });
});
