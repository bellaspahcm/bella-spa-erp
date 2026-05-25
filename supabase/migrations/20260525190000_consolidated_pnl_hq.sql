-- =============================================================================
-- Migration: Phase 29.3 — Multi-branch Consolidated P&L (HQ View)
-- Ngày: 2026-05-25
-- Mục đích:
--   Cung cấp báo cáo P&L tổng hợp toàn network cho HQ Super Admin (Bella Spa
--   Headquarter). Trả về 1 dòng P&L per tenant (chi nhánh) với 14 chỉ tiêu
--   chuẩn TT133, sort theo lợi nhuận thuần giảm dần để ranking.
--
--   Khác với get_income_statement (single tenant), function này:
--     - Chỉ HQ super admin gọi được (kiểm tra is_hq_super_admin())
--     - Loop qua mọi tenant active trong network
--     - Trả về 1 row per tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_consolidated_pnl(
    p_from_date DATE,
    p_to_date DATE
)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    gross_revenue DECIMAL(19,4),
    deductions DECIMAL(19,4),
    net_revenue DECIMAL(19,4),
    cost_of_goods_sold DECIMAL(19,4),
    gross_profit DECIMAL(19,4),
    financial_income DECIMAL(19,4),
    financial_expense DECIMAL(19,4),
    operating_expense DECIMAL(19,4),
    operating_profit DECIMAL(19,4),
    other_income DECIMAL(19,4),
    other_expense DECIMAL(19,4),
    profit_before_tax DECIMAL(19,4),
    tax_expense DECIMAL(19,4),
    net_profit DECIMAL(19,4),
    -- KPIs phụ
    net_margin_percent DECIMAL(7,2),  -- net_profit / net_revenue * 100
    total_bookings_count INTEGER,
    total_sessions_completed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    t RECORD;
    v_gross_rev DECIMAL(19,4);
    v_deductions DECIMAL(19,4);
    v_cogs DECIMAL(19,4);
    v_fin_inc DECIMAL(19,4);
    v_fin_exp DECIMAL(19,4);
    v_ope_exp DECIMAL(19,4);
    v_oth_inc DECIMAL(19,4);
    v_oth_exp DECIMAL(19,4);
    v_tax_exp DECIMAL(19,4);
    v_net_rev DECIMAL(19,4);
    v_op_profit DECIMAL(19,4);
    v_pbt DECIMAL(19,4);
    v_net_profit DECIMAL(19,4);
    v_margin DECIMAL(7,2);
    v_bookings INTEGER;
    v_sessions INTEGER;
BEGIN
    -- Authorization: chỉ HQ super admin được gọi
    IF NOT public.is_hq_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized: chỉ HQ Super Admin được xem báo cáo tổng hợp toàn network.';
    END IF;

    FOR t IN
        SELECT id, name FROM public.tenants WHERE status = 'active' ORDER BY name ASC
    LOOP
        -- Reset all variables for this tenant
        v_gross_rev := 0; v_deductions := 0; v_cogs := 0;
        v_fin_inc := 0; v_fin_exp := 0; v_ope_exp := 0;
        v_oth_inc := 0; v_oth_exp := 0; v_tax_exp := 0;

        -- Doanh thu (511)
        SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_gross_rev
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '511%';

        -- Giảm trừ doanh thu (521)
        SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_deductions
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '521%';

        -- Giá vốn (632)
        SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_cogs
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '632%';

        -- Doanh thu tài chính (515)
        SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_fin_inc
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '515%';

        -- Chi phí tài chính (635)
        SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_fin_exp
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '635%';

        -- Chi phí QLKD (642)
        SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_ope_exp
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '642%';

        -- Thu nhập khác (711)
        SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_oth_inc
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '711%';

        -- Chi phí khác (811)
        SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_oth_exp
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '811%';

        -- Thuế TNDN (821)
        SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_tax_exp
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
          AND a.account_code LIKE '821%';

        -- Derived calculations
        v_net_rev := v_gross_rev - v_deductions;
        v_op_profit := (v_net_rev - v_cogs) + v_fin_inc - v_fin_exp - v_ope_exp;
        v_pbt := v_op_profit + v_oth_inc - v_oth_exp;
        v_net_profit := v_pbt - v_tax_exp;
        v_margin := CASE WHEN v_net_rev > 0 THEN (v_net_profit / v_net_rev * 100)::DECIMAL(7,2) ELSE 0 END;

        -- KPIs phụ
        SELECT COUNT(*)::INTEGER INTO v_bookings FROM public.bookings WHERE tenant_id = t.id;
        SELECT COUNT(*)::INTEGER INTO v_sessions FROM public.session_logs
        WHERE tenant_id = t.id AND status = 'completed';

        RETURN QUERY SELECT
            t.id,
            t.name,
            v_gross_rev,
            v_deductions,
            v_net_rev,
            v_cogs,
            (v_net_rev - v_cogs)::DECIMAL(19,4),
            v_fin_inc,
            v_fin_exp,
            v_ope_exp,
            v_op_profit,
            v_oth_inc,
            v_oth_exp,
            v_pbt,
            v_tax_exp,
            v_net_profit,
            v_margin,
            v_bookings,
            v_sessions;
    END LOOP;
END;
$$;
