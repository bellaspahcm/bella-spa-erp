-- Tenant configuration contract for Bella-governed profile metadata.
-- Existing generated types and onboarding code use tenants.metadata; some
-- runtime databases may predate the archived manual metadata migration.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.metadata IS
  'Flexible JSON storage for Bella-governed tenant configuration, including hospitality business profile settings.';
