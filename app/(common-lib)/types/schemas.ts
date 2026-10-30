import { z } from 'zod';

// ─── Zod schemas for azentio.ai — shared client + server validation ───

// ─── Organisations ───

export const orgTypeSchema = z.enum(['azentio', 'client']);
export const orgStatusSchema = z.enum(['active', 'suspended', 'disabled']);

// ─── Roles ───

export const portalRoleSchema = z.enum([
  'employee',
  'client_member',
  'client_admin',
  'learning_moderator',
  'content_publisher',
  'product_owner',
  'portal_admin',
]);

// ─── Contributions ───

export const contributionVisibilitySchema = z.enum([
  'author',
  'org',
  'community_proposed',
]);

export const contributionStateSchema = z.enum([
  'private_draft',
  'submitted',
  'needs_clarification',
  'approved',
  'published',
  'suspended',
  'rejected',
  'withdrawn',
]);

// ─── Contribution form input (client → server) ───

export const contributionCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  observation_type: z.enum([
    'market_observation',
    'emerging_trend',
    'product_gap',
    'operational_challenge',
    'successful_practice',
    'improvement_suggestion',
  ]),
  offering: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  observation_period_start: z.iso.date().optional(),
  observation_period_end: z.iso.date().optional(),
  evidence_type: z.enum(['anecdotal', 'quantitative', 'case_study', 'other']),
  confidence: z.enum(['low', 'medium', 'high']),
  body: z.string().trim().min(10).max(5000),
  visibility: contributionVisibilitySchema,
  // Independent consents (a–d)
  consent_store_process: z.boolean(),
  consent_publish_reviewed: z.boolean(),
  consent_attribute: z.boolean(),
  consent_model_training: z.boolean(),
  consent_semantic_analysis: z.boolean().default(false),
}).refine(
  ({ observation_period_start, observation_period_end }) =>
    !observation_period_start || !observation_period_end || observation_period_start <= observation_period_end,
  { path: ['observation_period_end'], message: 'Observation period end must not be before its start' },
);

export type ContributionCreateInput = z.infer<typeof contributionCreateSchema>;

// ─── Moderation decision input ───

export const moderationDecisionSchema = z.object({
  action: z.enum(['clarify', 'reject', 'approve', 'publish', 'suspend', 'reinstate']),
  reason_code: z.string().min(1).max(50),
  clarification_message: z.string().max(2000).optional(),
  redacted_payload: z.object({
    title: z.string().min(3).max(200),
    observation_type: z.enum([
      'market_observation', 'emerging_trend', 'product_gap',
      'operational_challenge', 'successful_practice', 'improvement_suggestion',
    ]),
    offering: z.string().max(100).nullable().optional(),
    industry: z.string().max(100).nullable().optional(),
    region: z.string().max(100).nullable().optional(),
    observation_period_start: z.iso.date().nullable().optional(),
    observation_period_end: z.iso.date().nullable().optional(),
    evidence_type: z.enum(['anecdotal', 'quantitative', 'case_study', 'other']),
    confidence: z.enum(['low', 'medium', 'high']),
    body: z.string().min(10).max(5000),
    attribution_label: z.string().min(1).max(100).optional(),
  }).strict().optional(),
  deidentified: z.boolean().default(true),
  attribution_consent: z.boolean().default(false),
  evidence_quality: z.enum(['weak', 'moderate', 'strong']).optional(),
}).superRefine((value, context) => {
  if (value.action === 'publish' && !value.redacted_payload) {
    context.addIssue({ code: 'custom', path: ['redacted_payload'], message: 'A reviewed, redacted copy is required' });
  }
  if (value.action === 'clarify' && !value.clarification_message?.trim()) {
    context.addIssue({ code: 'custom', path: ['clarification_message'], message: 'A clarification request is required' });
  }
  if (value.action === 'publish' && !value.evidence_quality) {
    context.addIssue({ code: 'custom', path: ['evidence_quality'], message: 'Reviewer-assessed evidence quality is required before publication' });
  }
});

export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;

// ─── Theme / Idea ───

export const ideaStatusSchema = z.enum([
  'Proposed',
  'Under review',
  'Planned',
  'In progress',
  'Released',
  'Not proceeding',
]);

export const ideaCreateSchema = z.object({
  title: z.string().min(3).max(200),
  problem_statement: z.string().min(10).max(3000),
  offering: z.string().min(1).max(100),
  proposed_outcome: z.string().min(10).max(2000),
  client_update: z.string().max(1000).optional(),
  owner_team: z.string().max(120).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  audience: z.enum(['internal', 'clients']),
  supporting_contribution_ids: z.array(z.string().uuid()).min(1).max(50)
    .refine((ids) => new Set(ids).size === ids.length, 'Evidence references must be unique'),
});

export type IdeaCreateInput = z.infer<typeof ideaCreateSchema>;

export const ideaStatusUpdateSchema = z.object({
  status: ideaStatusSchema,
  status_note: z.string().max(1000).optional(),
  client_update: z.string().max(1000).optional(),
});

export type IdeaStatusUpdateInput = z.infer<typeof ideaStatusUpdateSchema>;

// ─── Search ───

export const searchQuerySchema = z.object({
  q: z.string().trim().max(500).optional(),
  offering: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  period_start: z.iso.date().optional(),
  period_end: z.iso.date().optional(),
  topic: z.string().max(100).optional(),
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export const savedSearchFiltersSchema = searchQuerySchema.omit({ cursor: true, limit: true });
export const savedSearchCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: savedSearchFiltersSchema,
  digest_enabled: z.boolean().default(false),
});
export type SavedSearchCreateInput = z.infer<typeof savedSearchCreateSchema>;

// ─── Invitation ───

export const inviteCreateSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(['client_member', 'client_admin']),
});

export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;

// ─── Report ───

export const reportCreateSchema = z.object({
  category: z.enum(['misleading', 'confidential', 'inappropriate', 'other']),
  details: z.string().min(10).max(2000),
});

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export const communityCommentCreateSchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict();

export type CommunityCommentCreateInput = z.infer<typeof communityCommentCreateSchema>;

export const hackathonTeamCreateSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
}).strict();

export type HackathonTeamCreateInput = z.infer<typeof hackathonTeamCreateSchema>;

export const hackathonTeamPostSchema = z.object({
  body: z.string().trim().min(1).max(4000),
}).strict();

export type HackathonTeamPostInput = z.infer<typeof hackathonTeamPostSchema>;

// ─── Workspace selection ───

export const workspaceSelectSchema = z.object({
  membership_id: z.string().uuid(),
});

// ─── Auth ───

export const emailOtpSchema = z.object({
  email: z.string().email().max(255),
});

export const verifyOtpSchema = z.object({
  email: z.string().email().max(255),
  code: z.string().regex(/^\d{6}$/, 'Verification code must contain six digits'),
});

// ─── Playground ───

export const playgroundRunSchema = z.object({
  offering_id: z.string().uuid(),
  scenario_id: z.string().min(1).max(100),
  parameters: z.record(z.string(), z.unknown()).optional(),
});
