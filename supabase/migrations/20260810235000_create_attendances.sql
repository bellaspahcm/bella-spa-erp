-- ============================================================================
-- Attendance Table Migration
-- 
-- Pattern: Inherited from Student/Enrollment/Course migrations
-- Constitution Compliance: Law 4 (Additive migrations only)
-- ============================================================================

-- Create attendances table
CREATE TABLE IF NOT EXISTS public.attendances (
  -- Primary key
  attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Foreign keys
  student_id UUID NOT NULL,
  course_id UUID NOT NULL,
  enrollment_id UUID,
  
  -- Session details
  session_date DATE NOT NULL,
  session_number INTEGER,
  session_type TEXT CHECK (session_type IN ('lecture', 'lab', 'tutorial', 'exam', 'workshop', 'seminar')),
  session_duration INTEGER, -- minutes
  
  -- Attendance tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('present', 'absent', 'late', 'excused', 'pending')),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  minutes_late INTEGER CHECK (minutes_late >= 0),
  
  -- Notes and excuses
  notes TEXT,
  excuse_reason TEXT,
  excuse_document_url TEXT,
  
  -- Verification
  verified_by UUID, -- User UUID who verified
  verified_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL,
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT fk_attendances_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_student FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_course FOREIGN KEY (course_id) REFERENCES public.courses(course_id) ON DELETE CASCADE,
  CONSTRAINT fk_attendances_enrollment FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id) ON DELETE SET NULL,
  CONSTRAINT check_out_after_check_in CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time > check_in_time)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendances_tenant ON public.attendances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendances_student ON public.attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_course ON public.attendances(course_id);
CREATE INDEX IF NOT EXISTS idx_attendances_enrollment ON public.attendances(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendances_session_date ON public.attendances(session_date);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON public.attendances(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_attendances_student_course ON public.attendances(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_attendances_course_date ON public.attendances(course_id, session_date);

-- Unique constraint: one attendance record per student per course per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_unique_session 
  ON public.attendances(tenant_id, student_id, course_id, session_date, COALESCE(session_number, 0));

-- Enable Row Level Security
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access attendances from their tenant
CREATE POLICY tenant_isolation_policy ON public.attendances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendances TO service_role;

-- Comments
COMMENT ON TABLE public.attendances IS 'Student attendance records for course sessions';
COMMENT ON COLUMN public.attendances.attendance_id IS 'Primary key';
COMMENT ON COLUMN public.attendances.tenant_id IS 'Tenant isolation';
COMMENT ON COLUMN public.attendances.student_id IS 'Foreign key to students table';
COMMENT ON COLUMN public.attendances.course_id IS 'Foreign key to courses table';
COMMENT ON COLUMN public.attendances.enrollment_id IS 'Optional foreign key to enrollments table';
COMMENT ON COLUMN public.attendances.session_date IS 'Date of the course session';
COMMENT ON COLUMN public.attendances.status IS 'Attendance status: present, absent, late, excused, pending';
COMMENT ON COLUMN public.attendances.minutes_late IS 'Minutes late for late arrivals';
COMMENT ON COLUMN public.attendances.verified_by IS 'User UUID who verified attendance';
