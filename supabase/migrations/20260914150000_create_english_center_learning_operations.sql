-- ============================================================================
-- E6 - ENGLISH CENTER ATTENDANCE & LEARNING OPERATIONS
-- ============================================================================
-- Product: Bella English Center
-- Phase: E6
-- Purpose: Session attendance mapping and lightweight learning progress.
-- Architecture: Product-level extension; canonical attendance/score writes go
-- through Education OS public contracts.
-- Compliance: Education OS Constitution, additive migration only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.english_center_session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES public.english_center_class_sessions(id) ON DELETE CASCADE,
  english_enrollment_id UUID NOT NULL REFERENCES public.english_center_enrollments(id) ON DELETE CASCADE,
  canonical_enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  canonical_attendance_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  notes TEXT,
  marked_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_english_center_session_attendance_enrollment
    UNIQUE (tenant_id, session_id, english_enrollment_id)
);

CREATE TABLE IF NOT EXISTS public.english_center_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  session_id UUID REFERENCES public.english_center_class_sessions(id) ON DELETE SET NULL,
  english_enrollment_id UUID NOT NULL REFERENCES public.english_center_enrollments(id) ON DELETE CASCADE,
  canonical_enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  canonical_assessment_id UUID,
  progress_label VARCHAR(40) NOT NULL CHECK (progress_label IN ('needs_support', 'on_track', 'strong', 'excellent')),
  skill_area VARCHAR(40) CHECK (skill_area IN ('listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary', 'overall')),
  score_type VARCHAR(20) CHECK (score_type IN ('quiz', 'midterm', 'final', 'homework')),
  grade NUMERIC(5, 2),
  weight NUMERIC(3, 2),
  notes TEXT,
  recorded_by UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- zero-downtime: allow blocking-index - new E6 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_attendance_session
  ON public.english_center_session_attendance(tenant_id, session_id);

-- zero-downtime: allow blocking-index - new E6 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_attendance_enrollment
  ON public.english_center_session_attendance(tenant_id, english_enrollment_id, recorded_at);

-- zero-downtime: allow blocking-index - new E6 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_attendance_branch
  ON public.english_center_session_attendance(tenant_id, branch_id, recorded_at);

-- zero-downtime: allow blocking-index - new E6 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_progress_enrollment
  ON public.english_center_learning_progress(tenant_id, english_enrollment_id, recorded_at);

-- zero-downtime: allow blocking-index - new E6 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_progress_session
  ON public.english_center_learning_progress(tenant_id, session_id)
  WHERE session_id IS NOT NULL;

-- zero-downtime: allow blocking-index - new E6 product table has no existing production rows.
CREATE INDEX IF NOT EXISTS idx_english_center_progress_branch
  ON public.english_center_learning_progress(tenant_id, branch_id, recorded_at);

ALTER TABLE public.english_center_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_learning_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS english_center_session_attendance_tenant_branch_isolation
  ON public.english_center_session_attendance;

CREATE POLICY english_center_session_attendance_tenant_branch_isolation
  ON public.english_center_session_attendance
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

DROP POLICY IF EXISTS english_center_learning_progress_tenant_branch_isolation
  ON public.english_center_learning_progress;

CREATE POLICY english_center_learning_progress_tenant_branch_isolation
  ON public.english_center_learning_progress
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

REVOKE ALL ON public.english_center_session_attendance FROM anon;
REVOKE ALL ON public.english_center_learning_progress FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_session_attendance TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_learning_progress TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_english_center_session_attendance_updated_at
  ON public.english_center_session_attendance;

CREATE TRIGGER trg_english_center_session_attendance_updated_at
  BEFORE UPDATE ON public.english_center_session_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_english_center_learning_progress_updated_at
  ON public.english_center_learning_progress;

CREATE TRIGGER trg_english_center_learning_progress_updated_at
  BEFORE UPDATE ON public.english_center_learning_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.english_center_session_attendance IS
  'E6 - English Center session-to-enrollment attendance mapping. Canonical attendance is written through Education Attendance Contract.';

COMMENT ON TABLE public.english_center_learning_progress IS
  'E6 - English Center learning progress labels and notes. Optional scores are written through Education Assessment Contract.';
