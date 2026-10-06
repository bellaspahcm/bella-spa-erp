-- ============================================================================
-- Preschool Chain Assignments
-- ============================================================================
-- Product-owned additive persistence for Preschool customer/branch chain proof.
--
-- Boundary:
--   - Platform owns org_units / org_relationships.
--   - Education Kernel owns edu_courses / edu_enrollments.
--   - Bella Education product owns Preschool branch assignment for product flows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.preschool_chain_course_branch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.edu_courses(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  assigned_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_preschool_chain_course_branch_assignment UNIQUE (tenant_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_preschool_chain_course_branch_assignments_tenant_branch
  ON public.preschool_chain_course_branch_assignments(tenant_id, branch_id);

CREATE TABLE IF NOT EXISTS public.preschool_chain_enrollment_branch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.edu_enrollments(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.edu_courses(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  assigned_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_preschool_chain_enrollment_branch_assignment UNIQUE (tenant_id, enrollment_id),
  CONSTRAINT uq_preschool_chain_enrollment_branch_request UNIQUE (tenant_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_preschool_chain_enrollment_branch_assignments_tenant_branch
  ON public.preschool_chain_enrollment_branch_assignments(tenant_id, branch_id);

ALTER TABLE public.preschool_chain_course_branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_chain_enrollment_branch_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS preschool_chain_course_branch_assignments_tenant_isolation
  ON public.preschool_chain_course_branch_assignments;
CREATE POLICY preschool_chain_course_branch_assignments_tenant_isolation
  ON public.preschool_chain_course_branch_assignments
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS preschool_chain_enrollment_branch_assignments_tenant_isolation
  ON public.preschool_chain_enrollment_branch_assignments;
CREATE POLICY preschool_chain_enrollment_branch_assignments_tenant_isolation
  ON public.preschool_chain_enrollment_branch_assignments
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.preschool_chain_course_branch_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.preschool_chain_enrollment_branch_assignments TO authenticated, service_role;

COMMENT ON TABLE public.preschool_chain_course_branch_assignments IS
  'Bella Education product-owned course-to-branch assignment for Preschool chain proof.';

COMMENT ON TABLE public.preschool_chain_enrollment_branch_assignments IS
  'Bella Education product-owned enrollment-to-branch assignment for Preschool chain proof.';
