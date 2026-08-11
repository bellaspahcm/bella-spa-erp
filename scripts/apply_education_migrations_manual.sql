-- ============================================================================
-- MANUAL MIGRATION: Education Platform Tables
-- 
-- Run this in Supabase Dashboard SQL Editor to apply education migrations
-- that are blocked by CLI migration history mismatch
-- 
-- Tables created:
-- - persons (if not exists)
-- - students (if not exists)
-- - courses
-- - enrollments
-- - attendances
-- ============================================================================

-- ============================================================================
-- COURSES TABLE (from migration 20260810231500)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  description TEXT,
  credits NUMERIC(3,1) CHECK (credits > 0),
  min_students INTEGER CHECK (min_students >= 0),
  max_students INTEGER CHECK (max_students > 0),
  duration_weeks INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'in_progress', 'completed', 'cancelled', 'archived')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID,
  CONSTRAINT fk_courses_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT check_max_ge_min CHECK (max_students >= min_students)
);

CREATE INDEX IF NOT EXISTS idx_courses_tenant ON public.courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON public.courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_unique_code ON public.courses(tenant_id, course_code);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON public.courses;
CREATE POLICY tenant_isolation_policy ON public.courses
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

DROP TRIGGER IF EXISTS set_updated_at ON public.courses;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO service_role;

COMMENT ON TABLE public.courses IS 'Academic courses offered by institution';

-- ============================================================================
-- ENROLLMENTS TABLE (from migration 20260810231500)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrollments (
  enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_date DATE NOT NULL,
  enrollment_status TEXT NOT NULL DEFAULT 'pending' CHECK (enrollment_status IN ('pending', 'enrolled', 'completed', 'dropped', 'withdrawn')),
  grade TEXT,
  grade_points NUMERIC(3,2),
  completion_date DATE,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID,
  CONSTRAINT fk_enrollments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT check_grade_points CHECK (grade_points IS NULL OR (grade_points >= 0 AND grade_points <= 4.0)),
  CONSTRAINT check_completion_date CHECK (completion_date IS NULL OR completion_date >= enrollment_date)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant ON public.enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(enrollment_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_unique ON public.enrollments(tenant_id, student_id, course_id);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON public.enrollments;
CREATE POLICY tenant_isolation_policy ON public.enrollments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

DROP TRIGGER IF EXISTS set_updated_at ON public.enrollments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO service_role;

COMMENT ON TABLE public.enrollments IS 'Student enrollments in courses';

-- ============================================================================
-- ATTENDANCES TABLE (from migration 20260810235000)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.attendances (
  attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_id UUID,
  session_date DATE NOT NULL,
  session_number INTEGER,
  session_type TEXT CHECK (session_type IN ('lecture', 'lab', 'tutorial', 'exam', 'workshop', 'seminar')),
  session_duration INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('present', 'absent', 'late', 'excused', 'pending')),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  minutes_late INTEGER CHECK (minutes_late >= 0),
  notes TEXT,
  excuse_reason TEXT,
  excuse_document_url TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID,
  CONSTRAINT fk_attendances_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_student FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_course FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_enrollment FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON DELETE SET NULL,
  CONSTRAINT check_out_after_check_in CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time > check_in_time)
);

CREATE INDEX IF NOT EXISTS idx_attendances_tenant ON public.attendances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendances_student ON public.attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_course ON public.attendances(course_id);
CREATE INDEX IF NOT EXISTS idx_attendances_enrollment ON public.attendances(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendances_session_date ON public.attendances(session_date);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON public.attendances(status);
CREATE INDEX IF NOT EXISTS idx_attendances_student_course ON public.attendances(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_attendances_course_date ON public.attendances(course_id, session_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_unique_session 
  ON public.attendances(tenant_id, student_id, course_id, session_date, COALESCE(session_number, 0));

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON public.attendances;
CREATE POLICY tenant_isolation_policy ON public.attendances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

DROP TRIGGER IF EXISTS set_updated_at ON public.attendances;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO service_role;

COMMENT ON TABLE public.attendances IS 'Student attendance records for course sessions';

-- ============================================================================
-- VERIFY TABLES CREATED
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'courses') THEN
    RAISE NOTICE '✅ courses table created successfully';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'enrollments') THEN
    RAISE NOTICE '✅ enrollments table created successfully';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendances') THEN
    RAISE NOTICE '✅ attendances table created successfully';
  END IF;
END $$;
