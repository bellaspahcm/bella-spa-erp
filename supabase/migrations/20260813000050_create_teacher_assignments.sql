-- ============================================================================
-- Education OS — Teacher Classroom Assignments Canonical Table
-- ============================================================================
-- Migration: 20260813000050_create_teacher_assignments
-- Target: Canonical persistence for TeacherClassroomAssignment aggregate.
-- Eliminates courses.metadata shadow model risk.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_id UUID NOT NULL,
  teacher_party_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead_teacher', 'co_teacher', 'assistant', 'substitute')),
  academic_year TEXT NOT NULL,
  effective_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  CONSTRAINT teacher_assignments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT teacher_assignments_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT teacher_assignments_teacher_fk FOREIGN KEY (teacher_party_id) REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  CONSTRAINT teacher_assignments_dates_check CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);

-- Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant ON public.teacher_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_course ON public.teacher_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_party_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_status ON public.teacher_assignments(status);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_lookup ON public.teacher_assignments(tenant_id, course_id, academic_year, status);

-- Partial Unique Index: Hard Invariant - Max 1 active lead teacher per classroom/course per academic year
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_lead_teacher_per_course_year
  ON public.teacher_assignments (tenant_id, course_id, academic_year)
  WHERE role = 'lead_teacher' AND status = 'active';

-- Unique Constraint: Prevent identical active teacher assignment (same course, teacher, year, role)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_teacher_course_role_year
  ON public.teacher_assignments (tenant_id, course_id, teacher_party_id, academic_year, role)
  WHERE status = 'active';

-- RLS Enablement & Policies
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teacher_assignments' AND policyname = 'teacher_assignments_tenant_isolation') THEN
    CREATE POLICY teacher_assignments_tenant_isolation ON public.teacher_assignments
      FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID OR tenant_id = (current_setting('app.current_tenant_id', true))::UUID);
  END IF;
END $$;

-- Updated at Trigger
CREATE OR REPLACE FUNCTION update_teacher_assignments_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_teacher_assignments_updated_at ON public.teacher_assignments;
CREATE TRIGGER trigger_teacher_assignments_updated_at
  BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION update_teacher_assignments_updated_at();

NOTIFY pgrst, 'reload schema';
