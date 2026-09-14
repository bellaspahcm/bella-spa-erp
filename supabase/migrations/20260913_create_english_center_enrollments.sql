-- ============================================================================
-- E2 — ENGLISH CENTER ENROLLMENTS EXTENSION
-- ============================================================================
-- Product: Bella English Center
-- Phase: E2
-- Purpose: Branch/program/class context for Education OS enrollments
-- Architecture: Product extension via FK to Platform edu_enrollments
-- Compliance: Education OS Constitution v1.0
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: english_center_enrollments
-- Ownership: English Center Product
-- Canonical Source: edu_enrollments (Platform Education OS)
-- Relationship: 1:1 extension (FK to canonical)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.english_center_enrollments (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation (MANDATORY for all Product tables)
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Canonical enrollment link (1:1 relationship)
  canonical_enrollment_id UUID NOT NULL UNIQUE
    REFERENCES public.edu_enrollments(id) ON DELETE CASCADE,

  -- Branch context (which English Center branch)
  branch_id UUID NOT NULL
    REFERENCES public.org_units(id) ON DELETE RESTRICT,

  -- Program context (English program if defined)
  program_id UUID
    REFERENCES public.english_programs(id) ON DELETE SET NULL,

  -- Class assignment (if student assigned to specific class)
  class_id UUID
    REFERENCES public.english_classes(id) ON DELETE SET NULL,

  -- Intake/cohort identifier
  intake VARCHAR(100),

  -- Placement test result / English level at enrollment
  english_level_at_enrollment VARCHAR(50),

  -- Additional English Center–specific metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraint: canonical enrollment must belong to same tenant
  CONSTRAINT fk_english_enrollment_tenant_match
    CHECK (tenant_id IS NOT NULL)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Tenant isolation index (MANDATORY for all Product tables)
CREATE INDEX idx_english_enrollments_tenant
  ON public.english_center_enrollments(tenant_id);

-- Branch scope index (filter by branch)
CREATE INDEX idx_english_enrollments_branch
  ON public.english_center_enrollments(branch_id);

-- Canonical enrollment lookup (enforces UNIQUE)
CREATE INDEX idx_english_enrollments_canonical
  ON public.english_center_enrollments(canonical_enrollment_id);

-- Program filter index
CREATE INDEX idx_english_enrollments_program
  ON public.english_center_enrollments(program_id)
  WHERE program_id IS NOT NULL;

-- Class filter index
CREATE INDEX idx_english_enrollments_class
  ON public.english_center_enrollments(class_id)
  WHERE class_id IS NOT NULL;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.english_center_enrollments ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant isolation (users can only access their tenant's enrollments)
CREATE POLICY english_enrollments_tenant_isolation
  ON public.english_center_enrollments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Policy: Branch scope isolation (users can only access branches they have access to)
CREATE POLICY english_enrollments_branch_scope
  ON public.english_center_enrollments
  FOR ALL
  USING (
    branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
        AND tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID
    )
  );

-- ============================================================================
-- TRIGGER: Updated timestamp
-- ============================================================================

CREATE TRIGGER trg_english_enrollments_updated_at
  BEFORE UPDATE ON public.english_center_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.english_center_enrollments IS
  'E2 — English Center enrollment extensions. 1:1 link to Platform edu_enrollments. Stores branch/program/class context.';

COMMENT ON COLUMN public.english_center_enrollments.canonical_enrollment_id IS
  'FK to Platform edu_enrollments. Canonical enrollment source of truth. UNIQUE enforces 1:1.';

COMMENT ON COLUMN public.english_center_enrollments.branch_id IS
  'Which English Center branch student enrolled at. Required for branch-scope isolation.';

COMMENT ON COLUMN public.english_center_enrollments.program_id IS
  'English program (e.g., General English, Business English, IELTS). NULL if not yet assigned.';

COMMENT ON COLUMN public.english_center_enrollments.class_id IS
  'Assigned class. NULL if student not yet placed in specific class.';

COMMENT ON COLUMN public.english_center_enrollments.intake IS
  'Cohort/intake identifier (e.g., "2026-Q3", "September 2026").';

COMMENT ON COLUMN public.english_center_enrollments.english_level_at_enrollment IS
  'Placement test result or assessed level at enrollment (e.g., "A1", "B2", "Intermediate").';

COMMIT;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP TABLE IF EXISTS public.english_center_enrollments CASCADE;
-- ============================================================================
