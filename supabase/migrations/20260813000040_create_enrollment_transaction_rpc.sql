-- Migration: Create enrollment transaction RPC with capacity check constraints and idempotency (CC-4.1)
-- Date: 2026-08-13

-- 0. Drop the old UUID-based function signature to prevent overload resolution conflicts
DROP FUNCTION IF EXISTS public.edu_enroll_student_v3(UUID, UUID, UUID, UUID, TIMESTAMPTZ, UUID);

-- 0b. Add enum value to platform_rule_domain
ALTER TYPE public.platform_rule_domain ADD VALUE IF NOT EXISTS 'education.enrollment';

-- 1. Add capacity and prerequisite columns to edu_courses if not exist
ALTER TABLE public.edu_courses ADD COLUMN IF NOT EXISTS max_students INTEGER;
ALTER TABLE public.edu_courses ADD COLUMN IF NOT EXISTS current_enrollment INTEGER DEFAULT 0;
ALTER TABLE public.edu_courses ADD COLUMN IF NOT EXISTS prerequisite_course_codes TEXT[] DEFAULT '{}';

-- 2. Drop existing check constraints if they exist (to ensure idempotency in running migrations)
ALTER TABLE public.edu_courses DROP CONSTRAINT IF EXISTS chk_edu_courses_current_enrollment;
ALTER TABLE public.edu_courses DROP CONSTRAINT IF EXISTS chk_edu_courses_max_students;
ALTER TABLE public.edu_courses DROP CONSTRAINT IF EXISTS chk_edu_courses_capacity;

-- 3. Add explicit check constraints to edu_courses
ALTER TABLE public.edu_courses ADD CONSTRAINT chk_edu_courses_current_enrollment CHECK (current_enrollment >= 0);
ALTER TABLE public.edu_courses ADD CONSTRAINT chk_edu_courses_max_students CHECK (max_students IS NULL OR max_students > 0);
ALTER TABLE public.edu_courses ADD CONSTRAINT chk_edu_courses_capacity CHECK (max_students IS NULL OR current_enrollment <= max_students);

-- 4. Add request_id to edu_enrollments as TEXT to support existing tests' string IDs
ALTER TABLE public.edu_enrollments ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE public.edu_enrollments ALTER COLUMN request_id TYPE TEXT;

-- 5. Delete any existing rows with NULL request_id to avoid constraint violations during migration
DELETE FROM public.edu_enrollments WHERE request_id IS NULL;

-- 6. Enforce request_id NOT NULL constraint
ALTER TABLE public.edu_enrollments ALTER COLUMN request_id SET NOT NULL;

-- 7. Add unique constraint to edu_enrollments for request_id
ALTER TABLE public.edu_enrollments DROP CONSTRAINT IF EXISTS uq_edu_enrollments_request_id;
ALTER TABLE public.edu_enrollments ADD CONSTRAINT uq_edu_enrollments_request_id UNIQUE (tenant_id, request_id);

-- 8. Implement edu_enroll_student_v3 PL/pgSQL function (p_request_id is now TEXT)
CREATE OR REPLACE FUNCTION public.edu_enroll_student_v3(
  p_tenant_id UUID,
  p_student_party_id UUID,
  p_course_id UUID,
  p_enrollment_id UUID,
  p_enrolled_at TIMESTAMPTZ,
  p_request_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_max_students INTEGER;
  v_current_enrollment INTEGER;
  v_course_status TEXT;
  v_existing_id UUID;
  v_rows_affected INTEGER;
BEGIN
  -- 1. Pre-lock check for duplicate requests
  SELECT id INTO v_existing_id
  FROM public.edu_enrollments
  WHERE tenant_id = p_tenant_id AND request_id = p_request_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 2. Lock course row to ensure concurrent transactional safety
  SELECT status, max_students, current_enrollment
  INTO v_course_status, v_max_students, v_current_enrollment
  FROM public.edu_courses
  WHERE id = p_course_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found' USING ERRCODE = 'P0002';
  END IF;

  -- 2.5 Post-lock recheck of request_id (prevents race condition where wait for lock results in capacity error instead of duplicate response)
  SELECT id INTO v_existing_id
  FROM public.edu_enrollments
  WHERE tenant_id = p_tenant_id AND request_id = p_request_id;

  IF FOUND THEN
    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 3. Check capacity safely
  IF v_course_status = 'full' OR (v_max_students IS NOT NULL AND v_current_enrollment >= v_max_students) THEN
    RAISE EXCEPTION 'Course capacity exceeded' USING ERRCODE = 'P0003';
  END IF;

  -- 4. Create enrollment record with ON CONFLICT DO NOTHING to handle concurrent race conditions
  INSERT INTO public.edu_enrollments (
    id, tenant_id, student_party_id, course_id, status, enrolled_at, created_at, updated_at, request_id
  ) VALUES (
    p_enrollment_id, p_tenant_id, p_student_party_id, p_course_id, 'active', p_enrolled_at, now(), now(), p_request_id
  ) ON CONFLICT (tenant_id, request_id) DO NOTHING;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- 5. If conflict occurred, return the duplicate enrollment details
  IF v_rows_affected = 0 THEN
    SELECT id INTO v_existing_id
    FROM public.edu_enrollments
    WHERE tenant_id = p_tenant_id AND request_id = p_request_id;
    
    RETURN json_build_object('success', true, 'enrollment_id', v_existing_id, 'is_duplicate', true);
  END IF;

  -- 6. Increment course current enrollment count
  v_current_enrollment := v_current_enrollment + 1;
  UPDATE public.edu_courses
  SET current_enrollment = v_current_enrollment,
      updated_at = now()
  WHERE id = p_course_id AND tenant_id = p_tenant_id;

  RETURN json_build_object('success', true, 'enrollment_id', p_enrollment_id, 'is_duplicate', false);
END;
$$ LANGUAGE plpgsql;
