CREATE OR REPLACE FUNCTION public.get_salary_reconciliation_report(
    p_tenant_id UUID,
    p_month_year DATE
)
RETURNS TABLE (
    ktv_id UUID,
    ktv_name TEXT,
    legacy_base_salary NUMERIC,
    legacy_session_bonus NUMERIC,
    legacy_kpi_bonus NUMERIC,
    legacy_deductions NUMERIC,
    legacy_total NUMERIC,
    legacy_status TEXT,
    ai_base_salary NUMERIC,
    ai_session_bonus NUMERIC,
    ai_kpi_bonus NUMERIC,
    ai_deductions NUMERIC,
    ai_total NUMERIC,
    diff_total NUMERIC,
    diff_percent NUMERIC,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_period_month DATE;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant for salary reconciliation report.';
    END IF;

    IF auth.role() = 'service_role' THEN
        PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, true);
    ELSE
        IF NOT (
            public.is_admin()
            AND (public.is_hq_super_admin() OR p_tenant_id = public.get_auth_tenant_id())
        ) THEN
            RAISE EXCEPTION 'Unauthorized: chi admin cua chi nhanh moi duoc xem bao cao doi soat luong.';
        END IF;
    END IF;

    v_period_month := date_trunc('month', p_month_year)::DATE;

    RETURN QUERY
    WITH ai_sheet AS (
        SELECT
            s.ktv_id,
            s.ktv_name,
            s.base_salary AS ai_base,
            s.session_bonus AS ai_session,
            s.kpi_bonus AS ai_kpi,
            s.deductions AS ai_ded,
            s.total_salary AS ai_tot
        FROM public.calculate_ktv_salary_sheet(p_month_year) s
    ),
    legacy_records AS (
        SELECT
            r.ktv_id,
            COALESCE(r.base_salary, 0)::NUMERIC AS legacy_base,
            COALESCE(r.session_bonus, 0)::NUMERIC AS legacy_session,
            COALESCE(r.kpi_bonus, 0)::NUMERIC AS legacy_kpi,
            COALESCE(r.violations_deduction, 0)::NUMERIC AS legacy_ded,
            COALESCE(
                r.total_salary,
                (
                    COALESCE(r.base_salary, 0) +
                    COALESCE(r.session_bonus, 0) +
                    COALESCE(r.kpi_bonus, 0) +
                    COALESCE(r.rating_bonus, 0) -
                    COALESCE(r.violations_deduction, 0) -
                    COALESCE(r.service_percentage_bonus, 0)
                )
            )::NUMERIC AS legacy_tot,
            COALESCE(r.status, 'missing') AS legacy_stat
        FROM public.salary_records r
        WHERE r.tenant_id = p_tenant_id
          AND date_trunc('month', r.month_year::DATE)::DATE = v_period_month
    )
    SELECT
        ai.ktv_id,
        ai.ktv_name,
        COALESCE(lr.legacy_base, 0)::NUMERIC AS legacy_base_salary,
        COALESCE(lr.legacy_session, 0)::NUMERIC AS legacy_session_bonus,
        COALESCE(lr.legacy_kpi, 0)::NUMERIC AS legacy_kpi_bonus,
        COALESCE(lr.legacy_ded, 0)::NUMERIC AS legacy_deductions,
        COALESCE(lr.legacy_tot, 0)::NUMERIC AS legacy_total,
        COALESCE(lr.legacy_stat, 'missing')::TEXT AS legacy_status,
        ai.ai_base::NUMERIC AS ai_base_salary,
        ai.ai_session::NUMERIC AS ai_session_bonus,
        ai.ai_kpi::NUMERIC AS ai_kpi_bonus,
        ai.ai_ded::NUMERIC AS ai_deductions,
        ai.ai_tot::NUMERIC AS ai_total,
        (COALESCE(lr.legacy_tot, 0) - ai.ai_tot)::NUMERIC AS diff_total,
        CASE
            WHEN ai.ai_tot > 0 THEN
                (ABS(COALESCE(lr.legacy_tot, 0) - ai.ai_tot) / ai.ai_tot * 100)::NUMERIC(7,2)
            ELSE 0
        END AS diff_percent,
        CASE
            WHEN lr.legacy_tot IS NULL THEN 'PENDING_LEGACY'
            WHEN ABS(COALESCE(lr.legacy_tot, 0) - ai.ai_tot) < 5000 THEN 'MATCH'
            WHEN ai.ai_tot > 0
                 AND ABS(COALESCE(lr.legacy_tot, 0) - ai.ai_tot) / ai.ai_tot < 0.01
                THEN 'MINOR_DIFF'
            ELSE 'MAJOR_DIFF'
        END::TEXT AS status
    FROM ai_sheet ai
    LEFT JOIN legacy_records lr ON lr.ktv_id = ai.ktv_id
    ORDER BY ai.ktv_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_salary_reconciliation_report(UUID, DATE) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
