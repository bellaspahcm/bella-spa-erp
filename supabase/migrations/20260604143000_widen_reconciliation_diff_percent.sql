-- Prevent reconciliation report crashes when legacy amount is zero/small and
-- ledger amount is large enough to exceed the old fixed-precision cap.
DROP FUNCTION IF EXISTS public.get_reconciliation_report(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_reconciliation_report(
    p_tenant_id UUID,
    p_from_date DATE,
    p_to_date DATE
)
RETURNS TABLE (
    category TEXT,
    category_label TEXT,
    legacy_amount NUMERIC(19,4),
    ledger_amount NUMERIC(19,4),
    diff_amount NUMERIC(19,4),
    diff_percent NUMERIC,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
#variable_conflict use_column
DECLARE
    v_legacy_revenue NUMERIC(19,4) := 0;
    v_legacy_expense NUMERIC(19,4) := 0;
    v_legacy_salary NUMERIC(19,4) := 0;
    v_ledger_revenue NUMERIC(19,4) := 0;
    v_ledger_expense NUMERIC(19,4) := 0;
    v_legacy_net NUMERIC(19,4) := 0;
    v_ledger_net NUMERIC(19,4) := 0;
    v_period_month DATE;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NOT (
            public.is_admin()
            AND (public.is_hq_super_admin() OR p_tenant_id = public.get_auth_tenant_id())
        ) THEN
            RAISE EXCEPTION 'Unauthorized: chỉ admin của chi nhánh mới được xem báo cáo đối soát.';
        END IF;
    END IF;

    v_period_month := date_trunc('month', p_from_date)::DATE;

    SELECT COALESCE(SUM(amount), 0)::NUMERIC(19,4)
    INTO v_legacy_revenue
    FROM public.revenue
    WHERE tenant_id = p_tenant_id
      AND status = 'confirmed'
      AND received_date::DATE BETWEEN p_from_date AND p_to_date;

    SELECT COALESCE(SUM(amount), 0)::NUMERIC(19,4)
    INTO v_legacy_expense
    FROM public.expenses
    WHERE tenant_id = p_tenant_id
      AND status IN ('approved', 'paid')
      AND expense_date::DATE BETWEEN p_from_date AND p_to_date;

    SELECT COALESCE(SUM(COALESCE(
        total_salary,
        GREATEST(
            0,
            COALESCE(base_salary, 0)
            + COALESCE(session_bonus, 0)
            + COALESCE(rating_bonus, 0)
            + COALESCE(kpi_bonus, 0)
            - COALESCE(violations_deduction, 0)
            - COALESCE(service_percentage_bonus, 0)
        )
    )), 0)::NUMERIC(19,4)
    INTO v_legacy_salary
    FROM public.salary_records
    WHERE tenant_id = p_tenant_id
      AND status = 'paid'
      AND date_trunc('month', month_year::DATE)::DATE = v_period_month;

    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0)::NUMERIC(19,4)
    INTO v_ledger_revenue
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date::DATE BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '5%';

    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0)::NUMERIC(19,4)
    INTO v_ledger_expense
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date::DATE BETWEEN p_from_date AND p_to_date
      AND (a.account_code LIKE '6%' OR a.account_code LIKE '8%')
      AND a.account_code NOT LIKE '821%';

    v_legacy_net := v_legacy_revenue - v_legacy_expense - v_legacy_salary;
    v_ledger_net := v_ledger_revenue - v_ledger_expense;

    RETURN QUERY VALUES
        ('REVENUE_TOTAL'::TEXT, 'Tổng doanh thu'::TEXT, v_legacy_revenue, v_ledger_revenue,
         (v_legacy_revenue - v_ledger_revenue)::NUMERIC(19,4),
         ROUND(ABS(v_legacy_revenue - v_ledger_revenue) / GREATEST(ABS(v_legacy_revenue), 1::NUMERIC) * 100, 2),
         CASE WHEN ABS(v_legacy_revenue - v_ledger_revenue) < 1 THEN 'MATCH'
              WHEN ABS(v_legacy_revenue - v_ledger_revenue) / GREATEST(ABS(v_legacy_revenue), 1::NUMERIC) < 0.01 THEN 'MINOR_DIFF'
              ELSE 'MAJOR_DIFF' END::TEXT),
        ('EXPENSE_TOTAL'::TEXT, 'Tổng chi phí (gồm lương)'::TEXT, (v_legacy_expense + v_legacy_salary)::NUMERIC(19,4), v_ledger_expense,
         ((v_legacy_expense + v_legacy_salary) - v_ledger_expense)::NUMERIC(19,4),
         ROUND(ABS((v_legacy_expense + v_legacy_salary) - v_ledger_expense) / GREATEST(ABS(v_legacy_expense + v_legacy_salary), 1::NUMERIC) * 100, 2),
         CASE WHEN ABS((v_legacy_expense + v_legacy_salary) - v_ledger_expense) < 1 THEN 'MATCH'
              WHEN ABS((v_legacy_expense + v_legacy_salary) - v_ledger_expense) / GREATEST(ABS(v_legacy_expense + v_legacy_salary), 1::NUMERIC) < 0.01 THEN 'MINOR_DIFF'
              ELSE 'MAJOR_DIFF' END::TEXT),
        ('NET_PROFIT'::TEXT, 'Lợi nhuận ròng'::TEXT, v_legacy_net, v_ledger_net,
         (v_legacy_net - v_ledger_net)::NUMERIC(19,4),
         ROUND(ABS(v_legacy_net - v_ledger_net) / GREATEST(ABS(v_legacy_net), 1::NUMERIC) * 100, 2),
         CASE WHEN ABS(v_legacy_net - v_ledger_net) < 1 THEN 'MATCH'
              WHEN ABS(v_legacy_net - v_ledger_net) / GREATEST(ABS(v_legacy_net), 1::NUMERIC) < 0.01 THEN 'MINOR_DIFF'
              ELSE 'MAJOR_DIFF' END::TEXT);
END;
$$;

REVOKE ALL ON FUNCTION public.get_reconciliation_report(UUID, DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_reconciliation_report(UUID, DATE, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_reconciliation_report(UUID, DATE, DATE) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
