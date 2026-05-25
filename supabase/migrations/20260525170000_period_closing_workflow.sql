-- =============================================================================
-- Migration: Phase 29.1 — Period Closing Workflow + Compliance Hooks (29.4)
-- Ngày: 2026-05-25
-- Mục đích:
--   Triển khai workflow đóng kỳ kế toán chuẩn TT133:
--     1. preview_closing_entries() — Xem trước 3 bút toán sẽ tạo
--     2. generate_closing_entries() — Tự động tạo + POST 3 entries:
--          • Bước 1: Kết chuyển doanh thu (5xx → 911)
--          • Bước 2: Kết chuyển chi phí (6xx + 8xx → 911)
--          • Bước 3: Kết chuyển lãi/lỗ (911 → 421)
--     3. close_accounting_period() — Nâng cấp: gọi generate + lock cascade
--     4. Trigger DB cấm INSERT/UPDATE journal vào period CLOSED (Phase 29.1.2)
--     5. Cascade lock revenue/expenses/salary_records khi đóng kỳ (Phase 29.1.3)
--     6. Trigger audit log tự động cho journal_entries (Phase 29.4.1)
-- =============================================================================


-- =============================================================================
-- 1. preview_closing_entries — Xem trước số liệu sẽ kết chuyển
-- =============================================================================
CREATE OR REPLACE FUNCTION public.preview_closing_entries(p_period_id UUID)
RETURNS TABLE (
    step INTEGER,
    step_name TEXT,
    description TEXT,
    debit_account_code TEXT,
    credit_account_code TEXT,
    amount DECIMAL(19,4)
) AS $$
DECLARE
    v_tenant_id UUID;
    v_period_start DATE;
    v_period_end DATE;
    v_total_revenue DECIMAL(19,4) := 0;
    v_total_expense DECIMAL(19,4) := 0;
    v_net_pnl DECIMAL(19,4) := 0;
BEGIN
    SELECT tenant_id, start_date, end_date
    INTO v_tenant_id, v_period_start, v_period_end
    FROM public.accounting_periods WHERE id = p_period_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Kỳ kế toán % không tồn tại.', p_period_id;
    END IF;

    -- Tổng doanh thu (5xx) trong kỳ — số dư bên Có
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_total_revenue
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = v_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN v_period_start AND v_period_end
      AND a.account_code LIKE '5%';

    -- Tổng chi phí (6xx, 8xx) trong kỳ — số dư bên Nợ
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_total_expense
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = v_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN v_period_start AND v_period_end
      AND (a.account_code LIKE '6%' OR a.account_code LIKE '8%');

    v_net_pnl := v_total_revenue - v_total_expense;

    -- Trả về 3 step xem trước
    RETURN QUERY VALUES
        (1, 'Kết chuyển doanh thu'::TEXT, 'Tổng doanh thu 5xx kết chuyển sang 911'::TEXT,
         '5xx'::TEXT, '911'::TEXT, v_total_revenue),
        (2, 'Kết chuyển chi phí'::TEXT, 'Tổng chi phí 6xx, 8xx kết chuyển sang 911'::TEXT,
         '911'::TEXT, '6xx/8xx'::TEXT, v_total_expense),
        (3, CASE WHEN v_net_pnl >= 0 THEN 'Kết chuyển lãi ròng' ELSE 'Kết chuyển lỗ ròng' END::TEXT,
         CASE WHEN v_net_pnl >= 0
              THEN 'Chuyển lãi từ 911 sang 421 (Lợi nhuận chưa phân phối)'
              ELSE 'Chuyển lỗ từ 421 sang 911' END::TEXT,
         CASE WHEN v_net_pnl >= 0 THEN '911'::TEXT ELSE '421'::TEXT END,
         CASE WHEN v_net_pnl >= 0 THEN '421'::TEXT ELSE '911'::TEXT END,
         ABS(v_net_pnl));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 2. generate_closing_entries — Tạo + POST 3 bút toán đóng kỳ
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_closing_entries(p_period_id UUID)
RETURNS TABLE (
    entry_id UUID,
    step TEXT,
    total_amount DECIMAL(19,4)
) AS $$
DECLARE
    v_tenant_id UUID;
    v_period_status TEXT;
    v_period_start DATE;
    v_period_end DATE;
    v_account_911 UUID;
    v_account_421 UUID;
    v_entry_revenue UUID;
    v_entry_expense UUID;
    v_entry_pnl UUID;
    v_total_revenue DECIMAL(19,4) := 0;
    v_total_expense DECIMAL(19,4) := 0;
    v_net_pnl DECIMAL(19,4) := 0;
    rec RECORD;
BEGIN
    -- Validate period
    SELECT tenant_id, status, start_date, end_date
    INTO v_tenant_id, v_period_status, v_period_start, v_period_end
    FROM public.accounting_periods WHERE id = p_period_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Kỳ kế toán % không tồn tại.', p_period_id;
    END IF;

    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'Kỳ kế toán đã đóng. Không thể tạo lại bút toán kết chuyển.';
    END IF;

    -- Resolve account 911 (Xác định KQKD) và 421 (LN chưa phân phối)
    SELECT id INTO v_account_911
    FROM public.accounting_accounts
    WHERE tenant_id = v_tenant_id AND account_code = '911' AND is_active = true
    LIMIT 1;

    SELECT id INTO v_account_421
    FROM public.accounting_accounts
    WHERE tenant_id = v_tenant_id AND account_code = '421' AND is_active = true
    LIMIT 1;

    IF v_account_911 IS NULL OR v_account_421 IS NULL THEN
        RAISE EXCEPTION 'Tenant chưa có tài khoản 911 hoặc 421 trong COA. Hãy chạy seed_default_coa().';
    END IF;

    -- =========================================================================
    -- STEP 1: Kết chuyển từng tài khoản doanh thu (5xx) → 911
    -- Nợ 5xx (zero-out) / Có 911
    -- =========================================================================
    INSERT INTO public.journal_entries (
        tenant_id, entry_date, description, reference_type, reference_id, status, period_id
    ) VALUES (
        v_tenant_id, v_period_end,
        'Kết chuyển doanh thu cuối kỳ ' || to_char(v_period_end, 'MM/YYYY'),
        'PERIOD_CLOSING', p_period_id, 'DRAFT', p_period_id
    ) RETURNING id INTO v_entry_revenue;

    FOR rec IN
        SELECT a.id AS account_id, a.account_code,
               COALESCE(SUM(l.credit_amount - l.debit_amount), 0) AS balance
        FROM public.accounting_accounts a
        JOIN public.journal_lines l ON l.account_id = a.id
        JOIN public.journal_entries e ON e.id = l.entry_id
        WHERE a.tenant_id = v_tenant_id
          AND a.account_code LIKE '5%'
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN v_period_start AND v_period_end
        GROUP BY a.id, a.account_code
        HAVING COALESCE(SUM(l.credit_amount - l.debit_amount), 0) <> 0
    LOOP
        -- Nợ 5xx để zero-out
        INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount)
        VALUES (v_entry_revenue, rec.account_id, ABS(rec.balance), 0);
        v_total_revenue := v_total_revenue + rec.balance;
    END LOOP;

    -- Có 911 với tổng
    IF v_total_revenue <> 0 THEN
        INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount)
        VALUES (v_entry_revenue, v_account_911, 0, v_total_revenue);

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_entry_revenue;
    ELSE
        -- Không có doanh thu → xoá entry rỗng
        DELETE FROM public.journal_entries WHERE id = v_entry_revenue;
        v_entry_revenue := NULL;
    END IF;

    -- =========================================================================
    -- STEP 2: Kết chuyển từng tài khoản chi phí (6xx, 8xx) → 911
    -- Nợ 911 / Có 6xx, 8xx (zero-out)
    -- =========================================================================
    INSERT INTO public.journal_entries (
        tenant_id, entry_date, description, reference_type, reference_id, status, period_id
    ) VALUES (
        v_tenant_id, v_period_end,
        'Kết chuyển chi phí cuối kỳ ' || to_char(v_period_end, 'MM/YYYY'),
        'PERIOD_CLOSING', p_period_id, 'DRAFT', p_period_id
    ) RETURNING id INTO v_entry_expense;

    FOR rec IN
        SELECT a.id AS account_id, a.account_code,
               COALESCE(SUM(l.debit_amount - l.credit_amount), 0) AS balance
        FROM public.accounting_accounts a
        JOIN public.journal_lines l ON l.account_id = a.id
        JOIN public.journal_entries e ON e.id = l.entry_id
        WHERE a.tenant_id = v_tenant_id
          AND (a.account_code LIKE '6%' OR a.account_code LIKE '8%')
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN v_period_start AND v_period_end
        GROUP BY a.id, a.account_code
        HAVING COALESCE(SUM(l.debit_amount - l.credit_amount), 0) <> 0
    LOOP
        -- Có 6xx/8xx để zero-out
        INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount)
        VALUES (v_entry_expense, rec.account_id, 0, ABS(rec.balance));
        v_total_expense := v_total_expense + rec.balance;
    END LOOP;

    IF v_total_expense <> 0 THEN
        -- Nợ 911 với tổng
        INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount)
        VALUES (v_entry_expense, v_account_911, v_total_expense, 0);

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_entry_expense;
    ELSE
        DELETE FROM public.journal_entries WHERE id = v_entry_expense;
        v_entry_expense := NULL;
    END IF;

    -- =========================================================================
    -- STEP 3: Kết chuyển lãi/lỗ ròng (911 → 421)
    -- Lãi: Nợ 911 / Có 421
    -- Lỗ:  Nợ 421 / Có 911
    -- =========================================================================
    v_net_pnl := v_total_revenue - v_total_expense;

    IF v_net_pnl <> 0 THEN
        INSERT INTO public.journal_entries (
            tenant_id, entry_date, description, reference_type, reference_id, status, period_id
        ) VALUES (
            v_tenant_id, v_period_end,
            CASE WHEN v_net_pnl > 0
                 THEN 'Kết chuyển lãi ròng cuối kỳ ' || to_char(v_period_end, 'MM/YYYY')
                 ELSE 'Kết chuyển lỗ ròng cuối kỳ ' || to_char(v_period_end, 'MM/YYYY')
            END,
            'PERIOD_CLOSING', p_period_id, 'DRAFT', p_period_id
        ) RETURNING id INTO v_entry_pnl;

        IF v_net_pnl > 0 THEN
            -- Lãi: Nợ 911 / Có 421
            INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount) VALUES
                (v_entry_pnl, v_account_911, v_net_pnl, 0),
                (v_entry_pnl, v_account_421, 0, v_net_pnl);
        ELSE
            -- Lỗ: Nợ 421 / Có 911
            INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount) VALUES
                (v_entry_pnl, v_account_421, ABS(v_net_pnl), 0),
                (v_entry_pnl, v_account_911, 0, ABS(v_net_pnl));
        END IF;

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_entry_pnl;
    END IF;

    -- Trả về các entries đã tạo
    RETURN QUERY VALUES
        (v_entry_revenue, 'Kết chuyển doanh thu'::TEXT, v_total_revenue),
        (v_entry_expense, 'Kết chuyển chi phí'::TEXT, v_total_expense),
        (v_entry_pnl, CASE WHEN v_net_pnl >= 0 THEN 'Kết chuyển lãi ròng' ELSE 'Kết chuyển lỗ ròng' END::TEXT, ABS(v_net_pnl));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 3. close_accounting_period — Nâng cấp: validate + generate + lock cascade
-- (Override migration 20260525120000)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.close_accounting_period(p_period_id UUID)
RETURNS VOID AS $$
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

    -- STEP 2: Cascade lock revenue/expenses/salary_records (Phase 29.1.3)
    UPDATE public.revenue
    SET is_locked = true, updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND received_date BETWEEN v_period_start AND v_period_end
      AND COALESCE(is_locked, false) = false;
    GET DIAGNOSTICS v_locked_rev = ROW_COUNT;

    UPDATE public.expenses
    SET is_locked = true, updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND expense_date BETWEEN v_period_start AND v_period_end
      AND COALESCE(is_locked, false) = false;
    GET DIAGNOSTICS v_locked_exp = ROW_COUNT;

    UPDATE public.salary_records
    SET is_locked = true, updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND month_year = to_char(v_period_start, 'YYYY-MM')
      AND COALESCE(is_locked, false) = false;
    GET DIAGNOSTICS v_locked_sal = ROW_COUNT;

    -- STEP 3: Đóng period
    UPDATE public.accounting_periods
    SET status = 'CLOSED', updated_at = NOW()
    WHERE id = p_period_id;

    RAISE NOTICE 'Đã đóng kỳ % | Lock cascade: revenue=%, expenses=%, salary=%',
        to_char(v_period_end, 'MM/YYYY'), v_locked_rev, v_locked_exp, v_locked_sal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 4. Phase 29.1.2 — Trigger DB cấm INSERT/UPDATE journal vào period CLOSED
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prevent_closed_period_journal_modify()
RETURNS TRIGGER AS $$
DECLARE
    v_period_status TEXT;
BEGIN
    -- Allow bypass via session variable for HQ super admin reopen flow
    IF current_setting('app.bypass_period_lock', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Check via period_id if set
    IF NEW.period_id IS NOT NULL THEN
        SELECT status INTO v_period_status
        FROM public.accounting_periods WHERE id = NEW.period_id;

        IF v_period_status = 'CLOSED' THEN
            RAISE EXCEPTION 'Không thể tạo/sửa bút toán trong kỳ kế toán đã đóng (period_id=%).', NEW.period_id;
        END IF;
    END IF;

    -- Check via entry_date matching any closed period (safety net khi period_id chưa được gán)
    IF EXISTS (
        SELECT 1 FROM public.accounting_periods p
        WHERE p.tenant_id = NEW.tenant_id
          AND p.status = 'CLOSED'
          AND NEW.entry_date BETWEEN p.start_date AND p.end_date
    ) THEN
        RAISE EXCEPTION 'Không thể tạo/sửa bút toán có ngày % vì kỳ kế toán bao quanh đã đóng.', NEW.entry_date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_closed_period_modify ON public.journal_entries;
CREATE TRIGGER trg_prevent_closed_period_modify
    BEFORE INSERT OR UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_closed_period_journal_modify();


-- =============================================================================
-- 5. reopen_accounting_period — Nâng cấp: dùng session bypass + unlock cascade
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reopen_accounting_period(p_period_id UUID)
RETURNS VOID AS $$
DECLARE
    v_tenant_id UUID;
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    -- Chỉ HQ super admin được mở lại kỳ đã đóng
    IF NOT public.is_hq_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized: chỉ HQ super admin được mở lại kỳ kế toán đã đóng.';
    END IF;

    SELECT tenant_id, start_date, end_date
    INTO v_tenant_id, v_period_start, v_period_end
    FROM public.accounting_periods WHERE id = p_period_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Kỳ kế toán % không tồn tại.', p_period_id;
    END IF;

    -- Mở lại period
    UPDATE public.accounting_periods
    SET status = 'OPEN', updated_at = NOW()
    WHERE id = p_period_id AND status = 'CLOSED';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kỳ kế toán % chưa được đóng, không cần mở lại.', p_period_id;
    END IF;

    -- Unlock cascade (đảo ngược)
    UPDATE public.revenue SET is_locked = false, updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND received_date BETWEEN v_period_start AND v_period_end;

    UPDATE public.expenses SET is_locked = false, updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND expense_date BETWEEN v_period_start AND v_period_end;

    UPDATE public.salary_records SET is_locked = false, updated_at = NOW()
    WHERE tenant_id = v_tenant_id
      AND month_year = to_char(v_period_start, 'YYYY-MM');

    RAISE NOTICE 'Đã mở lại kỳ % cho tenant %', to_char(v_period_end, 'MM/YYYY'), v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 6. Phase 29.4.1 — Trigger audit log tự động cho journal_entries
-- Mọi POSTED entry được ghi nhận để audit nhà nước
-- =============================================================================
CREATE OR REPLACE FUNCTION public.audit_journal_entry_change()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_actor UUID;
BEGIN
    v_actor := auth.uid();

    -- Phân loại action
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Chỉ ghi audit nếu status thay đổi (DRAFT → POSTED, POSTED → CANCELED)
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action := 'STATUS_CHANGE:' || OLD.status || '→' || NEW.status;
        ELSE
            -- Không có thay đổi status → bỏ qua audit
            RETURN NEW;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

    INSERT INTO public.audit_logs (
        action, table_name, record_id, user_id, new_data, tenant_id
    ) VALUES (
        v_action,
        'journal_entries',
        NEW.id,
        v_actor,
        jsonb_build_object(
            'description', NEW.description,
            'status', NEW.status,
            'reference_type', NEW.reference_type,
            'reference_id', NEW.reference_id,
            'entry_date', NEW.entry_date,
            'period_id', NEW.period_id
        ),
        NEW.tenant_id
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Audit log fail không nên block business operation
    RAISE WARNING '[audit_journal_entry_change] Failed to log audit: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_journal_entry_change ON public.journal_entries;
CREATE TRIGGER trg_audit_journal_entry_change
    AFTER INSERT OR UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_journal_entry_change();


-- =============================================================================
-- 7. Performance index cho closing query
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_journal_entries_period_status
    ON public.journal_entries (period_id, status)
    WHERE status IN ('DRAFT', 'POSTED');
