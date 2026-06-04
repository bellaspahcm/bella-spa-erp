CREATE OR REPLACE FUNCTION public.get_accounting_readiness(p_tenant_id UUID)
RETURNS TABLE (
    source_table TEXT,
    total_records INTEGER,
    classified_records INTEGER,
    missing_business_event INTEGER,
    needs_review INTEGER,
    posting_failed INTEGER
) AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant for accounting readiness.';
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR (
            (public.is_admin() OR public.is_accountant())
            AND (
                public.is_hq_super_admin()
                OR p_tenant_id = public.get_auth_tenant_id()
            )
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: only admin/accountant can view accounting readiness for the current tenant.';
    END IF;

    RETURN QUERY
    SELECT 'revenue'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.revenue WHERE tenant_id = p_tenant_id
    UNION ALL
    SELECT 'expenses'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.expenses WHERE tenant_id = p_tenant_id
    UNION ALL
    SELECT 'salary_records'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.salary_records WHERE tenant_id = p_tenant_id
    UNION ALL
    SELECT 'session_logs'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.session_logs WHERE tenant_id = p_tenant_id AND status = 'completed'
    UNION ALL
    SELECT 'inventory_logs'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.inventory_logs WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_accounting_readiness(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_accounting_readiness(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
