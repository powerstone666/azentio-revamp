// ─── Core domain types for azentio.ai ───
// Hand-written TS types; no ORM. Used by server and client.
// Zod schemas live alongside these types in ./schemas.ts

// ─── Organisations ───

export type OrgType = 'azentio' | 'client';
export type OrgStatus = 'active' | 'suspended' | 'disabled';

export interface Organization {
  id: string; // UUID
  name: string;
  type: OrgType;
  status: OrgStatus;
  created_at: Date;
}

// ─── Users & Membership ───

export type MembershipStatus = 'active' | 'invited' | 'revoked';

export interface User {
  id: string;
  email: string; // normalised
  display_name: string;
  verified_at: Date | null;
  disabled_at: Date | null;
  created_at: Date;
}

export interface Membership {
  id: string;
  org_id: string;
  user_id: string;
  role: PortalRole;
  status: MembershipStatus;
  joined_at: Date;
}

// ─── Roles & Permissions ───

export type PortalRole =
  | 'employee'
  | 'client_member'
  | 'client_admin'
  | 'learning_moderator'
  | 'content_publisher'
  | 'product_owner'
  | 'portal_admin';

export interface RoleGrant {
  id: string;
  org_id: string | null; // null = platform-level grant
  user_id: string;
  role: PortalRole;
  offering_id: string | null; // product-owner assignment
  granted_by: string;
  expires_at: Date | null;
  revoked_at: Date | null;
}

// ─── Entitlements ───

export type EntitlementStatus = 'active' | 'revoked' | 'expired';

export interface Entitlement {
  id: string;
  org_id: string;
  offering_id: string;
  feature: string | null;
  status: EntitlementStatus;
  valid_from: Date;
  valid_to: Date | null;
  granted_by: string;
}

// ─── Invitations ───

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  proposed_role: PortalRole;
  token_hash: string;
  expires_at: Date;
  accepted_by: string | null;
  accepted_at: Date | null;
  revoked_at: Date | null;
  inviter: string;
  created_at: Date;
}

// ─── Contributions ───

export type ContributionVisibility = 'author' | 'org' | 'community_proposed';

export type ContributionState =
  | 'private_draft'
  | 'submitted'
  | 'needs_clarification'
  | 'approved'
  | 'published'
  | 'suspended'
  | 'rejected'
  | 'withdrawn';

export interface Contribution {
  id: string;
  author_user_id: string;
  org_id: string;
  visibility: ContributionVisibility;
  current_version_id: string | null;
  state: ContributionState;
  withdrawn_at: Date | null;
  visibility_epoch: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContributionVersion {
  id: string;
  contribution_id: string;
  version: number;
  source_payload: Record<string, unknown>;
  created_by: string;
  created_at: Date;
  parent_version_id: string | null;
}

// ─── Shared Copies ───

export type SharedCopyStatus = 'active' | 'suspended' | 'withdrawn';

export interface SharedCopy {
  id: string;
  contribution_id: string;
  source_version_id: string;
  reviewed_payload: Record<string, unknown>;
  deidentified: boolean;
  attribution_consent: boolean;
  status: SharedCopyStatus;
  published_at: Date;
  invalidated_at: Date | null;
}

// ─── Consents ───

export type ConsentPurpose = 'store_process' | 'publish_reviewed' | 'attribute' | 'model_training';

export interface Consent {
  id: string;
  user_id: string;
  contribution_id: string;
  version: number;
  purpose: ConsentPurpose;
  choice: boolean;
  policy_version: string;
  granted_at: Date | null;
  revoked_at: Date | null;
  captured_at: Date;
}

// ─── Moderation ───

export type ModerationAction =
  | 'clarify'
  | 'reject'
  | 'approve'
  | 'publish'
  | 'suspend'
  | 'reinstate'
  | 'withdraw';

export interface ModerationDecision {
  id: string;
  contribution_id: string;
  version_id: string;
  moderator_id: string;
  action: ModerationAction;
  reason_code: string;
  redactions: Record<string, unknown> | null;
  created_at: Date;
}

export interface Report {
  id: string;
  shared_copy_id: string;
  reporter_user_id: string;
  category: string;
  details: string;
  status: 'open' | 'investigating' | 'resolved';
  created_at: Date;
}

// ─── Themes & Ideas ───

export type ThemeStatus = 'emerging' | 'active' | 'archived';

export interface Theme {
  id: string;
  title: string;
  offering: string | null;
  topic: string;
  period_start: Date;
  period_end: Date;
  status: ThemeStatus;
  safe_summary: string;
  distinct_org_count: number;
  created_at: Date;
}

export type IdeaStatus =
  | 'Proposed'
  | 'Under review'
  | 'Planned'
  | 'In progress'
  | 'Released'
  | 'Not proceeding';

export interface ImprovementIdea {
  id: string;
  title: string;
  problem_statement: string;
  offering: string | null;
  proposed_outcome: string;
  owner_team: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: IdeaStatus;
  audience: 'internal' | 'clients' | 'public';
  created_at: Date;
  updated_at: Date;
}

// ─── Notifications ───

export interface Notification {
  id: string;
  recipient_user_id: string;
  event: string;
  safe_payload: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
}

// ─── Audit ───

export interface AuditEvent {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  active_org_id: string | null;
  request_id: string;
  decision: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

// ─── Session ───

export interface AppSession {
  user: User;
  activeWorkspace: {
    orgId: string;
    orgName: string;
    orgType: OrgType;
    role: PortalRole;
  } | null;
  memberships: Membership[];
  grants: RoleGrant[];
}