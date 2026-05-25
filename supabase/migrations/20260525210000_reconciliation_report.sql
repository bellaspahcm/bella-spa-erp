-- =============================================================================
-- Migration: Phase 29.5 — Reconciliation Report (Đối soát chéo Legacy vs Ledger)
-- Ngày: 2026-05-25
-- Mục đích:
--   So sánh side-by-side dữ liệu từ 2 nguồn:
--     • LEGACY: sum revenue.amount + sum expenses.amount theo category
--     • LEDGER: sum journal_lines theo account group (5xx revenue, 6xx expense)
--   Tính discrepancy và % lệch.
--
--   Mục đích: chạy song song 1 tháng để verify accounting engine ghi đúng,
--   sau khi match 100% thì deprecate UI Finance cũ và switch sang Ledger.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_reconciliation_report(
    p_tenant_id UUID,
    p_from_date DATE,
    p_to_date DATE
)
RETURNS TABLE (
    category TEXT,                          -- 'REVENUE_TOTAL', 'EXPENSE_TOTAL', 'NET_PROFIT'
    category_label TEXT,                    -- Tên hiển thị tiếng Việt
    legacy_amount DECIMAL(19,4),            -- Từ revenue/expenses tables
    ledger_amount DECIMAL(19,4),            -- Từ journal_entries
    diff_amount DECIMAL(19,4),              -- legacy - ledger
    diff_percent DECIMAL(7,2),              -- |diff| / max(|legacy|, 1) * 100
    status TEXT                             -- 'MATCH', 'MINOR_DIFF' (<1%), 'MAJOR_DIFF' (>=1%)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
#variable_conflict use_column
DECLARE
    v_legacy_revenue DECIMAL(19,4) := 0;
    v_legacy_expense DECIMAL(19,4) := 0;
    v_legacy_salary DECIMAL(19,4) := 0;
    v_ledger_revenue DECIMAL(19,4) := 0;
    v_ledger_expense DECIMAL(19,4) := 0;
    v_legacy_net DECIMAL(19,4) := 0;
    v_ledger_net DECIMAL(19,4) := 0;
BEGIN
    -- Authorization: chỉ admin của tenant (hoặc HQ super admin) được xem
    IF NOT (
        public.is_admin()
        AND (public.is_hq_super_admin() OR p_tenant_id = public.get_auth_tenant_id())
    ) THEN
        RAISE EXCEPTION 'Unauthorized: chỉ admin của chi nhánh mới được xem báo cáo đối soát.';
    END IF;

    -- ─────────────────────────────────────────────────────────────────────
    -- LEGACY: revenue + expenses + salary_records cũ
    -- ─────────────────────────────────────────────────────────────────────

    -- Doanh thu cũ (chỉ status='confirmed')
    SELECT COALESCE(SUM(amount), 0)::DECIMAL(19,4) INTO v_legacy_revenue
    FROM public.revenue
    WHERE tenant_id = p_tenant_id
      AND status = 'confirmed'
      AND received_date BETWEEN p_from_date AND p_to_date;

    -- Chi phí cũ (chỉ status='approved')
    SELECT COALESCE(SUM(amount), 0)::DECIMAL(19,4) INTO v_legacy_expense
    FROM public.expenses
    WHERE tenant_id = p_tenant_id
      AND status = 'approved'
      AND expense_date BETWEEN p_from_date AND p_to_date;

    -- Lương đã trả cũ (status='paid')
    SELECT COALESCE(SUM(
        COALESCE(base_salary, 0)
      + COALESCE(kpi_bonus, 0)
      + COALESCE(service_percentage_bonus, 0)
      - COALESCE(violations_deduction, 0)
    ), 0)::DECIMAL(19,4) INTO v_legacy_salary
    FROM public.salary_records
    WHERE tenant_id = p_tenant_id
      AND status = 'paid'
      AND month_year = to_char(p_from_date, 'YYYY-MM');

    -- ─────────────────────────────────────────────────────────────────────
    -- LEDGER: journal_lines theo account groups
    -- ─────────────────────────────────────────────────────────────────────

    -- Doanh thu ledger (5xx, POSTED)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0)::DECIMAL(19,4) INTO v_ledger_revenue
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '5%';

    -- Chi phí ledger (6xx + 8xx, KHÔNG bao gồm 821 thuế)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0)::DECIMAL(19,4) INTO v_ledger_expense
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND (a.account_code LIKE '6%' OR a.account_code LIKE '8%')
      AND a.account_code NOT LIKE '821%';

    v_legacy_net := v_legacy_revenue - v_legacy_expense - v_legacy_salary;
    v_ledger_net := v_ledger_revenue - v_ledger_expense;

    -- ─────────────────────────────────────────────────────────────────────
    -- TRẢ VỀ 4 DÒNG SO SÁNH
    -- ─────────────────────────────────────────────────────────────────────
    RETURN QUERY VALUES
        -- Doanh thu
        (
            'REVENUE_TOTAL'::TEXT,
            'Tổng doanh thu'::TEXT,
            v_legacy_revenue,
            v_ledger_revenue,
            (v_legacy_revenue - v_ledger_revenue)::DECIMAL(19,4),
            CASE WHEN GREATEST(ABS(v_legacy_revenue), 1) > 0
                 THEN (ABS(v_legacy_revenue - v_ledger_revenue) / GREATEST(ABS(v_legacy_revenue), 1) * 100)::DECIMAL(7,2)
                 ELSE 0 END,
            CASE
                WHEN ABS(v_legacy_revenue - v_ledger_revenue) < 1 THEN 'MATCH'
                WHEN ABS(v_legacy_revenue - v_ledger_revenue) / GREATEST(ABS(v_legacy_revenue), 1) < 0.01 THEN 'MINOR_DIFF'
                ELSE 'MAJOR_DIFF'
            END::TEXT
        ),
        -- Chi phí (legacy: expenses + salary, ledger: 6xx+8xx not 821)
        (
            'EXPENSE_TOTAL'::TEXT,
            'Tổng chi phí (gồm lương)'::TEXT,
            (v_legacy_expense + v_legacy_salary)::DECIMAL(19,4),
            v_ledger_expense,
            ((v_legacy_expense + v_legacy_salary) - v_ledger_expense)::DECIMAL(19,4),
            CASE WHEN GREATEST(ABS(v_legacy_expense + v_legacy_salary), 1) > 0
                 THEN (ABS((v_legacy_expense + v_legacy_salary) - v_ledger_expense) / GREATEST(ABS(v_legacy_expense + v_legacy_salary), 1) * 100)::DECIMAL(7,2)
                 ELSE 0 END,
            CASE
                WHEN ABS((v_legacy_expense + v_legacy_salary) - v_ledger_expense) < 1 THEN 'MATCH'
                WHEN ABS((v_legacy_expense + v_legacy_salary) - v_ledger_expense) / GREATEST(ABS(v_legacy_expense + v_legacy_salary), 1) < 0.01 THEN 'MINOR_DIFF'
                ELSE 'MAJOR_DIFF'
            END::TEXT
        ),
        -- Lợi nhuận ròng
        (
            'NET_PROFIT'::TEXT,
            'Lợi nhuận ròng'::TEXT,
            v_legacy_net,
            v_ledger_net,
            (v_legacy_net - v_ledger_net)::DECIMAL(19,4),
            CASE WHEN GREATEST(ABS(v_legacy_net), 1) > 0
                 THEN (ABS(v_legacy_net - v_ledger_net) / GREATEST(ABS(v_legacy_net), 1) * 100)::DECIMAL(7,2)
                 ELSE 0 END,
            CASE
                WHEN ABS(v_legacy_net - v_ledger_net) < 1 THEN 'MATCH'
                WHEN ABS(v_legacy_net - v_ledger_net) / GREATEST(ABS(v_legacy_net), 1) < 0.01 THEN 'MINOR_DIFF'
                ELSE 'MAJOR_DIFF'
            END::TEXT
        );
END;
$$;


-- =============================================================================
-- Helper view: reconciliation_health_today
-- Quick check status đối soát hôm qua cho dashboard
-- =============================================================================
CREATE OR REPLACE VIEW public.reconciliation_health_today AS
SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    (CURRENT_DATE - INTERVAL '1 day')::DATE AS check_date,
    EXISTS (
        SELECT 1 FROM public.journal_entries e
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date = (CURRENT_DATE - INTERVAL '1 day')::DATE
    ) AS has_ledger_entries,
    EXISTS (
        SELECT 1 FROM public.revenue r
        WHERE r.tenant_id = t.id
          AND r.status = 'confirmed'
          AND r.received_date = (CURRENT_DATE - INTERVAL '1 day')::DATE
    ) AS has_legacy_revenue
FROM public.tenants t
WHERE t.status = 'active';
