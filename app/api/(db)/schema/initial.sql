-- =============================================================================
-- Azentio.ai — Initial Database Schema
-- Schema definition only. This file has not been applied to a database.
--
-- Designed for raw-SQL access via pg Pool (no ORM).
-- Supabase REST API is locked down: RLS enabled, anon + authenticated denied.
-- All application access flows through the server-only DAL at app/api/(db)/client.ts
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extension
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================================================
-- 1. Organizations
-- ===========================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('azentio', 'client')),
  status     TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_sandbox BOOLEAN NOT NULL DEFAULT false
);

-- Self-serve demo workspaces (DEMO_ONBOARDING). Hidden from admin directories and global review queues.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON organizations FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON organizations FOR ALL TO authenticated USING (false);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name_ci ON organizations (lower(name));

-- ===========================================================================
-- 2. Users
-- ===========================================================================
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  verified_at  TIMESTAMPTZ,
  disabled_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON users FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON users FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 3. Memberships
-- ===========================================================================
CREATE TABLE IF NOT EXISTS memberships (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role      TEXT NOT NULL CHECK (role IN (
              'employee', 'client_member', 'client_admin',
              'learning_moderator', 'content_publisher',
              'product_owner', 'portal_admin'
            )),
  status    TEXT NOT NULL CHECK (status IN ('active', 'invited', 'revoked')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON memberships FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON memberships FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 4. Role Grants (platform-level when org_id IS NULL)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS role_grants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id) ON DELETE RESTRICT,  -- NULL = platform grant
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role        TEXT NOT NULL CHECK (role IN (
                'employee', 'client_member', 'client_admin',
                'learning_moderator', 'content_publisher',
                'product_owner', 'portal_admin'
              )),
  offering_id TEXT,                                                  -- product-owner assignment by offering key
  granted_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

ALTER TABLE role_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON role_grants FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON role_grants FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_role_grants_org_active ON role_grants (org_id, role, user_id) WHERE revoked_at IS NULL;

-- ===========================================================================
-- 5. Invitations
-- ===========================================================================
CREATE TABLE IF NOT EXISTS invitations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  email         TEXT NOT NULL,
  proposed_role TEXT NOT NULL CHECK (proposed_role IN (
                  'employee', 'client_member', 'client_admin',
                  'learning_moderator', 'content_publisher',
                  'product_owner', 'portal_admin'
                )),
  token_hash    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_by   UUID REFERENCES users(id) ON DELETE RESTRICT,
  accepted_at   TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  inviter       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON invitations FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON invitations FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 6. Entitlements (feature gating per org)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS entitlements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  offering_id TEXT NOT NULL,
  feature     TEXT,
  status      TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  valid_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to    TIMESTAMPTZ,
  granted_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON entitlements FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON entitlements FOR ALL TO authenticated USING (false);

-- ==========================================================================
-- 6a. Sandbox Runs (tenant and user scoped, synthetic demo inputs only)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS sandbox_runs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  offering_id    TEXT NOT NULL,
  scenario_key   TEXT NOT NULL,
  input_snapshot JSONB NOT NULL,
  output_snapshot JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sandbox_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON sandbox_runs FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON sandbox_runs FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 7. Contributions
-- NOTE: current_version_id FK is deferred — added after contribution_versions
--       exists to resolve the circular dependency.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS contributions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  visibility         TEXT NOT NULL CHECK (visibility IN (
                       'author', 'org', 'community_proposed'
                     )),
  current_version_id UUID,  -- FK added via ALTER below
  state              TEXT NOT NULL CHECK (state IN (
                       'private_draft', 'submitted', 'needs_clarification',
                       'approved', 'published', 'suspended', 'rejected', 'withdrawn'
                     )),
  withdrawn_at       TIMESTAMPTZ,
  visibility_epoch   INT NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON contributions FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON contributions FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 8. Contribution Versions
-- ===========================================================================
CREATE TABLE IF NOT EXISTS contribution_versions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contribution_id   UUID NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  version           INT NOT NULL,
  source_payload    JSONB NOT NULL DEFAULT '{}',
  created_by        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  parent_version_id UUID REFERENCES contribution_versions(id) ON DELETE RESTRICT, -- self-ref
  UNIQUE (contribution_id, version)
);

ALTER TABLE contribution_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON contribution_versions FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON contribution_versions FOR ALL TO authenticated USING (false);

-- Resolve circular FK: contributions.current_version_id → contribution_versions
ALTER TABLE contributions
  ADD CONSTRAINT fk_contributions_current_version
  FOREIGN KEY (current_version_id) REFERENCES contribution_versions(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY IMMEDIATE;

-- ===========================================================================
-- 9. Shared Copies (reviewed & de-identified snapshots)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS shared_copies (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contribution_id     UUID NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  source_version_id   UUID NOT NULL REFERENCES contribution_versions(id) ON DELETE RESTRICT,
  reviewed_payload    JSONB NOT NULL DEFAULT '{}',
  deidentified        BOOLEAN NOT NULL DEFAULT false,
  attribution_consent BOOLEAN NOT NULL DEFAULT false,
  evidence_quality    TEXT CHECK (evidence_quality IN ('weak', 'moderate', 'strong')),
  status              TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'withdrawn')),
  published_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at      TIMESTAMPTZ,
  UNIQUE (source_version_id)
);

ALTER TABLE shared_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copies FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copies FOR ALL TO authenticated USING (false);
ALTER TABLE shared_copies ADD COLUMN IF NOT EXISTS evidence_quality TEXT
  CHECK (evidence_quality IN ('weak', 'moderate', 'strong'));

-- User- and workspace-scoped saved searches and bookmarks for approved community learning.
CREATE TABLE IF NOT EXISTS client_saved_searches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  filters     JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(filters) = 'object'),
  digest_enabled BOOLEAN NOT NULL DEFAULT false,
  last_digest_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, name)
);
ALTER TABLE client_saved_searches ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE client_saved_searches ADD COLUMN IF NOT EXISTS last_digest_at TIMESTAMPTZ;

ALTER TABLE client_saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON client_saved_searches FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON client_saved_searches FOR ALL TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS shared_copy_bookmarks (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  shared_copy_id UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id, shared_copy_id)
);

ALTER TABLE shared_copy_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copy_bookmarks FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copy_bookmarks FOR ALL TO authenticated USING (false);

-- Community quality feedback is one current vote per active client member and shared copy.
CREATE TABLE IF NOT EXISTS shared_copy_feedback (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  shared_copy_id UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT,
  feedback       TEXT NOT NULL CHECK (feedback IN ('useful', 'needs_evidence')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id, shared_copy_id)
);

ALTER TABLE shared_copy_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copy_feedback FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copy_feedback FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_shared_copy_feedback_copy ON shared_copy_feedback (shared_copy_id, feedback);

-- ===========================================================================
-- 10. Consents (granular per-purpose consent tracking)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS consents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  version         INT NOT NULL,
  purpose         TEXT NOT NULL CHECK (purpose IN (
                    'store_process', 'publish_reviewed', 'attribute', 'model_training', 'semantic_analysis'
                  )),
  choice          BOOLEAN NOT NULL,
  policy_version  TEXT NOT NULL,
  granted_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE consents DROP CONSTRAINT IF EXISTS consents_purpose_check;
ALTER TABLE consents ADD CONSTRAINT consents_purpose_check
  CHECK (purpose IN ('store_process', 'publish_reviewed', 'attribute', 'model_training', 'semantic_analysis'));

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON consents FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON consents FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 11. Moderation Decisions
-- ===========================================================================
CREATE TABLE IF NOT EXISTS moderation_decisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  version_id      UUID NOT NULL REFERENCES contribution_versions(id) ON DELETE RESTRICT,
  moderator_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action          TEXT NOT NULL CHECK (action IN (
                    'clarify', 'reject', 'approve', 'publish',
                    'suspend', 'reinstate', 'withdraw'
                  )),
  reason_code     TEXT NOT NULL,
  decision_note   TEXT,
  redactions      JSONB,
  evidence_quality TEXT CHECK (evidence_quality IN ('weak', 'moderate', 'strong')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE moderation_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON moderation_decisions FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON moderation_decisions FOR ALL TO authenticated USING (false);
ALTER TABLE moderation_decisions ADD COLUMN IF NOT EXISTS evidence_quality TEXT
  CHECK (evidence_quality IN ('weak', 'moderate', 'strong'));

-- ===========================================================================
-- 12. Reports (user-submitted flags against shared copies)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shared_copy_id   UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category         TEXT NOT NULL,
  details          TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'resolved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON reports FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON reports FOR ALL TO authenticated USING (false);

-- Community comments inherit the published shared copy's audience. There is no
-- independent tenant or audience field that could widen their visibility.
CREATE TABLE IF NOT EXISTS shared_copy_comments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shared_copy_id   UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT,
  author_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body             TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status           TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

ALTER TABLE shared_copy_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copy_comments FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copy_comments FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_shared_copy_comments_visible
  ON shared_copy_comments (shared_copy_id, created_at, id) WHERE status = 'visible';

CREATE TABLE IF NOT EXISTS shared_copy_comment_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id       UUID NOT NULL REFERENCES shared_copy_comments(id) ON DELETE RESTRICT,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category         TEXT NOT NULL CHECK (category IN ('misleading', 'confidential', 'inappropriate', 'other')),
  details          TEXT NOT NULL CHECK (char_length(details) BETWEEN 10 AND 2000),
  status           TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'resolved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shared_copy_comment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copy_comment_reports FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copy_comment_reports FOR ALL TO authenticated USING (false);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_copy_comment_reports_open_reporter
  ON shared_copy_comment_reports (comment_id, reporter_user_id) WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS idx_shared_copy_comment_reports_status
  ON shared_copy_comment_reports (status, created_at DESC);

-- ===========================================================================
-- 13. Themes (aggregated insight topics surfaced from evidence)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS themes (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title              TEXT NOT NULL,
  offering           TEXT,
  topic              TEXT NOT NULL,
  period_start       TIMESTAMPTZ NOT NULL,
  period_end         TIMESTAMPTZ NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('emerging', 'active', 'archived')),
  safe_summary       TEXT NOT NULL DEFAULT '',
  distinct_org_count INT NOT NULL DEFAULT 0,
  review_priority    TEXT NOT NULL DEFAULT 'monitor' CHECK (review_priority IN ('monitor', 'evidence_review', 'candidate_review')),
  generated_key      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE themes ADD COLUMN IF NOT EXISTS generated_key TEXT;
ALTER TABLE themes ADD COLUMN IF NOT EXISTS review_priority TEXT NOT NULL DEFAULT 'monitor'
  CHECK (review_priority IN ('monitor', 'evidence_review', 'candidate_review'));
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON themes FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON themes FOR ALL TO authenticated USING (false);
CREATE UNIQUE INDEX IF NOT EXISTS idx_themes_generated_key
  ON themes (generated_key) WHERE generated_key IS NOT NULL;

-- ===========================================================================
-- 14. Theme Evidence (many-to-many: themes ↔ shared_copies)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS theme_evidence (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theme_id       UUID NOT NULL REFERENCES themes(id) ON DELETE RESTRICT,
  shared_copy_id UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT,
  UNIQUE (theme_id, shared_copy_id)
);

ALTER TABLE theme_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON theme_evidence FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON theme_evidence FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 15. Improvement Ideas
-- ===========================================================================
CREATE TABLE IF NOT EXISTS improvement_ideas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  problem_statement TEXT NOT NULL DEFAULT '',
  offering          TEXT,
  proposed_outcome  TEXT NOT NULL DEFAULT '',
  client_update     TEXT NOT NULL DEFAULT '',
  owner_team        TEXT NOT NULL DEFAULT '',
  priority          TEXT NOT NULL CHECK (priority IN (
                      'low', 'medium', 'high', 'critical'
                    )),
  status            TEXT NOT NULL CHECK (status IN (
                      'Proposed', 'Under review', 'Planned',
                      'In progress', 'Released', 'Not proceeding'
                    )),
  audience          TEXT NOT NULL CHECK (audience IN (
                      'internal', 'clients', 'public'
                    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE improvement_ideas ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_improvement_ideas_org_updated ON improvement_ideas (org_id, updated_at DESC);

ALTER TABLE improvement_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON improvement_ideas FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON improvement_ideas FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 16. Idea Evidence (many-to-many: improvement_ideas ↔ shared_copies)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS idea_evidence (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id        UUID NOT NULL REFERENCES improvement_ideas(id) ON DELETE RESTRICT,
  shared_copy_id UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT,
  UNIQUE (idea_id, shared_copy_id)
);

ALTER TABLE idea_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON idea_evidence FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON idea_evidence FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 17. Idea Status History (audit trail for idea lifecycle transitions)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS idea_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id     UUID NOT NULL REFERENCES improvement_ideas(id) ON DELETE RESTRICT,
  from_status TEXT,  -- NULL for initial creation
  to_status   TEXT NOT NULL,
  changed_by  UUID REFERENCES users(id) ON DELETE RESTRICT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE idea_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON idea_status_history FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON idea_status_history FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 18. Notifications (in-app alerts for users)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event              TEXT NOT NULL,
  safe_payload       JSONB NOT NULL DEFAULT '{}',
  read_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON notifications FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON notifications FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 19. Notification Outbox (reliable delivery with idempotency)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS notification_outbox (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id   UUID NOT NULL REFERENCES notifications(id) ON DELETE RESTRICT,
  idempotency_key   TEXT NOT NULL UNIQUE,
  attempts          INT NOT NULL DEFAULT 0,
  next_attempt_at   TIMESTAMPTZ,
  last_error_code   TEXT,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS last_error_code TEXT;

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON notification_outbox FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON notification_outbox FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON notification_outbox (created_at, id) WHERE delivered_at IS NULL AND attempts < 8;

CREATE OR REPLACE FUNCTION enqueue_notification_outbox() RETURNS trigger AS $$
BEGIN
  INSERT INTO notification_outbox (notification_id, idempotency_key)
  VALUES (NEW.id, 'notification:' || NEW.id::text || ':email')
  ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notifications_enqueue_outbox ON notifications;
CREATE TRIGGER notifications_enqueue_outbox
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION enqueue_notification_outbox();

-- Outbound email delivery is durable. `sent` records provider acceptance; queueing is not delivery.
CREATE TABLE IF NOT EXISTS email_outbox (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key   TEXT NOT NULL UNIQUE,
  recipient_email   TEXT NOT NULL,
  subject           TEXT NOT NULL,
  text_body         TEXT NOT NULL,
  html_body         TEXT,
  status            TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
  attempts          INT NOT NULL DEFAULT 0,
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at         TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  last_error_code   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON email_outbox FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON email_outbox FOR ALL TO authenticated USING (false);

-- Acceptance is separate from membership and contribution sharing consent.
CREATE TABLE IF NOT EXISTS workspace_acceptances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  policy_version  TEXT NOT NULL,
  accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, policy_version)
);

ALTER TABLE workspace_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON workspace_acceptances FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON workspace_acceptances FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 20. Audit Log (immutable event journal)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id       UUID NOT NULL,
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      UUID NOT NULL,
  active_org_id  UUID,
  request_id     TEXT NOT NULL,
  decision       TEXT NOT NULL,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION reject_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_row_mutation ON audit_log;
CREATE TRIGGER audit_log_no_row_mutation
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_log_mutation();

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON audit_log FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON audit_log FOR ALL TO authenticated USING (false);

-- Public web leads are private operational records. Only server-side handlers
-- can access them; neither Supabase anon nor authenticated API keys can read them.
CREATE TABLE IF NOT EXISTS public_submissions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_type         TEXT NOT NULL CHECK (submission_type IN ('demo_enquiry', 'hackathon_registration')),
  email                   TEXT NOT NULL,
  organization_name       TEXT NOT NULL,
  payload                 JSONB NOT NULL,
  privacy_notice_version  TEXT NOT NULL,
  consented_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                  TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'closed')),
  request_id              TEXT NOT NULL UNIQUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON public_submissions FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON public_submissions FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_public_submissions_inbox
  ON public_submissions (submission_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_submissions_email_recent
  ON public_submissions (submission_type, lower(email), created_at DESC);

-- Employee-only submissions and knowledge stay outside client/public retrieval.
CREATE TABLE IF NOT EXISTS employee_experiments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title            TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  offering         TEXT NOT NULL,
  proposed_approach TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'accepted', 'declined')),
  reviewer_note    TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_experiments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE employee_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON employee_experiments FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON employee_experiments FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_employee_experiments_owner_created
  ON employee_experiments (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_experiments_org_updated
  ON employee_experiments (org_id, updated_at DESC);

-- Employee hackathon collaboration spaces remain outside client/public search.
CREATE TABLE IF NOT EXISTS employee_hackathon_teams (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 100),
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_hackathon_teams ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE employee_hackathon_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON employee_hackathon_teams FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON employee_hackathon_teams FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_employee_hackathon_teams_open
  ON employee_hackathon_teams (updated_at DESC, id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_employee_hackathon_teams_org_open
  ON employee_hackathon_teams (org_id, updated_at DESC, id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS employee_hackathon_team_members (
  team_id         UUID NOT NULL REFERENCES employee_hackathon_teams(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role            TEXT NOT NULL CHECK (role IN ('lead', 'member')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
ALTER TABLE employee_hackathon_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON employee_hackathon_team_members FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON employee_hackathon_team_members FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_employee_hackathon_team_members_user
  ON employee_hackathon_team_members (user_id, team_id);

CREATE TABLE IF NOT EXISTS employee_hackathon_team_posts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES employee_hackathon_teams(id) ON DELETE RESTRICT,
  author_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_hackathon_team_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON employee_hackathon_team_posts FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON employee_hackathon_team_posts FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_employee_hackathon_team_posts_recent
  ON employee_hackathon_team_posts (team_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS release_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  audience        TEXT NOT NULL CHECK (audience IN ('employees', 'clients')),
  offering_id     TEXT,
  org_id          UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((audience = 'employees' AND org_id IS NULL) OR audience = 'clients'),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
ALTER TABLE release_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON release_notes FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON release_notes FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_release_notes_published_audience
  ON release_notes (audience, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_release_notes_org_offering
  ON release_notes (org_id, offering_id, published_at DESC) WHERE status = 'published' AND audience = 'clients';

-- Tenant-only resources are link records; binary uploads remain out of P0.
CREATE TABLE IF NOT EXISTS client_resources (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 180),
  description     TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 3000),
  category        TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 80),
  resource_url    TEXT NOT NULL CHECK (char_length(resource_url) <= 2048),
  offering_id     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE client_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON client_resources FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON client_resources FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_client_resources_org_active
  ON client_resources (org_id, offering_id, created_at DESC, id DESC) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS employee_knowledge_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  review_at       DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_knowledge_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE employee_knowledge_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON employee_knowledge_items FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON employee_knowledge_items FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_employee_knowledge_published_review
  ON employee_knowledge_items (review_at, updated_at DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_employee_knowledge_org_review
  ON employee_knowledge_items (org_id, review_at, updated_at DESC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS employee_knowledge_feedback (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id         UUID NOT NULL REFERENCES employee_knowledge_items(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  helpful         BOOLEAN NOT NULL,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);
ALTER TABLE employee_knowledge_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON employee_knowledge_feedback FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON employee_knowledge_feedback FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_employee_knowledge_feedback_item
  ON employee_knowledge_feedback (item_id, helpful);

CREATE TABLE IF NOT EXISTS broadcast_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  host_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  audience        TEXT NOT NULL CHECK (audience IN ('employees', 'clients', 'public')),
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'recorded', 'cancelled')),
  join_url        TEXT,
  recording_url   TEXT,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK (status <> 'live' OR join_url IS NOT NULL),
  CHECK (status <> 'recorded' OR recording_url IS NOT NULL)
);
ALTER TABLE broadcast_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON broadcast_sessions FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON broadcast_sessions FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_broadcast_sessions_audience_status_start
  ON broadcast_sessions (org_id, audience, status, starts_at);

-- A client-audience session is only visible to explicitly invited client workspaces.
-- The Azentio org_id on broadcast_sessions remains the publishing workspace.
CREATE TABLE IF NOT EXISTS broadcast_session_invited_orgs (
  broadcast_id UUID NOT NULL REFERENCES broadcast_sessions(id) ON DELETE RESTRICT,
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  invited_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  PRIMARY KEY (broadcast_id, org_id)
);
ALTER TABLE broadcast_session_invited_orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON broadcast_session_invited_orgs FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON broadcast_session_invited_orgs FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_broadcast_session_invited_orgs_org_active
  ON broadcast_session_invited_orgs (org_id, broadcast_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_broadcast_session_invited_orgs_inviter
  ON broadcast_session_invited_orgs (invited_by, invited_at DESC);

CREATE TABLE IF NOT EXISTS employee_playground_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  offering_id     TEXT NOT NULL,
  scenario_key    TEXT NOT NULL,
  input_snapshot  JSONB NOT NULL,
  output_snapshot JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE employee_playground_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON employee_playground_runs FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON employee_playground_runs FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_employee_playground_runs_owner
  ON employee_playground_runs (org_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_playground_feedback (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id          UUID NOT NULL REFERENCES employee_playground_runs(id) ON DELETE RESTRICT,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating          TEXT NOT NULL CHECK (rating IN ('Useful', 'Needs more evidence', 'Not clear')),
  comment         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, user_id)
);
ALTER TABLE employee_playground_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON employee_playground_feedback FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON employee_playground_feedback FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_employee_playground_feedback_org
  ON employee_playground_feedback (org_id, created_at DESC);

-- ===========================================================================
-- 21. Shared Copy Embeddings (vector store for semantic search)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS shared_copy_embeddings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shared_copy_id   UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT,
  embedding        JSONB NOT NULL,  -- float[] stored as JSON array
  dims             INT NOT NULL,
  model            TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_copy_embeddings_copy_model
  ON shared_copy_embeddings (shared_copy_id, model);

ALTER TABLE shared_copy_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copy_embeddings FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copy_embeddings FOR ALL TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS shared_copy_embedding_jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shared_copy_id   UUID NOT NULL UNIQUE REFERENCES shared_copies(id) ON DELETE RESTRICT,
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'complete', 'failed')),
  attempts         INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at        TIMESTAMPTZ,
  last_error_code  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shared_copy_embedding_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copy_embedding_jobs FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copy_embedding_jobs FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_shared_copy_embedding_jobs_due
  ON shared_copy_embedding_jobs (next_attempt_at, created_at) WHERE status = 'queued';

-- ===========================================================================
-- 22. Support Access (time-boxed portal-admin access to client orgs)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS support_access (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal_admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  contribution_id UUID REFERENCES contributions(id) ON DELETE RESTRICT,  -- NULL = org-wide access
  reason          TEXT NOT NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ
);

ALTER TABLE support_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON support_access FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON support_access FOR ALL TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS client_support_tickets (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  requester_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject            TEXT NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 200),
  details            TEXT NOT NULL CHECK (char_length(details) BETWEEN 10 AND 5000),
  category           TEXT NOT NULL CHECK (category IN ('product_question', 'access', 'technical_issue', 'other')),
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority           TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
  external_system    TEXT,
  external_ticket_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE client_support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON client_support_tickets FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON client_support_tickets FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_client_support_tickets_org_status
  ON client_support_tickets (org_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_support_tickets_requester
  ON client_support_tickets (requester_user_id, org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_outbox (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id         UUID NOT NULL REFERENCES client_support_tickets(id) ON DELETE RESTRICT,
  idempotency_key   TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
  attempts          INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at         TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  last_error_code   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE support_ticket_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON support_ticket_outbox FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON support_ticket_outbox FOR ALL TO authenticated USING (false);
CREATE INDEX IF NOT EXISTS idx_support_ticket_outbox_due
  ON support_ticket_outbox (next_attempt_at, created_at)
  WHERE status IN ('queued', 'failed', 'processing');

-- ===========================================================================
-- Additional Performance Indexes
-- ===========================================================================

-- contributions: common query patterns
CREATE INDEX IF NOT EXISTS idx_contributions_org_state
  ON contributions (org_id, state);
CREATE INDEX IF NOT EXISTS idx_memberships_user_status
  ON memberships (user_id, status, org_id);
CREATE INDEX IF NOT EXISTS idx_role_grants_user_active
  ON role_grants (user_id, role, org_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entitlements_org_offering_active
  ON entitlements (org_id, offering_id, valid_from, valid_to)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sandbox_runs_user_workspace
  ON sandbox_runs (org_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_email_pending
  ON invitations (lower(email), expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_outbox_due
  ON email_outbox (next_attempt_at, created_at)
  WHERE status IN ('queued', 'failed');
CREATE INDEX IF NOT EXISTS idx_email_outbox_stale_processing
  ON email_outbox (locked_at)
  WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_workspace_acceptances_user_org
  ON workspace_acceptances (user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_versions_contribution_created
  ON contribution_versions (contribution_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_shared_copy_embedding_copy
  ON shared_copy_embeddings (shared_copy_id);
CREATE INDEX IF NOT EXISTS idx_client_saved_searches_user_org
  ON client_saved_searches (user_id, org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_copy_bookmarks_user_org
  ON shared_copy_bookmarks (user_id, org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_theme_evidence_copy
  ON theme_evidence (shared_copy_id);
CREATE INDEX IF NOT EXISTS idx_idea_evidence_copy
  ON idea_evidence (shared_copy_id);
CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports (status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
  ON audit_log (active_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_author_state
  ON contributions (author_user_id, state);

-- shared_copies: find active / recently invalidated copies
CREATE INDEX IF NOT EXISTS idx_shared_copies_status_invalidated
  ON shared_copies (status, invalidated_at);

-- shared_copies: full-text search on reviewed payload
CREATE INDEX IF NOT EXISTS idx_shared_copies_fts
  ON shared_copies USING GIN (to_tsvector('english', reviewed_payload::text));

-- notifications: unread inbox queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
  ON notifications (recipient_user_id, read_at);

-- ===========================================================================
-- Comments on key design decisions
-- ===========================================================================

COMMENT ON TABLE organizations IS 'Azentio internal orgs and client orgs. Type discriminates; status controls lifecycle.';
COMMENT ON TABLE users IS 'All human users (Azentio employees and client members). Verified via email flow.';
COMMENT ON TABLE memberships IS 'Maps a user to an org with a PortalRole. Exactly one row per (org, user).';
COMMENT ON TABLE role_grants IS 'Explicit role grants, optionally scoped to org or offering. Null org_id = platform-level grant.';
COMMENT ON TABLE invitations IS 'Outbound email invitations to join an org. Token hash stored, never raw token.';
COMMENT ON TABLE entitlements IS 'Per-org feature gating. offering_id is a logical reference (no offerings table).';
COMMENT ON TABLE contributions IS 'User-submitted feedback / insight. current_version_id points to the latest approved version.';
COMMENT ON TABLE contribution_versions IS 'Immutable version history for a contribution. parent_version_id chains edits.';
COMMENT ON TABLE shared_copies IS 'Reviewed, de-identified snapshots published for cross-org visibility.';
COMMENT ON TABLE consents IS 'Granular per-purpose consent. Enables users to revoke specific purposes independently.';
COMMENT ON TABLE moderation_decisions IS 'Moderator actions against a contribution version. redactions stored as JSON paths.';
COMMENT ON TABLE reports IS 'User-submitted flags against a shared copy.';
COMMENT ON TABLE themes IS 'Aggregated insight topics surfaced from shared-copy evidence.';
COMMENT ON TABLE theme_evidence IS 'Junction: which shared copies substantiate a theme.';
COMMENT ON TABLE improvement_ideas IS 'Product improvement proposals vetted against evidence.';
COMMENT ON TABLE idea_evidence IS 'Junction: which shared copies back an improvement idea.';
COMMENT ON TABLE idea_status_history IS 'Audit trail of idea lifecycle transitions. from_status is NULL for initial creation.';
COMMENT ON TABLE notifications IS 'In-app user alerts. safe_payload must never contain PII.';
COMMENT ON TABLE notification_outbox IS 'Idempotent handoff of in-app notifications into email_outbox; delivered_at means queued for email, not SMTP delivery.';
COMMENT ON TABLE audit_log IS 'Immutable event journal for compliance and debugging. actor_id may not always reference users.';
COMMENT ON TABLE shared_copy_embeddings IS 'Vector embeddings for semantic search over shared copies.';
COMMENT ON TABLE support_access IS 'Time-boxed portal-admin access to a client org, optionally scoped to a single contribution.';
COMMENT ON INDEX idx_shared_copies_fts IS 'GIN index enabling full-text search across reviewed_payload content.';

-- ==========================================================================
-- Public CMS: publisher-managed announcement banners and public text pages.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public_content_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('announcement', 'page')),
  slug         TEXT,
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  link_label   TEXT,
  link_href    TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  CHECK ((kind = 'page' AND slug IS NOT NULL AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') OR (kind = 'announcement' AND slug IS NULL)),
  CHECK (link_href IS NULL OR link_href ~ '^(/|https://)'),
  CHECK (link_label IS NULL OR char_length(link_label) BETWEEN 1 AND 60),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

ALTER TABLE public_content_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public_content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON public_content_items FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON public_content_items FOR ALL TO authenticated USING (false);
DROP INDEX IF EXISTS idx_public_content_pages_slug;
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_content_pages_org_slug
  ON public_content_items ((COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid)), slug) WHERE kind = 'page';
CREATE INDEX IF NOT EXISTS idx_public_content_live_announcement
  ON public_content_items (starts_at, ends_at, published_at DESC)
  WHERE kind = 'announcement' AND status = 'published' AND org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_public_content_org_status
  ON public_content_items (org_id, status, updated_at DESC);

-- =============================================================================
-- End of initial schema definition
-- =============================================================================
