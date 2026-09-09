-- Migration: 20260909000064_p93_facilities_rls_grant.sql
-- Description: Grant table access and update RLS policies for edu_fac_* tables

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

DROP POLICY IF EXISTS edu_fac_facilities_policy ON public.edu_fac_facilities;
DROP POLICY IF EXISTS edu_fac_zones_policy ON public.edu_fac_zones;
DROP POLICY IF EXISTS edu_fac_assets_policy ON public.edu_fac_assets;
DROP POLICY IF EXISTS edu_fac_inspection_schedules_policy ON public.edu_fac_inspection_schedules;
DROP POLICY IF EXISTS edu_fac_inspection_logs_policy ON public.edu_fac_inspection_logs;
DROP POLICY IF EXISTS edu_fac_maintenance_jobs_policy ON public.edu_fac_maintenance_jobs;
DROP POLICY IF EXISTS edu_fac_out_of_service_logs_policy ON public.edu_fac_out_of_service_logs;

CREATE POLICY edu_fac_facilities_policy ON public.edu_fac_facilities FOR ALL USING (true);
CREATE POLICY edu_fac_zones_policy ON public.edu_fac_zones FOR ALL USING (true);
CREATE POLICY edu_fac_assets_policy ON public.edu_fac_assets FOR ALL USING (true);
CREATE POLICY edu_fac_inspection_schedules_policy ON public.edu_fac_inspection_schedules FOR ALL USING (true);
CREATE POLICY edu_fac_inspection_logs_policy ON public.edu_fac_inspection_logs FOR ALL USING (true);
CREATE POLICY edu_fac_maintenance_jobs_policy ON public.edu_fac_maintenance_jobs FOR ALL USING (true);
CREATE POLICY edu_fac_out_of_service_logs_policy ON public.edu_fac_out_of_service_logs FOR ALL USING (true);
