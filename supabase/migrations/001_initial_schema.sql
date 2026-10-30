-- =============================================================================
-- Azentio.ai — Initial Database Schema
-- Migration: 001_initial_schema
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON organizations FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON organizations FOR ALL TO authenticated USING (false);

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
  offering_id UUID,                                                  -- product-owner assignment
  granted_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

ALTER TABLE role_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON role_grants FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON role_grants FOR ALL TO authenticated USING (false);

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
  parent_version_id UUID REFERENCES contribution_versions(id) ON DELETE RESTRICT -- self-ref
);

ALTER TABLE contribution_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON contribution_versions FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON contribution_versions FOR ALL TO authenticated USING (false);

-- Resolve circular FK: contributions.current_version_id → contribution_versions
ALTER TABLE contributions
  ADD CONSTRAINT fk_contributions_current_version
  FOREIGN KEY (current_version_id) REFERENCES contribution_versions(id)
  ON DELETE RESTRICT;

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
  status              TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'withdrawn')),
  published_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at      TIMESTAMPTZ
);

ALTER TABLE shared_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copies FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copies FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 10. Consents (granular per-purpose consent tracking)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS consents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE RESTRICT,
  version         INT NOT NULL,
  purpose         TEXT NOT NULL CHECK (purpose IN (
                    'store_process', 'publish_reviewed', 'attribute', 'model_training'
                  )),
  choice          BOOLEAN NOT NULL,
  policy_version  TEXT NOT NULL,
  granted_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  redactions      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE moderation_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON moderation_decisions FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON moderation_decisions FOR ALL TO authenticated USING (false);

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
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON themes FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON themes FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 14. Theme Evidence (many-to-many: themes ↔ shared_copies)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS theme_evidence (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theme_id       UUID NOT NULL REFERENCES themes(id) ON DELETE RESTRICT,
  shared_copy_id UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT
);

ALTER TABLE theme_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON theme_evidence FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON theme_evidence FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 15. Improvement Ideas
-- ===========================================================================
CREATE TABLE IF NOT EXISTS improvement_ideas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  problem_statement TEXT NOT NULL DEFAULT '',
  offering          TEXT,
  proposed_outcome  TEXT NOT NULL DEFAULT '',
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

ALTER TABLE improvement_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON improvement_ideas FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON improvement_ideas FOR ALL TO authenticated USING (false);

-- ===========================================================================
-- 16. Idea Evidence (many-to-many: improvement_ideas ↔ shared_copies)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS idea_evidence (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id        UUID NOT NULL REFERENCES improvement_ideas(id) ON DELETE RESTRICT,
  shared_copy_id UUID NOT NULL REFERENCES shared_copies(id) ON DELETE RESTRICT
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
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON notification_outbox FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON notification_outbox FOR ALL TO authenticated USING (false);

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

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON audit_log FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON audit_log FOR ALL TO authenticated USING (false);

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

ALTER TABLE shared_copy_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON shared_copy_embeddings FOR ALL TO anon USING (false);
CREATE POLICY "no_authenticated_access" ON shared_copy_embeddings FOR ALL TO authenticated USING (false);

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

-- ===========================================================================
-- Additional Performance Indexes
-- ===========================================================================

-- contributions: common query patterns
CREATE INDEX IF NOT EXISTS idx_contributions_org_state
  ON contributions (org_id, state);
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
COMMENT ON TABLE notification_outbox IS 'Reliable notification delivery with idempotency-key dedup.';
COMMENT ON TABLE audit_log IS 'Immutable event journal for compliance and debugging. actor_id may not always reference users.';
COMMENT ON TABLE shared_copy_embeddings IS 'Vector embeddings for semantic search over shared copies.';
COMMENT ON TABLE support_access IS 'Time-boxed portal-admin access to a client org, optionally scoped to a single contribution.';
COMMENT ON INDEX idx_shared_copies_fts IS 'GIN index enabling full-text search across reviewed_payload content.';

-- =============================================================================
-- End of migration 001
-- =============================================================================