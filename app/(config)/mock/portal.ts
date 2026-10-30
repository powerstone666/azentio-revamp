// Synthetic portal data for the preview build. Source: docs/plan/claude-mock-data-portal.md.
// Everything here is invented. No real clients, people or customer data.

export type ObsState =
  | 'private_draft' | 'submitted' | 'needs_clarification' | 'approved'
  | 'published' | 'suspended' | 'rejected' | 'withdrawn';
export type IdeaStatus = 'Proposed' | 'Under review' | 'Planned' | 'In progress' | 'Released' | 'Not proceeding';

export const STATE_LABEL: Record<ObsState, string> = {
  private_draft: 'Draft', submitted: 'Submitted', needs_clarification: 'Needs clarification', approved: 'Approved',
  published: 'Published', suspended: 'Suspended', rejected: 'Rejected', withdrawn: 'Withdrawn',
};
export const SCOPE_LABEL = { private: 'Only me', org: 'My organisation', community: 'Community (proposed)' } as const;

export interface Org { id: string; name: string; short: string; kind: 'client' | 'azentio'; offerings: string[]; note: string }
export const ORGS: Org[] = [
  { id: 'harborline', name: 'Harborline Commercial Bank', short: 'Harborline', kind: 'client', offerings: ['Lending', 'Digital', 'AMLOCK', 'FAI'], note: 'Seasonality scenario' },
  { id: 'sandune', name: 'Sandune Finance', short: 'Sandune', kind: 'client', offerings: ['Lending', 'Factoring', 'FAI'], note: 'Seasonality scenario' },
  { id: 'kestrel', name: 'Kestrel Peak Microfinance', short: 'Kestrel', kind: 'client', offerings: ['Lending', 'Digital', 'FAI'], note: 'Seasonality scenario' },
  { id: 'northmere', name: 'Northmere Mutual', short: 'Northmere', kind: 'client', offerings: ['Insurance', 'Orion'], note: 'Isolation test tenant' },
  { id: 'emberfield', name: 'Emberfield Capital', short: 'Emberfield', kind: 'client', offerings: [], note: 'No entitlements: empty states' },
  { id: 'azentio', name: 'Azentio', kind: 'azentio', short: 'Azentio', offerings: [], note: 'Internal' },
];
export const orgById = (id: string) => ORGS.find((o) => o.id === id);

export interface Observation {
  id: string; orgId: string; author: string; title: string; type: string; state: ObsState;
  scope: 'private' | 'org' | 'community'; consents: { a: boolean; b: boolean; c: boolean; d: boolean; e: boolean };
  period: string; evidence: string; confidence: 'Low' | 'Medium' | 'High'; updated: string; version: number;
  note?: string; source?: string; shared?: string; flagged?: string[];
}
const c = (a: number, b: number, cc: number, d: number, e = 0) => ({ a: !!a, b: !!b, c: !!cc, d: !!d, e: !!e });
export const OBSERVATIONS: Observation[] = [
  { id: 'obs_01', orgId: 'harborline', author: 'Amira Haddad', title: 'Seasonal SME revenue flagged as deterioration', type: 'Market observation', state: 'published', scope: 'community', consents: c(1,1,0,0,1), period: 'Jan–Dec 2025', evidence: 'Portfolio review', confidence: 'Medium', updated: '9 days ago', version: 1,
    source: 'Our Eastern-region book of 38 date-packing and gift-retail SMEs, handled by RM Noor Qasim, drops about 60% of revenue in Q3. FAI flags every one as deteriorating. The credit committee overrode 45% of these in FY2025.',
    shared: 'A regional lender saw borrowers in seasonal retail and food trading show sharp revenue dips in particular quarters, and automated analysis flagged them as deteriorating. Credit committees frequently overrode those flags.' },
  { id: 'obs_02', orgId: 'sandune', author: 'Tariq Bashir', title: 'Quarter-on-quarter comparisons mis-read seasonal traders', type: 'Operational challenge', state: 'published', scope: 'community', consents: c(1,1,1,0,1), period: 'Jul 2024–Jun 2025', evidence: 'Credit-committee override log', confidence: 'High', updated: '8 days ago', version: 1,
    note: 'Attribution requested; reviewer declined because the observation is rare.',
    source: 'Sandune’s Amman trading cohort (about 120 loans, largest client Zaytoun Wholesale) is flagged each January. We now add a manual memo to 70% of files.',
    shared: 'A non-bank lender reported that a large cohort of trading loans is flagged every January and that analysts add manual notes to most of those files.' },
  { id: 'obs_03', orgId: 'kestrel', author: 'Wira Santoso', title: 'Harvest-cycle borrowers look delinquent in monthly views', type: 'Product gap', state: 'published', scope: 'community', consents: c(1,1,0,1,1), period: 'Oct 2025–Sep 2026', evidence: 'Field-officer feedback', confidence: 'Low', updated: '8 days ago', version: 1,
    source: 'In Mindanao-east, our 300 harvest borrowers look 30 days late every March per the monthly dashboard.',
    shared: 'A microfinance lender observed that borrowers with harvest-driven income appear delinquent in monthly views during off-season months.' },
  { id: 'obs_04', orgId: 'harborline', author: 'Amira Haddad', title: 'Early-warning signals for collections miss seasonal lulls', type: 'Trend', state: 'published', scope: 'community', consents: c(1,1,0,0), period: 'Jan–Dec 2025', evidence: 'Collections report', confidence: 'Medium', updated: '7 days ago', version: 1 },
  { id: 'obs_07', orgId: 'kestrel', author: 'Wira Santoso', title: 'Repayment-calendar flexibility for farmers', type: 'Successful practice', state: 'published', scope: 'community', consents: c(1,1,0,1), period: 'Oct 2025–Sep 2026', evidence: 'Field-officer feedback', confidence: 'Low', updated: '2 days ago', version: 1, note: 'Version 2 is pending review. Version 1 stays visible with an "update under review" label.' },
  { id: 'obs_08', orgId: 'harborline', author: 'Amira Haddad', title: 'Alert triage queue fatigue', type: 'Operational challenge', state: 'published', scope: 'community', consents: c(1,1,0,0), period: 'Jan–Jun 2026', evidence: 'Analyst survey', confidence: 'Medium', updated: '6 days ago', version: 1 },
  { id: 'obs_11', orgId: 'harborline', author: 'Amira Haddad', title: 'Draft: onboarding re-request ideas', type: 'Improvement suggestion', state: 'private_draft', scope: 'private', consents: c(0,0,0,0), period: 'Not set', evidence: 'Not set', confidence: 'Low', updated: '1 day ago', version: 1, note: 'Private draft. Moderators and product owners cannot see it.' },
  { id: 'obs_12', orgId: 'sandune', author: 'Elena Voss', title: 'Sensitive-flag example', type: 'Product gap', state: 'submitted', scope: 'community', consents: c(1,0,0,0), period: 'Q2 2026', evidence: 'Support tickets', confidence: 'Low', updated: '3 hours ago', version: 1, flagged: ['Looks like an account number', 'Contains a contact detail'],
    source: 'The loan for account XX00 TEST 0000 0000 1234 56 and contact cust.demo@example.test was misclassified after the migration.' },
  { id: 'obs_13', orgId: 'kestrel', author: 'Mei Lan Tran', title: 'Digital onboarding drop-off at document step', type: 'Trend', state: 'needs_clarification', scope: 'community', consents: c(1,0,0,0), period: 'Not set', evidence: 'Not set', confidence: 'Low', updated: '1 day ago', version: 1, note: 'Moderator asked: which period, and what type of evidence?' },
  { id: 'obs_14', orgId: 'harborline', author: 'Amira Haddad', title: 'Treatment of seasonal limits in FAI commentary', type: 'Improvement suggestion', state: 'needs_clarification', scope: 'org', consents: c(1,0,0,0), period: 'FY2025', evidence: 'Credit memo review', confidence: 'Medium', updated: '2 days ago', version: 1, note: 'Returned for edit: too specific. Please generalise before resubmitting.' },
  { id: 'obs_15', orgId: 'sandune', author: 'Elena Voss', title: 'Seasonal traders misread in comparisons', type: 'Market observation', state: 'rejected', scope: 'community', consents: c(1,0,0,0), period: 'FY2025', evidence: 'Portfolio review', confidence: 'Medium', updated: '5 days ago', version: 1, note: 'Rejected: duplicate of obs_02.' },
  { id: 'obs_16', orgId: 'kestrel', author: 'Mei Lan Tran', title: 'Pricing complaint naming a specific customer', type: 'Operational challenge', state: 'rejected', scope: 'community', consents: c(1,0,0,0), period: 'Q1 2026', evidence: 'Customer email', confidence: 'Low', updated: '5 days ago', version: 1, note: 'Rejected: unsafe. It names a customer and a contract rate, so the raw text is shown only to the author and moderator.' },
  { id: 'obs_17', orgId: 'harborline', author: 'Amira Haddad', title: 'Old KYC re-submission note', type: 'Market observation', state: 'withdrawn', scope: 'community', consents: c(1,1,0,0), period: 'FY2024', evidence: 'Process review', confidence: 'Low', updated: '4 days ago', version: 1, note: 'Withdrawn by the author. Removed from search, AIRA, themes and exports.' },
  { id: 'obs_18', orgId: 'harborline', author: 'Amira Haddad', title: 'Digital KYC re-submission friction', type: 'Market observation', state: 'published', scope: 'community', consents: c(1,1,0,0), period: 'Q1 2026', evidence: 'Customer feedback', confidence: 'Medium', updated: '1 day ago', version: 1, note: 'Used for the live 60-second withdrawal demonstration.' },
  { id: 'obs_19', orgId: 'sandune', author: 'Tariq Bashir', title: 'Claim that peer banks leak credit scores', type: 'Market observation', state: 'suspended', scope: 'community', consents: c(1,1,0,0), period: 'Q2 2026', evidence: 'Industry conversation', confidence: 'Low', updated: '1 day ago', version: 1, note: 'Reported as misleading. Temporarily unpublished while a moderator reviews it.' },
  { id: 'obs_20', orgId: 'northmere', author: 'Samuel Okafor', title: 'Claims intake fragmentation', type: 'Operational challenge', state: 'approved', scope: 'org', consents: c(1,1,0,0), period: 'FY2025', evidence: 'Process mapping', confidence: 'Medium', updated: '3 days ago', version: 1, note: 'Approved for Northmere only; not proposed to the community.' },
];
export const getObservation = (id: string) => OBSERVATIONS.find((o) => o.id === id);
export const observationsOf = (orgId: string) => OBSERVATIONS.filter((o) => o.orgId === orgId);

export interface Theme { id: string; title: string; offering: string; orgs: number; posts: number; periods: string; confidence: string; shown: boolean; summary: string; evidence: string[] }
export const THEMES: Theme[] = [
  { id: 'theme_seasonality', title: 'Seasonality context', offering: 'FAI', orgs: 3, posts: 3, periods: '2024–2026', confidence: 'Medium, High, Low', shown: true, summary: 'Lenders report that automated comparisons treat seasonal income dips as deterioration. Small sample: do not treat this as market prevalence.', evidence: ['obs_01', 'obs_02', 'obs_03'] },
  { id: 'theme_collections', title: 'Collections early warning', offering: 'Lending', orgs: 2, posts: 4, periods: '2025–2026', confidence: 'Medium, Low', shown: false, summary: 'Not enough distinct contributing organisations to show this theme.', evidence: ['obs_04', 'obs_07'] },
  { id: 'theme_triage', title: 'Alert triage fatigue', offering: 'AMLOCK', orgs: 2, posts: 3, periods: '2026', confidence: 'Not shown', shown: false, summary: 'Not enough contributing organisations to show.', evidence: [] },
];
export const getTheme = (id: string) => THEMES.find((t) => t.id === id);

export interface AuditEntry { at: string; actor: string; action: string; internalOnly?: boolean }
export interface Idea { id: string; title: string; offering: string; status: IdeaStatus; owner: string; evidence: string[]; clientText: string; internalNote?: string; audit: AuditEntry[]; clientVisible: boolean }
export const IDEAS: Idea[] = [
  { id: 'idea_01', title: 'Seasonality-aware comparison explanation', offering: 'FAI', status: 'Under review', owner: 'Tomas Reiniger, FAI team', evidence: ['obs_01', 'obs_02', 'obs_03'], clientText: 'Under review. This is not a delivery commitment.', clientVisible: true,
    internalNote: 'Competing with a Q1 roadmap item. No date promised.',
    audit: [{ at: '9 days ago', actor: 'Tomas Reiniger', action: 'Idea created' }, { at: '9 days ago', actor: 'Tomas Reiniger', action: 'Linked 3 pieces of evidence' }, { at: '7 days ago', actor: 'Tomas Reiniger', action: 'Status changed: Proposed to Under review' }, { at: '6 days ago', actor: 'Tomas Reiniger', action: 'Client-visible message approved' }] },
  { id: 'idea_02', title: 'Per-segment alert triage tuning', offering: 'AMLOCK', status: 'Proposed', owner: 'Tomas Reiniger', evidence: [], clientText: 'Hidden until the supporting theme can be shown.', clientVisible: false, audit: [{ at: '5 days ago', actor: 'Tomas Reiniger', action: 'Idea created' }] },
  { id: 'idea_03', title: 'Respect repayment holidays in collections triggers', offering: 'Lending', status: 'In progress', owner: 'Lending product team', evidence: ['obs_04', 'obs_07'], clientText: 'In progress. Thank you to the lenders who shared this.', clientVisible: true, audit: [{ at: '20 days ago', actor: 'Lending product team', action: 'Idea created' }, { at: '10 days ago', actor: 'Lending product team', action: 'Status changed: Planned to In progress' }] },
  { id: 'idea_04', title: 'Auto-translate KYC re-submission prompts', offering: 'Digital', status: 'Not proceeding', owner: 'Digital team', evidence: ['obs_18'], clientText: 'Not proceeding: out of current scope.', clientVisible: true, audit: [{ at: '12 days ago', actor: 'Digital team', action: 'Idea created' }, { at: '3 days ago', actor: 'Digital team', action: 'Status changed: Under review to Not proceeding' }] },
];
export const getIdea = (id: string) => IDEAS.find((i) => i.id === id);

export interface Report { id: string; target: string; reporter: string; category: string; status: 'Open' | 'Dismissed' | 'Resolved'; note: string; when: string }
export const REPORTS: Report[] = [
  { id: 'rpt_01', target: 'obs_19', reporter: 'A member of another organisation', category: 'Misleading', status: 'Open', note: 'Drove a temporary unpublish while under review.', when: '1 day ago' },
  { id: 'rpt_02', target: 'obs_08', reporter: 'A member of another organisation', category: 'Inappropriate', status: 'Dismissed', note: 'Reason recorded: content is within guidelines.', when: '6 days ago' },
  { id: 'rpt_03', target: 'Comment on obs_04', reporter: 'A member of another organisation', category: 'Confidential', status: 'Resolved', note: 'Comment hidden by a moderator.', when: '5 days ago' },
];

export interface AuditEvent { at: string; actor: string; org: string; action: string; target: string; request: string }
export const AUDIT: AuditEvent[] = [
  { at: '3 hours ago', actor: 'Elena Voss', org: 'Sandune', action: 'Submitted', target: 'obs_12', request: 'req_7f21' },
  { at: '1 day ago', actor: 'Ines Calderon', org: 'Azentio', action: 'Requested clarification', target: 'obs_13', request: 'req_6d02' },
  { at: '1 day ago', actor: 'Ines Calderon', org: 'Azentio', action: 'Suspended after report', target: 'obs_19', request: 'req_6c9a' },
  { at: '2 days ago', actor: 'Ines Calderon', org: 'Azentio', action: 'Returned for edit', target: 'obs_14', request: 'req_5b10' },
  { at: '4 days ago', actor: 'Amira Haddad', org: 'Harborline', action: 'Withdrew', target: 'obs_17', request: 'req_41e8' },
  { at: '5 days ago', actor: 'Ines Calderon', org: 'Azentio', action: 'Rejected (unsafe)', target: 'obs_16', request: 'req_3a77' },
  { at: '7 days ago', actor: 'Ines Calderon', org: 'Azentio', action: 'Redacted and published', target: 'obs_01', request: 'req_21c4' },
  { at: '9 days ago', actor: 'Sunita Varghese', org: 'Azentio', action: 'Granted role: learning moderator', target: 'Ines Calderon', request: 'req_1190' },
];

export interface Demo { id: string; name: string; offering: string; blurb: string; audience: string }
export const DEMOS: Demo[] = [
  { id: 'fai', name: 'Financial Analysis Intelligence', offering: 'FAI', blurb: 'Guided sandbox with synthetic financial statements. Outputs are simulated, not credit decisions.', audience: 'Harborline, Sandune, Kestrel' },
  { id: 'lending', name: 'Lending sandbox', offering: 'Lending', blurb: 'Walk through origination and collections with synthetic borrowers.', audience: 'Harborline, Sandune, Kestrel' },
  { id: 'amlock-tm', name: 'AMLOCK transaction monitoring', offering: 'AMLOCK', blurb: 'Review synthetic alerts and triage queues.', audience: 'Harborline' },
  { id: 'claims', name: 'Claims automation briefing', offering: 'Insurance', blurb: 'Briefing and demo for claims automation.', audience: 'Northmere' },
];
export const demosFor = (org: Org) => DEMOS.filter((d) => org.offerings.includes(d.offering));

export interface Session { id: string; title: string; when: string; audience: string; status: 'Live' | 'Upcoming' | 'Recording'; host: string }
export const SESSIONS: Session[] = [
  { id: 's1', title: 'Hackathon kickoff', when: 'Today, 10:00', audience: 'Employees only', status: 'Live', host: 'Marcus Oyelaran' },
  { id: 's2', title: 'Seasonality roundtable', when: 'Thursday, 15:00', audience: 'Invitation only', status: 'Upcoming', host: 'Ines Calderon, Tomas Reiniger' },
  { id: 's3', title: 'FAI Q3 release walkthrough', when: 'Recorded last week', audience: 'Employees only', status: 'Recording', host: 'Tomas Reiniger' },
];
export const EXPERIMENTS = [
  { id: 'x1', name: 'FAI prototype v0.3 prompts', owner: 'Dana Whitfield', status: 'In review', note: 'Internal notes. Never shown to clients, search or AIRA.' },
  { id: 'x2', name: 'Seasonality-aware commentary draft', owner: 'Tomas Reiniger', status: 'Prototype', note: 'Linked to idea_01.' },
  { id: 'x3', name: 'Alert triage ranking experiment', owner: 'Dana Whitfield', status: 'Idea', note: 'Waiting on theme threshold.' },
];
export const KNOWLEDGE = [
  { id: 'k1', title: 'How we redact shared copies', owner: 'Ines Calderon', review: 'Review due in 3 weeks' },
  { id: 'k2', title: 'Writing client-safe release notes', owner: 'Marcus Oyelaran', review: 'Reviewed last month' },
  { id: 'k3', title: 'Sandbox data: what is synthetic and why', owner: 'Dana Whitfield', review: 'Review due in 6 weeks' },
];
export const TEAM = [
  { name: 'Amira Haddad', email: 'amira.haddad@harborline-bank.example', role: 'Client member', status: 'Active' },
  { name: 'Rahul Menon', email: 'rahul.menon@harborline-bank.example', role: 'Client admin', status: 'Active' },
  { name: 'Priya Natarajan', email: 'priya.natarajan@advisory-partner.example', role: 'Client member (also in Sandune)', status: 'Active' },
  { name: 'Ravi Kumar', email: 'ravi.kumar@harborline-bank.example', role: 'Client member', status: 'Invitation expired' },
];
