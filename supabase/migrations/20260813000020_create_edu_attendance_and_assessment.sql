-- Migration: Create edu_attendance and public.edu_assessments tables (CC-3.1)
-- Date: 2026-08-13

-- 1. Attendance Table
CREATE TABLE public.edu_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  roll_call_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Assessments Table
CREATE TABLE public.edu_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  score_type TEXT NOT NULL CHECK (score_type IN ('quiz', 'midterm', 'final', 'homework')),
  grade NUMERIC(5, 2) NOT NULL,
  weight NUMERIC(3, 2) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_edu_attendance_tenant ON public.edu_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edu_attendance_enrollment ON public.edu_attendance(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_edu_assessments_tenant ON public.edu_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edu_assessments_enrollment ON public.edu_assessments(enrollment_id);

-- Enable RLS
ALTER TABLE public.edu_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_assessments ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS edu_attendance_tenant_isolation ON public.edu_attendance;
CREATE POLICY edu_attendance_tenant_isolation ON public.edu_attendance
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS edu_assessments_tenant_isolation ON public.edu_assessments;
CREATE POLICY edu_assessments_tenant_isolation ON public.edu_assessments
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
