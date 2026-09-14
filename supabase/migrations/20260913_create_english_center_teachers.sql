-- ============================================================================
-- E4 — ENGLISH CENTER TEACHERS & WORKFORCE
-- Zero-downtime migration: tables + policies, indexes added concurrently after
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.english_center_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  party_id UUID NOT NULL UNIQUE REFERENCES public.party_parties(id) ON DELETE CASCADE,
  employee_code VARCHAR(50),
  certifications JSONB DEFAULT '[]'::jsonb,
  specializations VARCHAR[],
  languages VARCHAR[],
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.english_center_teacher_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.english_center_teachers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE public.english_center_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_teacher_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY teachers_tenant_isolation ON public.english_center_teachers
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY teacher_branches_tenant_isolation ON public.english_center_teacher_branches
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE TRIGGER trg_teachers_updated_at BEFORE UPDATE ON public.english_center_teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- Indexes created outside transaction for zero-downtime
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teachers_tenant ON public.english_center_teachers(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teachers_party ON public.english_center_teachers(party_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teachers_status ON public.english_center_teachers(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_branches_tenant ON public.english_center_teacher_branches(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_branches_teacher ON public.english_center_teacher_branches(teacher_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_branches_branch ON public.english_center_teacher_branches(branch_id);
