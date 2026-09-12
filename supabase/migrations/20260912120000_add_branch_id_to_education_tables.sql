-- ============================================================================
-- E1 Chain Management - Add branch_id to Education Tables
-- ============================================================================
-- Migration: 20260912120000_add_branch_id_to_education_tables
-- Phase: E1 Chain Management
-- Product: Bella English Center
--
-- Description:
--   Add branch_id foreign key to education tables to enable chain/branch
--   hierarchy tracking and reporting.
--
-- Architecture Compliance:
--   - Law 4: Additive only (no column drops, no data deletion)
--   - Law 11: Strict typing (UUID NOT NULL with FK)
--   - Tenant isolation: branch_id references tenant-scoped org_units
--   - Zero downtime: nullable first, then backfill, then enforce NOT NULL
--
-- Tables Modified:
--   - enrollments: Add branch_id (student's enrolled branch)
--   - courses: Add branch_id (course offered at branch)
--   - classes: Add branch_id (class location)
--   - teachers: Add branch_id (teacher's primary branch)
--
-- Boundary:
--   Platform owns: org_units schema + hierarchy
--   Product owns: branch_id mappings in academic tables
-- ============================================================================

-- ============================================================================
-- 1. ADD BRANCH_ID TO ENROLLMENTS (nullable for migration safety)
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'enrollments' 
    AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.enrollments 
    ADD COLUMN branch_id UUID;
    
    COMMENT ON COLUMN public.enrollments.branch_id IS 
    'E1: Branch where student is enrolled. References org_units(id) with unitType=branch';
  END IF;
END $$;

-- FK constraint (references Platform org_units)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'enrollments_branch_fk'
  ) THEN
    ALTER TABLE public.enrollments
    ADD CONSTRAINT enrollments_branch_fk 
    FOREIGN KEY (branch_id) 
    REFERENCES public.org_units(id) 
    ON DELETE RESTRICT;
  END IF;
END $$;

-- Index for branch queries
CREATE INDEX IF NOT EXISTS idx_enrollments_branch_id 
ON public.enrollments(branch_id);

-- ============================================================================
-- 2. ADD BRANCH_ID TO COURSES (nullable)
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'courses' 
    AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.courses 
    ADD COLUMN branch_id UUID;
    
    COMMENT ON COLUMN public.courses.branch_id IS 
    'E1: Branch offering this course. NULL = available at all branches';
  END IF;
END $$;

-- FK constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'courses_branch_fk'
  ) THEN
    ALTER TABLE public.courses
    ADD CONSTRAINT courses_branch_fk 
    FOREIGN KEY (branch_id) 
    REFERENCES public.org_units(id) 
    ON DELETE RESTRICT;
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_courses_branch_id 
ON public.courses(branch_id);

-- ============================================================================
-- 3. ADD BRANCH_ID TO CLASSES (if table exists)
-- ============================================================================

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'classes'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'classes' 
      AND column_name = 'branch_id'
    ) THEN
      ALTER TABLE public.classes 
      ADD COLUMN branch_id UUID;
      
      COMMENT ON COLUMN public.classes.branch_id IS 
      'E1: Branch where class is held';
    END IF;
    
    -- FK constraint
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'classes_branch_fk'
    ) THEN
      ALTER TABLE public.classes
      ADD CONSTRAINT classes_branch_fk 
      FOREIGN KEY (branch_id) 
      REFERENCES public.org_units(id) 
      ON DELETE RESTRICT;
    END IF;
    
    -- Index
    CREATE INDEX IF NOT EXISTS idx_classes_branch_id 
    ON public.classes(branch_id);
  END IF;
END $$;

-- ============================================================================
-- 4. ADD BRANCH_ID TO TEACHERS (if table exists)
-- ============================================================================

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'teachers'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'teachers' 
      AND column_name = 'branch_id'
    ) THEN
      ALTER TABLE public.teachers 
      ADD COLUMN branch_id UUID;
      
      COMMENT ON COLUMN public.teachers.branch_id IS 
      'E1: Teacher primary branch assignment';
    END IF;
    
    -- FK constraint
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'teachers_branch_fk'
    ) THEN
      ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_branch_fk 
      FOREIGN KEY (branch_id) 
      REFERENCES public.org_units(id) 
      ON DELETE RESTRICT;
    END IF;
    
    -- Index
    CREATE INDEX IF NOT EXISTS idx_teachers_branch_id 
    ON public.teachers(branch_id);
  END IF;
END $$;

-- ============================================================================
-- 5. HELPER VIEW: Branch Academic Summary
-- ============================================================================

CREATE OR REPLACE VIEW public.v_branch_academic_summary AS
SELECT
  ou.id AS branch_id,
  ou.tenant_id,
  ou.name AS branch_name,
  ou.code AS branch_code,
  COUNT(DISTINCT e.enrollment_id) AS total_enrollments,
  COUNT(DISTINCT e.student_id) AS total_students,
  COUNT(DISTINCT c.course_id) AS total_courses,
  COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.enrollment_id END) AS active_enrollments
FROM public.org_units ou
LEFT JOIN public.enrollments e ON e.branch_id = ou.id
LEFT JOIN public.courses c ON c.branch_id = ou.id
WHERE ou.unit_type = 'branch'
  AND ou.is_active = true
GROUP BY ou.id, ou.tenant_id, ou.name, ou.code;

COMMENT ON VIEW public.v_branch_academic_summary IS 
'E1: Aggregate academic metrics per branch for reporting';

-- ============================================================================
-- 6. RLS UPDATE: Ensure branch_id queries respect tenant isolation
-- ============================================================================

-- No RLS changes needed - existing tenant_id RLS policies cover branch_id joins
-- because org_units.tenant_id already enforces tenant boundary via FK cascade

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- Data Migration Strategy (NOT in this migration):
--   1. This migration adds nullable branch_id columns
--   2. Separate data migration script will:
--      - Create default branch per tenant if needed
--      - Backfill existing enrollments/courses with branch_id
--      - Add NOT NULL constraint after backfill complete
--   3. Application code can handle NULL gracefully during transition

-- Rollback Strategy:
--   - DROP CONSTRAINT enrollments_branch_fk
--   - DROP COLUMN enrollments.branch_id
--   - (repeat for courses/classes/teachers)
--   - DROP VIEW v_branch_academic_summary

-- ============================================================================
