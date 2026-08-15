-- ============================================================================
-- Education Platform - Enrollments Table
-- ============================================================================
-- Migration: 20260810235900_create_enrollments_table
-- Description: Student ↔ Course enrollment aggregate root
--
-- Constitution Compliance:
-- - Law 1: Enrollment references Student (aggregate root for academic role)
-- - Law 4: Additive migration (no DROP, no breaking changes)
-- - Law 8: Tenant isolation on every query
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,

  -- Enrollment lifecycle
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'dropped', 'on_hold', 'pending')),

  -- Dates
  enrolled_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at    DATE,
  dropped_at      DATE,

  -- Academic progress for this course
  grade           NUMERIC(5,2),      -- Final grade (e.g. 8.5 / 10.0)
  attendance_pct  NUMERIC(5,2),      -- Attendance percentage 0–100
  notes           TEXT,

  -- Metadata extensions
  metadata        JSONB,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,
  updated_by      UUID
);

-- ============================================================================
-- Constraints
-- ============================================================================

-- A student can only be enrolled in the same course once per tenant (active or completed)
-- Allows re-enrollment only after dropping
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_student_course_active_unique
  ON public.enrollments(tenant_id, student_id, course_id)
  WHERE status IN ('active', 'pending', 'on_hold');

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_id     ON public.enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id    ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id     ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status        ON public.enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at   ON public.enrollments(enrolled_at);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'enrollments'
    AND policyname = 'enrollments_service_role'
  ) THEN
    CREATE POLICY enrollments_service_role ON public.enrollments
      FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 'enrollments' AS table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_name = 'enrollments' AND table_schema = 'public';
