export type PersonaGroup = 'Azentio staff' | 'Client users' | 'Edge cases';

export interface Persona {
  name: string;
  email: string;
  org: string;
  role: string;
  purpose: string;
  group: PersonaGroup;
}

// Synthetic demo identities. Source: docs/plan/claude-mock-data-portal.md §2.
export const PERSONAS: Persona[] = [
  { name: 'Dana Whitfield', email: 'dana.whitfield@azentio.com', org: 'Azentio', role: 'Employee', purpose: 'Plain employee: denied on every admin, publish and moderate route.', group: 'Azentio staff' },
  { name: 'Marcus Oyelaran', email: 'marcus.oyelaran@azentio.com', org: 'Azentio', role: 'Content publisher', purpose: 'Banners, public content and video audiences. No learning access.', group: 'Azentio staff' },
  { name: 'Ines Calderon', email: 'ines.calderon@azentio.com', org: 'Azentio', role: 'Learning moderator', purpose: 'Reviews, redacts, publishes or rejects. Cannot read unsubmitted drafts.', group: 'Azentio staff' },
  { name: 'Tomas Reiniger', email: 'tomas.reiniger@azentio.com', org: 'Azentio', role: 'Product owner (FAI)', purpose: 'Creates improvement ideas; sees only evidence shared with him.', group: 'Azentio staff' },
  { name: 'Sunita Varghese', email: 'sunita.varghese@azentio.com', org: 'Azentio', role: 'Portal admin', purpose: 'Manages orgs and role grants. Cannot open private client content.', group: 'Azentio staff' },

  { name: 'Amira Haddad', email: 'amira.haddad@harborline-bank.example', org: 'Harborline Commercial Bank', role: 'Client member', purpose: 'Main client author of the seasonality observation.', group: 'Client users' },
  { name: 'Rahul Menon', email: 'rahul.menon@harborline-bank.example', org: 'Harborline Commercial Bank', role: 'Client admin', purpose: 'Invites and revokes users; tries role escalation.', group: 'Client users' },
  { name: 'Tariq Bashir', email: 'tariq.bashir@sandune-finance.example', org: 'Sandune Finance', role: 'Client admin', purpose: 'Second seasonality author.', group: 'Client users' },
  { name: 'Elena Voss', email: 'elena.voss@sandune-finance.example', org: 'Sandune Finance', role: 'Client member', purpose: 'Reads her organisation’s observations.', group: 'Client users' },
  { name: 'Wira Santoso', email: 'wira.santoso@kestrelpeak.example', org: 'Kestrel Peak Microfinance', role: 'Client admin', purpose: 'Third seasonality author; sends a pending invite.', group: 'Client users' },
  { name: 'Mei Lan Tran', email: 'mei.tran@kestrelpeak.example', org: 'Kestrel Peak Microfinance', role: 'Client member', purpose: 'Reports a shared observation for review.', group: 'Client users' },
  { name: 'Grace Adeyemi', email: 'grace.adeyemi@northmere.example', org: 'Northmere Mutual', role: 'Client admin', purpose: 'Attack-target tenant admin; her data must never leak.', group: 'Client users' },
  { name: 'Hana Berg', email: 'hana.berg@emberfield.example', org: 'Emberfield Capital', role: 'Client admin', purpose: 'No entitlements: sees empty states only.', group: 'Client users' },

  { name: 'Priya Natarajan', email: 'priya.natarajan@advisory-partner.example', org: 'Harborline + Sandune', role: 'Member of two orgs', purpose: 'Forced workspace switcher; an active workspace is required.', group: 'Edge cases' },
  { name: 'Omar Rahim', email: 'omar.rahim@sandune-finance.example', org: 'Sandune Finance', role: 'Revoked member', purpose: 'Sign-in must fail; old posts stay with the org.', group: 'Edge cases' },
  { name: 'Kofi Mensah', email: 'kofi.mensah@azentio.com', org: 'None', role: 'Unprovisioned @azentio.com', purpose: 'Verified email but no grant: portal access denied.', group: 'Edge cases' },
  { name: 'Finance Lead', email: 'finance.lead@harborline-bank.example', org: 'None', role: 'Matching email suffix', purpose: 'Same domain as Harborline but no invitation: must not auto-join.', group: 'Edge cases' },
];

export const PERSONA_GROUPS: PersonaGroup[] = ['Azentio staff', 'Client users', 'Edge cases'];

export type AccessLevel = 'full' | 'limited' | 'denied';

export interface PersonaAccess {
  level: AccessLevel;
  /** One line shown under the chip. */
  summary: string;
  can: string[];
  cannot: string[];
}

// What each persona may and may not do. Shown on the sign-in page so the limits are explicit.
export const ACCESS: Record<string, PersonaAccess> = {
  'sunita.varghese@azentio.com': {
    level: 'full',
    summary: 'Full administrative access. The only persona that can administer the whole portal.',
    can: ['Create and manage organisations and entitlements', 'Grant and revoke every role (moderator, publisher, product owner)', 'Invite users and manage portal configuration', 'View audit history across the portal'],
    cannot: ['Open private client content without an explicit, time-limited support authorisation (audited)'],
  },
  'dana.whitfield@azentio.com': { level: 'limited', summary: 'Plain employee.', can: ['Employee dashboard and Playground', 'Employee-only Live sessions', 'Experiments and knowledge library'], cannot: ['Moderate, publish or administer', 'See any client’s private content'] },
  'marcus.oyelaran@azentio.com': { level: 'limited', summary: 'Employee with a publishing grant.', can: ['Manage banners and public content', 'Set video audiences and sessions'], cannot: ['Moderate learning', 'Manage users or roles', 'See private client content'] },
  'ines.calderon@azentio.com': { level: 'limited', summary: 'Employee with a moderator grant.', can: ['Review, redact, publish or reject submissions', 'Handle reports and suspend content'], cannot: ['Read unsubmitted drafts', 'Publish site content', 'Change roles'] },
  'tomas.reiniger@azentio.com': { level: 'limited', summary: 'Product owner for FAI only.', can: ['Create and track improvement ideas', 'See approved themes and evidence'], cannot: ['See raw client text or organisation names', 'Moderate or administer'] },
  'amira.haddad@harborline-bank.example': { level: 'limited', summary: 'Client member, own organisation only.', can: ['Write observations and choose what to share', 'Browse approved shared learning', 'Use entitled demos'], cannot: ['See other organisations’ private items', 'Manage the team', 'Open employee content'] },
  'rahul.menon@harborline-bank.example': { level: 'limited', summary: 'Client admin, own organisation only.', can: ['Everything a client member can do', 'Invite and revoke members of Harborline'], cannot: ['Grant roles above client admin', 'See other organisations’ data'] },
  'tariq.bashir@sandune-finance.example': { level: 'limited', summary: 'Client admin, own organisation only.', can: ['Write observations and manage Sandune’s team'], cannot: ['See other organisations’ private items', 'Open employee content'] },
  'elena.voss@sandune-finance.example': { level: 'limited', summary: 'Client member, own organisation only.', can: ['Write observations', 'Read Sandune’s observations and approved shared learning'], cannot: ['Manage the team', 'See other organisations’ private items'] },
  'wira.santoso@kestrelpeak.example': { level: 'limited', summary: 'Client admin, own organisation only.', can: ['Write observations and manage Kestrel’s team'], cannot: ['See other organisations’ private items', 'Open employee content'] },
  'mei.tran@kestrelpeak.example': { level: 'limited', summary: 'Client member, own organisation only.', can: ['Write observations', 'Report a shared contribution'], cannot: ['Manage the team', 'See other organisations’ private items'] },
  'grace.adeyemi@northmere.example': { level: 'limited', summary: 'Client admin of an isolated tenant.', can: ['Manage Northmere’s team and observations'], cannot: ['See any other organisation’s data (isolation test)'] },
  'hana.berg@emberfield.example': { level: 'limited', summary: 'Client admin with no entitlements.', can: ['Sign in and manage Emberfield’s team'], cannot: ['Open any demo (none entitled)', 'See shared learning until entitled'] },
  'priya.natarajan@advisory-partner.example': { level: 'limited', summary: 'Member of two organisations.', can: ['Switch between Harborline and Sandune'], cannot: ['Work in both at once', 'Combine data across organisations'] },
  'omar.rahim@sandune-finance.example': { level: 'denied', summary: 'Revoked member. Real sign-in would deny access.', can: ['Nothing, once real access control is on'], cannot: ['Sign in or use an old session'] },
  'kofi.mensah@azentio.com': { level: 'denied', summary: 'Verified @azentio.com email but not provisioned. Real sign-in would deny the portal.', can: ['Nothing, once real access control is on'], cannot: ['Reach any portal area without an approved membership'] },
  'finance.lead@harborline-bank.example': { level: 'denied', summary: 'Same email domain as Harborline but no invitation. Real sign-in would deny access.', can: ['Nothing, once real access control is on'], cannot: ['Join Harborline from the email domain alone'] },
};
