-- ============================================================================
-- Education Platform - Students Table Schema Migration (Additive)
-- ============================================================================
-- Migration: 20260810224418_migrate_students_to_platform_schema
-- Description: Add Platform DDD columns to existing students table
--
-- Constitution Compliance:
-- - Law 4: Additive only (no breaking changes, no DROP of legacy columns)
-- - Law 11: No `any` types (strict JSONB schemas)
-- - Law 1: Student references Person aggregate root
--
-- Context:
-- The existing students table has a legacy schema (user_id, full_name, etc.)
-- This migration adds the new Platform-compatible columns alongside legacy ones.
-- New code uses new columns; old app code continues to use legacy columns.
-- ============================================================================

-- Add platform DDD columns (IF NOT EXISTS = safe to re-run)

-- Person reference (aggregate root for identity)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS person_id UUID;

-- Student-specific identity fields
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_code TEXT;

-- Academic lifecycle fields
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS academic_status TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS enrollment_type TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS program_id TEXT;

-- Academic dates
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS enrollment_date DATE;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS expected_graduation_date DATE;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS actual_graduation_date DATE;

-- Academic info
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS current_level TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS gpa NUMERIC(3,2);

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS total_credits INTEGER;

-- Emergency contact (student-specific)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

-- Metadata extensions
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Audit fields (created_by / updated_by as UUID if not present)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- ============================================================================
-- Add Platform FK: person_id → persons.id
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'students_person_fk'
    AND conrelid = 'public.students'::regclass
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_person_fk
      FOREIGN KEY (person_id)
      REFERENCES public.persons(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- Add unique constraint on (tenant_id, student_code)
-- Only when both columns have values (partial for NULLs)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS students_tenant_student_code_unique
  ON public.students(tenant_id, student_code)
  WHERE student_code IS NOT NULL;

-- ============================================================================
-- Indexes for new columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_person_id ON public.students(person_id);
CREATE INDEX IF NOT EXISTS idx_students_student_code ON public.students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_academic_status ON public.students(academic_status);
CREATE INDEX IF NOT EXISTS idx_students_program_id ON public.students(program_id);
CREATE INDEX IF NOT EXISTS idx_students_enrollment_date ON public.students(enrollment_date);

-- ============================================================================
-- GIN index for metadata searches
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_students_metadata ON public.students USING GIN (metadata);

-- ============================================================================
-- Service role policy (allow service role to bypass RLS)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'students'
    AND policyname = 'students_service_role'
  ) THEN
    CREATE POLICY students_service_role ON public.students
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT
  'students' AS table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'students' AND table_schema = 'public') AS total_column_count;
