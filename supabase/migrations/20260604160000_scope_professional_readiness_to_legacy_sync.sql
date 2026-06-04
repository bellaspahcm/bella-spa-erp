-- Scope Professional Core readiness to the legacy rows that the atomic sync
-- actually posts: confirmed revenue, approved/paid expenses, and paid salary.
-- Session logs and inventory logs can still need metadata review, but they are
-- not migrated by sync_legacy_to_ledger_atomic and must not block activation.

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
    FROM public.revenue
    WHERE tenant_id = p_tenant_id
      AND status = 'confirmed'
      AND COALESCE(amount, 0) > 0
    UNION ALL
    SELECT 'expenses'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.expenses
    WHERE tenant_id = p_tenant_id
      AND status IN ('approved', 'paid')
      AND COALESCE(amount, 0) > 0
    UNION ALL
    SELECT 'salary_records'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.salary_records
    WHERE tenant_id = p_tenant_id
      AND status = 'paid'
      AND COALESCE(
            total_salary,
            COALESCE(base_salary, 0)
            + COALESCE(session_bonus, 0)
            + COALESCE(kpi_bonus, 0)
            + COALESCE(rating_bonus, 0)
            - COALESCE(violations_deduction, 0)
            - COALESCE(service_percentage_bonus, 0),
            0
          ) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE
    v_function_sql TEXT;
    v_old_readiness_sql TEXT := $old$
        SELECT
            COUNT(*)::INTEGER AS total_records,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER AS missing_business_event,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER AS needs_review,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER AS posting_failed
        FROM public.revenue WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.expenses WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.salary_records WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.session_logs WHERE tenant_id = p_tenant_id AND status = 'completed'
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.inventory_logs WHERE tenant_id = p_tenant_id
$old$;
    v_new_readiness_sql TEXT := $new$
        SELECT
            COUNT(*)::INTEGER AS total_records,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER AS missing_business_event,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER AS needs_review,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER AS posting_failed
        FROM public.revenue
        WHERE tenant_id = p_tenant_id
          AND status = 'confirmed'
          AND COALESCE(amount, 0) > 0
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.expenses
        WHERE tenant_id = p_tenant_id
          AND status IN ('approved', 'paid')
          AND COALESCE(amount, 0) > 0
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.salary_records
        WHERE tenant_id = p_tenant_id
          AND status = 'paid'
          AND COALESCE(
                total_salary,
                COALESCE(base_salary, 0)
                + COALESCE(session_bonus, 0)
                + COALESCE(kpi_bonus, 0)
                + COALESCE(rating_bonus, 0)
                - COALESCE(violations_deduction, 0)
                - COALESCE(service_percentage_bonus, 0),
                0
              ) > 0
$new$;
BEGIN
    SELECT pg_get_functiondef('public.sync_legacy_to_ledger_atomic(uuid, uuid)'::regprocedure)
    INTO v_function_sql;

    IF position(v_old_readiness_sql IN v_function_sql) = 0 THEN
        RAISE EXCEPTION 'sync_legacy_to_ledger_atomic readiness block no longer matches expected shape';
    END IF;

    v_function_sql := replace(v_function_sql, v_old_readiness_sql, v_new_readiness_sql);
    EXECUTE v_function_sql;
END $$;

REVOKE ALL ON FUNCTION public.get_accounting_readiness(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_accounting_readiness(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_accounting_readiness(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_accounting_readiness(UUID)
IS 'Reports readiness for the legacy rows that Professional Core activation syncs: confirmed revenue, approved/paid expenses, and paid salary.';

COMMENT ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID)
IS 'Atomically syncs legacy finance rows into TT133 ledger entries; readiness gate is scoped to rows this sync actually posts.';

NOTIFY pgrst, 'reload schema';
