#!/usr/bin/env npx tsx
/**
 * azentio.ai — Deterministic Portal Seed Script
 * ==============================================
 *
 * Populates all demo data for the hackathon judging environment.
 * All data is SYNTHETIC. No real PII or production data.
 *
 * Usage:  npx tsx scripts/seed.ts
 * Env:    DATABASE_URL (required — Supabase Postgres connection string)
 *
 * Idempotent: safe to re-run; uses ON CONFLICT DO NOTHING everywhere.
 *
 * Deterministic IDs: SHA-256 hash of (prefix + name) → UUID format.
 * Re-running produces identical IDs every time.
 */

import { Pool, PoolClient } from 'pg';
// eslint-disable-next-line
const { createHash } = require('crypto');

// ─── Configuration ───────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is required.');
  process.exit(1);
}

// Anchor clock: all seeded timestamps are offsets from this fixed point.
const ANCHOR = new Date('2026-10-26T09:00:00Z');

// Minimum distinct organisations for theme visibility.
const MIN_DISTINCT_ORGS = 3;

// Policy version for consents.
const POLICY_VERSION = '1.0';

// ─── UUID generation (deterministic, reproducible) ───────────────────────────

/**
 * Generate a deterministic UUID-like ID from a prefix and name.
 * Uses SHA-256 → first 32 hex chars → formatted as 8-4-4-4-12 UUID.
 */
function makeId(prefix: string, name: string): string {
  const hash = createHash('sha256')
    .update(`${prefix}:${name}`)
    .digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

/** Timestamp offset from anchor: negative = before anchor, positive = after. */
function ts(offsetDays: number, offsetHours = 0): Date {
  const d = new Date(ANCHOR);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(d.getHours() + offsetHours);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString();
}

// ─── Database pool ───────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 1, // seed runs single-threaded
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

// ─── Organisations ───────────────────────────────────────────────────────────

const ORGS = {
  azentio: {
    id: makeId('org', 'azentio'),
    name: 'Azentio',
    type: 'azentio' as const,
    status: 'active' as const,
  },
  harborline: {
    id: makeId('org', 'harborline-commercial-bank'),
    name: 'Harborline Commercial Bank',
    type: 'client' as const,
    status: 'active' as const,
  },
  sandune: {
    id: makeId('org', 'sandune-finance'),
    name: 'Sandune Finance Company',
    type: 'client' as const,
    status: 'active' as const,
  },
  kestrel: {
    id: makeId('org', 'kestrel-peak-microfinance'),
    name: 'Kestrel Peak Microfinance',
    type: 'client' as const,
    status: 'active' as const,
  },
  northmere: {
    id: makeId('org', 'northmere-mutual'),
    name: 'Northmere Mutual Insurance',
    type: 'client' as const,
    status: 'active' as const,
  },
  emberfield: {
    id: makeId('org', 'emberfield-capital'),
    name: 'Emberfield Capital Partners',
    type: 'client' as const,
    status: 'active' as const,
  },
} as const;

type OrgKey = keyof typeof ORGS;

// ─── Offerings ───────────────────────────────────────────────────────────────

const OFFERINGS = {
  imal: { id: makeId('offering', 'imal'), name: 'iMAL Islamic Banking' },
  lending: { id: makeId('offering', 'lending'), name: 'Lending Suite' },
  digital: { id: makeId('offering', 'digital'), name: 'Digital Banking' },
  factoring: { id: makeId('offering', 'factoring'), name: 'Factoring' },
  mfund: { id: makeId('offering', 'mfund'), name: 'MFund' },
  amlock: { id: makeId('offering', 'amlock'), name: 'AMLOCK Transaction Monitoring' },
  insurance: { id: makeId('offering', 'insurance'), name: 'Insurance Suite' },
  orion: { id: makeId('offering', 'orion'), name: 'Orion ERP Financial Cloud' },
  fai: { id: makeId('offering', 'fai'), name: 'Financial Analysis Intelligence' },
} as const;

// ─── Users (23+ personas) ────────────────────────────────────────────────────

interface SeedUser {
  id: string;
  email: string;
  display_name: string;
}

const USERS: Record<string, SeedUser> = {};

function defineUser(key: string, email: string, displayName: string): SeedUser {
  const u: SeedUser = {
    id: makeId('user', email),
    email,
    display_name: displayName,
  };
  USERS[key] = u;
  return u;
}

// ── Employees (@azentio.com) ─────────────────────────────────────────────────

defineUser('alice', 'alice.chen@azentio.com', 'Alice Chen');
// Role: portal_admin

defineUser('bob', 'bob.martinez@azentio.com', 'Bob Martinez');
// Role: learning_moderator

defineUser('carol', 'carol.patel@azentio.com', 'Carol Patel');
// Role: content_publisher

defineUser('david', 'david.kim@azentio.com', 'David Kim');
// Role: product_owner (assigned: Financial Analysis Intelligence)

defineUser('elena_r', 'elena.rossi@azentio.com', 'Elena Rossi');
// Role: product_owner (assigned: Risk & Compliance)

defineUser('frank', 'frank.nguyen@azentio.com', 'Frank Nguyen');
// Role: employee only (no special grants — tests "denied on admin/publish/moderate routes")

defineUser('grace', 'grace.thompson@azentio.com', 'Grace Thompson');
// Role: employee only (Playground contributor)

defineUser('kofi', 'kofi.mensah@azentio.com', 'Kofi Mensah');
// Role: verified @azentio.com but NOT provisioned (no membership) — sign-in works, portal access denied

defineUser('lisa', 'lisa.jones@azentio.com', 'Lisa Jones');
// Role: employee only (no special grants — filling out roster)

// ── Harborline Commercial Bank ───────────────────────────────────────────────

defineUser('henry', 'henry.wu@harborline.com', 'Henry Wu');
// Role: client_admin

defineUser('iris', 'iris.johnson@harborline.com', 'Iris Johnson');
// Role: client_member (main author of seasonality observations)

defineUser('quinn', 'quinn.roberts@harborline.com', 'Quinn Roberts');
// Role: dual member — Harborline AND Sandune (forces workspace switcher, active-workspace required)

defineUser('wendy', 'wendy.kim@harborline.com', 'Wendy Kim');
// Role: client_member (additional, filling out roster)

// ── Sandune Finance Company ──────────────────────────────────────────────────

defineUser('jack', 'jack.brown@sandune.com', 'Jack Brown');
// Role: client_admin (seasonality #2 author)

defineUser('kate', 'kate.davis@sandune.com', 'Kate Davis');
// Role: client_member (reads org observations, files report)

defineUser('rebecca', 'rebecca.nguyen@sandune.com', 'Rebecca Nguyen');
// Role: REVOKED member — session/token must fail; old posts stay with org, authorship hidden

// ── Kestrel Peak Microfinance ────────────────────────────────────────────────

defineUser('liam', 'liam.wilson@kestrel.com', 'Liam Wilson');
// Role: client_admin (seasonality #3 author)

defineUser('maya', 'maya.anderson@kestrel.com', 'Maya Anderson');
// Role: client_member (files report, submits sensitive content)

// ── Northmere Mutual Insurance (attack target) ───────────────────────────────

defineUser('noah', 'noah.taylor@northmere.com', 'Noah Taylor');
// Role: client_admin (victim tenant admin)

defineUser('olivia', 'olivia.martin@northmere.com', 'Olivia Martin');
// Role: client_member (owns private canary content)

// ── Emberfield Capital Partners (empty states) ───────────────────────────────

defineUser('peter', 'peter.white@emberfield.com', 'Peter White');
// Role: client_admin (sees empty states only)

defineUser('samir', 'samir.ali@emberfield.com', 'Samir Ali');
// Role: client_member (sees empty states only)

// ── Additional employees ─────────────────────────────────────────────────────

defineUser('victor', 'victor.zhou@azentio.com', 'Victor Zhou');
// Role: employee only (no special grants)

// ── Invitation-only (not full users, but we create invitation records) ───────
// tanya.zhang@kestrel.com — pending invitation
// uma.patel@harborline.com — expired invitation

// ─── Memberships ─────────────────────────────────────────────────────────────

interface SeedMembership {
  userId: string;
  orgKey: OrgKey;
  role: string;
  status: 'active' | 'invited' | 'revoked';
  joinedAt: Date;
}

const MEMBERSHIPS: SeedMembership[] = [];

function addMembership(
  userKey: string,
  orgKey: OrgKey,
  role: string,
  status: 'active' | 'invited' | 'revoked' = 'active',
  offsetDays = -30,
) {
  MEMBERSHIPS.push({
    userId: USERS[userKey].id,
    orgKey,
    role,
    status,
    joinedAt: ts(offsetDays),
  });
}

// Azentio employees (provisioned)
addMembership('alice', 'azentio', 'portal_admin', 'active', -90);
addMembership('bob', 'azentio', 'learning_moderator', 'active', -60);
addMembership('carol', 'azentio', 'content_publisher', 'active', -45);
addMembership('david', 'azentio', 'product_owner', 'active', -50);
addMembership('elena_r', 'azentio', 'product_owner', 'active', -40);
addMembership('frank', 'azentio', 'employee', 'active', -30);
addMembership('grace', 'azentio', 'employee', 'active', -25);
addMembership('lisa', 'azentio', 'employee', 'active', -20);
addMembership('victor', 'azentio', 'employee', 'active', -15);

// NOTE: kofi.mensah@azentio.com is verified but NOT provisioned — no membership row.
// This tests: sign-in succeeds, portal access denied.

// Harborline
addMembership('henry', 'harborline', 'client_admin', 'active', -60);
addMembership('iris', 'harborline', 'client_member', 'active', -55);
addMembership('quinn', 'harborline', 'client_member', 'active', -35);
addMembership('wendy', 'harborline', 'client_member', 'active', -30);

// Sandune
addMembership('jack', 'sandune', 'client_admin', 'active', -50);
addMembership('kate', 'sandune', 'client_member', 'active', -45);
addMembership('rebecca', 'sandune', 'client_member', 'revoked', -60); // REVOKED
addMembership('quinn', 'sandune', 'client_member', 'active', -25); // Dual member

// Kestrel
addMembership('liam', 'kestrel', 'client_admin', 'active', -40);
addMembership('maya', 'kestrel', 'client_member', 'active', -35);

// Northmere
addMembership('noah', 'northmere', 'client_admin', 'active', -30);
addMembership('olivia', 'northmere', 'client_member', 'active', -25);

// Emberfield
addMembership('peter', 'emberfield', 'client_admin', 'active', -20);
addMembership('samir', 'emberfield', 'client_member', 'active', -15);

// ─── Role Grants ─────────────────────────────────────────────────────────────

interface SeedRoleGrant {
  userId: string;
  orgKey: OrgKey | null;
  role: string;
  offeringId: string | null;
  grantedBy: string;
}

const ROLE_GRANTS: SeedRoleGrant[] = [];

function addRoleGrant(
  userKey: string,
  orgKey: OrgKey | null,
  role: string,
  offeringId: string | null = null,
  grantedByKey = 'alice',
) {
  ROLE_GRANTS.push({
    userId: USERS[userKey].id,
    orgKey,
    role,
    offeringId,
    grantedBy: USERS[grantedByKey].id,
  });
}

// Platform-level grants (orgKey = null)
addRoleGrant('alice', null, 'portal_admin');
addRoleGrant('bob', null, 'learning_moderator');
addRoleGrant('carol', null, 'content_publisher');
addRoleGrant('david', null, 'product_owner', OFFERINGS.fai.id);
addRoleGrant('elena_r', null, 'product_owner', OFFERINGS.insurance.id);

// ─── Entitlements ────────────────────────────────────────────────────────────

interface SeedEntitlement {
  orgKey: OrgKey;
  offeringId: string;
  feature: string | null;
  status: 'active' | 'revoked' | 'expired';
  validFrom: Date;
  validTo: Date | null;
  grantedBy: string;
}

const ENTITLEMENTS: SeedEntitlement[] = [];

function addEntitlement(
  orgKey: OrgKey,
  offeringId: string,
  status: 'active' | 'revoked' | 'expired' = 'active',
  validFromDays = -90,
  validToDays: number | null = null,
) {
  ENTITLEMENTS.push({
    orgKey,
    offeringId,
    feature: null,
    status,
    validFrom: ts(validFromDays),
    validTo: validToDays ? ts(validToDays) : null,
    grantedBy: USERS.alice.id,
  });
}

// Harborline: Lending, Digital, AMLOCK, FAI (active); iMAL pending
addEntitlement('harborline', OFFERINGS.lending.id);
addEntitlement('harborline', OFFERINGS.digital.id);
addEntitlement('harborline', OFFERINGS.amlock.id);
addEntitlement('harborline', OFFERINGS.fai.id);

// Sandune: Lending, Factoring, FAI
addEntitlement('sandune', OFFERINGS.lending.id);
addEntitlement('sandune', OFFERINGS.factoring.id);
addEntitlement('sandune', OFFERINGS.fai.id);

// Kestrel: Lending, Digital, FAI
addEntitlement('kestrel', OFFERINGS.lending.id);
addEntitlement('kestrel', OFFERINGS.digital.id);
addEntitlement('kestrel', OFFERINGS.fai.id);

// Northmere: Insurance, Orion (active)
addEntitlement('northmere', OFFERINGS.insurance.id);
addEntitlement('northmere', OFFERINGS.orion.id);

// Northmere: revoked entitlements (security test — cross-tenant attack target)
addEntitlement('northmere', OFFERINGS.lending.id, 'revoked', -180, -120);

// Emberfield: NONE (empty states)

// ─── Contributions + Versions + Shared Copies ────────────────────────────────

interface SeedContribution {
  id: string;
  authorUserKey: string;
  orgKey: OrgKey;
  visibility: 'author' | 'org' | 'community_proposed';
  state: string;
  epoch: number;
  createdAt: Date;
  updatedAt: Date;
  // Version data
  sourcePayload: Record<string, unknown>;
  // Shared copy (if published/approved)
  reviewedPayload: Record<string, unknown> | null;
  deidentified: boolean;
  attributionConsent: boolean;
  publishedAt: Date | null;
}

const CONTRIBUTIONS: SeedContribution[] = [];

function addContribution(c: SeedContribution) {
  CONTRIBUTIONS.push(c);
}

const nowTs = ts(0);

// ── Seasonality Scenario (obs_01, obs_02, obs_03) ────────────────────────────

// obs_01: Harborline / Iris — Seasonal SME revenue flagged as deterioration
addContribution({
  id: makeId('contribution', 'obs-01-harborline-seasonal-sme'),
  authorUserKey: 'iris',
  orgKey: 'harborline',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-20),
  updatedAt: ts(-14),
  sourcePayload: {
    title: 'Seasonal SME revenue flagged as deterioration',
    observation_type: 'market_observation',
    offering: 'FAI',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'quantitative',
    confidence: 'medium',
    body: 'Our Eastern-region book of 38 date-packing and gift-retail SMEs, handled by RM Noor Qasim, drops about 60% of revenue in Q3. FAI flags every one as deteriorating. The credit committee overrode 45% of these in FY2025.',
  },
  reviewedPayload: {
    title: 'Seasonal SME revenue flagged as deterioration',
    body: 'A regional lender saw borrowers in seasonal retail and food trading show sharp revenue dips in particular quarters. Period-over-period comparisons labelled these as deterioration, and manual overrides were frequent.',
    observation_type: 'market_observation',
    offering: 'FAI',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'quantitative',
    confidence: 'medium',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-14),
});

// obs_02: Sandune / Jack — Quarter-on-quarter comparisons mis-read seasonal traders
addContribution({
  id: makeId('contribution', 'obs-02-sandune-qoq-seasonal'),
  authorUserKey: 'jack',
  orgKey: 'sandune',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-18),
  updatedAt: ts(-12),
  sourcePayload: {
    title: 'Quarter-on-quarter comparisons mis-read seasonal traders',
    observation_type: 'operational_challenge',
    offering: 'FAI',
    industry: 'SME Lending',
    region: 'Levant',
    observation_period_start: '2024-07-01',
    observation_period_end: '2025-06-30',
    evidence_type: 'quantitative',
    confidence: 'high',
    body: "Sandune's Amman trading cohort (about 120 loans, largest client Zaytoun Wholesale) is flagged each January. We now add a manual memo to 70% of files.",
  },
  reviewedPayload: {
    title: 'Quarter-on-quarter comparisons mis-read seasonal traders',
    body: 'A non-bank lender reported that comparing a quarter with the preceding quarter mis-reads seasonal traders, and that analysts add manual explanations to a large share of files.',
    observation_type: 'operational_challenge',
    offering: 'FAI',
    industry: 'SME Lending',
    region: 'Levant',
    observation_period_start: '2024-07-01',
    observation_period_end: '2025-06-30',
    evidence_type: 'quantitative',
    confidence: 'high',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-12),
});

// obs_03: Kestrel / Liam — Harvest-cycle borrowers look delinquent
addContribution({
  id: makeId('contribution', 'obs-03-kestrel-harvest-delinquent'),
  authorUserKey: 'liam',
  orgKey: 'kestrel',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-15),
  updatedAt: ts(-10),
  sourcePayload: {
    title: 'Harvest-cycle borrowers look delinquent in monthly views',
    observation_type: 'product_gap',
    offering: 'Lending',
    industry: 'Microfinance',
    region: 'South East Asia',
    observation_period_start: '2025-10-01',
    observation_period_end: '2026-09-30',
    evidence_type: 'anecdotal',
    confidence: 'low',
    body: 'In Mindanao-east, our 300 harvest borrowers look 30 days late every March per the monthly dashboard.',
  },
  reviewedPayload: {
    title: 'Harvest-cycle borrowers look delinquent in monthly views',
    body: 'A microfinance lender observed that borrowers with harvest-driven income appear delinquent in monthly views during off-season months.',
    observation_type: 'product_gap',
    offering: 'Lending',
    industry: 'Microfinance',
    region: 'South East Asia',
    observation_period_start: '2025-10-01',
    observation_period_end: '2026-09-30',
    evidence_type: 'anecdotal',
    confidence: 'low',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-10),
});

// ── Collections Early Warning Theme (obs_04, obs_05, obs_06, obs_07) ─────────

// obs_04: Harborline / Iris — Early-warning signals for collections miss seasonal lulls
addContribution({
  id: makeId('contribution', 'obs-04-harborline-early-warning'),
  authorUserKey: 'iris',
  orgKey: 'harborline',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-12),
  updatedAt: ts(-7),
  sourcePayload: {
    title: 'Early-warning signals for collections miss seasonal lulls',
    observation_type: 'emerging_trend',
    offering: 'AMLOCK',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-06-01',
    observation_period_end: '2026-05-31',
    evidence_type: 'anecdotal',
    confidence: 'medium',
    body: 'Our collections early-warning system fires alerts every July-August when SME clients take planned repayment holidays. Analysts spend the first week of every quarter dismissing known seasonal patterns.',
  },
  reviewedPayload: {
    title: 'Early-warning signals for collections miss seasonal lulls',
    body: 'A GCC lender reported that collections early-warning triggers fire during planned seasonal repayment holidays, requiring analysts to manually dismiss known patterns each quarter.',
    observation_type: 'emerging_trend',
    offering: 'AMLOCK',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-06-01',
    observation_period_end: '2026-05-31',
    evidence_type: 'anecdotal',
    confidence: 'medium',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-7),
});

// obs_05: Harborline / Iris — Collections triggers fire during agreed repayment holidays
addContribution({
  id: makeId('contribution', 'obs-05-harborline-collections-holidays'),
  authorUserKey: 'iris',
  orgKey: 'harborline',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-10),
  updatedAt: ts(-6),
  sourcePayload: {
    title: 'Collections triggers fire during agreed repayment holidays',
    observation_type: 'operational_challenge',
    offering: 'Lending',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-03-01',
    observation_period_end: '2026-02-28',
    evidence_type: 'quantitative',
    confidence: 'high',
    body: 'Across our SME portfolio, 30% of collections triggers in Q2 and Q3 correspond to accounts with documented repayment holiday agreements. The system does not read the holiday schedule.',
  },
  reviewedPayload: {
    title: 'Collections triggers fire during agreed repayment holidays',
    body: 'A lender found that a significant share of collections triggers correspond to accounts with documented repayment holiday agreements. The collections system does not reference the holiday schedule.',
    observation_type: 'operational_challenge',
    offering: 'Lending',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-03-01',
    observation_period_end: '2026-02-28',
    evidence_type: 'quantitative',
    confidence: 'high',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-6),
});

// obs_06: Sandune / Jack — Arrears flags ignore agreed grace months
addContribution({
  id: makeId('contribution', 'obs-06-sandune-arrears-grace'),
  authorUserKey: 'jack',
  orgKey: 'sandune',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-9),
  updatedAt: ts(-5),
  sourcePayload: {
    title: 'Arrears flags ignore agreed grace months',
    observation_type: 'operational_challenge',
    offering: 'Lending',
    industry: 'SME Lending',
    region: 'Levant',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'quantitative',
    confidence: 'medium',
    body: 'Our factoring clients with agricultural supply chains have contractually agreed grace periods of up to 90 days. The arrears dashboard still flags them at 30 days past due.',
  },
  reviewedPayload: {
    title: 'Arrears flags ignore agreed grace months',
    body: 'A non-bank lender reported that factoring clients with agricultural supply chains have contractually agreed grace periods, but the arrears dashboard flags them at standard past-due thresholds.',
    observation_type: 'operational_challenge',
    offering: 'Lending',
    industry: 'SME Lending',
    region: 'Levant',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'quantitative',
    confidence: 'medium',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-5),
});

// obs_07: Kestrel / Liam — Repayment-calendar flexibility for farmers (v1 published, v2 pending review)
addContribution({
  id: makeId('contribution', 'obs-07-kestrel-repayment-flex'),
  authorUserKey: 'liam',
  orgKey: 'kestrel',
  visibility: 'community_proposed',
  state: 'published', // v1 published; v2 pending
  epoch: 2, // has been updated
  createdAt: ts(-8),
  updatedAt: ts(-1),
  sourcePayload: {
    title: 'Repayment-calendar flexibility for farmers',
    observation_type: 'successful_practice',
    offering: 'Lending',
    industry: 'Microfinance',
    region: 'South East Asia',
    observation_period_start: '2025-01-01',
    observation_period_end: '2026-01-01',
    evidence_type: 'case_study',
    confidence: 'medium',
    body: 'We aligned repayment dates with harvest calendars for 200 rice and vegetable farmers in Mindanao. Default rates dropped from 12% to 4.5% over two seasons. V2 expands to include a neighbouring district with similar crop patterns.',
  },
  reviewedPayload: {
    title: 'Repayment-calendar flexibility for farmers',
    body: 'A microfinance lender aligned repayment dates with harvest calendars for agricultural borrowers. Default rates improved substantially over two growing seasons.',
    observation_type: 'successful_practice',
    offering: 'Lending',
    industry: 'Microfinance',
    region: 'South East Asia',
    observation_period_start: '2025-01-01',
    observation_period_end: '2026-01-01',
    evidence_type: 'case_study',
    confidence: 'medium',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-4),
});

// ── Alert Triage Theme (obs_08, obs_09, obs_10 — suppressed: only 2 distinct orgs) ─

// obs_08: Harborline / Iris — Alert triage queue fatigue
addContribution({
  id: makeId('contribution', 'obs-08-harborline-alert-fatigue'),
  authorUserKey: 'iris',
  orgKey: 'harborline',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-7),
  updatedAt: ts(-3),
  sourcePayload: {
    title: 'Alert triage queue fatigue',
    observation_type: 'operational_challenge',
    offering: 'AMLOCK',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'anecdotal',
    confidence: 'high',
    body: 'Our compliance analysts triage ~450 alerts per day. Over 60% are known false positives from seasonal patterns, but skipping triage risks missing genuine alerts.',
  },
  reviewedPayload: {
    title: 'Alert triage queue fatigue',
    body: 'A GCC bank reported that compliance analysts triage a high volume of daily alerts, with a majority being known false positives from seasonal patterns. Skipping triage is not an option due to regulatory requirements.',
    observation_type: 'operational_challenge',
    offering: 'AMLOCK',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'anecdotal',
    confidence: 'high',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-3),
});

// obs_09: Harborline / Henry — Triage rules need per-segment tuning
addContribution({
  id: makeId('contribution', 'obs-09-harborline-triage-tuning'),
  authorUserKey: 'henry',
  orgKey: 'harborline',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-6),
  updatedAt: ts(-2),
  sourcePayload: {
    title: 'Triage rules need per-segment tuning',
    observation_type: 'improvement_suggestion',
    offering: 'AMLOCK',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-06-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'quantitative',
    confidence: 'medium',
    body: 'Segmenting alert thresholds by customer type (retail vs SME vs corporate) would cut our false-positive rate by an estimated 40%. Currently all segments share the same rules.',
  },
  reviewedPayload: {
    title: 'Triage rules need per-segment tuning',
    body: 'A bank suggested that segmenting alert thresholds by customer type could significantly reduce false-positive rates. Currently, all segments share identical rules.',
    observation_type: 'improvement_suggestion',
    offering: 'AMLOCK',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-06-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'quantitative',
    confidence: 'medium',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-2),
});

// obs_10: Kestrel / Maya — Analysts skip low-score alerts
addContribution({
  id: makeId('contribution', 'obs-10-kestrel-skip-low-score'),
  authorUserKey: 'maya',
  orgKey: 'kestrel',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-5),
  updatedAt: ts(-1),
  sourcePayload: {
    title: 'Analysts skip low-score alerts',
    observation_type: 'operational_challenge',
    offering: 'AMLOCK',
    industry: 'Microfinance',
    region: 'South East Asia',
    observation_period_start: '2025-03-01',
    observation_period_end: '2026-02-28',
    evidence_type: 'anecdotal',
    confidence: 'low',
    body: 'Our two-person compliance team ignores alerts scored below 50 because there are too many. We review maybe one in ten low-score alerts.',
  },
  reviewedPayload: {
    title: 'Analysts skip low-score alerts',
    body: 'A small microfinance institution reported that its compliance team skips low-scoring alerts due to volume, reviewing only a fraction of them.',
    observation_type: 'operational_challenge',
    offering: 'AMLOCK',
    industry: 'Microfinance',
    region: 'South East Asia',
    observation_period_start: '2025-03-01',
    observation_period_end: '2026-02-28',
    evidence_type: 'anecdotal',
    confidence: 'low',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-1),
});

// ── Private / Draft / Moderation Queue Items ─────────────────────────────────

// obs_11: Harborline / Iris — Draft: onboarding re-request ideas (private_draft)
addContribution({
  id: makeId('contribution', 'obs-11-harborline-onboarding-draft'),
  authorUserKey: 'iris',
  orgKey: 'harborline',
  visibility: 'author',
  state: 'private_draft',
  epoch: 0,
  createdAt: ts(-3),
  updatedAt: ts(-3),
  sourcePayload: {
    title: 'Onboarding re-request ideas',
    observation_type: 'improvement_suggestion',
    offering: 'Digital',
    industry: 'Banking',
    region: 'GCC',
    evidence_type: 'anecdotal',
    confidence: 'low',
    body: 'Draft notes on improving the digital onboarding flow. Need to gather more team feedback before submitting. Ideas include pre-filling KYC from national ID and reducing document upload steps.',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// obs_12: Sandune / Kate — Sensitive-flag example (submitted, flagged sensitive)
addContribution({
  id: makeId('contribution', 'obs-12-sandune-sensitive-flag'),
  authorUserKey: 'kate',
  orgKey: 'sandune',
  visibility: 'community_proposed',
  state: 'submitted',
  epoch: 0,
  createdAt: ts(-1, -2),
  updatedAt: ts(-1, -2),
  sourcePayload: {
    title: 'Digital onboarding drop-off at document step',
    observation_type: 'product_gap',
    offering: 'Digital',
    industry: 'SME Lending',
    region: 'Levant',
    observation_period_start: '2025-09-01',
    observation_period_end: '2026-09-30',
    evidence_type: 'quantitative',
    confidence: 'medium',
    body: 'The loan for account XX00 TEST 0000 0000 1234 56 and contact cust.demo@example.test was stuck in onboarding for 18 days at the document upload step. About 35% of our applicants drop off here.',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// obs_13: Kestrel / Maya — Needs clarification
addContribution({
  id: makeId('contribution', 'obs-13-kestrel-needs-clarification'),
  authorUserKey: 'maya',
  orgKey: 'kestrel',
  visibility: 'community_proposed',
  state: 'needs_clarification',
  epoch: 0,
  createdAt: ts(-4),
  updatedAt: ts(-2),
  sourcePayload: {
    title: 'Digital onboarding drop-off at document step',
    observation_type: 'operational_challenge',
    offering: 'Digital',
    industry: 'Microfinance',
    region: 'South East Asia',
    observation_period_start: '2025-06-01',
    observation_period_end: '2026-05-31',
    evidence_type: 'anecdotal',
    confidence: 'medium',
    body: 'Our field officers report that borrowers struggle with the document upload step in digital onboarding. Many use older phones and the app crashes during photo capture.',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// obs_14: Harborline / Iris — Returned for edit (org scope)
addContribution({
  id: makeId('contribution', 'obs-14-harborline-returned-edit'),
  authorUserKey: 'iris',
  orgKey: 'harborline',
  visibility: 'org',
  state: 'needs_clarification',
  epoch: 0,
  createdAt: ts(-5),
  updatedAt: ts(-3),
  sourcePayload: {
    title: 'Treatment of seasonal limits in FAI commentary',
    observation_type: 'improvement_suggestion',
    offering: 'FAI',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'quantitative',
    confidence: 'medium',
    body: 'FAI commentary should include a note when a borrower has a documented seasonal business. Currently it treats all revenue drops uniformly, which confuses our credit committee.',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// obs_15: Sandune / Kate — Rejected: duplicate of obs_02
addContribution({
  id: makeId('contribution', 'obs-15-sandune-duplicate'),
  authorUserKey: 'kate',
  orgKey: 'sandune',
  visibility: 'community_proposed',
  state: 'rejected',
  epoch: 0,
  createdAt: ts(-6),
  updatedAt: ts(-4),
  sourcePayload: {
    title: 'Seasonal traders misread in comparisons',
    observation_type: 'market_observation',
    offering: 'FAI',
    industry: 'SME Lending',
    region: 'Levant',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'anecdotal',
    confidence: 'low',
    body: 'Seasonal traders in our portfolio are consistently misread by quarter-on-quarter comparisons. This is similar to what others have reported.',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// obs_16: Kestrel / Maya — Rejected: unsafe (contains customer name and contract rate)
addContribution({
  id: makeId('contribution', 'obs-16-kestrel-unsafe'),
  authorUserKey: 'maya',
  orgKey: 'kestrel',
  visibility: 'community_proposed',
  state: 'rejected',
  epoch: 0,
  createdAt: ts(-5),
  updatedAt: ts(-3),
  sourcePayload: {
    title: 'Pricing complaint from key client',
    observation_type: 'operational_challenge',
    offering: 'Lending',
    industry: 'Microfinance',
    region: 'South East Asia',
    observation_period_start: '2025-05-01',
    observation_period_end: '2026-04-30',
    evidence_type: 'anecdotal',
    confidence: 'medium',
    body: 'Our largest borrower Maria Santos of Barangay San José, with a current rate of 18.5% on her PHP 450,000 agricultural loan, has complained that the pricing is unfair compared to neighbouring cooperatives offering 12%.',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// obs_17: Harborline / Iris — Withdrawn (was published)
addContribution({
  id: makeId('contribution', 'obs-17-harborline-withdrawn'),
  authorUserKey: 'iris',
  orgKey: 'harborline',
  visibility: 'community_proposed',
  state: 'withdrawn',
  epoch: 2,
  createdAt: ts(-15),
  updatedAt: ts(-2),
  sourcePayload: {
    title: 'Old KYC re-submission note',
    observation_type: 'market_observation',
    offering: 'Digital',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-06-30',
    evidence_type: 'anecdotal',
    confidence: 'low',
    body: 'KYC re-submission requests for SME clients have been increasing. This observation has been withdrawn as the data is now outdated.',
  },
  reviewedPayload: {
    title: 'Old KYC re-submission note',
    body: 'KYC re-submission requests for SME clients had been noted as increasing. This observation has been withdrawn.',
    observation_type: 'market_observation',
    offering: 'Digital',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-06-30',
    evidence_type: 'anecdotal',
    confidence: 'low',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-10),
});

// obs_18: Harborline / Iris — Live withdraw test (token: zebra-withdraw-test)
addContribution({
  id: makeId('contribution', 'obs-18-harborline-withdraw-test'),
  authorUserKey: 'iris',
  orgKey: 'harborline',
  visibility: 'community_proposed',
  state: 'published',
  epoch: 1,
  createdAt: ts(-3),
  updatedAt: ts(-2),
  sourcePayload: {
    title: 'Digital KYC re-submission friction',
    observation_type: 'market_observation',
    offering: 'Digital',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-07-01',
    observation_period_end: '2026-06-30',
    evidence_type: 'quantitative',
    confidence: 'medium',
    body: 'Digital KYC re-submission requests take an average of 4.2 days to process end-to-end. Token reference: zebra-withdraw-test for live withdrawal timing test.',
  },
  reviewedPayload: {
    title: 'Digital KYC re-submission friction',
    body: 'Digital KYC re-submission requests were observed to take several days for end-to-end processing. This contribution is used for withdrawal timing validation.',
    observation_type: 'market_observation',
    offering: 'Digital',
    industry: 'Banking',
    region: 'GCC',
    observation_period_start: '2025-07-01',
    observation_period_end: '2026-06-30',
    evidence_type: 'quantitative',
    confidence: 'medium',
  },
  deidentified: true,
  attributionConsent: false,
  publishedAt: ts(-2),
});

// obs_19: Sandune / Jack — Reported, temporarily unpublished
addContribution({
  id: makeId('contribution', 'obs-19-sandune-reported'),
  authorUserKey: 'jack',
  orgKey: 'sandune',
  visibility: 'community_proposed',
  state: 'suspended',
  epoch: 1,
  createdAt: ts(-4),
  updatedAt: ts(-1),
  sourcePayload: {
    title: 'Concern about peer bank credit score practices',
    observation_type: 'market_observation',
    offering: 'FAI',
    industry: 'SME Lending',
    region: 'Levant',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'anecdotal',
    confidence: 'low',
    body: 'We have heard from three clients that peer banks in the region are sharing credit scores informally. This is unverified and possibly misleading.',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// obs_20: Northmere / Olivia — Claims intake fragmentation (org-only, canary)
addContribution({
  id: makeId('contribution', 'obs-20-northmere-canary'),
  authorUserKey: 'olivia',
  orgKey: 'northmere',
  visibility: 'org',
  state: 'approved',
  epoch: 0,
  createdAt: ts(-4),
  updatedAt: ts(-2),
  sourcePayload: {
    title: 'Claims intake fragmentation (canary NORTHMERE-CANARY-7731)',
    observation_type: 'operational_challenge',
    offering: 'Insurance',
    industry: 'Insurance',
    region: 'East Africa',
    observation_period_start: '2025-07-01',
    observation_period_end: '2026-06-30',
    evidence_type: 'quantitative',
    confidence: 'high',
    body: 'Claims come in through three different intake channels: web portal, agent app, and email. Data fields are inconsistent across channels. NORTHMERE-CANARY-7731',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// obs_21: Northmere / Olivia — Private draft with canary (cross-tenant test)
addContribution({
  id: makeId('contribution', 'obs-21-northmere-private-draft'),
  authorUserKey: 'olivia',
  orgKey: 'northmere',
  visibility: 'author',
  state: 'private_draft',
  epoch: 0,
  createdAt: ts(-2),
  updatedAt: ts(-2),
  sourcePayload: {
    title: 'Draft: Insurance workflow improvements (canary NORTHMERE-PRIVATE-DRAFT-0042)',
    observation_type: 'improvement_suggestion',
    offering: 'Insurance',
    industry: 'Insurance',
    region: 'East Africa',
    observation_period_start: '2025-01-01',
    observation_period_end: '2025-12-31',
    evidence_type: 'anecdotal',
    confidence: 'low',
    body: 'Internal draft notes on potential workflow improvements for the claims processing pipeline. NORTHMERE-PRIVATE-DRAFT-0042',
  },
  reviewedPayload: null,
  deidentified: false,
  attributionConsent: false,
  publishedAt: null,
});

// ─── Themes ──────────────────────────────────────────────────────────────────

interface SeedTheme {
  id: string;
  title: string;
  offering: string | null;
  topic: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'emerging' | 'active' | 'archived';
  safeSummary: string;
  distinctOrgCount: number;
  contributionIds: string[];
}

const THEMES: SeedTheme[] = [
  {
    id: makeId('theme', 'seasonality-context'),
    title: 'Seasonality context',
    offering: 'FAI',
    topic: 'Seasonal SME cash-flow treatment',
    periodStart: ts(-20),
    periodEnd: ts(0),
    status: 'active',
    safeSummary:
      'Three organisations across banking, non-bank lending, and microfinance independently reported that seasonal revenue patterns are misread as deterioration, delinquency, or risk by standard period-over-period comparisons. Manual overrides and field-officer judgement are common workarounds. The sample is small; do not treat as market prevalence.',
    distinctOrgCount: 3,
    contributionIds: [
      makeId('contribution', 'obs-01-harborline-seasonal-sme'),
      makeId('contribution', 'obs-02-sandune-qoq-seasonal'),
      makeId('contribution', 'obs-03-kestrel-harvest-delinquent'),
    ],
  },
  {
    id: makeId('theme', 'collections-early-warning'),
    title: 'Collections early warning',
    offering: 'Lending',
    topic: 'Collections triggers and repayment flexibility',
    periodStart: ts(-12),
    periodEnd: ts(0),
    status: 'active',
    safeSummary:
      'Three organisations reported that collections and arrears triggers do not account for agreed repayment holidays, grace periods, or harvest-aligned schedules. Aligning repayment dates with borrower cash-flow cycles improved outcomes. Repeated posts from the same organisation are counted once.',
    distinctOrgCount: 3,
    contributionIds: [
      makeId('contribution', 'obs-04-harborline-early-warning'),
      makeId('contribution', 'obs-05-harborline-collections-holidays'),
      makeId('contribution', 'obs-06-sandune-arrears-grace'),
      makeId('contribution', 'obs-07-kestrel-repayment-flex'),
    ],
  },
  {
    id: makeId('theme', 'alert-triage-fatigue'),
    title: 'Alert triage fatigue',
    offering: 'AMLOCK',
    topic: 'Alert volume and triage efficiency',
    periodStart: ts(-7),
    periodEnd: ts(0),
    status: 'archived', // suppressed: only 2 distinct orgs
    safeSummary:
      'Not enough contributing organisations to show. This theme is suppressed because fewer than 3 distinct organisations contributed evidence.',
    distinctOrgCount: 2,
    contributionIds: [
      makeId('contribution', 'obs-08-harborline-alert-fatigue'),
      makeId('contribution', 'obs-09-harborline-triage-tuning'),
      makeId('contribution', 'obs-10-kestrel-skip-low-score'),
    ],
  },
];

// ─── Improvement Ideas ───────────────────────────────────────────────────────

interface SeedIdea {
  id: string;
  title: string;
  problemStatement: string;
  offering: string | null;
  proposedOutcome: string;
  ownerTeam: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  audience: 'internal' | 'clients' | 'public';
  createdAt: Date;
  updatedAt: Date;
  contributionIds: string[];
}

const IDEAS: SeedIdea[] = [
  {
    id: makeId('idea', 'seasonality-aware-comparison'),
    title: 'Seasonality-aware comparison explanation',
    problemStatement:
      'Standard period-over-period financial comparisons do not account for documented seasonal revenue patterns, causing false deterioration flags, unnecessary manual overrides, and reduced trust in automated analysis.',
    offering: 'FAI',
    proposedOutcome:
      'FAI commentary includes a seasonality-aware comparison that references the borrower\'s known seasonal cycle and highlights whether a change is within the expected range.',
    ownerTeam: 'FAI Product Team',
    priority: 'high',
    status: 'Under review',
    audience: 'clients',
    createdAt: ts(-9),
    updatedAt: ts(-6),
    contributionIds: [
      makeId('contribution', 'obs-01-harborline-seasonal-sme'),
      makeId('contribution', 'obs-02-sandune-qoq-seasonal'),
      makeId('contribution', 'obs-03-kestrel-harvest-delinquent'),
    ],
  },
  {
    id: makeId('idea', 'per-segment-alert-tuning'),
    title: 'Per-segment alert triage tuning',
    problemStatement:
      'Alert thresholds are applied uniformly across customer segments, generating high false-positive rates and analyst fatigue. Segment-specific tuning could reduce noise and improve detection of genuine risks.',
    offering: 'AMLOCK',
    proposedOutcome:
      'AMLOCK supports configurable alert thresholds by customer segment (retail, SME, corporate), with baseline rules shipped as defaults and client-adjustable parameters.',
    ownerTeam: 'AMLOCK Product Team',
    priority: 'medium',
    status: 'Proposed',
    audience: 'internal',
    createdAt: ts(-6),
    updatedAt: ts(-6),
    contributionIds: [], // Evidence from suppressed theme only
  },
  {
    id: makeId('idea', 'respect-repayment-holidays'),
    title: 'Respect repayment holidays in collections triggers',
    problemStatement:
      'Collections triggers fire during contractually agreed repayment holidays and grace periods, creating unnecessary workload and eroding borrower trust.',
    offering: 'Lending',
    proposedOutcome:
      'The collections module reads the repayment holiday and grace-period schedule and suppresses triggers during agreed non-payment windows.',
    ownerTeam: 'Lending Product Team',
    priority: 'high',
    status: 'In progress',
    audience: 'clients',
    createdAt: ts(-7),
    updatedAt: ts(-3),
    contributionIds: [
      makeId('contribution', 'obs-04-harborline-early-warning'),
      makeId('contribution', 'obs-05-harborline-collections-holidays'),
      makeId('contribution', 'obs-06-sandune-arrears-grace'),
      makeId('contribution', 'obs-07-kestrel-repayment-flex'),
    ],
  },
  {
    id: makeId('idea', 'auto-translate-kyc-prompts'),
    title: 'Auto-translate KYC re-submission prompts',
    problemStatement:
      'KYC re-submission requests are sent in a single language, causing delays and drop-offs for borrowers who operate in a different primary language.',
    offering: 'Digital',
    proposedOutcome:
      'Digital Banking auto-translates KYC re-submission prompts into the borrower\'s preferred language using approved translation templates.',
    ownerTeam: 'Digital Banking Team',
    priority: 'low',
    status: 'Not proceeding',
    audience: 'internal',
    createdAt: ts(-10),
    updatedAt: ts(-2),
    contributionIds: [
      makeId('contribution', 'obs-18-harborline-withdraw-test'),
    ],
  },
];

// ─── Notifications ───────────────────────────────────────────────────────────

interface SeedNotification {
  recipientUserKey: string;
  event: string;
  safePayload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

const NOTIFICATIONS: SeedNotification[] = [];

function addNotification(
  recipientKey: string,
  event: string,
  payload: Record<string, unknown>,
  createdDays: number,
  read: boolean = false,
) {
  NOTIFICATIONS.push({
    recipientUserKey: recipientKey,
    event,
    safePayload: payload,
    readAt: read ? ts(createdDays, 1) : null,
    createdAt: ts(createdDays),
  });
}

// obs_01 published
addNotification('iris', 'contribution.published', {
  contribution_id: makeId('contribution', 'obs-01-harborline-seasonal-sme'),
  title: 'Seasonal SME revenue flagged as deterioration',
}, -14, true);

// obs_02 clarification requested, then published
addNotification('jack', 'contribution.needs_clarification', {
  contribution_id: makeId('contribution', 'obs-02-sandune-qoq-seasonal'),
  title: 'Quarter-on-quarter comparisons mis-read seasonal traders',
}, -16, true);
addNotification('jack', 'contribution.published', {
  contribution_id: makeId('contribution', 'obs-02-sandune-qoq-seasonal'),
  title: 'Quarter-on-quarter comparisons mis-read seasonal traders',
}, -12, true);

// obs_03 published
addNotification('liam', 'contribution.published', {
  contribution_id: makeId('contribution', 'obs-03-kestrel-harvest-delinquent'),
  title: 'Harvest-cycle borrowers look delinquent in monthly views',
}, -10, false);

// obs_07 v2 received, pending review
addNotification('liam', 'contribution.version_received', {
  contribution_id: makeId('contribution', 'obs-07-kestrel-repayment-flex'),
  title: 'Repayment-calendar flexibility for farmers',
  version: 2,
}, -1, false);

// obs_13 needs clarification
addNotification('maya', 'contribution.needs_clarification', {
  contribution_id: makeId('contribution', 'obs-13-kestrel-needs-clarification'),
  title: 'Digital onboarding drop-off at document step',
}, -2, false);

// obs_16 rejected unsafe
addNotification('maya', 'contribution.rejected', {
  contribution_id: makeId('contribution', 'obs-16-kestrel-unsafe'),
  title: 'Pricing complaint from key client',
  reason: 'unsafe_content',
}, -3, false);

// obs_14 returned for edit
addNotification('iris', 'contribution.returned_for_edit', {
  contribution_id: makeId('contribution', 'obs-14-harborline-returned-edit'),
  title: 'Treatment of seasonal limits in FAI commentary',
}, -3, true);

// obs_15 rejected duplicate
addNotification('kate', 'contribution.rejected', {
  contribution_id: makeId('contribution', 'obs-15-sandune-duplicate'),
  title: 'Seasonal traders misread in comparisons',
  reason: 'duplicate',
}, -4, true);

// obs_17 withdrawal confirmed
addNotification('iris', 'contribution.withdrawn', {
  contribution_id: makeId('contribution', 'obs-17-harborline-withdrawn'),
  title: 'Old KYC re-submission note',
}, -2, true);

// obs_19 temporarily unpublished
addNotification('jack', 'contribution.suspended', {
  contribution_id: makeId('contribution', 'obs-19-sandune-reported'),
  title: 'Concern about peer bank credit score practices',
  reason: 'under_review',
}, -1, false);

// obs_19 reported (to moderator)
addNotification('bob', 'contribution.reported', {
  contribution_id: makeId('contribution', 'obs-19-sandune-reported'),
  reported_by: 'maya',
  category: 'misleading',
}, -1, false);

// obs_12 flagged sensitive (to moderator)
addNotification('bob', 'contribution.flagged_sensitive', {
  contribution_id: makeId('contribution', 'obs-12-sandune-sensitive-flag'),
  title: 'Digital onboarding drop-off at document step',
  flags: ['account_number', 'contact_detail'],
}, -1, false);

// idea_01 status update
addNotification('iris', 'idea.status_update', {
  idea_id: makeId('idea', 'seasonality-aware-comparison'),
  title: 'Seasonality-aware comparison explanation',
  status: 'Under review',
}, -6, true);
addNotification('jack', 'idea.status_update', {
  idea_id: makeId('idea', 'seasonality-aware-comparison'),
  title: 'Seasonality-aware comparison explanation',
  status: 'Under review',
}, -6, false);
addNotification('liam', 'idea.status_update', {
  idea_id: makeId('idea', 'seasonality-aware-comparison'),
  title: 'Seasonality-aware comparison explanation',
  status: 'Under review',
}, -6, false);

// Email notification (queued, never delivered)
addNotification('iris', 'email.queued', {
  contribution_id: makeId('contribution', 'obs-01-harborline-seasonal-sme'),
  provider: 'not_configured',
  status: 'queued',
}, -14, false);

// ─── Consents ────────────────────────────────────────────────────────────────

interface SeedConsent {
  userKey: string;
  contributionId: string;
  version: number;
  purpose: 'store_process' | 'publish_reviewed' | 'attribute' | 'model_training';
  choice: boolean;
}

const CONSENTS: SeedConsent[] = [];

function addConsent(
  userKey: string,
  contributionId: string,
  purpose: 'store_process' | 'publish_reviewed' | 'attribute' | 'model_training',
  choice: boolean,
) {
  CONSENTS.push({ userKey, contributionId, version: 1, purpose, choice });
}

// For all published community_proposed contributions, record consents
const publishedIds = CONTRIBUTIONS.filter(
  (c) => c.state === 'published' && c.visibility === 'community_proposed',
);

for (const c of publishedIds) {
  addConsent(c.authorUserKey, c.id, 'store_process', true);
  addConsent(c.authorUserKey, c.id, 'publish_reviewed', true);
  addConsent(c.authorUserKey, c.id, 'attribute', c.attributionConsent);
  addConsent(c.authorUserKey, c.id, 'model_training', false);
}

// obs_03 has model_training consent
const obs03Id = makeId('contribution', 'obs-03-kestrel-harvest-delinquent');
// Override model_training for obs_03 author
addConsent('liam', obs03Id, 'model_training', true);

// Private drafts: only store_process
const draftIds = CONTRIBUTIONS.filter((c) => c.state === 'private_draft');
for (const c of draftIds) {
  addConsent(c.authorUserKey, c.id, 'store_process', true);
}

// ─── Moderation Decisions ────────────────────────────────────────────────────

interface SeedModerationDecision {
  contributionId: string;
  versionId: string;
  moderatorKey: string;
  action: string;
  reasonCode: string;
  redactions: Record<string, unknown> | null;
  createdAt: Date;
}

const MODERATION_DECISIONS: SeedModerationDecision[] = [];

function addModerationDecision(
  contributionId: string,
  moderatorKey: string,
  action: string,
  reasonCode: string,
  createdDays: number,
  redactions: Record<string, unknown> | null = null,
) {
  MODERATION_DECISIONS.push({
    contributionId,
    versionId: makeId('version', contributionId + ':v1'),
    moderatorKey,
    action,
    reasonCode,
    redactions,
    createdAt: ts(createdDays),
  });
}

// Seasonality: redact + publish
addModerationDecision(
  makeId('contribution', 'obs-01-harborline-seasonal-sme'),
  'bob', 'approve', 'approved_with_redactions', -15,
  { body: 'redacted', region: 'generalised' },
);
addModerationDecision(
  makeId('contribution', 'obs-01-harborline-seasonal-sme'),
  'bob', 'publish', 'published', -14,
);

addModerationDecision(
  makeId('contribution', 'obs-02-sandune-qoq-seasonal'),
  'bob', 'clarify', 'needs_clarification', -17,
);
addModerationDecision(
  makeId('contribution', 'obs-02-sandune-qoq-seasonal'),
  'bob', 'approve', 'approved_with_redactions', -13,
  { body: 'redacted', client_name_removed: true },
);
addModerationDecision(
  makeId('contribution', 'obs-02-sandune-qoq-seasonal'),
  'bob', 'publish', 'published', -12,
);

addModerationDecision(
  makeId('contribution', 'obs-03-kestrel-harvest-delinquent'),
  'bob', 'approve', 'approved_with_redactions', -11,
  { body: 'redacted', region: 'generalised' },
);
addModerationDecision(
  makeId('contribution', 'obs-03-kestrel-harvest-delinquent'),
  'bob', 'publish', 'published', -10,
);

// Collections: redact + publish
addModerationDecision(
  makeId('contribution', 'obs-04-harborline-early-warning'),
  'bob', 'approve', 'approved_with_redactions', -8,
);
addModerationDecision(
  makeId('contribution', 'obs-04-harborline-early-warning'),
  'bob', 'publish', 'published', -7,
);
addModerationDecision(
  makeId('contribution', 'obs-05-harborline-collections-holidays'),
  'bob', 'approve', 'approved_with_redactions', -7,
);
addModerationDecision(
  makeId('contribution', 'obs-05-harborline-collections-holidays'),
  'bob', 'publish', 'published', -6,
);
addModerationDecision(
  makeId('contribution', 'obs-06-sandune-arrears-grace'),
  'bob', 'approve', 'approved_with_redactions', -6,
);
addModerationDecision(
  makeId('contribution', 'obs-06-sandune-arrears-grace'),
  'bob', 'publish', 'published', -5,
);
addModerationDecision(
  makeId('contribution', 'obs-07-kestrel-repayment-flex'),
  'bob', 'approve', 'approved_with_redactions', -5,
);
addModerationDecision(
  makeId('contribution', 'obs-07-kestrel-repayment-flex'),
  'bob', 'publish', 'published', -4,
);

// Alert triage: redact + publish
addModerationDecision(
  makeId('contribution', 'obs-08-harborline-alert-fatigue'),
  'bob', 'approve', 'approved_with_redactions', -4,
);
addModerationDecision(
  makeId('contribution', 'obs-08-harborline-alert-fatigue'),
  'bob', 'publish', 'published', -3,
);
addModerationDecision(
  makeId('contribution', 'obs-09-harborline-triage-tuning'),
  'bob', 'approve', 'approved_with_redactions', -3,
);
addModerationDecision(
  makeId('contribution', 'obs-09-harborline-triage-tuning'),
  'bob', 'publish', 'published', -2,
);
addModerationDecision(
  makeId('contribution', 'obs-10-kestrel-skip-low-score'),
  'bob', 'approve', 'approved_with_redactions', -2,
);
addModerationDecision(
  makeId('contribution', 'obs-10-kestrel-skip-low-score'),
  'bob', 'publish', 'published', -1,
);

// obs_13: request clarification
addModerationDecision(
  makeId('contribution', 'obs-13-kestrel-needs-clarification'),
  'bob', 'clarify', 'needs_clarification', -2,
);

// obs_14: return for edit
addModerationDecision(
  makeId('contribution', 'obs-14-harborline-returned-edit'),
  'bob', 'clarify', 'returned_for_edit', -3,
);

// obs_15: reject duplicate
addModerationDecision(
  makeId('contribution', 'obs-15-sandune-duplicate'),
  'bob', 'reject', 'duplicate', -4,
);

// obs_16: reject unsafe
addModerationDecision(
  makeId('contribution', 'obs-16-kestrel-unsafe'),
  'bob', 'reject', 'unsafe_content', -3,
);

// obs_17: publish then withdraw
addModerationDecision(
  makeId('contribution', 'obs-17-harborline-withdrawn'),
  'bob', 'approve', 'approved_with_redactions', -11,
);
addModerationDecision(
  makeId('contribution', 'obs-17-harborline-withdrawn'),
  'bob', 'publish', 'published', -10,
);
addModerationDecision(
  makeId('contribution', 'obs-17-harborline-withdrawn'),
  'bob', 'withdraw', 'author_requested', -2,
);

// obs_18: publish
addModerationDecision(
  makeId('contribution', 'obs-18-harborline-withdraw-test'),
  'bob', 'approve', 'approved_with_redactions', -3,
);
addModerationDecision(
  makeId('contribution', 'obs-18-harborline-withdraw-test'),
  'bob', 'publish', 'published', -2,
);

// obs_19: suspend
addModerationDecision(
  makeId('contribution', 'obs-19-sandune-reported'),
  'bob', 'suspend', 'under_review', -1,
);

// obs_20: approve (org-only)
addModerationDecision(
  makeId('contribution', 'obs-20-northmere-canary'),
  'bob', 'approve', 'approved_org_only', -2,
);

// ─── Invitations ─────────────────────────────────────────────────────────────

interface SeedInvitation {
  email: string;
  orgKey: OrgKey;
  proposedRole: string;
  expiresAt: Date;
  acceptedBy: string | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  inviterKey: string;
  createdAt: Date;
}

const INVITATIONS: SeedInvitation[] = [];

// Pending invitation: tanya.zhang@kestrel.com (7 days from anchor)
INVITATIONS.push({
  email: 'tanya.zhang@kestrel.com',
  orgKey: 'kestrel',
  proposedRole: 'client_member',
  expiresAt: ts(7),
  acceptedBy: null,
  acceptedAt: null,
  revokedAt: null,
  inviterKey: 'liam',
  createdAt: ts(0),
});

// Expired invitation: uma.patel@harborline.com (8 days old)
INVITATIONS.push({
  email: 'uma.patel@harborline.com',
  orgKey: 'harborline',
  proposedRole: 'client_member',
  expiresAt: ts(-5),
  acceptedBy: null,
  acceptedAt: null,
  revokedAt: null,
  inviterKey: 'henry',
  createdAt: ts(-13),
});

// ─── Audit Events ────────────────────────────────────────────────────────────

interface SeedAuditEvent {
  actorKey: string;
  action: string;
  targetType: string;
  targetId: string;
  orgKey: OrgKey | null;
  decision: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

const AUDIT_EVENTS: SeedAuditEvent[] = [];

function addAuditEvent(
  actorKey: string,
  action: string,
  targetType: string,
  targetId: string,
  orgKey: OrgKey | null,
  decision: string,
  createdDays: number,
  metadata: Record<string, unknown> | null = null,
) {
  AUDIT_EVENTS.push({
    actorKey,
    action,
    targetType,
    targetId,
    orgKey,
    decision,
    metadata,
    createdAt: ts(createdDays),
  });
}

// Login events
addAuditEvent('alice', 'auth.login', 'session', makeId('audit', 'login-alice-1'), 'azentio', 'allowed', -1);
addAuditEvent('bob', 'auth.login', 'session', makeId('audit', 'login-bob-1'), 'azentio', 'allowed', -1);
addAuditEvent('iris', 'auth.login', 'session', makeId('audit', 'login-iris-1'), 'harborline', 'allowed', -1);
addAuditEvent('kofi', 'auth.login', 'session', makeId('audit', 'login-kofi-1'), null, 'denied_no_membership', -1);

// Role grants
addAuditEvent('alice', 'admin.grant_role', 'role_grant', makeId('audit', 'grant-bob-moderator'), 'azentio', 'granted', -60,
  { role: 'learning_moderator', user: 'bob.martinez@azentio.com' });
addAuditEvent('alice', 'admin.grant_role', 'role_grant', makeId('audit', 'grant-carol-publisher'), 'azentio', 'granted', -45,
  { role: 'content_publisher', user: 'carol.patel@azentio.com' });
addAuditEvent('alice', 'admin.grant_role', 'role_grant', makeId('audit', 'grant-david-po'), 'azentio', 'granted', -50,
  { role: 'product_owner', offering: 'FAI', user: 'david.kim@azentio.com' });

// Membership revoked
addAuditEvent('jack', 'client_admin.revoke_membership', 'membership', makeId('audit', 'revoke-rebecca'), 'sandune', 'revoked', -60,
  { user: 'rebecca.nguyen@sandune.com' });

// Entitlement request denied
addAuditEvent('henry', 'client_admin.request_entitlement', 'entitlement', makeId('audit', 'ent-harborline-imal'), 'harborline', 'pending', -20,
  { offering: 'iMAL' });

// Contribution state transitions
addAuditEvent('iris', 'contribution.create', 'contribution', makeId('contribution', 'obs-01-harborline-seasonal-sme'), 'harborline', 'created', -20);
addAuditEvent('iris', 'contribution.submit', 'contribution', makeId('contribution', 'obs-01-harborline-seasonal-sme'), 'harborline', 'submitted', -19);
addAuditEvent('bob', 'moderation.approve', 'contribution', makeId('contribution', 'obs-01-harborline-seasonal-sme'), 'harborline', 'approved', -15);
addAuditEvent('bob', 'moderation.publish', 'contribution', makeId('contribution', 'obs-01-harborline-seasonal-sme'), 'harborline', 'published', -14);

addAuditEvent('jack', 'contribution.create', 'contribution', makeId('contribution', 'obs-02-sandune-qoq-seasonal'), 'sandune', 'created', -18);
addAuditEvent('jack', 'contribution.submit', 'contribution', makeId('contribution', 'obs-02-sandune-qoq-seasonal'), 'sandune', 'submitted', -17);

// Cross-tenant access denied
addAuditEvent('iris', 'access.denied', 'contribution', makeId('contribution', 'obs-20-northmere-canary'), 'harborline', 'denied_cross_tenant', -1,
  { reason: 'tenant_mismatch' });
addAuditEvent('noah', 'access.denied', 'entitlement', OFFERINGS.fai.id, 'northmere', 'denied_not_entitled', -1,
  { reason: 'entitlement_required' });

// Idea status changes
addAuditEvent('david', 'idea.create', 'improvement_idea', makeId('idea', 'seasonality-aware-comparison'), 'azentio', 'created', -9);
addAuditEvent('david', 'idea.update_status', 'improvement_idea', makeId('idea', 'seasonality-aware-comparison'), 'azentio', 'status_changed', -7,
  { from: 'Proposed', to: 'Under review' });

// Withdrawal
addAuditEvent('iris', 'contribution.withdraw', 'contribution', makeId('contribution', 'obs-17-harborline-withdrawn'), 'harborline', 'withdrawn', -2,
  { visibility_epoch: 2 });

// ─── Main seed function ──────────────────────────────────────────────────────

async function seed(client: PoolClient): Promise<void> {
  console.log('🌱 Starting deterministic seed...\n');

  // ── 1. Organisations ──────────────────────────────────────────────────────
  console.log('  [1/10] Seeding organisations...');
  for (const [key, org] of Object.entries(ORGS)) {
    await client.query(
      `INSERT INTO organizations (id, name, type, status, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [org.id, org.name, org.type, org.status, toISO(ts(-100))],
    );
  }
  console.log(`         ${Object.keys(ORGS).length} organisations seeded.`);

  // ── 2. Users ──────────────────────────────────────────────────────────────
  console.log('  [2/10] Seeding users...');
  for (const [key, user] of Object.entries(USERS)) {
    // Employees are verified; clients are verified too for demo
    const verifiedAt = toISO(ts(-60));
    await client.query(
      `INSERT INTO users (id, email, display_name, verified_at, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.email, user.display_name, verifiedAt, toISO(ts(-60))],
    );
  }
  console.log(`         ${Object.keys(USERS).length} users seeded.`);

  // ── 3. Memberships ────────────────────────────────────────────────────────
  console.log('  [3/10] Seeding memberships...');
  for (const m of MEMBERSHIPS) {
    const membershipId = makeId('membership', `${m.userId}:${ORGS[m.orgKey].id}`);
    await client.query(
      `INSERT INTO memberships (id, org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (org_id, user_id) DO NOTHING`,
      [membershipId, ORGS[m.orgKey].id, m.userId, m.role, m.status, toISO(m.joinedAt)],
    );
  }
  console.log(`         ${MEMBERSHIPS.length} memberships seeded.`);

  // ── 4. Role Grants ────────────────────────────────────────────────────────
  console.log('  [4/10] Seeding role grants...');
  for (const g of ROLE_GRANTS) {
    const grantId = makeId('role_grant', `${g.userId}:${g.role}:${g.orgKey ?? 'platform'}`);
    await client.query(
      `INSERT INTO role_grants (id, org_id, user_id, role, offering_id, granted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        grantId,
        g.orgKey ? ORGS[g.orgKey].id : null,
        g.userId,
        g.role,
        g.offeringId,
        g.grantedBy,
      ],
    );
  }
  console.log(`         ${ROLE_GRANTS.length} role grants seeded.`);

  // ── 5. Entitlements ───────────────────────────────────────────────────────
  console.log('  [5/10] Seeding entitlements...');
  for (const e of ENTITLEMENTS) {
    const entId = makeId('entitlement', `${ORGS[e.orgKey].id}:${e.offeringId}`);
    await client.query(
      `INSERT INTO entitlements (id, org_id, offering_id, feature, status, valid_from, valid_to, granted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        entId,
        ORGS[e.orgKey].id,
        e.offeringId,
        e.feature,
        e.status,
        toISO(e.validFrom),
        e.validTo ? toISO(e.validTo) : null,
        e.grantedBy,
      ],
    );
  }
  console.log(`         ${ENTITLEMENTS.length} entitlements seeded.`);

  // ── 6. Contributions + Versions + Shared Copies ───────────────────────────
  console.log('  [6/10] Seeding contributions, versions, and shared copies...');
  let versionCount = 0;
  let sharedCopyCount = 0;

  for (const c of CONTRIBUTIONS) {
    const authorId = USERS[c.authorUserKey].id;
    const orgId = ORGS[c.orgKey].id;

    // Contribution row
    await client.query(
      `INSERT INTO contributions (id, author_user_id, org_id, visibility, current_version_id, state, withdrawn_at, visibility_epoch, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        c.id,
        authorId,
        orgId,
        c.visibility,
        makeId('version', c.id + ':v1'), // current_version_id
        c.state,
        c.state === 'withdrawn' ? toISO(ts(-2)) : null,
        c.epoch,
        toISO(c.createdAt),
        toISO(c.updatedAt),
      ],
    );

    // Version v1
    const versionId = makeId('version', c.id + ':v1');
    await client.query(
      `INSERT INTO contribution_versions (id, contribution_id, version, source_payload, created_by, created_at, parent_version_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        versionId,
        c.id,
        1,
        JSON.stringify(c.sourcePayload),
        authorId,
        toISO(c.createdAt),
        null,
      ],
    );
    versionCount++;

    // Version v2 for obs_07 (pending review)
    if (c.id === makeId('contribution', 'obs-07-kestrel-repayment-flex')) {
      const v2Id = makeId('version', c.id + ':v2');
      await client.query(
        `INSERT INTO contribution_versions (id, contribution_id, version, source_payload, created_by, created_at, parent_version_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          v2Id,
          c.id,
          2,
          JSON.stringify({
            ...c.sourcePayload,
            body: 'We aligned repayment dates with harvest calendars for 250 rice and vegetable farmers across Mindanao and a neighbouring district. Default rates dropped from 12% to 4.5% over two seasons. V2 expands coverage.',
          }),
          authorId,
          toISO(ts(-1)),
          versionId,
        ],
      );
      versionCount++;
    }

    // Shared copy (if published and has reviewed payload)
    if (c.reviewedPayload && (c.state === 'published' || c.state === 'withdrawn')) {
      const scId = makeId('shared_copy', c.id);
      await client.query(
        `INSERT INTO shared_copies (id, contribution_id, source_version_id, reviewed_payload, deidentified, attribution_consent, status, published_at, invalidated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          scId,
          c.id,
          versionId,
          JSON.stringify(c.reviewedPayload),
          c.deidentified,
          c.attributionConsent,
          c.state === 'withdrawn' ? 'withdrawn' : 'active',
          c.publishedAt ? toISO(c.publishedAt) : toISO(ts(0)),
          c.state === 'withdrawn' ? toISO(ts(-2)) : null,
        ],
      );
      sharedCopyCount++;
    }
  }
  console.log(`         ${CONTRIBUTIONS.length} contributions, ${versionCount} versions, ${sharedCopyCount} shared copies seeded.`);

  // ── 7. Themes + Theme Evidence ────────────────────────────────────────────
  console.log('  [7/10] Seeding themes and theme evidence...');
  for (const t of THEMES) {
    await client.query(
      `INSERT INTO themes (id, title, offering, topic, period_start, period_end, status, safe_summary, distinct_org_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id,
        t.title,
        t.offering,
        t.topic,
        t.periodStart.toISOString().split('T')[0],
        t.periodEnd.toISOString().split('T')[0],
        t.status,
        t.safeSummary,
        t.distinctOrgCount,
        toISO(ts(-5)),
      ],
    );

    // Theme evidence links
    for (const cid of t.contributionIds) {
      await client.query(
        `INSERT INTO theme_evidence (theme_id, contribution_id)
         VALUES ($1, $2)
         ON CONFLICT (theme_id, contribution_id) DO NOTHING`,
        [t.id, cid],
      );
    }
  }
  console.log(`         ${THEMES.length} themes seeded.`);

  // ── 8. Improvement Ideas + Idea Evidence ──────────────────────────────────
  console.log('  [8/10] Seeding improvement ideas...');
  for (const idea of IDEAS) {
    await client.query(
      `INSERT INTO improvement_ideas (id, title, problem_statement, offering, proposed_outcome, owner_team, priority, status, audience, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        idea.id,
        idea.title,
        idea.problemStatement,
        idea.offering,
        idea.proposedOutcome,
        idea.ownerTeam,
        idea.priority,
        idea.status,
        idea.audience,
        toISO(idea.createdAt),
        toISO(idea.updatedAt),
      ],
    );

    // Idea evidence links
    for (const cid of idea.contributionIds) {
      await client.query(
        `INSERT INTO idea_evidence (idea_id, contribution_id)
         VALUES ($1, $2)
         ON CONFLICT (idea_id, contribution_id) DO NOTHING`,
        [idea.id, cid],
      );
    }
  }
  console.log(`         ${IDEAS.length} improvement ideas seeded.`);

  // ── 9. Consents ───────────────────────────────────────────────────────────
  console.log('  [9/10] Seeding consents...');
  for (const c of CONSENTS) {
    const consentId = makeId('consent', `${USERS[c.userKey].id}:${c.contributionId}:${c.purpose}`);
    await client.query(
      `INSERT INTO consents (id, user_id, contribution_id, version, purpose, choice, policy_version, granted_at, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        consentId,
        USERS[c.userKey].id,
        c.contributionId,
        c.version,
        c.purpose,
        c.choice,
        POLICY_VERSION,
        c.choice ? toISO(ts(-15)) : null,
        toISO(ts(-15)),
      ],
    );
  }
  console.log(`         ${CONSENTS.length} consent records seeded.`);

  // ── 10. Moderation Decisions ──────────────────────────────────────────────
  console.log(' [10/10] Seeding moderation decisions...');
  for (const md of MODERATION_DECISIONS) {
    const modId = makeId('moderation', `${md.contributionId}:${md.action}:${md.createdAt.getTime()}`);
    await client.query(
      `INSERT INTO moderation_decisions (id, contribution_id, version_id, moderator_id, action, reason_code, redactions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        modId,
        md.contributionId,
        md.versionId,
        USERS[md.moderatorKey].id,
        md.action,
        md.reasonCode,
        md.redactions ? JSON.stringify(md.redactions) : null,
        toISO(md.createdAt),
      ],
    );
  }
  console.log(`         ${MODERATION_DECISIONS.length} moderation decisions seeded.`);

  // ── 11. Notifications ─────────────────────────────────────────────────────
  console.log(' [11/10] Seeding notifications...');
  for (const n of NOTIFICATIONS) {
    const notifId = makeId('notification', `${USERS[n.recipientUserKey].id}:${n.event}:${n.createdAt.getTime()}`);
    await client.query(
      `INSERT INTO notifications (id, recipient_user_id, event, safe_payload, read_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        notifId,
        USERS[n.recipientUserKey].id,
        n.event,
        JSON.stringify(n.safePayload),
        n.readAt ? toISO(n.readAt) : null,
        toISO(n.createdAt),
      ],
    );
  }
  console.log(`         ${NOTIFICATIONS.length} notifications seeded.`);

  // ── 12. Invitations ───────────────────────────────────────────────────────
  console.log(' [12/10] Seeding invitations...');
  for (const inv of INVITATIONS) {
    const invId = makeId('invitation', `${inv.email}:${inv.orgKey}`);
    const tokenHash = createHash('sha256')
      .update(`invite:${inv.email}:${inv.orgKey}:${inv.createdAt.getTime()}`)
      .digest('hex');
    await client.query(
      `INSERT INTO invitations (id, org_id, email, proposed_role, token_hash, expires_at, accepted_by, accepted_at, revoked_at, inviter, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        invId,
        ORGS[inv.orgKey].id,
        inv.email,
        inv.proposedRole,
        tokenHash,
        toISO(inv.expiresAt),
        inv.acceptedBy ? USERS[inv.acceptedBy]?.id ?? null : null,
        inv.acceptedAt ? toISO(inv.acceptedAt) : null,
        inv.revokedAt ? toISO(inv.revokedAt) : null,
        USERS[inv.inviterKey].id,
        toISO(inv.createdAt),
      ],
    );
  }
  console.log(`         ${INVITATIONS.length} invitations seeded.`);

  // ── 13. Audit Events ──────────────────────────────────────────────────────
  console.log(' [13/10] Seeding audit events...');
  for (const ae of AUDIT_EVENTS) {
    const auditId = makeId('audit', `${ae.actorKey}:${ae.action}:${ae.targetId}:${ae.createdAt.getTime()}`);
    await client.query(
      `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        auditId,
        USERS[ae.actorKey].id,
        ae.action,
        ae.targetType,
        ae.targetId,
        ae.orgKey ? ORGS[ae.orgKey].id : null,
        makeId('request', `${ae.actorKey}:${ae.action}:${ae.createdAt.getTime()}`),
        ae.decision,
        ae.metadata ? JSON.stringify(ae.metadata) : null,
        toISO(ae.createdAt),
      ],
    );
  }
  console.log(`         ${AUDIT_EVENTS.length} audit events seeded.`);

  console.log('\n✅ Seed complete!\n');
}

// ─── Entrypoint ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  azentio.ai — Deterministic Seed Script');
  console.log('  All data is SYNTHETIC. No real PII.');
  console.log('═══════════════════════════════════════════════\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await seed(client);

    await client.query('COMMIT');

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('───────────────────────────────────────────────');
    console.log('  SEED SUMMARY');
    console.log('───────────────────────────────────────────────');
    console.log(`  Organisations:        ${Object.keys(ORGS).length}`);
    console.log(`  Users:                ${Object.keys(USERS).length}`);
    console.log(`  Memberships:          ${MEMBERSHIPS.length}`);
    console.log(`  Role grants:          ${ROLE_GRANTS.length}`);
    console.log(`  Entitlements:         ${ENTITLEMENTS.length}`);
    console.log(`  Contributions:        ${CONTRIBUTIONS.length}`);
    console.log(`  Themes:               ${THEMES.length}`);
    console.log(`  Improvement ideas:    ${IDEAS.length}`);
    console.log(`  Consents:             ${CONSENTS.length}`);
    console.log(`  Moderation decisions: ${MODERATION_DECISIONS.length}`);
    console.log(`  Notifications:        ${NOTIFICATIONS.length}`);
    console.log(`  Invitations:          ${INVITATIONS.length}`);
    console.log(`  Audit events:         ${AUDIT_EVENTS.length}`);
    console.log('───────────────────────────────────────────────');
    console.log('\n  Anchor clock:', ANCHOR.toISOString());
    console.log('  All IDs are deterministic (SHA-256 based).');
    console.log('  Re-running produces identical results.');
    console.log('  Synthetic data — no real PII or production data.\n');

    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed failed:', err instanceof Error ? err.message : String(err));
    console.error('   Transaction rolled back.\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();