-- =============================================================================
-- Migration: Accounting Periods Auto-Creation
-- Ngày: 2026-05-25
-- Mục đích:
--   Sửa trigger set_journal_entry_period (migration gốc 20260524) để tự động
--   TẠO period mới (theo tháng) nếu chưa tồn tại period chứa entry_date,
--   thay vì để period_id = NULL như hiện tại.
--
-- Bonus: function get_or_create_period() có thể gọi từ app layer khi cần.
-- =============================================================================


-- =============================================================================
-- 1. Function: ensure_open_period
-- Trả về period_id của kỳ OPEN chứa p_date. Tự tạo nếu chưa có.
-- Period name format: 'YYYY-MM' (vd: '2026-05')
-- Period range: ngày 1 đầu tháng → ngày cuối tháng
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ensure_open_period(
    p_tenant_id UUID,
    p_date DATE
) RETURNS UUID AS $$
DECLARE
    v_period_id UUID;
    v_period_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Tìm period OPEN bao chứa p_date
    SELECT id INTO v_period_id
    FROM public.accounting_periods
    WHERE tenant_id = p_tenant_id
      AND status = 'OPEN'
      AND p_date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_id IS NOT NULL THEN
        RETURN v_period_id;
    END IF;

    -- Không tìm thấy → kiểm tra có period CLOSED bao p_date không (cấm tạo entry vào kỳ đã đóng)
    IF EXISTS (
        SELECT 1 FROM public.accounting_periods
        WHERE tenant_id = p_tenant_id
          AND status = 'CLOSED'
          AND p_date BETWEEN start_date AND end_date
    ) THEN
        RAISE EXCEPTION 'Kỳ kế toán chứa ngày % đã đóng. Không thể tạo bút toán mới.', p_date;
    END IF;

    -- Tạo period mới theo tháng
    v_start_date := date_trunc('month', p_date)::DATE;
    v_end_date := (date_trunc('month', p_date) + INTERVAL '1 month - 1 day')::DATE;
    v_period_name := to_char(v_start_date, 'YYYY-MM');

    INSERT INTO public.accounting_periods (tenant_id, name, start_date, end_date, status)
    VALUES (p_tenant_id, v_period_name, v_start_date, v_end_date, 'OPEN')
    ON CONFLICT (tenant_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_period_id;

    RAISE NOTICE 'Auto-created accounting period % for tenant %', v_period_name, p_tenant_id;
    RETURN v_period_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 2. Replace trigger set_journal_entry_period — gọi ensure_open_period()
-- =============================================================================
CREATE OR REPLACE FUNCTION set_journal_entry_period()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.period_id IS NULL THEN
        NEW.period_id := public.ensure_open_period(NEW.tenant_id, NEW.entry_date);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger đã tồn tại từ migration 20260524000000 → giờ nó dùng function mới
-- Không cần DROP/CREATE TRIGGER vì function được CREATE OR REPLACE


-- =============================================================================
-- 3. Helper: close_period — đóng kỳ kế toán
-- Kiểm tra: tất cả entries trong period phải là POSTED (không còn DRAFT).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.close_accounting_period(p_period_id UUID)
RETURNS VOID AS $$
DECLARE
    v_tenant_id UUID;
    v_draft_count INTEGER;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.accounting_periods WHERE id = p_period_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Kỳ kế toán % không tồn tại.', p_period_id;
    END IF;

    -- Chỉ admin/HQ super admin được đóng kỳ
    IF NOT (
        public.is_admin()
        AND (public.is_hq_super_admin() OR v_tenant_id = public.get_auth_tenant_id())
    ) THEN
        RAISE EXCEPTION 'Unauthorized: chỉ admin của chi nhánh mới được đóng kỳ kế toán.';
    END IF;

    -- Kiểm tra còn DRAFT nào không
    SELECT COUNT(*) INTO v_draft_count
    FROM public.journal_entries
    WHERE period_id = p_period_id AND status = 'DRAFT';

    IF v_draft_count > 0 THEN
        RAISE EXCEPTION 'Còn % bút toán DRAFT trong kỳ. Hãy POST hoặc CANCEL trước khi đóng kỳ.', v_draft_count;
    END IF;

    UPDATE public.accounting_periods
    SET status = 'CLOSED', updated_at = NOW()
    WHERE id = p_period_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 4. Helper: reopen_period — mở lại kỳ đã đóng (chỉ HQ super admin)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reopen_accounting_period(p_period_id UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_hq_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized: chỉ HQ super admin được mở lại kỳ kế toán đã đóng.';
    END IF;

    UPDATE public.accounting_periods
    SET status = 'OPEN', updated_at = NOW()
    WHERE id = p_period_id AND status = 'CLOSED';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kỳ kế toán % không tồn tại hoặc chưa được đóng.', p_period_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
