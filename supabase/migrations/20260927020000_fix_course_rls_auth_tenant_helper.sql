-- Fix course visibility RLS for authenticated browser sessions.
-- Canonical tenant source: public.get_auth_tenant_id().

DROP POLICY IF EXISTS courses_tenant_isolation ON public.courses;
CREATE POLICY courses_tenant_isolation ON public.courses
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS edu_courses_tenant_isolation ON public.edu_courses;
CREATE POLICY edu_courses_tenant_isolation ON public.edu_courses
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());
