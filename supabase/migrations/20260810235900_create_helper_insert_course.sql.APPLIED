-- Helper RPC to insert course (bypass PostgREST schema cache in tests)
-- This is a workaround for schema cache issues in Supabase JS Client

CREATE OR REPLACE FUNCTION public.test_insert_course(
  p_tenant_id UUID,
  p_course_code TEXT,
  p_course_name TEXT,
  p_credits INTEGER,
  p_status TEXT,
  p_created_by UUID
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  course_code TEXT,
  course_name TEXT,
  credits INTEGER,
  status TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.courses (tenant_id, course_code, course_name, credits, status, created_by)
  VALUES (p_tenant_id, p_course_code, p_course_name, p_credits, p_status, p_created_by)
  RETURNING 
    courses.id,
    courses.tenant_id,
    courses.course_code,
    courses.course_name,
    courses.credits,
    courses.status,
    courses.created_by,
    courses.created_at;
END;
$$;

-- Grant execute to authenticated users (for tests)
GRANT EXECUTE ON FUNCTION public.test_insert_course TO authenticated, service_role;

COMMENT ON FUNCTION public.test_insert_course IS 'Test helper to insert courses, bypassing schema cache issues';
