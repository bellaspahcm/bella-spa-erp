-- Migration: Create Education OS Reuse Proof Schema (CC-3.1)
-- Date: 2026-08-12
-- Target: edu_courses and edu_enrollments tables with ON DELETE RESTRICT conventions

-- 1. Courses Table
CREATE TABLE IF NOT EXISTS public.edu_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  course_code TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_edu_courses_code UNIQUE (tenant_id, course_code)
);

-- 2. Enrollments Table
-- Business Assumption (CC-3 POC): UNIQUE (tenant_id, student_party_id, course_id) prevents simultaneous duplicate active enrollments per course per student.
CREATE TABLE IF NOT EXISTS public.edu_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.edu_courses(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_edu_enrollments_student_course UNIQUE (tenant_id, student_party_id, course_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_edu_courses_tenant ON public.edu_courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edu_enrollments_tenant ON public.edu_enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edu_enrollments_student ON public.edu_enrollments(student_party_id);
CREATE INDEX IF NOT EXISTS idx_edu_enrollments_course ON public.edu_enrollments(course_id);

-- Enable RLS
ALTER TABLE public.edu_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_enrollments ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation RLS Policies
DROP POLICY IF EXISTS edu_courses_tenant_isolation ON public.edu_courses;
CREATE POLICY edu_courses_tenant_isolation ON public.edu_courses
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS edu_enrollments_tenant_isolation ON public.edu_enrollments;
CREATE POLICY edu_enrollments_tenant_isolation ON public.edu_enrollments
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
