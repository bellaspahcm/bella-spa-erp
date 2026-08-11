-- ============================================================================
-- Education Platform - Courses and Enrollments Tables
-- ============================================================================
-- Migration: 20260810231500_create_courses_and_enrollments
-- Description: Create courses and enrollments tables with FK constraints
-- 
-- Constitution Compliance:
-- - Law 4: Additive only
-- - Law 11: Strict typing
-- - Law 1: Enrollment references Student + Course
-- ============================================================================

-- ============================================================================
-- 1. COURSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL CHECK (credits > 0),
  duration_weeks INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  CONSTRAINT courses_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT courses_course_code_unique UNIQUE (tenant_id, course_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_tenant_id ON public.courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_course_code ON public.courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);

-- RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses' AND policyname = 'courses_tenant_isolation') THEN
    CREATE POLICY courses_tenant_isolation ON public.courses FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- Trigger
CREATE OR REPLACE FUNCTION update_courses_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_courses_updated_at ON public.courses;
CREATE TRIGGER trigger_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION update_courses_updated_at();

-- ============================================================================
-- 2. ENROLLMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_date DATE NOT NULL,
  completion_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'withdrawn', 'failed', 'suspended')),
  grade TEXT,
  grade_points NUMERIC(5,2) CHECK (grade_points >= 0 AND grade_points <= 100),
  grade_status TEXT NOT NULL DEFAULT 'not_graded' CHECK (grade_status IN ('not_graded', 'in_progress', 'graded', 'pass', 'fail')),
  credits_earned INTEGER CHECK (credits_earned >= 0),
  attendance_percentage NUMERIC(5,2) CHECK (attendance_percentage >= 0 AND attendance_percentage <= 100),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  CONSTRAINT enrollments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT enrollments_student_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT enrollments_course_fk FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
  CONSTRAINT enrollments_student_course_unique UNIQUE (tenant_id, student_id, course_id),
  CONSTRAINT enrollments_dates_check CHECK (completion_date IS NULL OR completion_date >= enrollment_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_id ON public.enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrollment_date ON public.enrollments(enrollment_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant_status ON public.enrollments(tenant_id, status);

-- RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'enrollments' AND policyname = 'enrollments_tenant_isolation') THEN
    CREATE POLICY enrollments_tenant_isolation ON public.enrollments FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- Trigger
CREATE OR REPLACE FUNCTION update_enrollments_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enrollments_updated_at ON public.enrollments;
CREATE TRIGGER trigger_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION update_enrollments_updated_at();

-- ============================================================================
-- NOTIFY PostgREST
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- END
-- ============================================================================
