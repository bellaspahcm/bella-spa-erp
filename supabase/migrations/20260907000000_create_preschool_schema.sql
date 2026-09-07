-- ============================================================================
-- Bella Preschool — Schema Foundation
-- Creates core tables for preschool/kindergarten management
-- Phase 1: Student → Guardian → Classroom → Enrollment → Attendance
-- ============================================================================

-- ============================================================================
-- 1. PRESCHOOL STUDENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.preschool_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Student identity
  student_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  
  -- Enrollment
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'graduated')),
  
  -- Additional info
  photo_url TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT preschool_students_unique_code_per_tenant UNIQUE (tenant_id, student_code)
);

COMMENT ON TABLE public.preschool_students IS 'Preschool students (children aged 3-6 years)';
COMMENT ON COLUMN public.preschool_students.student_code IS 'Unique student identifier per tenant (e.g., PS-2026-001)';

-- ============================================================================
-- 2. PRESCHOOL STUDENT-GUARDIAN RELATIONSHIPS
-- ============================================================================
-- Reuses existing customers table for guardian contact info
-- This table tracks which customers are guardians for which students

CREATE TABLE IF NOT EXISTS public.preschool_student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Relationships
  student_id UUID NOT NULL REFERENCES public.preschool_students(id) ON DELETE CASCADE,
  guardian_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Guardian role
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'grandparent', 'guardian', 'other')),
  is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
  is_authorized_pickup BOOLEAN NOT NULL DEFAULT TRUE,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT preschool_student_guardians_unique_pair UNIQUE (student_id, guardian_customer_id)
);

COMMENT ON TABLE public.preschool_student_guardians IS 'Links preschool students to their guardians (stored in customers table)';
COMMENT ON COLUMN public.preschool_student_guardians.guardian_customer_id IS 'References customers table — guardian contact info stored there';

-- ============================================================================
-- 3. PRESCHOOL CLASSROOMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.preschool_classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Classroom identity
  classroom_name TEXT NOT NULL,
  classroom_code TEXT,
  
  -- Capacity
  age_group TEXT, -- e.g., "3-4 years", "4-5 years"
  capacity INTEGER CHECK (capacity > 0),
  
  -- Teacher assignment
  lead_teacher_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assistant_teacher_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Additional info
  room_location TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT preschool_classrooms_unique_name_per_tenant UNIQUE (tenant_id, classroom_name)
);

COMMENT ON TABLE public.preschool_classrooms IS 'Preschool classroom groups';

-- ============================================================================
-- 4. PRESCHOOL ENROLLMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.preschool_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Enrollment relationship
  student_id UUID NOT NULL REFERENCES public.preschool_students(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.preschool_classrooms(id) ON DELETE CASCADE,
  
  -- Enrollment period
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'completed', 'withdrawn')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT preschool_enrollments_valid_dates CHECK (end_date IS NULL OR end_date >= enrollment_date)
);

COMMENT ON TABLE public.preschool_enrollments IS 'Student enrollment in classrooms (tracks classroom assignments over time)';

-- ============================================================================
-- 5. PRESCHOOL ATTENDANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.preschool_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Attendance record
  student_id UUID NOT NULL REFERENCES public.preschool_students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Check-in/out times
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  
  -- Who performed check-in/out
  checked_in_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  checked_out_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Pickup authorization
  picked_up_by_guardian_id UUID REFERENCES public.preschool_student_guardians(id) ON DELETE SET NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('absent', 'checked_in', 'checked_out')),
  absence_reason TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT preschool_attendance_unique_student_date UNIQUE (tenant_id, student_id, attendance_date),
  CONSTRAINT preschool_attendance_valid_times CHECK (check_out_time IS NULL OR check_out_time >= check_in_time)
);

COMMENT ON TABLE public.preschool_attendance IS 'Daily attendance tracking (check-in/check-out)';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Students
CREATE INDEX IF NOT EXISTS idx_preschool_students_tenant_status 
  ON public.preschool_students(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_preschool_students_tenant_name 
  ON public.preschool_students(tenant_id, last_name, first_name) WHERE deleted_at IS NULL;

-- Guardians
CREATE INDEX IF NOT EXISTS idx_preschool_guardians_student 
  ON public.preschool_student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_preschool_guardians_customer 
  ON public.preschool_student_guardians(guardian_customer_id);

-- Classrooms
CREATE INDEX IF NOT EXISTS idx_preschool_classrooms_tenant_active 
  ON public.preschool_classrooms(tenant_id, is_active) WHERE deleted_at IS NULL;

-- Enrollments
CREATE INDEX IF NOT EXISTS idx_preschool_enrollments_student 
  ON public.preschool_enrollments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_preschool_enrollments_classroom 
  ON public.preschool_enrollments(classroom_id, status);
CREATE INDEX IF NOT EXISTS idx_preschool_enrollments_tenant_active 
  ON public.preschool_enrollments(tenant_id, status);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_preschool_attendance_student_date 
  ON public.preschool_attendance(student_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_preschool_attendance_tenant_date 
  ON public.preschool_attendance(tenant_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_preschool_attendance_date_status 
  ON public.preschool_attendance(attendance_date, status);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.preschool_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschool_attendance ENABLE ROW LEVEL SECURITY;

-- Students: Tenant isolation
DROP POLICY IF EXISTS "preschool_students_tenant_isolation" ON public.preschool_students;
CREATE POLICY "preschool_students_tenant_isolation"
  ON public.preschool_students
  FOR ALL TO authenticated
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id())
  WITH CHECK (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());

-- Student Guardians: Tenant isolation
DROP POLICY IF EXISTS "preschool_guardians_tenant_isolation" ON public.preschool_student_guardians;
CREATE POLICY "preschool_guardians_tenant_isolation"
  ON public.preschool_student_guardians
  FOR ALL TO authenticated
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id())
  WITH CHECK (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());

-- Classrooms: Tenant isolation
DROP POLICY IF EXISTS "preschool_classrooms_tenant_isolation" ON public.preschool_classrooms;
CREATE POLICY "preschool_classrooms_tenant_isolation"
  ON public.preschool_classrooms
  FOR ALL TO authenticated
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id())
  WITH CHECK (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());

-- Enrollments: Tenant isolation
DROP POLICY IF EXISTS "preschool_enrollments_tenant_isolation" ON public.preschool_enrollments;
CREATE POLICY "preschool_enrollments_tenant_isolation"
  ON public.preschool_enrollments
  FOR ALL TO authenticated
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id())
  WITH CHECK (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());

-- Attendance: Tenant isolation
DROP POLICY IF EXISTS "preschool_attendance_tenant_isolation" ON public.preschool_attendance;
CREATE POLICY "preschool_attendance_tenant_isolation"
  ON public.preschool_attendance
  FOR ALL TO authenticated
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id())
  WITH CHECK (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());

-- Anonymous read access for public-facing pages (if needed)
DROP POLICY IF EXISTS "preschool_students_anon_view" ON public.preschool_students;
CREATE POLICY "preschool_students_anon_view"
  ON public.preschool_students
  FOR SELECT TO anon
  USING (public.get_auth_tenant_id() IS NOT NULL AND tenant_id = public.get_auth_tenant_id());

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preschool_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preschool_student_guardians TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preschool_classrooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preschool_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.preschool_attendance TO authenticated;

GRANT SELECT ON public.preschool_students TO anon;
GRANT SELECT ON public.preschool_classrooms TO anon;
