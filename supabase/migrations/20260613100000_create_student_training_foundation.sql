-- Foundation for the Student Training expansion.
-- Creates tenant-scoped learning tables, keeps student users isolated from
-- operational ERP data through app routing and narrow RLS on training tables.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'ktv_lead', 'ktv', 'admin_staff', 'accountant', 'hr', 'student'));

ALTER TABLE public.tenants
  ALTER COLUMN enabled_modules SET DEFAULT '{"babycare": true, "beauty_spa": false, "student_training": false}'::jsonb;

UPDATE public.tenants
SET enabled_modules = COALESCE(enabled_modules, '{}'::jsonb) || '{"student_training": false}'::jsonb
WHERE NOT (COALESCE(enabled_modules, '{}'::jsonb) ? 'student_training');

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL DEFAULT 'student_training'
    CHECK (module_key = 'student_training'),
  title TEXT NOT NULL,
  description TEXT,
  specialty TEXT,
  tuition_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tuition_amount >= 0),
  theory_duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (theory_duration_minutes >= 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_modules_unique_order UNIQUE (course_id, sequence_order)
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'document'
    CHECK (content_type IN ('document', 'video', 'pdf', 'quiz', 'live_class')),
  content_url TEXT,
  body TEXT,
  sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
  required_view_seconds INTEGER NOT NULL DEFAULT 0 CHECK (required_view_seconds >= 0),
  required_view_percentage NUMERIC(5,2) NOT NULL DEFAULT 90 CHECK (required_view_percentage BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lessons_unique_order UNIQUE (module_id, sequence_order)
);

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  enrollment_status TEXT NOT NULL DEFAULT 'active'
    CHECK (enrollment_status IN ('active', 'paused', 'graduated', 'withdrawn')),
  tuition_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tuition_total >= 0),
  tuition_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tuition_paid >= 0),
  enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
  graduated_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT students_unique_user_course UNIQUE (user_id, course_id),
  CONSTRAINT students_paid_not_above_total CHECK (tuition_paid <= tuition_total)
);

CREATE TABLE IF NOT EXISTS public.student_tuition_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'bank_transfer', 'vietqr', 'card', 'other')),
  payment_status TEXT NOT NULL DEFAULT 'recorded'
    CHECK (payment_status IN ('recorded', 'voided')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  receipt_number TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_tuition_receipt_unique UNIQUE (tenant_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.student_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  view_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (view_percentage BETWEEN 0 AND 100),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_lesson_progress_unique UNIQUE (student_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.training_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  class_type TEXT NOT NULL DEFAULT 'practice'
    CHECK (class_type IN ('theory', 'practice', 'exam', 'orientation')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location_note TEXT,
  capacity INTEGER NOT NULL DEFAULT 12 CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.training_classes(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'present'
    CHECK (attendance_status IN ('present', 'excused_absent', 'absent')),
  checked_in_at TIMESTAMPTZ,
  checked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_class_attendance_unique UNIQUE (student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_courses_tenant_status
  ON public.courses (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_course_modules_course_order
  ON public.course_modules (course_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module_order
  ON public.lessons (module_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_students_tenant_status
  ON public.students (tenant_id, enrollment_status);
CREATE INDEX IF NOT EXISTS idx_students_user_id
  ON public.students (user_id);
CREATE INDEX IF NOT EXISTS idx_student_tuition_payments_student
  ON public.student_tuition_payments (student_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_lesson_progress_student
  ON public.student_lesson_progress (student_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_training_classes_tenant_time
  ON public.training_classes (tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_student_class_attendance_class
  ON public.student_class_attendance (class_id, attendance_status);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_tuition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_class_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Training courses read scoped tenant data" ON public.courses;
CREATE POLICY "Training courses read scoped tenant data"
  ON public.courses
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.course_id = courses.id
        AND s.user_id = auth.uid()
    )
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr', 'accountant')
      )
    )
  );

DROP POLICY IF EXISTS "Training courses admin manage scoped tenant data" ON public.courses;
CREATE POLICY "Training courses admin manage scoped tenant data"
  ON public.courses
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

DROP POLICY IF EXISTS "Students read own or scoped tenant data" ON public.students;
CREATE POLICY "Students read own or scoped tenant data"
  ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR user_id = auth.uid()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr', 'accountant')
      )
    )
  );

DROP POLICY IF EXISTS "Students admin manage scoped tenant data" ON public.students;
CREATE POLICY "Students admin manage scoped tenant data"
  ON public.students
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

DROP POLICY IF EXISTS "Tuition payments read own or scoped tenant data" ON public.student_tuition_payments;
CREATE POLICY "Tuition payments read own or scoped tenant data"
  ON public.student_tuition_payments
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.user_id = auth.uid()
    )
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'accountant')
      )
    )
  );

DROP POLICY IF EXISTS "Tuition payments admin manage scoped tenant data" ON public.student_tuition_payments;
CREATE POLICY "Tuition payments admin manage scoped tenant data"
  ON public.student_tuition_payments
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'accountant')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'accountant')
      )
    )
  );

DROP POLICY IF EXISTS "Lesson progress read own or scoped tenant data" ON public.student_lesson_progress;
CREATE POLICY "Lesson progress read own or scoped tenant data"
  ON public.student_lesson_progress
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.user_id = auth.uid()
    )
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  );

DROP POLICY IF EXISTS "Lesson progress student upsert own data" ON public.student_lesson_progress;
CREATE POLICY "Lesson progress student upsert own data"
  ON public.student_lesson_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.user_id = auth.uid()
        AND s.tenant_id = tenant_id
    )
  );

DROP POLICY IF EXISTS "Lesson progress update own or scoped data" ON public.student_lesson_progress;
CREATE POLICY "Lesson progress update own or scoped data"
  ON public.student_lesson_progress
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.user_id = auth.uid()
    )
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.user_id = auth.uid()
        AND s.tenant_id = tenant_id
    )
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  );

DROP POLICY IF EXISTS "Training classes read scoped tenant data" ON public.training_classes;
CREATE POLICY "Training classes read scoped tenant data"
  ON public.training_classes
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.course_id = training_classes.course_id
        AND s.user_id = auth.uid()
    )
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  );

DROP POLICY IF EXISTS "Training classes admin manage scoped tenant data" ON public.training_classes;
CREATE POLICY "Training classes admin manage scoped tenant data"
  ON public.training_classes
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  );

DROP POLICY IF EXISTS "Class attendance read own or scoped tenant data" ON public.student_class_attendance;
CREATE POLICY "Class attendance read own or scoped tenant data"
  ON public.student_class_attendance
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.user_id = auth.uid()
    )
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  );

DROP POLICY IF EXISTS "Class attendance admin manage scoped tenant data" ON public.student_class_attendance;
CREATE POLICY "Class attendance admin manage scoped tenant data"
  ON public.student_class_attendance
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  );

DROP POLICY IF EXISTS "Course modules read through scoped courses" ON public.course_modules;
CREATE POLICY "Course modules read through scoped courses"
  ON public.course_modules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          public.is_hq_super_admin()
          OR c.tenant_id = public.get_auth_tenant_id()
          OR EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.course_id = c.id
              AND s.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Course modules admin manage through scoped courses" ON public.course_modules;
CREATE POLICY "Course modules admin manage through scoped courses"
  ON public.course_modules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          public.is_hq_super_admin()
          OR (
            c.tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.id = auth.uid()
                AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          public.is_hq_super_admin()
          OR (
            c.tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.id = auth.uid()
                AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Lessons read through scoped modules" ON public.lessons;
CREATE POLICY "Lessons read through scoped modules"
  ON public.lessons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.course_modules cm
      JOIN public.courses c ON c.id = cm.course_id
      WHERE cm.id = module_id
        AND (
          public.is_hq_super_admin()
          OR c.tenant_id = public.get_auth_tenant_id()
          OR EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.course_id = c.id
              AND s.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Lessons admin manage through scoped modules" ON public.lessons;
CREATE POLICY "Lessons admin manage through scoped modules"
  ON public.lessons
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.course_modules cm
      JOIN public.courses c ON c.id = cm.course_id
      WHERE cm.id = module_id
        AND (
          public.is_hq_super_admin()
          OR (
            c.tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.id = auth.uid()
                AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.course_modules cm
      JOIN public.courses c ON c.id = cm.course_id
      WHERE cm.id = module_id
        AND (
          public.is_hq_super_admin()
          OR (
            c.tenant_id = public.get_auth_tenant_id()
            AND EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.id = auth.uid()
                AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
            )
          )
        )
    )
  );

REVOKE ALL ON TABLE public.courses FROM anon;
REVOKE ALL ON TABLE public.course_modules FROM anon;
REVOKE ALL ON TABLE public.lessons FROM anon;
REVOKE ALL ON TABLE public.students FROM anon;
REVOKE ALL ON TABLE public.student_tuition_payments FROM anon;
REVOKE ALL ON TABLE public.student_lesson_progress FROM anon;
REVOKE ALL ON TABLE public.training_classes FROM anon;
REVOKE ALL ON TABLE public.student_class_attendance FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_tuition_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_lesson_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.training_classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_class_attendance TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_modules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lessons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.students TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_tuition_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_lesson_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.training_classes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_class_attendance TO service_role;

COMMENT ON TABLE public.courses IS
  'Tenant-scoped training course catalog for student training add-on.';
COMMENT ON TABLE public.students IS
  'Student profiles linked to external student users and tenant-scoped courses.';
COMMENT ON TABLE public.student_lesson_progress IS
  'Per-student lesson progress for sequential training unlocks and viewing metrics.';
