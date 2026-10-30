-- Narrow alignment for an existing Azentio database that predates the current
-- consent purpose, public-content and branded-email schema. This is not a full-schema rerun.
-- Safe to reapply; it only changes the Azentio `consents` and
-- `public_content_items` and `email_outbox` objects.

BEGIN;

-- Contribution capture and withdrawal already support this separate purpose.
ALTER TABLE public.consents
  DROP CONSTRAINT IF EXISTS consents_purpose_check;
ALTER TABLE public.consents
  ADD CONSTRAINT consents_purpose_check
  CHECK (purpose IN (
    'store_process', 'publish_reviewed', 'attribute', 'model_training', 'semantic_analysis'
  ));

-- The outbox stores the rendered Azentio template with its text alternative.
ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS html_body TEXT;

-- Public announcement/page CMS used by /api/v1/public-content/*.
CREATE TABLE IF NOT EXISTS public.public_content_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('announcement', 'page')),
  slug         TEXT,
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  link_label   TEXT,
  link_href    TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by   UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  CHECK ((kind = 'page' AND slug IS NOT NULL AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
      OR (kind = 'announcement' AND slug IS NULL)),
  CHECK (link_href IS NULL OR link_href ~ '^(/|https://)'),
  CHECK (link_label IS NULL OR char_length(link_label) BETWEEN 1 AND 60),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

ALTER TABLE public.public_content_items
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.public_content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_anon_access" ON public.public_content_items;
CREATE POLICY "no_anon_access" ON public.public_content_items FOR ALL TO anon USING (false);
DROP POLICY IF EXISTS "no_authenticated_access" ON public.public_content_items;
CREATE POLICY "no_authenticated_access" ON public.public_content_items FOR ALL TO authenticated USING (false);

-- Remove the legacy global slug index only if it belongs to this table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class index_class
    JOIN pg_namespace index_schema ON index_schema.oid = index_class.relnamespace
    JOIN pg_index index_metadata ON index_metadata.indexrelid = index_class.oid
    WHERE index_schema.nspname = 'public'
      AND index_class.relname = 'idx_public_content_pages_slug'
      AND index_metadata.indrelid = 'public.public_content_items'::regclass
  ) THEN
    EXECUTE 'DROP INDEX public.idx_public_content_pages_slug';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_content_pages_org_slug
  ON public.public_content_items (
    (COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid)), slug
  ) WHERE kind = 'page';
CREATE INDEX IF NOT EXISTS idx_public_content_live_announcement
  ON public.public_content_items (starts_at, ends_at, published_at DESC)
  WHERE kind = 'announcement' AND status = 'published' AND org_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_public_content_org_status
  ON public.public_content_items (org_id, status, updated_at DESC);

COMMIT;
