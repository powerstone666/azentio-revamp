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
  title: z.string().min(3).max(200),
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
  observation_period_start: z.string().optional(),
  observation_period_end: z.string().optional(),
  evidence_type: z.enum(['anecdotal', 'quantitative', 'case_study', 'other']),
  confidence: z.enum(['low', 'medium', 'high']),
  body: z.string().min(10).max(5000),
  visibility: contributionVisibilitySchema,
  // Independent consents (a–d)
  consent_store_process: z.boolean(),
  consent_publish_reviewed: z.boolean(),
  consent_attribute: z.boolean(),
  consent_model_training: z.boolean(),
});

export type ContributionCreateInput = z.infer<typeof contributionCreateSchema>;

// ─── Moderation decision input ───

export const moderationDecisionSchema = z.object({
  action: z.enum(['clarify', 'reject', 'approve', 'publish', 'suspend', 'reinstate']),
  reason_code: z.string().min(1).max(50),
  clarification_message: z.string().max(2000).optional(),
  redacted_payload: z.record(z.string(), z.unknown()).optional(),
  deidentified: z.boolean().default(true),
  attribution_consent: z.boolean().default(false),
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
  offering: z.string().max(100).optional(),
  proposed_outcome: z.string().min(10).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  supporting_contribution_ids: z.array(z.string().uuid()).max(50),
});

export type IdeaCreateInput = z.infer<typeof ideaCreateSchema>;

export const ideaStatusUpdateSchema = z.object({
  status: ideaStatusSchema,
  status_note: z.string().max(1000).optional(),
});

// ─── Search ───

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  offering: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  topic: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

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
  code: z.string().length(6),
});

// ─── Playground ───

export const playgroundRunSchema = z.object({
  offering_id: z.string().uuid(),
  scenario_id: z.string().min(1).max(100),
  parameters: z.record(z.string(), z.unknown()).optional(),
});