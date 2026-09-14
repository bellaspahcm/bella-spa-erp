-- ============================================================================
-- E3 — ENGLISH CENTER PROGRAM / COURSE / CLASS
-- ============================================================================
-- Product: Bella English Center
-- Phase: E3
-- Purpose: Program catalog, course catalog, class management
-- Architecture: Product-level entities (no Platform dependency for now)
-- Compliance: Education OS Constitution v1.0
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: english_center_programs
-- Ownership: English Center Product
-- Purpose: Program catalog (General English, Business English, IELTS, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.english_center_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_program_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_programs_tenant ON public.english_center_programs(tenant_id);
CREATE INDEX idx_programs_code ON public.english_center_programs(code);
CREATE INDEX idx_programs_status ON public.english_center_programs(status) WHERE status = 'active';

-- ============================================================================
-- TABLE: english_center_courses
-- Ownership: English Center Product
-- Purpose: Course catalog within programs (levels, durations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.english_center_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.english_center_programs(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  level VARCHAR(50),
  duration_hours INTEGER,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_course_code UNIQUE (tenant_id, program_id, code)
);

CREATE INDEX idx_courses_tenant ON public.english_center_courses(tenant_id);
CREATE INDEX idx_courses_program ON public.english_center_courses(program_id);
CREATE INDEX idx_courses_status ON public.english_center_courses(status) WHERE status = 'active';

-- ============================================================================
-- TABLE: english_center_classes
-- Ownership: English Center Product
-- Purpose: Class instances (scheduling, capacity, teacher assignment)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.english_center_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES public.english_center_courses(id) ON DELETE RESTRICT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 20 CHECK (capacity > 0),
  enrolled_count INTEGER NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  teacher_id UUID REFERENCES public.party_parties(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  schedule_days VARCHAR[],
  schedule_time VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_class_code UNIQUE (tenant_id, branch_id, code),
  CONSTRAINT chk_capacity CHECK (enrolled_count <= capacity),
  CONSTRAINT chk_dates CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE INDEX idx_classes_tenant ON public.english_center_classes(tenant_id);
CREATE INDEX idx_classes_branch ON public.english_center_classes(branch_id);
CREATE INDEX idx_classes_course ON public.english_center_classes(course_id);
CREATE INDEX idx_classes_teacher ON public.english_center_classes(teacher_id) WHERE teacher_id IS NOT NULL;
CREATE INDEX idx_classes_status ON public.english_center_classes(status);
CREATE INDEX idx_classes_dates ON public.english_center_classes(start_date, end_date) WHERE status = 'active';

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.english_center_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.english_center_classes ENABLE ROW LEVEL SECURITY;

-- Programs: Tenant isolation
CREATE POLICY programs_tenant_isolation
  ON public.english_center_programs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Courses: Tenant isolation
CREATE POLICY courses_tenant_isolation
  ON public.english_center_courses
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Classes: Tenant + branch scope isolation
CREATE POLICY classes_tenant_isolation
  ON public.english_center_classes
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY classes_branch_scope
  ON public.english_center_classes
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
-- TRIGGERS: Updated timestamp
-- ============================================================================

CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON public.english_center_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.english_center_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON public.english_center_classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.english_center_programs IS
  'E3 — English Center program catalog (General English, Business English, IELTS, TOEIC)';

COMMENT ON TABLE public.english_center_courses IS
  'E3 — English Center course catalog within programs (levels, durations)';

COMMENT ON TABLE public.english_center_classes IS
  'E3 — English Center class instances (scheduling, capacity, teacher assignment)';

COMMIT;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP TABLE IF EXISTS public.english_center_classes CASCADE;
-- DROP TABLE IF EXISTS public.english_center_courses CASCADE;
-- DROP TABLE IF EXISTS public.english_center_programs CASCADE;
-- ============================================================================
