-- ============================================================================
-- Bella Preschool OS - Phase 4.2 Daily Care Operations
-- ============================================================================
-- Migration: 20260909000052_p42_daily_care_operations
-- Description:
--   - Daily Care Sessions per class/date
--   - Canonical Care Records per student (Arrival, Meals, Hygiene, Nap, Health)
--   - Parent Digest Projection with DRAFT -> GENERATED -> PUBLISHED lifecycle
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.edu_daily_care_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  class_id UUID NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'COMPLETED', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_class_date UNIQUE (tenant_id, class_id, date)
);

CREATE TABLE IF NOT EXISTS public.edu_daily_care_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.edu_daily_care_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  arrival_status TEXT DEFAULT 'PRESENT' CHECK (arrival_status IN ('PRESENT', 'ABSENT', 'LATE')),
  arrival_time TIMESTAMPTZ,
  morning_condition TEXT DEFAULT 'GOOD',
  meal_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  hygiene_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  nap_records JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_session_student UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.edu_daily_parent_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.edu_daily_care_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'PUBLISHED')),
  digest_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_digest_session_student UNIQUE (session_id, student_id)
);

-- RLS Configuration
DO $$
DECLARE
  t_name TEXT;
  tables_to_secure TEXT[] := ARRAY[
    'edu_daily_care_sessions', 'edu_daily_care_records', 'edu_daily_parent_digests'
  ];
BEGIN
  FOREACH t_name IN ARRAY tables_to_secure
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);
    
    EXECUTE format('
      DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I;
      CREATE POLICY %I_tenant_isolation ON public.%I
        FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> ''tenant_id'')::UUID);
    ', t_name, t_name, t_name, t_name);

    EXECUTE format('
      DROP POLICY IF EXISTS %I_service_role ON public.%I;
      CREATE POLICY %I_service_role ON public.%I
        FOR ALL TO service_role USING (true);
    ', t_name, t_name, t_name, t_name);
  END LOOP;
END $$;
