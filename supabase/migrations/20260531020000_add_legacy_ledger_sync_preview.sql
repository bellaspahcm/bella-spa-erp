-- Dry-run preview for legacy SIMPLE -> PROFESSIONAL ledger sync.
-- This function is read-only and lets admins/accountants review the expected
-- sync scope before running the atomic posting function.

CREATE OR REPLACE FUNCTION public.preview_legacy_ledger_sync(
    p_tenant_id UUID
)
RETURNS TABLE (
    pending_revenue_count INTEGER,
    pending_expense_count INTEGER,
    pending_salary_count INTEGER,
    journal_entries_to_create INTEGER,
    revenue_amount NUMERIC,
    expense_amount NUMERIC,
    salary_amount NUMERIC
) AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant for legacy ledger sync preview.';
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
        RAISE EXCEPTION 'Unauthorized: only admin/accountant can preview legacy ledger sync.';
    END IF;

    RETURN QUERY
    WITH pending_revenue AS (
        SELECT
            COUNT(*)::INTEGER AS row_count,
            COALESCE(SUM(r.amount), 0)::NUMERIC AS amount
        FROM public.revenue r
        WHERE r.tenant_id = p_tenant_id
          AND r.status = 'confirmed'
          AND COALESCE(r.amount, 0) > 0
          AND NOT EXISTS (
              SELECT 1
              FROM public.journal_entries je
              WHERE je.tenant_id = p_tenant_id
                AND je.reference_type = 'PACKAGE_SALE'
                AND je.reference_id = r.id
                AND je.status <> 'CANCELED'
          )
    ),
    pending_expense AS (
        SELECT
            COUNT(*)::INTEGER AS row_count,
            COALESCE(SUM(e.amount), 0)::NUMERIC AS amount
        FROM public.expenses e
        WHERE e.tenant_id = p_tenant_id
          AND e.status = 'approved'
          AND COALESCE(e.amount, 0) > 0
          AND NOT EXISTS (
              SELECT 1
              FROM public.journal_entries je
              WHERE je.tenant_id = p_tenant_id
                AND je.reference_type = 'EXPENSE'
                AND je.reference_id = e.id
                AND je.status <> 'CANCELED'
          )
    ),
    salary_base AS (
        SELECT
            s.id,
            COALESCE(
                s.total_salary,
                COALESCE(s.base_salary, 0)
                + COALESCE(s.session_bonus, 0)
                + COALESCE(s.kpi_bonus, 0)
                + COALESCE(s.rating_bonus, 0)
                - COALESCE(s.violations_deduction, 0)
                - COALESCE(s.service_percentage_bonus, 0)
            )::NUMERIC AS amount,
            NOT EXISTS (
                SELECT 1
                FROM public.journal_entries je
                WHERE je.tenant_id = p_tenant_id
                  AND je.reference_type = 'SALARY_ACCRUAL'
                  AND je.reference_id = s.id
                  AND je.status <> 'CANCELED'
            ) AS missing_accrual,
            NOT EXISTS (
                SELECT 1
                FROM public.journal_entries je
                WHERE je.tenant_id = p_tenant_id
                  AND je.reference_type = 'SALARY_PAYMENT'
                  AND je.reference_id = s.id
                  AND je.status <> 'CANCELED'
            ) AS missing_payment
        FROM public.salary_records s
        WHERE s.tenant_id = p_tenant_id
          AND s.status = 'paid'
    ),
    pending_salary AS (
        SELECT
            COUNT(*) FILTER (
                WHERE amount > 0 AND (missing_accrual OR missing_payment)
            )::INTEGER AS row_count,
            COALESCE(SUM(amount) FILTER (
                WHERE amount > 0 AND (missing_accrual OR missing_payment)
            ), 0)::NUMERIC AS amount,
            COALESCE(SUM(
                CASE WHEN amount > 0 AND missing_accrual THEN 1 ELSE 0 END
                + CASE WHEN amount > 0 AND missing_payment THEN 1 ELSE 0 END
            ), 0)::INTEGER AS entry_count
        FROM salary_base
    )
    SELECT
        pr.row_count AS pending_revenue_count,
        pe.row_count AS pending_expense_count,
        ps.row_count AS pending_salary_count,
        (pr.row_count + pe.row_count + ps.entry_count)::INTEGER AS journal_entries_to_create,
        pr.amount AS revenue_amount,
        pe.amount AS expense_amount,
        ps.amount AS salary_amount
    FROM pending_revenue pr
    CROSS JOIN pending_expense pe
    CROSS JOIN pending_salary ps;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.preview_legacy_ledger_sync(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_legacy_ledger_sync(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
