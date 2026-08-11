-- ============================================================================
-- Education Platform - Students Table Migration
-- ============================================================================
-- Migration: 20260810224417_create_students_table
-- Description: Create students table with Person foreign key reference
-- 
-- Constitution Compliance:
-- - Law 4: Additive only (no breaking changes)
-- - Law 11: No `any` types (strict JSONB schemas)
-- - Law 1: Student references Person aggregate root
--
-- Architecture:
-- Student = academic role referencing Person for identity
-- Person (firstName, lastName, DOB) → Student (studentCode, academicStatus)
-- ============================================================================

-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Person reference (aggregate root for identity)
  person_id UUID NOT NULL,
  
  -- Student-specific fields
  student_code TEXT NOT NULL,
  academic_status TEXT NOT NULL CHECK (
    academic_status IN ('enrolled', 'on_leave', 'graduated', 'dropped_out', 'expelled')
  ),
  enrollment_type TEXT NOT NULL CHECK (
    enrollment_type IN ('full_time', 'part_time', 'online', 'hybrid')
  ),
  program_id TEXT NOT NULL,
  
  -- Academic dates
  enrollment_date DATE NOT NULL,
  expected_graduation_date DATE,
  actual_graduation_date DATE,
  
  -- Academic info
  current_level TEXT,
  gpa NUMERIC(3,2) CHECK (gpa >= 0 AND gpa <= 4.0),
  total_credits INTEGER CHECK (total_credits >= 0),
  
  -- Emergency contact (student-specific)
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Metadata (extensions)
  metadata JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT students_tenant_fk FOREIGN KEY (tenant_id) 
    REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT students_person_fk FOREIGN KEY (person_id) 
    REFERENCES public.persons(id) ON DELETE CASCADE,
  CONSTRAINT students_student_code_unique UNIQUE (tenant_id, student_code),
  CONSTRAINT students_enrollment_date_check CHECK (enrollment_date <= CURRENT_DATE),
  CONSTRAINT students_graduation_dates_check CHECK (
    expected_graduation_date IS NULL OR 
    expected_graduation_date > enrollment_date
  ),
  CONSTRAINT students_actual_graduation_check CHECK (
    actual_graduation_date IS NULL OR 
    actual_graduation_date >= enrollment_date
  )
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON public.students(tenant_id);

-- Person reference index (JOIN queries)
CREATE INDEX IF NOT EXISTS idx_students_person_id ON public.students(person_id);

-- Student code index (unique identifier lookup)
CREATE INDEX IF NOT EXISTS idx_students_student_code ON public.students(student_code);

-- Academic status index (filter active students)
CREATE INDEX IF NOT EXISTS idx_students_academic_status ON public.students(academic_status);

-- Program index (students per program)
CREATE INDEX IF NOT EXISTS idx_students_program_id ON public.students(program_id);

-- Enrollment date index (cohort queries)
CREATE INDEX IF NOT EXISTS idx_students_enrollment_date ON public.students(enrollment_date);

-- JSONB GIN index for metadata searches
CREATE INDEX IF NOT EXISTS idx_students_metadata ON public.students USING GIN (metadata);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON public.students(tenant_id, academic_status);
CREATE INDEX IF NOT EXISTS idx_students_tenant_program ON public.students(tenant_id, program_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access students in their tenant
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'students' 
    AND policyname = 'students_tenant_isolation'
  ) THEN
    CREATE POLICY students_tenant_isolation ON public.students
      FOR ALL
      USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- Policy: Service role can access all students
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
-- Triggers
-- ============================================================================

-- Trigger: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_students_updated_at ON public.students;

CREATE TRIGGER trigger_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION update_students_updated_at();

-- ============================================================================
-- Comments (Documentation)
-- ============================================================================

COMMENT ON TABLE public.students IS 'Students - academic role referencing Person for identity';
COMMENT ON COLUMN public.students.id IS 'Unique student identifier (UUID)';
COMMENT ON COLUMN public.students.tenant_id IS 'Tenant this student belongs to';
COMMENT ON COLUMN public.students.person_id IS 'Reference to Person identity aggregate (foreign key)';
COMMENT ON COLUMN public.students.student_code IS 'Unique student identifier (e.g., EDU-2024-001)';
COMMENT ON COLUMN public.students.academic_status IS 'Current academic status (enrolled, on_leave, graduated, dropped_out, expelled)';
COMMENT ON COLUMN public.students.enrollment_type IS 'Type of enrollment (full_time, part_time, online, hybrid)';
COMMENT ON COLUMN public.students.program_id IS 'Program the student is enrolled in';
COMMENT ON COLUMN public.students.enrollment_date IS 'Date student enrolled';
COMMENT ON COLUMN public.students.expected_graduation_date IS 'Expected graduation date';
COMMENT ON COLUMN public.students.actual_graduation_date IS 'Actual graduation date (when graduated)';
COMMENT ON COLUMN public.students.current_level IS 'Current academic level (Year 1, Semester 2, etc.)';
COMMENT ON COLUMN public.students.gpa IS 'Grade Point Average (0.0 - 4.0)';
COMMENT ON COLUMN public.students.total_credits IS 'Total credits earned';
COMMENT ON COLUMN public.students.emergency_contact_name IS 'Emergency contact name (student-specific)';
COMMENT ON COLUMN public.students.emergency_contact_phone IS 'Emergency contact phone';
COMMENT ON COLUMN public.students.emergency_contact_relationship IS 'Relationship to student';
COMMENT ON COLUMN public.students.metadata IS 'Tenant-specific extension fields (JSONB)';

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this after migration to verify table created successfully

SELECT 
  'students' AS table_name,
  COUNT(*) AS column_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'students') AS index_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'students') AS policy_count,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgrelid = 'public.students'::regclass) AS trigger_count,
  (SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'public.students'::regclass AND contype = 'f') AS foreign_key_count
FROM information_schema.columns 
WHERE table_name = 'students' AND table_schema = 'public';

-- Expected output:
-- table_name | column_count | index_count | policy_count | trigger_count | foreign_key_count
-- students   | 21           | 9           | 2            | 1             | 2

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
