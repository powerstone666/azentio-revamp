import type { Persona } from '@/app/(config)/personas';

// Mock sign-in for the preview build. Choosing a persona sets a cookie; real auth comes later.
export const MOCK_PERSONA_COOKIE = 'azentio_mock_persona';
export const MOCK_ORG_COOKIE = 'azentio_mock_org';

const DESTINATION_BY_EMAIL = new Map<string, string>([
  ['dana.whitfield@azentio.com', '/portal/employee'],
  ['marcus.oyelaran@azentio.com', '/portal/employee'],
  ['ines.calderon@azentio.com', '/portal/moderator'],
  ['tomas.reiniger@azentio.com', '/portal/product-owner'],
  ['sunita.varghese@azentio.com', '/portal/admin'],
  ['priya.natarajan@advisory-partner.example', '/workspace/select'],
]);

/** Where a persona lands after mock sign-in. Client users (and any unlisted persona) go to the client portal. */
export function destinationFor(persona: Persona): string {
  return DESTINATION_BY_EMAIL.get(persona.email) ?? '/portal/client';
}

/** Sets the mock persona cookie. Client-side only. */
export function setMockPersonaCookie(email: string): void {
  document.cookie = `${MOCK_PERSONA_COOKIE}=${encodeURIComponent(email)}; path=/; SameSite=Lax`;
}

/** Sets the mock organisation cookie. Client-side only. */
export function setMockOrgCookie(orgId: string): void {
  document.cookie = `${MOCK_ORG_COOKIE}=${encodeURIComponent(orgId)}; path=/; SameSite=Lax`;
}
