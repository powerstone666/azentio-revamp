import { PERSONAS, PERSONA_GROUPS, ACCESS, type PersonaGroup } from '@/app/(config)/personas';

const emailOf = (name: string) => PERSONAS.find((p) => p.name === name)!.email;

describe('PERSONAS identities', () => {
  it('has unique, lowercase email addresses', () => {
    const emails = PERSONAS.map((p) => p.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) expect(email).toBe(email.toLowerCase());
  });

  it.each(PERSONAS.map((p) => [p.name, p] as const))('%s uses a synthetic address (azentio.com staff or .example client)', (_name, persona) => {
    expect(persona.email.endsWith('@azentio.com') || persona.email.endsWith('.example')).toBe(true);
  });

  it('gives every persona a name, org, role and purpose', () => {
    for (const persona of PERSONAS) {
      expect(persona.name.trim()).not.toBe('');
      expect(persona.org.trim()).not.toBe('');
      expect(persona.role.trim()).not.toBe('');
      expect(persona.purpose.trim()).not.toBe('');
    }
  });

  it('puts every persona in one of the declared groups, and each group is used', () => {
    for (const persona of PERSONAS) expect(PERSONA_GROUPS).toContain(persona.group);
    const used = new Set(PERSONAS.map((p) => p.group));
    expect([...used].sort()).toEqual([...PERSONA_GROUPS].sort());
  });

  it('keeps the expected group sizes (5 staff, 8 client users, 4 edge cases)', () => {
    const count = (group: PersonaGroup) => PERSONAS.filter((p) => p.group === group).length;
    expect(count('Azentio staff')).toBe(5);
    expect(count('Client users')).toBe(8);
    expect(count('Edge cases')).toBe(4);
  });

  it('places Azentio staff only on azentio.com addresses', () => {
    for (const persona of PERSONAS.filter((p) => p.group === 'Azentio staff')) {
      expect(persona.email).toMatch(/@azentio\.com$/);
    }
  });
});

describe('ACCESS matrix', () => {
  it('has exactly one entry per persona and no entries for unknown emails', () => {
    const personaEmails = PERSONAS.map((p) => p.email).sort();
    expect(Object.keys(ACCESS).sort()).toEqual(personaEmails);
  });

  it.each(Object.entries(ACCESS))('%s has a summary and non-empty can and cannot lists', (_email, access) => {
    expect(access.summary.trim()).not.toBe('');
    expect(access.can.length).toBeGreaterThan(0);
    expect(access.cannot.length).toBeGreaterThan(0);
    for (const line of [...access.can, ...access.cannot]) expect(line.trim()).not.toBe('');
  });

  it('gives exactly one persona the full access level, and it is the portal admin', () => {
    const full = Object.entries(ACCESS).filter(([, a]) => a.level === 'full').map(([email]) => email);
    expect(full).toEqual([emailOf('Sunita Varghese')]);
    const admin = PERSONAS.find((p) => p.email === full[0])!;
    expect(admin.role).toBe('Portal admin');
  });

  it('marks exactly the revoked, unprovisioned and uninvited personas as denied', () => {
    const denied = Object.entries(ACCESS).filter(([, a]) => a.level === 'denied').map(([email]) => email).sort();
    expect(denied).toEqual([
      emailOf('Finance Lead'),
      emailOf('Kofi Mensah'),
      emailOf('Omar Rahim'),
    ].sort());
  });

  it.each([
    ['Omar Rahim', 'Revoked member'],
    ['Kofi Mensah', 'Unprovisioned @azentio.com'],
    ['Finance Lead', 'Matching email suffix'],
  ])('%s is a denied edge case with role "%s"', (name, role) => {
    const persona = PERSONAS.find((p) => p.name === name)!;
    expect(persona.group).toBe('Edge cases');
    expect(persona.role).toBe(role);
    expect(ACCESS[persona.email].level).toBe('denied');
  });

  it('gives Hana Berg a limited, not denied, level because she signs in with no entitlements', () => {
    expect(ACCESS[emailOf('Hana Berg')].level).toBe('limited');
  });

  it('never grants a persona an admin capability it is not supposed to have', () => {
    const adminClaim = (line: string) => /\b(Manage (organisations|orgs)|Grant and revoke every role)\b/i.test(line);
    const nonFull = Object.values(ACCESS).filter((access) => access.level !== 'full');
    expect(nonFull.length).toBeGreaterThan(0);
    for (const access of nonFull) expect(access.can.some(adminClaim)).toBe(false);
  });

  it('keeps Priya Natarajan in the workspace switcher with two organisations', () => {
    const priya = PERSONAS.find((p) => p.name === 'Priya Natarajan')!;
    expect(priya.role).toBe('Member of two orgs');
    expect(ACCESS[priya.email].can.join(' ')).toMatch(/Switch between Harborline and Sandune/);
  });
});
