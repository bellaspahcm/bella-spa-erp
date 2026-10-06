-- ============================================================================
-- E2/E3/E4 English Center Branch RLS Repair
-- ============================================================================
-- Migration: 20260914
-- Dependency: public.user_org_unit_access projection
-- Purpose: Replace tenant-only or missing branch policies with Platform-derived
--          branch access checks.
-- ============================================================================

-- E2 enrollments
DROP POLICY IF EXISTS english_enrollments_tenant_isolation ON public.english_center_enrollments;
DROP POLICY IF EXISTS english_enrollments_branch_scope ON public.english_center_enrollments;
DROP POLICY IF EXISTS english_enrollments_tenant_branch_isolation ON public.english_center_enrollments;

CREATE POLICY english_enrollments_tenant_branch_isolation
  ON public.english_center_enrollments
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  );

-- E3 programs
DROP POLICY IF EXISTS programs_tenant_isolation ON public.english_center_programs;
DROP POLICY IF EXISTS programs_tenant_branch_isolation ON public.english_center_programs;

CREATE POLICY programs_tenant_branch_isolation
  ON public.english_center_programs
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND (
      branch_id IS NULL
      OR branch_id IN (
        SELECT org_unit_id
        FROM public.user_org_unit_access
        WHERE user_id = COALESCE(
          auth.uid(),
          NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
        )
          AND tenant_id = COALESCE(
            public.get_auth_tenant_id(),
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
          )
      )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND (
      branch_id IS NULL
      OR branch_id IN (
        SELECT org_unit_id
        FROM public.user_org_unit_access
        WHERE user_id = COALESCE(
          auth.uid(),
          NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
        )
          AND tenant_id = COALESCE(
            public.get_auth_tenant_id(),
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
          )
      )
    )
  );

-- E3 courses inherit branch scope from their program.
DROP POLICY IF EXISTS courses_tenant_isolation ON public.english_center_courses;
DROP POLICY IF EXISTS courses_tenant_branch_isolation ON public.english_center_courses;

CREATE POLICY courses_tenant_branch_isolation
  ON public.english_center_courses
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.english_center_programs p
      WHERE p.id = public.english_center_courses.program_id
        AND p.tenant_id = public.english_center_courses.tenant_id
        AND (
          p.branch_id IS NULL
          OR p.branch_id IN (
            SELECT org_unit_id
            FROM public.user_org_unit_access
            WHERE user_id = COALESCE(
              auth.uid(),
              NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
            )
              AND tenant_id = COALESCE(
                public.get_auth_tenant_id(),
                NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
              )
          )
        )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.english_center_programs p
      WHERE p.id = public.english_center_courses.program_id
        AND p.tenant_id = public.english_center_courses.tenant_id
        AND (
          p.branch_id IS NULL
          OR p.branch_id IN (
            SELECT org_unit_id
            FROM public.user_org_unit_access
            WHERE user_id = COALESCE(
              auth.uid(),
              NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
            )
              AND tenant_id = COALESCE(
                public.get_auth_tenant_id(),
                NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
              )
          )
        )
    )
  );

-- E3 classes
DROP POLICY IF EXISTS classes_tenant_isolation ON public.english_center_classes;
DROP POLICY IF EXISTS classes_branch_scope ON public.english_center_classes;
DROP POLICY IF EXISTS classes_tenant_branch_isolation ON public.english_center_classes;

CREATE POLICY classes_tenant_branch_isolation
  ON public.english_center_classes
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  );

-- E4 teachers. Teacher rows are visible only when at least one assigned branch
-- is accessible. Insert/update remains tenant-scoped so a teacher can be
-- created before branch assignment.
DROP POLICY IF EXISTS teachers_tenant_isolation ON public.english_center_teachers;
DROP POLICY IF EXISTS teachers_branch_select ON public.english_center_teachers;
DROP POLICY IF EXISTS teachers_tenant_write ON public.english_center_teachers;
DROP POLICY IF EXISTS teachers_tenant_update ON public.english_center_teachers;
DROP POLICY IF EXISTS teachers_tenant_delete ON public.english_center_teachers;

CREATE POLICY teachers_branch_select
  ON public.english_center_teachers
  FOR SELECT
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND EXISTS (
      SELECT 1
      FROM public.english_center_teacher_branches tb
      WHERE tb.teacher_id = public.english_center_teachers.id
        AND tb.tenant_id = public.english_center_teachers.tenant_id
        AND tb.status = 'active'
        AND tb.branch_id IN (
          SELECT org_unit_id
          FROM public.user_org_unit_access
          WHERE user_id = COALESCE(
            auth.uid(),
            NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
          )
            AND tenant_id = COALESCE(
              public.get_auth_tenant_id(),
              NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
            )
        )
    )
  );

CREATE POLICY teachers_tenant_write
  ON public.english_center_teachers
  FOR INSERT
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  );

CREATE POLICY teachers_tenant_update
  ON public.english_center_teachers
  FOR UPDATE
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  );

CREATE POLICY teachers_tenant_delete
  ON public.english_center_teachers
  FOR DELETE
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
  );

-- E4 teacher branches
DROP POLICY IF EXISTS teacher_branches_tenant_isolation ON public.english_center_teacher_branches;
DROP POLICY IF EXISTS teacher_branches_tenant_branch_isolation ON public.english_center_teacher_branches;

CREATE POLICY teacher_branches_tenant_branch_isolation
  ON public.english_center_teacher_branches
  FOR ALL
  USING (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      public.get_auth_tenant_id(),
      NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
    )
    AND branch_id IN (
      SELECT org_unit_id
      FROM public.user_org_unit_access
      WHERE user_id = COALESCE(
        auth.uid(),
        NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
      )
        AND tenant_id = COALESCE(
          public.get_auth_tenant_id(),
          NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
        )
    )
  );

REVOKE ALL ON public.english_center_enrollments FROM anon;
REVOKE ALL ON public.english_center_programs FROM anon;
REVOKE ALL ON public.english_center_courses FROM anon;
REVOKE ALL ON public.english_center_classes FROM anon;
REVOKE ALL ON public.english_center_teachers FROM anon;
REVOKE ALL ON public.english_center_teacher_branches FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_enrollments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_programs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_courses TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_classes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_teachers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.english_center_teacher_branches TO authenticated, service_role;
