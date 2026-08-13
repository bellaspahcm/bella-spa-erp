-- Migration: Create assessments and assessment_results tables (CC-3.1)
-- Date: 2026-08-13

CREATE TABLE IF NOT EXISTS public.assessments (
  assessment_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.courses(course_id) ON DELETE RESTRICT,
  assessment_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('exam', 'quiz', 'assignment', 'project', 'presentation')),
  max_score NUMERIC(5, 2) NOT NULL,
  passing_score NUMERIC(5, 2) NOT NULL,
  weight NUMERIC(5, 2) NOT NULL,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'graded', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT uq_assessments_code UNIQUE (tenant_id, assessment_code)
);

CREATE TABLE IF NOT EXISTS public.assessment_results (
  result_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  assessment_id UUID NOT NULL REFERENCES public.assessments(assessment_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  score NUMERIC(5, 2),
  grade TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  feedback TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'submitted', 'graded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assessment_results_student UNIQUE (tenant_id, assessment_id, student_id)
);

-- Enable RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS assessments_tenant_isolation ON public.assessments;
CREATE POLICY assessments_tenant_isolation ON public.assessments
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

DROP POLICY IF EXISTS assessment_results_tenant_isolation ON public.assessment_results;
CREATE POLICY assessment_results_tenant_isolation ON public.assessment_results
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- Grant privileges for authenticated and service_role
GRANT ALL ON public.assessments TO authenticated, service_role;
GRANT ALL ON public.assessment_results TO authenticated, service_role;
