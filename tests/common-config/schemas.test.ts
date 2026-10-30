import { z } from 'zod';
import {
  orgTypeSchema, orgStatusSchema, portalRoleSchema, contributionVisibilitySchema, contributionStateSchema,
  contributionCreateSchema, moderationDecisionSchema, ideaStatusSchema, ideaCreateSchema, ideaStatusUpdateSchema,
  searchQuerySchema, savedSearchFiltersSchema, savedSearchCreateSchema, inviteCreateSchema, reportCreateSchema,
  communityCommentCreateSchema, hackathonTeamCreateSchema, hackathonTeamPostSchema, workspaceSelectSchema,
  emailOtpSchema, verifyOtpSchema, playgroundRunSchema,
} from '@/app/(common-lib)/types/schemas';
import { UUID_A, UUID_B, validContribution, validRedactedPayload, validIdea } from './support/fixtures';

const accepts = (schema: z.ZodType, input: unknown) => expect(schema.safeParse(input).success).toBe(true);
const rejects = (schema: z.ZodType, input: unknown) => expect(schema.safeParse(input).success).toBe(false);

describe('enum schemas', () => {
  it.each([
    ['orgTypeSchema accepts azentio and client', orgTypeSchema, ['azentio', 'client'], ['Client', 'partner', '']],
    ['orgStatusSchema accepts active, suspended and disabled', orgStatusSchema, ['active', 'suspended', 'disabled'], ['deleted', 'ACTIVE']],
    ['portalRoleSchema lists exactly the seven portal roles', portalRoleSchema, ['employee', 'client_member', 'client_admin', 'learning_moderator', 'content_publisher', 'product_owner', 'portal_admin'], ['admin', 'viewer', 'client']],
    ['contributionVisibilitySchema accepts author, org and community_proposed', contributionVisibilitySchema, ['author', 'org', 'community_proposed'], ['public', 'community']],
    ['contributionStateSchema accepts the eight lifecycle states', contributionStateSchema, ['private_draft', 'submitted', 'needs_clarification', 'approved', 'published', 'suspended', 'rejected', 'withdrawn'], ['draft', 'archived']],
    ['ideaStatusSchema accepts the six idea statuses', ideaStatusSchema, ['Proposed', 'Under review', 'Planned', 'In progress', 'Released', 'Not proceeding'], ['proposed', 'Done', 'Closed']],
  ])('%s', (_name, schema, valid, invalid) => {
    for (const value of valid) accepts(schema, value);
    for (const value of invalid) rejects(schema, value);
  });
});

describe('contributionCreateSchema', () => {
  it('accepts a complete, valid contribution', () => {
    const parsed = contributionCreateSchema.parse(validContribution);
    expect(parsed.title).toBe(validContribution.title);
  });

  it('defaults consent_semantic_analysis to false when omitted', () => {
    expect(contributionCreateSchema.parse(validContribution).consent_semantic_analysis).toBe(false);
  });

  it.each([
    ['title shorter than 3 characters', { title: 'ab' }],
    ['title longer than 200 characters', { title: 'x'.repeat(201) }],
    ['body shorter than 10 characters', { body: 'too short' }],
    ['body longer than 5000 characters', { body: 'x'.repeat(5001) }],
    ['offering longer than 100 characters', { offering: 'x'.repeat(101) }],
    ['unknown observation_type', { observation_type: 'rumour' }],
    ['unknown evidence_type', { evidence_type: 'hearsay' }],
    ['unknown confidence level', { confidence: 'certain' }],
    ['unknown visibility', { visibility: 'public' }],
    ['malformed period start date', { observation_period_start: '2025-13-40' }],
    ['a consent sent as a string', { consent_store_process: 'yes' }],
    ['a missing mandatory consent', { consent_model_training: undefined }],
  ])('rejects %s', (_name, override) => {
    rejects(contributionCreateSchema, { ...validContribution, ...override });
  });

  it('accepts the title and body at their exact length limits', () => {
    accepts(contributionCreateSchema, { ...validContribution, title: 'abc', body: 'x'.repeat(10) });
    accepts(contributionCreateSchema, { ...validContribution, title: 'x'.repeat(200), body: 'x'.repeat(5000) });
  });

  it('rejects a whitespace-only title (a blank title is not a title)', () => {
    rejects(contributionCreateSchema, { ...validContribution, title: '   ' });
  });

  it('rejects an observation period whose end is before its start', () => {
    rejects(contributionCreateSchema, {
      ...validContribution,
      observation_period_start: '2025-06-30',
      observation_period_end: '2025-01-01',
    });
  });
});

describe('moderationDecisionSchema', () => {
  it('accepts a reject decision with only an action and reason code', () => {
    const parsed = moderationDecisionSchema.parse({ action: 'reject', reason_code: 'Duplicate' });
    expect(parsed.deidentified).toBe(true);
    expect(parsed.attribution_consent).toBe(false);
  });

  it('requires a reviewed, redacted payload and evidence quality to publish', () => {
    const missingPayload = moderationDecisionSchema.safeParse({ action: 'publish', reason_code: 'ok', evidence_quality: 'strong' });
    const missingQuality = moderationDecisionSchema.safeParse({ action: 'publish', reason_code: 'ok', redacted_payload: validRedactedPayload });
    expect(missingPayload.success).toBe(false);
    expect(missingQuality.success).toBe(false);
    accepts(moderationDecisionSchema, { action: 'publish', reason_code: 'ok', redacted_payload: validRedactedPayload, evidence_quality: 'moderate' });
  });

  it.each([
    ['no clarification message', {}],
    ['a whitespace-only clarification message', { clarification_message: '   ' }],
  ])('requires a non-blank clarification message to clarify (%s)', (_name, extra) => {
    rejects(moderationDecisionSchema, { action: 'clarify', reason_code: 'Other', ...extra });
    accepts(moderationDecisionSchema, { action: 'clarify', reason_code: 'Other', clarification_message: 'Which period?' });
  });

  it('rejects a redacted payload that carries an extra, unreviewed field', () => {
    rejects(moderationDecisionSchema, {
      action: 'publish',
      reason_code: 'ok',
      evidence_quality: 'weak',
      redacted_payload: { ...validRedactedPayload, author_email: 'someone@example.test' },
    });
  });

  it.each([
    ['an unknown action', { action: 'delete' }],
    ['an empty reason code', { action: 'reject', reason_code: '' }],
    ['a reason code longer than 50 characters', { action: 'reject', reason_code: 'x'.repeat(51) }],
    ['an unknown evidence quality', { action: 'approve', reason_code: 'ok', evidence_quality: 'excellent' }],
  ])('rejects %s', (_name, input) => {
    rejects(moderationDecisionSchema, input);
  });
});

describe('ideaCreateSchema', () => {
  it('accepts a valid idea', () => {
    accepts(ideaCreateSchema, validIdea);
  });

  it('rejects an empty evidence list and more than fifty evidence references', () => {
    rejects(ideaCreateSchema, { ...validIdea, supporting_contribution_ids: [] });
    const fifty = Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    rejects(ideaCreateSchema, { ...validIdea, supporting_contribution_ids: fifty });
  });

  it('rejects duplicate evidence references', () => {
    rejects(ideaCreateSchema, { ...validIdea, supporting_contribution_ids: [UUID_A, UUID_A] });
    accepts(ideaCreateSchema, { ...validIdea, supporting_contribution_ids: [UUID_A, UUID_B] });
  });

  it('rejects evidence references that are not UUIDs', () => {
    rejects(ideaCreateSchema, { ...validIdea, supporting_contribution_ids: ['obs_01'] });
  });

  it.each([
    ['an unknown priority', { priority: 'urgent' }],
    ['an unknown audience', { audience: 'public' }],
    ['a problem statement under 10 characters', { problem_statement: 'short' }],
    ['a missing offering', { offering: '' }],
  ])('rejects %s', (_name, override) => {
    rejects(ideaCreateSchema, { ...validIdea, ...override });
  });

  it('accepts every priority the schema defines', () => {
    for (const priority of ['low', 'medium', 'high', 'critical']) accepts(ideaCreateSchema, { ...validIdea, priority });
  });
});

describe('ideaStatusUpdateSchema', () => {
  it('accepts a known status with optional notes', () => {
    accepts(ideaStatusUpdateSchema, { status: 'Planned' });
    accepts(ideaStatusUpdateSchema, { status: 'Released', status_note: 'Shipped', client_update: 'Available now.' });
  });

  it('rejects an unknown status and over-long notes', () => {
    rejects(ideaStatusUpdateSchema, { status: 'Shipped' });
    rejects(ideaStatusUpdateSchema, { status: 'Planned', status_note: 'x'.repeat(1001) });
    rejects(ideaStatusUpdateSchema, { status: 'Planned', client_update: 'x'.repeat(1001) });
  });
});

describe('searchQuerySchema', () => {
  it('applies a default limit of 20 and trims the free-text query', () => {
    const parsed = searchQuerySchema.parse({ q: '  seasonal  ' });
    expect(parsed.limit).toBe(20);
    expect(parsed.q).toBe('seasonal');
  });

  it('coerces a numeric string limit to a number', () => {
    expect(searchQuerySchema.parse({ limit: '35' }).limit).toBe(35);
  });

  it.each([
    ['a limit of 0', { limit: 0 }],
    ['a limit above 100', { limit: 101 }],
    ['a non-integer limit', { limit: 2.5 }],
    ['a query longer than 500 characters', { q: 'x'.repeat(501) }],
    ['a cursor longer than 256 characters', { cursor: 'c'.repeat(257) }],
    ['a malformed period_start', { period_start: '01/02/2025' }],
  ])('rejects %s', (_name, input) => {
    rejects(searchQuerySchema, input);
  });

  it('accepts a query of exactly 500 characters', () => {
    accepts(searchQuerySchema, { q: 'x'.repeat(500) });
  });
});

describe('saved search schemas', () => {
  it('drops cursor and paging fields from saved filters', () => {
    const filters = savedSearchFiltersSchema.parse({ q: 'lending', cursor: 'abc', limit: 5, offering: 'Lending' });
    expect(filters).not.toHaveProperty('cursor');
    expect(filters).not.toHaveProperty('limit');
    expect(filters.offering).toBe('Lending');
  });

  it('trims the saved search name and defaults digest_enabled to false', () => {
    const parsed = savedSearchCreateSchema.parse({ name: '  Lending alerts ', filters: {} });
    expect(parsed.name).toBe('Lending alerts');
    expect(parsed.digest_enabled).toBe(false);
  });

  it.each([
    ['a blank name', { name: '   ', filters: {} }],
    ['a name longer than 80 characters', { name: 'n'.repeat(81), filters: {} }],
    ['missing filters', { name: 'Alerts' }],
  ])('rejects %s', (_name, input) => {
    rejects(savedSearchCreateSchema, input);
  });
});

describe('inviteCreateSchema', () => {
  it.each(['client_member', 'client_admin'])('accepts the %s invite role', (role) => {
    accepts(inviteCreateSchema, { email: 'ravi.kumar@harborline-bank.example', role });
  });

  it.each([
    ['an azentio-internal role', 'employee'],
    ['the portal admin role', 'portal_admin'],
    ['an unknown role', 'owner'],
  ])('rejects invites to %s', (_name, role) => {
    rejects(inviteCreateSchema, { email: 'ravi.kumar@harborline-bank.example', role });
  });

  it.each(['not-an-email', 'a@', '@example.test', ''])('rejects the malformed email %j', (email) => {
    rejects(inviteCreateSchema, { email, role: 'client_member' });
  });
});

describe('reportCreateSchema', () => {
  it.each(['misleading', 'confidential', 'inappropriate', 'other'])('accepts the %s category', (category) => {
    accepts(reportCreateSchema, { category, details: 'The claim is not supported by the evidence.' });
  });

  it('rejects unknown categories and details outside 10 to 2000 characters', () => {
    rejects(reportCreateSchema, { category: 'spam', details: 'The claim is not supported.' });
    rejects(reportCreateSchema, { category: 'other', details: 'short' });
    rejects(reportCreateSchema, { category: 'other', details: 'x'.repeat(2001) });
  });
});

describe('trimmed text schemas that reject extra keys', () => {
  it.each([
    ['communityCommentCreateSchema', communityCommentCreateSchema, { body: '  Helpful, thanks.  ' }, { body: '   ' }],
    ['hackathonTeamPostSchema', hackathonTeamPostSchema, { body: '  Update  ' }, { body: '\n\t ' }],
  ])('%s trims the body and rejects blank input', (_name, schema, good, blank) => {
    expect(schema.parse(good).body).toBe(good.body.trim());
    rejects(schema, blank);
  });

  it('communityCommentCreateSchema rejects unexpected keys and bodies over 2000 characters', () => {
    rejects(communityCommentCreateSchema, { body: 'ok', author_id: UUID_A });
    rejects(communityCommentCreateSchema, { body: 'x'.repeat(2001) });
  });

  it('hackathonTeamCreateSchema trims name and description and enforces their lengths', () => {
    const parsed = hackathonTeamCreateSchema.parse({ name: '  Team Nova ', description: '  We build tiny prototypes.  ' });
    expect(parsed).toEqual({ name: 'Team Nova', description: 'We build tiny prototypes.' });
    rejects(hackathonTeamCreateSchema, { name: 'AB', description: 'We build tiny prototypes.' });
    rejects(hackathonTeamCreateSchema, { name: 'Team Nova', description: 'short' });
    rejects(hackathonTeamCreateSchema, { name: 'Team Nova', description: 'We build tiny prototypes.', leader: 'me' });
  });
});

describe('workspaceSelectSchema', () => {
  it('accepts a UUID membership id and rejects anything else', () => {
    accepts(workspaceSelectSchema, { membership_id: UUID_A });
    rejects(workspaceSelectSchema, { membership_id: 'membership-1' });
    rejects(workspaceSelectSchema, {});
  });
});

describe('authentication schemas', () => {
  it('accepts a well-formed email for OTP issuance and rejects overlong addresses', () => {
    accepts(emailOtpSchema, { email: 'imran@valueailabs.ai' });
    rejects(emailOtpSchema, { email: `${'a'.repeat(250)}@example.test` });
    rejects(emailOtpSchema, { email: 'not an email' });
  });

  it('requires a six-character verification code', () => {
    accepts(verifyOtpSchema, { email: 'dana.whitfield@azentio.com', code: '123456' });
    rejects(verifyOtpSchema, { email: 'dana.whitfield@azentio.com', code: '12345' });
    rejects(verifyOtpSchema, { email: 'dana.whitfield@azentio.com', code: '1234567' });
  });

  it('accepts only numeric verification codes', () => {
    rejects(verifyOtpSchema, { email: 'dana.whitfield@azentio.com', code: 'abcdef' });
  });
});

describe('playgroundRunSchema', () => {
  it('accepts a UUID offering with a scenario id and optional parameters', () => {
    accepts(playgroundRunSchema, { offering_id: UUID_A, scenario_id: 'synthetic-seasonality' });
    accepts(playgroundRunSchema, { offering_id: UUID_A, scenario_id: 'x', parameters: { borrower_count: 240 } });
  });

  it('rejects a non-UUID offering id and an empty scenario id', () => {
    rejects(playgroundRunSchema, { offering_id: 'FAI', scenario_id: 'synthetic-seasonality' });
    rejects(playgroundRunSchema, { offering_id: UUID_A, scenario_id: '' });
  });
});
