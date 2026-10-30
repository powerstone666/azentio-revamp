import type { IdeaStatus, Observation } from '@/app/(config)/mock/portal';

// Privacy rules for the staff preview. Moderators never see private drafts.
export const isReviewable = (o: Observation) => o.state !== 'private_draft';
export const isQueued = (o: Observation) => o.state === 'submitted' || o.state === 'needs_clarification';
export const isFlagged = (o: Observation) => (o.flagged?.length ?? 0) > 0;

export const IDEA_STATUSES: IdeaStatus[] = ['Proposed', 'Under review', 'Planned', 'In progress', 'Released', 'Not proceeding'];
export const OFFERINGS = ['FAI', 'Lending', 'Digital', 'AMLOCK', 'Factoring', 'Insurance', 'Orion'];
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const AUDIENCES = ['Internal', 'Clients', 'Public'];

export const REDACTION_RULES = [
  'Numbers are coarsened (for example, 38 becomes "about 40").',
  'Names, branches and districts are removed.',
  'Regions are generalised (for example, a district becomes "a regional lender").',
  'Dates are rounded to the period.',
];

export const REASON_CODES = ['Sensitive identifier', 'Customer identity', 'Contract terms', 'Not a learning observation', 'Duplicate', 'Other'];
export const EVIDENCE_QUALITY = ['Strong: documented review', 'Moderate: aggregated analysis', 'Weak: anecdote'];
