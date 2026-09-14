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

CREATE POLICY teachers_branch_select ON public.english_center_teachers
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.english_center_teacher_branches tb
      WHERE tb.teacher_id = public.english_center_teachers.id
        AND tb.tenant_id = public.english_center_teachers.tenant_id
        AND tb.status = 'active'
        AND tb.branch_id IN (
          SELECT org_unit_id
          FROM public.user_org_unit_access
          WHERE user_id = COALESCE(
            auth.uid(),
            NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
          )
            AND tenant_id = COALESCE(
              public.get_auth_tenant_id(),
              NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
            )
        )
    )
  );

CREATE POLICY teachers_tenant_write ON public.english_center_teachers
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  );

CREATE POLICY teachers_tenant_update ON public.english_center_teachers
  FOR UPDATE
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  );

CREATE POLICY teachers_tenant_delete ON public.english_center_teachers
  FOR DELETE
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  );

CREATE POLICY teacher_branches_tenant_branch_isolation ON public.english_center_teacher_branches
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  );

REVOKE ALL ON public.english_center_teachers FROM anon;
REVOKE ALL ON public.english_center_teacher_branches FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_teachers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_teacher_branches TO authenticated, service_role;

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
