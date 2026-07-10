-- Migration: Fix close_accounting_period RPC
-- Error: 42703 "undefined_column" – revenue, expenses, salary_records tables
-- do not have an `updated_at` column. Remove those SET clauses.
-- Applied directly to production via MCP on 2026-07-10.

CREATE OR REPLACE FUNCTION public.close_accounting_period(p_period_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_tenant_id UUID;
    v_period_status TEXT;
    v_period_start DATE;
    v_period_end DATE;
    v_draft_count INTEGER;
    v_locked_rev INTEGER := 0;
    v_locked_exp INTEGER := 0;
    v_locked_sal INTEGER := 0;
BEGIN
    SELECT tenant_id, status, start_date, end_date
    INTO v_tenant_id, v_period_status, v_period_start, v_period_end
    FROM public.accounting_periods WHERE id = p_period_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Kỳ kế toán % không tồn tại.', p_period_id;
    END IF;

    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'Kỳ kế toán đã đóng từ trước.';
    END IF;

    -- Authorization
    IF NOT (
        public.is_admin()
        AND (public.is_hq_super_admin() OR v_tenant_id = public.get_auth_tenant_id())
    ) THEN
        RAISE EXCEPTION 'Unauthorized: chỉ admin của chi nhánh hoặc HQ Super Admin mới được đóng kỳ.';
    END IF;

    -- Validation: không còn DRAFT (loại trừ DRAFT do chính generate_closing_entries tạo ra)
    SELECT COUNT(*) INTO v_draft_count
    FROM public.journal_entries
    WHERE period_id = p_period_id
      AND status = 'DRAFT'
      AND reference_type IS DISTINCT FROM 'PERIOD_CLOSING';

    IF v_draft_count > 0 THEN
        RAISE EXCEPTION 'Còn % bút toán DRAFT (chưa POST) trong kỳ. Hãy POST hoặc CANCEL trước khi đóng kỳ.', v_draft_count;
    END IF;

    -- STEP 1: Tạo bút toán kết chuyển
    PERFORM public.generate_closing_entries(p_period_id);

    -- STEP 2: Cascade lock revenue/expenses/salary_records
    -- Note: revenue, expenses, salary_records do NOT have an updated_at column.
    UPDATE public.revenue
    SET is_locked = true
    WHERE tenant_id = v_tenant_id
      AND received_date BETWEEN v_period_start AND v_period_end
      AND COALESCE(is_locked, false) = false;
    GET DIAGNOSTICS v_locked_rev = ROW_COUNT;

    UPDATE public.expenses
    SET is_locked = true
    WHERE tenant_id = v_tenant_id
      AND expense_date BETWEEN v_period_start AND v_period_end
      AND COALESCE(is_locked, false) = false;
    GET DIAGNOSTICS v_locked_exp = ROW_COUNT;

    UPDATE public.salary_records
    SET is_locked = true
    WHERE tenant_id = v_tenant_id
      AND month_year = date_trunc('month', v_period_start)::date
      AND COALESCE(is_locked, false) = false;
    GET DIAGNOSTICS v_locked_sal = ROW_COUNT;

    -- STEP 3: Đóng period (accounting_periods HAS updated_at)
    UPDATE public.accounting_periods
    SET status = 'CLOSED', updated_at = NOW()
    WHERE id = p_period_id;

    RAISE NOTICE 'Đã đóng kỳ % | Lock cascade: revenue=%, expenses=%, salary=%',
        to_char(v_period_end, 'MM/YYYY'), v_locked_rev, v_locked_exp, v_locked_sal;
END;
$function$;
