-- Allow operational service-role checks and AI/CFO jobs to execute the HQ
-- consolidated P&L RPC without needing an end-user HQ admin session.

DO $$
DECLARE
    v_function_sql TEXT;
BEGIN
    SELECT pg_get_functiondef('public.get_consolidated_pnl(date, date)'::regprocedure)
    INTO v_function_sql;

    IF position('IF NOT public.is_hq_super_admin() THEN' IN v_function_sql) = 0 THEN
        RAISE EXCEPTION 'get_consolidated_pnl authorization block no longer matches expected shape';
    END IF;

    v_function_sql := replace(
        v_function_sql,
        'IF NOT public.is_hq_super_admin() THEN',
        'IF auth.role() <> ''service_role'' AND NOT public.is_hq_super_admin() THEN'
    );

    EXECUTE v_function_sql;
END $$;

REVOKE ALL ON FUNCTION public.get_consolidated_pnl(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_consolidated_pnl(DATE, DATE)
IS 'Returns consolidated network P&L for HQ admins and service-role operational checks/jobs.';

NOTIFY pgrst, 'reload schema';
