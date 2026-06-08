-- Phase 2 foundation for Beauty Spa commercialization.
-- Keep existing Bella package/booking flows intact. This only adds optional
-- beauty-specific service metadata and resource inventory for future scheduling.

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS module_key TEXT,
  ADD COLUMN IF NOT EXISTS service_kind TEXT,
  ADD COLUMN IF NOT EXISTS service_category TEXT,
  ADD COLUMN IF NOT EXISTS default_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS requires_resource BOOLEAN,
  ADD COLUMN IF NOT EXISTS default_resource_type TEXT,
  ADD COLUMN IF NOT EXISTS before_after_required BOOLEAN,
  ADD COLUMN IF NOT EXISTS care_note_template TEXT;

UPDATE public.packages
SET
  module_key = COALESCE(NULLIF(module_key, ''), 'babycare'),
  service_kind = COALESCE(NULLIF(service_kind, ''), 'treatment_package'),
  default_duration_minutes = COALESCE(default_duration_minutes, 90),
  requires_resource = COALESCE(requires_resource, FALSE),
  before_after_required = COALESCE(before_after_required, FALSE)
WHERE module_key IS NULL
   OR service_kind IS NULL
   OR default_duration_minutes IS NULL
   OR requires_resource IS NULL
   OR before_after_required IS NULL;

ALTER TABLE public.packages
  ALTER COLUMN module_key SET DEFAULT 'babycare',
  ALTER COLUMN module_key SET NOT NULL,
  ALTER COLUMN service_kind SET DEFAULT 'treatment_package',
  ALTER COLUMN service_kind SET NOT NULL,
  ALTER COLUMN default_duration_minutes SET DEFAULT 90,
  ALTER COLUMN default_duration_minutes SET NOT NULL,
  ALTER COLUMN requires_resource SET DEFAULT FALSE,
  ALTER COLUMN requires_resource SET NOT NULL,
  ALTER COLUMN before_after_required SET DEFAULT FALSE,
  ALTER COLUMN before_after_required SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.packages
    ADD CONSTRAINT packages_module_key_check
    CHECK (module_key IN ('babycare', 'beauty_spa'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.packages
    ADD CONSTRAINT packages_service_kind_check
    CHECK (service_kind IN ('single_service', 'treatment_package', 'retail_product', 'consultation'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.packages
    ADD CONSTRAINT packages_default_duration_minutes_check
    CHECK (default_duration_minutes BETWEEN 1 AND 1440);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.packages
    ADD CONSTRAINT packages_default_resource_type_check
    CHECK (
      default_resource_type IS NULL
      OR default_resource_type IN ('bed', 'room', 'machine', 'chair', 'other')
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_packages_tenant_module_kind
  ON public.packages (tenant_id, module_key, service_kind, status);

CREATE TABLE IF NOT EXISTS public.booking_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'bed'
    CHECK (resource_type IN ('bed', 'room', 'machine', 'chair', 'other')),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'maintenance', 'inactive')),
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 20),
  location_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_resources_unique_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_booking_resources_tenant_status
  ON public.booking_resources (tenant_id, status, resource_type);

CREATE INDEX IF NOT EXISTS idx_booking_resources_branch
  ON public.booking_resources (branch_tenant_id)
  WHERE branch_tenant_id IS NOT NULL;

ALTER TABLE public.booking_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Booking resources read scoped tenant data" ON public.booking_resources;
CREATE POLICY "Booking resources read scoped tenant data"
  ON public.booking_resources
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      (tenant_id = public.get_auth_tenant_id() OR branch_tenant_id = public.get_auth_tenant_id())
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr', 'accountant')
      )
    )
  );

DROP POLICY IF EXISTS "Booking resources admin manage scoped tenant data" ON public.booking_resources;
CREATE POLICY "Booking resources admin manage scoped tenant data"
  ON public.booking_resources
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      (tenant_id = public.get_auth_tenant_id() OR branch_tenant_id = public.get_auth_tenant_id())
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      (tenant_id = public.get_auth_tenant_id() OR branch_tenant_id = public.get_auth_tenant_id())
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

REVOKE ALL ON TABLE public.booking_resources FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_resources TO service_role;

COMMENT ON COLUMN public.packages.module_key IS
  'Module that owns the package/service definition. Existing Bella services default to babycare.';

COMMENT ON COLUMN public.packages.service_kind IS
  'Commercial service type for Beauty Spa rollout: single service, treatment package, retail product, or consultation.';

COMMENT ON TABLE public.booking_resources IS
  'Schedulable resources such as beds, rooms, machines, chairs, or other beauty spa resources.';
