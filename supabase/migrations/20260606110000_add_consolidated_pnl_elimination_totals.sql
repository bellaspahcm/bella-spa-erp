-- =============================================================================
-- Migration: Add internal elimination totals to HQ consolidated P&L
-- Date: 2026-06-06
-- Purpose:
--   Keep HQ consolidated P&L transparent by returning how much inter-branch
--   clearing was eliminated from revenue and COGS. Net P&L values remain
--   external-only, while the UI can explain the consolidation adjustment.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_consolidated_pnl(DATE, DATE);

CREATE FUNCTION public.get_consolidated_pnl(
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
    net_margin_percent DECIMAL(7,2),
    total_bookings_count INTEGER,
    total_sessions_completed INTEGER,
    internal_revenue_eliminated DECIMAL(19,4),
    internal_cogs_eliminated DECIMAL(19,4)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
#variable_conflict use_column
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
    v_internal_revenue DECIMAL(19,4);
    v_internal_cogs DECIMAL(19,4);
    v_net_rev DECIMAL(19,4);
    v_op_profit DECIMAL(19,4);
    v_pbt DECIMAL(19,4);
    v_net_profit DECIMAL(19,4);
    v_margin DECIMAL(7,2);
    v_bookings INTEGER;
    v_sessions INTEGER;
BEGIN
    IF NOT public.is_hq_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized: chi HQ Super Admin duoc xem bao cao tong hop toan network.';
    END IF;

    FOR t IN
        SELECT id, name FROM public.tenants WHERE status = 'active' ORDER BY name ASC
    LOOP
        SELECT
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '511%'
                 AND COALESCE(e.reference_type, '') <> 'INTER_BRANCH_CLEARING'
                THEN l.credit_amount - l.debit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '521%'
                THEN l.debit_amount - l.credit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '632%'
                 AND COALESCE(e.reference_type, '') <> 'INTER_BRANCH_CLEARING'
                THEN l.debit_amount - l.credit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '515%'
                THEN l.credit_amount - l.debit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '635%'
                THEN l.debit_amount - l.credit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '642%'
                THEN l.debit_amount - l.credit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '711%'
                THEN l.credit_amount - l.debit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '811%'
                THEN l.debit_amount - l.credit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '821%'
                THEN l.debit_amount - l.credit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '511%'
                 AND COALESCE(e.reference_type, '') = 'INTER_BRANCH_CLEARING'
                THEN l.credit_amount - l.debit_amount
                ELSE 0
            END), 0),
            COALESCE(SUM(CASE
                WHEN a.account_code LIKE '632%'
                 AND COALESCE(e.reference_type, '') = 'INTER_BRANCH_CLEARING'
                THEN l.debit_amount - l.credit_amount
                ELSE 0
            END), 0)
        INTO
            v_gross_rev,
            v_deductions,
            v_cogs,
            v_fin_inc,
            v_fin_exp,
            v_ope_exp,
            v_oth_inc,
            v_oth_exp,
            v_tax_exp,
            v_internal_revenue,
            v_internal_cogs
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = t.id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date;

        v_net_rev := v_gross_rev - v_deductions;
        v_op_profit := (v_net_rev - v_cogs) + v_fin_inc - v_fin_exp - v_ope_exp;
        v_pbt := v_op_profit + v_oth_inc - v_oth_exp;
        v_net_profit := v_pbt - v_tax_exp;
        v_margin := CASE
            WHEN v_net_rev > 0 THEN (v_net_profit / v_net_rev * 100)::DECIMAL(7,2)
            ELSE 0
        END;

        SELECT COUNT(*)::INTEGER
        INTO v_bookings
        FROM public.bookings
        WHERE bookings.tenant_id = t.id;

        SELECT COUNT(*)::INTEGER
        INTO v_sessions
        FROM public.session_logs
        WHERE session_logs.tenant_id = t.id
          AND session_logs.status = 'completed';

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
            v_sessions,
            v_internal_revenue,
            v_internal_cogs;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_consolidated_pnl(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) TO authenticated, service_role;
