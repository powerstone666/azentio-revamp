import * as types from '@/app/(common-lib)/types';
import {
  AccessDeniedError, UnprovisionedAccountError, RevokedMembershipError, UninvitedDomainError,
} from '@/app/(common-lib)/types/errors';

describe('AccessDeniedError', () => {
  it('defaults to a 403 with NO_APPROVED_MEMBERSHIP and uses the message as the summary', () => {
    const error = new AccessDeniedError('Denied', { email: 'kofi.mensah@azentio.com' });
    expect(error.status).toBe(403);
    expect(error.code).toBe('NO_APPROVED_MEMBERSHIP');
    expect(error.summary).toBe('Denied');
    expect(error.name).toBe('AccessDeniedError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AccessDeniedError);
  });

  it('keeps the email, persona, role and explicit summary it was given', () => {
    const error = new AccessDeniedError('Denied', {
      email: 'omar.rahim@sandune-finance.example',
      code: 'REVOKED_MEMBERSHIP',
      personaName: 'Omar Rahim',
      role: 'Revoked member',
      summary: 'Revoked.',
    });
    expect(error.code).toBe('REVOKED_MEMBERSHIP');
    expect(error.personaName).toBe('Omar Rahim');
    expect(error.role).toBe('Revoked member');
    expect(error.summary).toBe('Revoked.');
  });

  it('serialises to JSON with exactly the public fields and an ISO timestamp', () => {
    const error = new AccessDeniedError('Denied', { email: 'a@example.test', code: 'INSUFFICIENT_PERMISSIONS' });
    const json = error.toJSON();
    expect(Object.keys(json).sort()).toEqual(['code', 'email', 'personaName', 'role', 'status', 'summary', 'timestamp']);
    expect(json.status).toBe(403);
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
    expect(json).not.toHaveProperty('stack');
  });
});

describe('access denial subclasses', () => {
  it.each([
    ['UnprovisionedAccountError', UnprovisionedAccountError, 'kofi.mensah@azentio.com', 'UNPROVISIONED_AZENTIO_EMAIL'],
    ['RevokedMembershipError', RevokedMembershipError, 'omar.rahim@sandune-finance.example', 'REVOKED_MEMBERSHIP'],
    ['UninvitedDomainError', UninvitedDomainError, 'finance.lead@harborline-bank.example', 'UNINVITED_DOMAIN'],
  ] as const)('%s carries its reason code, 403 status and the email', (name, ErrorClass, email, code) => {
    const error = new ErrorClass(email, 'Persona');
    expect(error.name).toBe(name);
    expect(error.code).toBe(code);
    expect(error.status).toBe(403);
    expect(error.email).toBe(email);
    expect(error.personaName).toBe('Persona');
    expect(error.message).toContain(email);
    expect(error).toBeInstanceOf(AccessDeniedError);
    expect(error.summary).toMatch(/Real sign-in denies/);
  });

  it('describes a verified @azentio.com address as not provisioned, not as a generic failure', () => {
    const error = new UnprovisionedAccountError('kofi.mensah@azentio.com');
    expect(error.message).toMatch(/not provisioned with an approved membership/);
    expect(error.role).toBe('Unprovisioned @azentio.com');
  });

  it('re-exports the error classes from the types barrel', () => {
    expect(types.AccessDeniedError).toBe(AccessDeniedError);
    expect(types.UnprovisionedAccountError).toBe(UnprovisionedAccountError);
    expect(types.RevokedMembershipError).toBe(RevokedMembershipError);
    expect(types.UninvitedDomainError).toBe(UninvitedDomainError);
  });
});

describe('types barrel', () => {
  it('does not re-export zod schemas, which are imported from ./schemas directly', () => {
    for (const name of ['contributionCreateSchema', 'moderationDecisionSchema', 'ideaCreateSchema', 'searchQuerySchema', 'emailOtpSchema']) {
      expect(types).not.toHaveProperty(name);
    }
  });
});
