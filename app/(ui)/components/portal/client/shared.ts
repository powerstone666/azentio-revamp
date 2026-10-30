import { notFound } from 'next/navigation';
import { IDEAS, OBSERVATIONS, getObservation, orgById, type Idea, type Observation } from '@/app/(config)/mock/portal';

// Shared helpers for the client workspace. Plain data and pure functions only.

export const PREVIEW_NOTE = 'Preview build: nothing is saved.';

export const CONSENT_ITEMS = [
  { key: 'a', label: 'Store and process this contribution', hint: 'Azentio stores and processes this text so that the portal can review it.' },
  { key: 'b', label: 'Publish a reviewed shared version', hint: 'A moderator-reviewed, redacted copy may appear in shared learning.' },
  { key: 'c', label: "Show my organisation's name with it", hint: 'Off by default. Without this, the shared copy names no organisation or author.' },
  { key: 'd', label: 'Allow future training or federated programmes', hint: 'Optional and separate from publishing. Off by default.' },
  { key: 'e', label: 'Use the reviewed copy for semantic theme analysis', hint: 'Optional. If published, only the reviewed shared text is sent to the configured embedding provider to group similar themes. Private source text and identity details are excluded.' },
] as const;
export type ConsentKey = (typeof CONSENT_ITEMS)[number]['key'];
export type Consents = Record<ConsentKey, boolean>;

export const OBSERVATION_TYPES = [
  'Market observation', 'Trend', 'Operational challenge', 'Product gap', 'Improvement suggestion', 'Successful practice',
];

export const EVIDENCE_TYPES = [
  'Portfolio review', 'Credit-committee override log', 'Field-officer feedback', 'Collections report', 'Support tickets',
  'Customer feedback', 'Analyst survey', 'Process review', 'Process mapping', 'Credit memo review', 'Customer email',
  'Industry conversation', 'Other',
];

/** The signed-in preview user's organisation (Harborline). */
export function currentOrg() {
  const org = orgById('harborline');
  if (!org) throw new Error('Preview organisation is missing from mock data');
  return org;
}

/** Only the current organisation's observations. Anything else is a 404. */
export function ownObservation(id: string): Observation {
  const o = getObservation(id);
  if (!o || o.orgId !== currentOrg().id) notFound();
  return o;
}

/** A published, community-scoped observation: the only kind that appears in shared learning. */
export const isShared = (o: Observation) => o.state === 'published' && o.scope === 'community';
export const sharedObservations = () => OBSERVATIONS.filter(isShared);
export function sharedObservation(id: string): Observation {
  const o = getObservation(id);
  if (!o || !isShared(o)) notFound();
  return o;
}

/** Ideas the client may see. Never returns internalNote or hidden ideas. */
export const clientIdeas = (): Idea[] =>
  IDEAS.filter((i) => i.clientVisible).map(({ internalNote: _internalNote, ...idea }) => ({
    ...idea,
    audit: idea.audit.filter((e) => !e.internalOnly),
  }));

/** Time of the last audit entry that the client may see. */
export function clientAuditTime(idea: Idea): string | undefined {
  const entries = idea.audit.filter((e) => !e.internalOnly);
  return entries[entries.length - 1]?.at;
}

/**
 * Team roles may carry notes about other organisations (for example "also in Sandune").
 * Clients must never see another organisation's name, so only the base role is shown.
 */
export const displayRole = (role: string) => {
  const base = role.replace(/\s*\(.*\)\s*$/, '');
  const roles: Record<string, string> = {
    client_member: 'Client member', client_admin: 'Client admin', employee: 'Employee',
    learning_moderator: 'Learning moderator', content_publisher: 'Content publisher',
    product_owner: 'Product owner', portal_admin: 'Portal admin',
  };
  return roles[base] ?? base;
};
