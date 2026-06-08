-- Phase 1 commercialization foundation:
-- Keep the existing Bella babycare module enabled by default, and store optional
-- white-label branding per tenant without changing current operating flows.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB NOT NULL DEFAULT '{"babycare": true, "beauty_spa": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_theme JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.tenants
SET enabled_modules = '{"babycare": true, "beauty_spa": false}'::jsonb
WHERE enabled_modules IS NULL;

UPDATE public.tenants
SET brand_theme = '{}'::jsonb
WHERE brand_theme IS NULL;

COMMENT ON COLUMN public.tenants.logo_url IS
  'Tenant-level logo URL used for white-label display.';

COMMENT ON COLUMN public.tenants.enabled_modules IS
  'Tenant module toggles. babycare stays enabled by default; beauty_spa is opt-in.';

COMMENT ON COLUMN public.tenants.brand_theme IS
  'Tenant white-label display settings such as brand name and colors.';
