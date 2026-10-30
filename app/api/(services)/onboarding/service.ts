import 'server-only';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { auth } from '@/app/api/(services)/auth/better-auth-config';
import { createAuthApiRequest } from '@/app/api/(services)/auth/request-origin';
import { query, transaction } from '@/app/api/(db)/client';
import {
  SELF_SERVICE_ONBOARDING_ROLE_IDS,
  type SelfServiceOnboardingRole,
} from '@/app/(config)/onboarding';
import { SANDBOX_DEMOS } from '@/app/(config)/sandbox';

type Tx = typeof query;

export class OnboardingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface VerifiedIdentity {
  email: string;
  name: string | null;
}

export interface ProvisionedWorkspace {
  membership_id: string;
  org_id: string;
  org_name: string;
  role: string;
  created: boolean;
}

/** The signed-in Better Auth identity, even before an application user exists. */
export async function getVerifiedIdentity(): Promise<VerifiedIdentity | null> {
  const incomingHeaders = await headers();
  createAuthApiRequest(incomingHeaders); // validates the host
  const authSession = await auth.api.getSession({ headers: incomingHeaders });
  if (!authSession?.user?.email || !authSession.user.emailVerified) return null;
  return { email: authSession.user.email.toLowerCase(), name: authSession.user.name?.trim() || null };
}

/** Deterministic UUID, so provisioning the same role twice is a no-op. */
function stableId(prefix: string, name: string): string {
  const hash = createHash('sha256').update(`${prefix}:${name}`).digest('hex');
  return [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)].join('-');
}

function displayNameFrom(identity: VerifiedIdentity): string {
  if (identity.name && !identity.name.includes('@')) return identity.name.slice(0, 80);
  const local = identity.email.split('@')[0].replace(/[._+-]+/g, ' ').replace(/\d+/g, '').trim();
  const pretty = local.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  return (pretty || 'Demo user').slice(0, 80);
}

const PRODUCT_OWNER_OFFERINGS = ['FAI', 'Lending', 'AMLOCK', 'Digital', 'Insurance', 'iMAL'];
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export async function listOwnDemoRoles(email: string): Promise<SelfServiceOnboardingRole[]> {
  const rows = await query<{ role: SelfServiceOnboardingRole }>(
    `SELECT DISTINCT demo.role FROM (
       SELECT m.user_id, m.role, m.org_id FROM memberships m
       WHERE m.status = 'active' AND m.role = ANY($2::text[])
       UNION
       SELECT g.user_id, g.role, g.org_id FROM role_grants g
       WHERE g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
         AND g.role = ANY($2::text[])
     ) demo
     JOIN users u ON u.id = demo.user_id
     JOIN organizations o ON o.id = demo.org_id AND o.is_sandbox AND o.status = 'active'
     WHERE lower(u.email) = lower($1)`,
    [email, SELF_SERVICE_ONBOARDING_ROLE_IDS],
  );
  return rows.map((row) => row.role);
}

export async function provisionDemoWorkspaces(
  identity: VerifiedIdentity,
  roles: SelfServiceOnboardingRole[],
): Promise<ProvisionedWorkspace[]> {
  return transaction(async (tx) => {
    const user = await ensureUser(tx, identity);
    const taken = await tx<{ role: string }>(
      `SELECT m.role FROM memberships m JOIN organizations o ON o.id = m.org_id AND o.is_sandbox
       WHERE m.user_id = $1 AND m.status = 'active' LIMIT 1`,
      [user.id],
    );
    if (taken[0]) throw new OnboardingError('You already have a demo role. Each account can try one role.', 409);
    const selected = [...new Set(roles)].slice(0, 1);
    const memberRole = selected.includes('client_admin') ? 'client_admin'
      : selected.includes('client_member') ? 'client_member'
      : selected.includes('employee') ? 'employee'
      : selected[0];
    return [await provisionRole(tx, user, memberRole, selected)];
  });
}

async function ensureUser(tx: Tx, identity: VerifiedIdentity) {
  const existing = await tx<{ id: string; display_name: string; disabled_at: string | null }>(
    `SELECT id, display_name, disabled_at FROM users WHERE lower(email) = lower($1)`,
    [identity.email],
  );
  if (existing[0]) {
    if (existing[0].disabled_at) throw new OnboardingError('This account has been disabled.', 403);
    await tx(`UPDATE users SET verified_at = COALESCE(verified_at, now()) WHERE id = $1`, [existing[0].id]);
    return { id: existing[0].id, display_name: existing[0].display_name };
  }
  const inserted = await tx<{ id: string; display_name: string }>(
    `INSERT INTO users (email, display_name, verified_at) VALUES ($1, $2, now()) RETURNING id, display_name`,
    [identity.email, displayNameFrom(identity)],
  );
  return inserted[0];
}

async function provisionRole(
  tx: Tx,
  user: { id: string; display_name: string },
  membershipRole: SelfServiceOnboardingRole,
  selectedRoles: SelfServiceOnboardingRole[],
): Promise<ProvisionedWorkspace> {
  const orgType = 'client';
  const orgId = stableId('sandbox-org', 'shared-product-demo');
  const orgName = 'Azentio Shared Demo';
  const inserted = await tx<{ id: string }>(
    `INSERT INTO organizations (id, name, type, status, is_sandbox) VALUES ($1, $2, $3, 'active', true)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [orgId, orgName, orgType],
  );
  const created = inserted.length > 0;
  const activeOrg = await tx<{ id: string }>(
    `SELECT id FROM organizations WHERE id = $1 AND type = $2 AND status = 'active' AND is_sandbox FOR SHARE`,
    [orgId, orgType],
  );
  if (!activeOrg[0]) throw new OnboardingError('The shared demo workspace is unavailable.', 503);

  const membershipInserted = await tx<{ id: string }>(
    `INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, $3, 'active')
     ON CONFLICT (org_id, user_id) DO NOTHING RETURNING id`,
    [orgId, user.id, membershipRole],
  );
  if (membershipRole === 'client_admin') {
    await tx(
      `UPDATE memberships SET role = 'client_admin'
       WHERE org_id = $1 AND user_id = $2 AND status = 'active' AND role = 'client_member'`,
      [orgId, user.id],
    );
  }
  const membership = (await tx<{ id: string; role: string; status: string }>(
    `SELECT id, role, status FROM memberships WHERE org_id = $1 AND user_id = $2 FOR SHARE`,
    [orgId, user.id],
  ))[0];
  if (!membership || membership.status !== 'active') {
    throw new OnboardingError('Your membership in the shared demo workspace is not active.', 403);
  }

  await grantDemoRoles(tx, orgId, user.id, selectedRoles);
  if (created) {
    await seedClientStarterData(tx, orgId, user);
    await seedInternalStarterData(tx, orgId, user);
  }
  await ensurePublishedSandboxExample(tx, orgId);
  await ensureSandboxReleaseNotes(tx, orgId);
  if (membershipInserted.length) {
    await tx(
      `INSERT INTO notifications (recipient_user_id, event, safe_payload) VALUES ($1, 'demo_workspace_ready', $2)`,
      [user.id, JSON.stringify({ role: membershipRole, message: 'The shared demo workspace is ready. Everything in it is synthetic and visible to demo members.' })],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'onboarding.join_demo_workspace', 'membership', $2, $3, $4, 'allow', $5)`,
      [user.id, membership.id, orgId, stableId('request', `${user.id}:${orgType}`), JSON.stringify({ role: membershipRole, sandbox: true, shared: true })],
    );
  }

  return { membership_id: membership.id, org_id: orgId, org_name: orgName, role: membership.role as ProvisionedWorkspace['role'], created };
}

async function grantDemoRoles(tx: Tx, orgId: string, userId: string, roles: SelfServiceOnboardingRole[]) {
  for (const role of roles) {
    const offerings: Array<string | null> = role === 'product_owner' ? PRODUCT_OWNER_OFFERINGS : [null];
    for (const offering of offerings) {
      await tx(
        `INSERT INTO role_grants (org_id, user_id, role, offering_id, granted_by)
         SELECT $1, $2, $3, $4, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM role_grants WHERE org_id = $1 AND user_id = $2 AND role = $3
             AND offering_id IS NOT DISTINCT FROM $4 AND revoked_at IS NULL
         )`,
        [orgId, userId, role, offering],
      );
    }
  }
}

async function syntheticUser(tx: Tx, orgId: string, key: string, displayName: string) {
  const email = `${key}.${orgId.slice(0, 8)}@demo.invalid`;
  await tx(
    `INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
    [stableId('sandbox-user', email), email, displayName],
  );
  return (await tx<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]))[0].id;
}

const SANDBOX_RELEASE_NOTES = [
  { key: 'fai-seasonal', offering: 'FAI', ago: 3, title: 'Synthetic update: seasonal comparison view',
    body: 'Synthetic demo release note. Financial Analysis Intelligence now shows seasonal and non-seasonal periods side by side so reviewers can judge a dip in context. This note is sample content for the demo workspace.' },
  { key: 'lending-workflow', offering: 'Lending', ago: 10, title: 'Synthetic update: faster application review',
    body: 'Synthetic demo release note. The lending workflow groups pending applications by missing document, so reviewers can clear the common blockers first. Sample content only.' },
  { key: 'amlock-alerts', offering: 'AMLOCK', ago: 17, title: 'Synthetic update: clearer alert explanations',
    body: 'Synthetic demo release note. Screening alerts now include a short plain-language reason next to the match score. Sample content only.' },
] as const;

/** Client-facing release notes for the shared sandbox, so the page is never empty. Published by a synthetic author. */
async function ensureSandboxReleaseNotes(tx: Tx, orgId: string) {
  const authorId = await syntheticUser(tx, orgId, 'release-notes-author', 'Synthetic release manager');
  for (const note of SANDBOX_RELEASE_NOTES) {
    await tx(
      `INSERT INTO release_notes (id, title, body, audience, offering_id, org_id, status, author_user_id, published_at)
       VALUES ($1, $2, $3, 'clients', $4, $5, 'published', $6, now() - ($7 || ' days')::interval)
       ON CONFLICT (id) DO NOTHING`,
      [stableId('sandbox-release-note', `${orgId}:${note.key}`), note.title, note.body, note.offering, orgId, authorId, String(note.ago)],
    );
  }
}

/** Ensure every version of the shared sandbox has one approved item to explore. */
async function ensurePublishedSandboxExample(tx: Tx, orgId: string) {
  await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`sandbox-starter-data:${orgId}`]);
  const authorId = await syntheticUser(tx, orgId, 'shared-learning-author', 'Synthetic demo contributor');
  const moderatorId = await syntheticUser(tx, orgId, 'shared-learning-moderator', 'Synthetic demo reviewer');
  await tx(
    `INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, 'client_member', 'active')
     ON CONFLICT (org_id, user_id) DO NOTHING`,
    [orgId, authorId],
  );
  await tx(
    `INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, 'learning_moderator', 'active')
     ON CONFLICT (org_id, user_id) DO NOTHING`,
    [orgId, moderatorId],
  );

  const contributionId = stableId('sandbox-contribution', `${orgId}:approved-shared-example`);
  const versionId = stableId('sandbox-version', `${orgId}:approved-shared-example:1`);
  const sharedCopyId = stableId('sandbox-shared-copy', `${orgId}:approved-shared-example:1`);
  const themeId = stableId('sandbox-theme', `${orgId}:seasonality-context`);
  const example = payload(
    'Seasonal context in synthetic cash-flow comparisons',
    'Synthetic demo example: a recurring seasonal dip can look like deterioration when a comparison uses only the immediately preceding period. A seasonal comparison note may help reviewers interpret the pattern. This example contains no real customer or transaction data.',
    { observation_type: 'market_observation', evidence_type: 'synthetic_scenario', confidence: 'high' },
  );
  await tx(
    `INSERT INTO contributions (id, author_user_id, org_id, visibility, state, created_at, updated_at)
     VALUES ($1, $2, $3, 'community_proposed', 'published', now() - interval '30 days', now())
     ON CONFLICT (id) DO NOTHING`,
    [contributionId, authorId, orgId],
  );
  await tx(
    `INSERT INTO contribution_versions (id, contribution_id, version, source_payload, created_by, created_at)
     VALUES ($1, $2, 1, $3::jsonb, $4, now() - interval '30 days')
     ON CONFLICT (id) DO NOTHING`,
    [versionId, contributionId, JSON.stringify(example), authorId],
  );
  await tx(
    `UPDATE contributions SET current_version_id = $2 WHERE id = $1 AND current_version_id IS NULL`,
    [contributionId, versionId],
  );
  for (const [purpose, choice] of [
    ['store_process', true], ['publish_reviewed', true], ['attribute', false],
    ['model_training', false], ['semantic_analysis', false],
  ] as const) {
    // An absent optional consent is a denial. Older databases may still have
    // the pre-semantic-analysis CHECK constraint, so do not write an explicit
    // false row for this newly added purpose during synthetic demo seeding.
    if (purpose === 'semantic_analysis' && !choice) continue;
    await tx(
      `INSERT INTO consents (user_id, contribution_id, version, purpose, choice, policy_version, granted_at)
       SELECT $1, $2, 1, $3, $4, 'demo-synthetic-v1', CASE WHEN $4 THEN now() ELSE NULL END
       WHERE NOT EXISTS (
         SELECT 1 FROM consents WHERE contribution_id = $2 AND version = 1
           AND purpose = $3 AND revoked_at IS NULL
       )`,
      [authorId, contributionId, purpose, choice],
    );
  }
  await tx(
    `INSERT INTO moderation_decisions (contribution_id, version_id, moderator_id, action, reason_code, decision_note, evidence_quality)
     SELECT $1, $2, $3, 'publish', 'synthetic_demo_seed',
            'Seeded synthetic example for the shared demo workspace.', 'strong'
     WHERE NOT EXISTS (
       SELECT 1 FROM moderation_decisions WHERE contribution_id = $1 AND version_id = $2
         AND action = 'publish' AND reason_code = 'synthetic_demo_seed'
     )`,
    [contributionId, versionId, moderatorId],
  );
  await tx(
    `INSERT INTO shared_copies
       (id, contribution_id, source_version_id, reviewed_payload, deidentified, attribution_consent, evidence_quality, status)
     VALUES ($1, $2, $3, $4::jsonb, true, false, 'strong', 'active')
     ON CONFLICT (source_version_id) DO NOTHING`,
    [sharedCopyId, contributionId, versionId, JSON.stringify(example)],
  );
  await tx(
    `INSERT INTO themes (id, title, offering, topic, period_start, period_end, status, safe_summary, distinct_org_count)
     VALUES ($1, 'Seasonality context for cash-flow comparisons', 'FAI', 'market_observation',
             date_trunc('month', now()), date_trunc('month', now()) + interval '1 month' - interval '1 second',
             'active', 'One synthetic example in the shared demo workspace. It is a product walkthrough, not cross-organisation evidence or a claim about market prevalence.', 1)
     ON CONFLICT (id) DO NOTHING`,
    [themeId],
  );
  await tx(
    `INSERT INTO theme_evidence (theme_id, shared_copy_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [themeId, sharedCopyId],
  );
}

interface StarterContribution {
  key: string;
  state: 'private_draft' | 'submitted' | 'needs_clarification';
  visibility: 'author' | 'community_proposed';
  ago: number;
  payload: Record<string, string>;
}

async function addContribution(tx: Tx, orgId: string, authorId: string, item: StarterContribution, moderatorId?: string) {
  const id = stableId('sandbox-contribution', `${orgId}:${item.key}`);
  const versionId = stableId('sandbox-version', `${orgId}:${item.key}:1`);
  const at = daysAgo(item.ago);
  await tx(
    `INSERT INTO contributions (id, author_user_id, org_id, visibility, state, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [id, authorId, orgId, item.visibility, item.state, at],
  );
  await tx(
    `INSERT INTO contribution_versions (id, contribution_id, version, source_payload, created_by, created_at)
     VALUES ($1, $2, 1, $3, $4, $5)`,
    [versionId, id, JSON.stringify(item.payload), authorId, at],
  );
  await tx(`UPDATE contributions SET current_version_id = $2 WHERE id = $1`, [id, versionId]);

  const shared = item.visibility === 'community_proposed';
  const consents: [string, boolean][] = [['store_process', true], ['publish_reviewed', shared], ['attribute', false], ['model_training', false]];
  for (const [purpose, choice] of consents) {
    await tx(
      `INSERT INTO consents (user_id, contribution_id, version, purpose, choice, policy_version, granted_at, captured_at)
       VALUES ($1, $2, 1, $3, $4, '1.0', $5, $6)`,
      [authorId, id, purpose, choice, choice ? at : null, at],
    );
  }
  if (item.state === 'needs_clarification' && moderatorId) {
    await tx(
      `INSERT INTO moderation_decisions (contribution_id, version_id, moderator_id, action, reason_code, decision_note, created_at)
       VALUES ($1, $2, $3, 'clarify', 'needs_detail', $4, $5)`,
      [id, versionId, moderatorId, 'Could you say which segment this covers and over what period? Then we can publish a safe version.', daysAgo(item.ago - 1)],
    );
  }
}

const payload = (title: string, body: string, extra: Record<string, string> = {}): Record<string, string> => ({
  title,
  body,
  observation_type: 'market_observation',
  offering: 'FAI',
  industry: 'Banking',
  region: 'GCC',
  observation_period_start: '2025-01-01',
  observation_period_end: '2025-12-31',
  evidence_type: 'quantitative',
  confidence: 'medium',
  ...extra,
});

async function seedClientStarterData(tx: Tx, orgId: string, user: { id: string; display_name: string }) {
  for (const demo of SANDBOX_DEMOS) {
    await tx(
      `INSERT INTO entitlements (org_id, offering_id, status, granted_by) VALUES ($1, $2, 'active', $3)`,
      [orgId, demo.id, user.id],
    );
  }
  const clientAuthor = await syntheticUser(tx, orgId, 'client-demo-author', 'Synthetic client contributor');
  await tx(
    `INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, 'client_member', 'active')
     ON CONFLICT (org_id, user_id) DO NOTHING`, [orgId, clientAuthor],
  );
  const moderator = await syntheticUser(tx, orgId, 'client-demo-moderator', 'Synthetic demo moderator');
  await addContribution(tx, orgId, clientAuthor, {
    key: 'draft', state: 'private_draft', visibility: 'author', ago: 1,
    payload: payload('Seasonal repayment peaks in SME lending (draft)', 'Synthetic example: our trading customers repay mostly in two quarters. Still gathering the figures before I submit this.'),
  });
  await addContribution(tx, orgId, clientAuthor, {
    key: 'submitted', state: 'submitted', visibility: 'community_proposed', ago: 3,
    payload: payload('Seasonal dips are flagged as deterioration', 'Synthetic example: period-over-period comparisons label seasonal revenue dips as deterioration, and analysts override many of them.'),
  });
  await addContribution(tx, orgId, clientAuthor, {
    key: 'clarify', state: 'needs_clarification', visibility: 'community_proposed', ago: 6,
    payload: payload('Alert fatigue from uniform transaction thresholds', 'Synthetic example: one threshold for every customer segment creates many false positives for analysts.', { offering: 'AMLOCK', observation_type: 'operational_challenge' }),
  }, moderator);
  const colleague = await syntheticUser(tx, orgId, 'client-demo-colleague', 'Synthetic demo colleague');
  await tx(`INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, 'client_member', 'active') ON CONFLICT (org_id, user_id) DO NOTHING`, [orgId, colleague]);
}

async function seedInternalStarterData(tx: Tx, orgId: string, user: { id: string; display_name: string }) {
  const authorA = await syntheticUser(tx, orgId, 'internal-author-a', 'Synthetic analyst A');
  const authorB = await syntheticUser(tx, orgId, 'internal-author-b', 'Synthetic analyst B');
  const authorC = await syntheticUser(tx, orgId, 'internal-author-c', 'Synthetic analyst C');
  await addContribution(tx, orgId, authorA, {
    key: 'queue-1', state: 'submitted', visibility: 'community_proposed', ago: 2,
    payload: payload('Seasonal dips flagged as deterioration', 'Synthetic demo example: revenue falls sharply in one quarter every year and the comparison labels it deterioration.'),
  });
  await addContribution(tx, orgId, authorB, {
    key: 'queue-2', state: 'submitted', visibility: 'community_proposed', ago: 4,
    payload: payload('Harvest-aligned repayment calendars', 'Synthetic demo example: aligning repayment dates with harvest cycles improved repayment timing.', { offering: 'Lending', industry: 'Microfinance', region: 'SEA' }),
  });
  await addContribution(tx, orgId, authorC, {
    key: 'queue-3', state: 'needs_clarification', visibility: 'community_proposed', ago: 7,
    payload: payload('Uniform alert thresholds create noise', 'Synthetic demo example: the same alert rule is applied to retail, SME and corporate customers.', { offering: 'AMLOCK', observation_type: 'operational_challenge' }),
  }, user.id);

  const starterIdeas = [
    {
      key: 'seasonality-context', offering: 'FAI', audience: 'clients', priority: 'medium', status: 'Under review',
      title: 'Add seasonal context to cash-flow comparisons',
      problem: 'Synthetic demo idea: recurring seasonal changes can be mistaken for deterioration.',
      outcome: 'Show a seasonal comparison note alongside the existing period-over-period view.',
      clientUpdate: 'This synthetic idea is under review in the shared demo workspace.', owner: 'FAI product team',
    },
    {
      key: 'alert-thresholds', offering: 'AMLOCK', audience: 'internal', priority: 'low', status: 'Proposed',
      title: 'Explore segment-aware alert thresholds',
      problem: 'Synthetic demo idea: one threshold across segments can create avoidable review noise.',
      outcome: 'Assess a configurable threshold approach using synthetic examples.',
      clientUpdate: '', owner: 'AMLOCK product team',
    },
  ] as const;
  for (const idea of starterIdeas) {
    const ideaId = stableId('sandbox-idea', `${orgId}:${idea.key}`);
    await tx(
      `INSERT INTO improvement_ideas
         (id, org_id, title, problem_statement, offering, proposed_outcome, client_update, owner_team, priority, status, audience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [ideaId, orgId, idea.title, idea.problem, idea.offering, idea.outcome, idea.clientUpdate, idea.owner, idea.priority, idea.status, idea.audience],
    );
    await tx(
      `INSERT INTO idea_status_history (idea_id, from_status, to_status, changed_by, note)
       VALUES ($1, NULL, $2, $3, 'Synthetic starter idea for the shared demo workspace')
       ON CONFLICT DO NOTHING`,
      [ideaId, idea.status, user.id],
    );
  }

  await tx(
    `INSERT INTO employee_experiments
       (id, org_id, owner_user_id, title, problem_statement, offering, proposed_approach, status)
     VALUES ($1, $2, $3, 'Synthetic seasonal-context prototype',
       'Demo example: compare a synthetic seasonal pattern with the prior period.', 'FAI',
       'Show a short explanation beside the comparison; no model or credit decision is connected.', 'in_review')
     ON CONFLICT (id) DO NOTHING`,
    [stableId('sandbox-experiment', orgId), orgId, authorA],
  );
  await tx(
    `INSERT INTO employee_knowledge_items (id, org_id, title, body, owner_user_id, review_at, status)
     VALUES ($1, $2, 'Demo review checklist',
       'Use synthetic examples only. Confirm the approved audience, review the shared copy, and record a clear reason for each moderation decision.',
       $3, CURRENT_DATE + 90, 'published')
     ON CONFLICT (id) DO NOTHING`,
    [stableId('sandbox-knowledge', orgId), orgId, authorA],
  );
  const teamId = stableId('sandbox-hackathon-team', orgId);
  await tx(
    `INSERT INTO employee_hackathon_teams (id, org_id, name, description, status, created_by)
     VALUES ($1, $2, 'Synthetic seasonality prototype',
       'A shared demo team exploring how synthetic seasonal patterns could be explained in analysis.', 'open', $3)
     ON CONFLICT (id) DO NOTHING`,
    [teamId, orgId, authorA],
  );
  await tx(
    `INSERT INTO employee_hackathon_team_members (team_id, user_id, role)
     VALUES ($1, $2, 'lead') ON CONFLICT (team_id, user_id) DO NOTHING`,
    [teamId, authorA],
  );
  await tx(
    `INSERT INTO employee_hackathon_team_posts (id, team_id, author_user_id, body)
     VALUES ($1, $2, $3, 'Synthetic demo note: document the expected comparison behavior before changing the playground.')
     ON CONFLICT (id) DO NOTHING`,
    [stableId('sandbox-hackathon-post', orgId), teamId, authorA],
  );
  await tx(
    `INSERT INTO public_content_items
       (id, org_id, kind, slug, title, body, status, created_by, updated_by, published_at)
     VALUES ($1, $2, 'page', 'demo-product-briefing', 'Synthetic product briefing',
       'A demo-only page. Describe a synthetic product capability and review the preview with your team.',
       'published', $3, $3, now()) ON CONFLICT (id) DO NOTHING`,
    [stableId('sandbox-content', `${orgId}:product-briefing`), orgId, user.id],
  );
  await tx(
    `INSERT INTO public_content_items
       (id, org_id, kind, title, body, status, created_by, updated_by)
     VALUES ($1, $2, 'announcement', 'Synthetic demo announcement',
       'This draft is visible only in the shared demo workspace and never appears on the public website.',
       'draft', $3, $3) ON CONFLICT (id) DO NOTHING`,
    [stableId('sandbox-content', `${orgId}:announcement`), orgId, user.id],
  );

  const now = Date.now();
  const sessions = [
    { key: 'employee-live', title: 'Synthetic demo: Q&A with the FAI product team', audience: 'employees', start: 3 },
    { key: 'client-briefing', title: 'Synthetic demo: Client briefing on release notes', audience: 'clients', start: 10 },
  ];
  for (const session of sessions) {
    await tx(
      `INSERT INTO broadcast_sessions (id, org_id, title, description, host_user_id, starts_at, audience, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $5) ON CONFLICT (id) DO NOTHING`,
      [stableId('sandbox-broadcast', `${orgId}:${session.key}`), orgId, session.title,
        'Demo session with synthetic content only. Do not share sensitive information.', user.id,
        new Date(now + session.start * 86_400_000).toISOString(), session.audience],
    );
  }
}
