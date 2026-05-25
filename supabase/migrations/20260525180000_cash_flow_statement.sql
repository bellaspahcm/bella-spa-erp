-- =============================================================================
-- Migration: Phase 29.2 — Cash Flow Statement (Báo cáo Lưu chuyển Tiền tệ)
-- Ngày: 2026-05-25
-- Mục đích:
--   Triển khai báo cáo lưu chuyển tiền tệ theo PHƯƠNG PHÁP GIÁN TIẾP
--   (Indirect Method) chuẩn Thông tư 133/2016/TT-BTC.
--
-- Cấu trúc:
--   I. Lưu chuyển tiền từ HOẠT ĐỘNG KINH DOANH (Operating):
--      = Lợi nhuận trước thuế
--      + Khấu hao TSCĐ (214 — chi phí không bằng tiền)
--      ± Δ Khoản phải thu (131)
--      ± Δ Hàng tồn kho (152, 153)
--      ± Δ Khoản phải trả (331, 333, 334, 338, 3387)
--      − Chi phí thuế TNDN đã trả
--
--   II. Lưu chuyển tiền từ HOẠT ĐỘNG ĐẦU TƯ (Investing):
--      − Chi đầu tư mua sắm TSCĐ (Δ 211 nguyên giá)
--      + Thu thanh lý TSCĐ
--
--   III. Lưu chuyển tiền từ HOẠT ĐỘNG TÀI CHÍNH (Financing):
--      + Tiền góp vốn (Δ 411)
--      + Tiền vay (Δ 341 nếu có)
--      − Tiền trả nợ vay, cổ tức
--
--   Tổng tiền cuối kỳ = Tổng tiền đầu kỳ + (I + II + III)
--   Verify: phải bằng số dư 111 + 112 cuối kỳ
-- =============================================================================


-- Helper: tính số dư account theo loại (ASSET → debit-credit, LIABILITY/EQUITY → credit-debit)
-- tại một ngày cụ thể.
CREATE OR REPLACE FUNCTION public.acc_balance_at(
    p_tenant_id UUID,
    p_account_code_prefix TEXT,
    p_as_of_date DATE
) RETURNS DECIMAL(19,4) AS $$
DECLARE
    v_balance DECIMAL(19,4) := 0;
    v_account_type TEXT;
BEGIN
    -- Lấy account_type của account đầu tiên matching prefix (giả định cùng prefix cùng type)
    SELECT account_type INTO v_account_type
    FROM public.accounting_accounts
    WHERE tenant_id = p_tenant_id AND account_code LIKE p_account_code_prefix || '%'
    LIMIT 1;

    IF v_account_type IS NULL THEN
        RETURN 0;
    END IF;

    IF v_account_type IN ('ASSET', 'EXPENSE') THEN
        SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_balance
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = p_tenant_id
          AND e.status = 'POSTED'
          AND e.entry_date <= p_as_of_date
          AND a.account_code LIKE p_account_code_prefix || '%';
    ELSE
        -- LIABILITY, EQUITY, REVENUE
        SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_balance
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        JOIN public.accounting_accounts a ON a.id = l.account_id
        WHERE e.tenant_id = p_tenant_id
          AND e.status = 'POSTED'
          AND e.entry_date <= p_as_of_date
          AND a.account_code LIKE p_account_code_prefix || '%';
    END IF;

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;


-- =============================================================================
-- get_cash_flow_statement — Báo cáo Lưu chuyển Tiền tệ (indirect method)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_cash_flow_statement(
    p_tenant_id UUID,
    p_from_date DATE,
    p_to_date DATE
)
RETURNS TABLE (
    -- Tiền đầu kỳ / cuối kỳ
    opening_cash DECIMAL(19,4),
    closing_cash DECIMAL(19,4),

    -- I. Hoạt động Kinh doanh (Operating)
    profit_before_tax DECIMAL(19,4),
    depreciation DECIMAL(19,4),
    change_in_receivables DECIMAL(19,4),       -- Δ 131 (tăng → giảm tiền)
    change_in_inventory DECIMAL(19,4),         -- Δ 152+153 (tăng → giảm tiền)
    change_in_payables DECIMAL(19,4),          -- Δ 331+333+334+338 (tăng → tăng tiền)
    change_in_unearned_revenue DECIMAL(19,4),  -- Δ 3387 (tăng → tăng tiền — khách trả tiền trước)
    tax_paid DECIMAL(19,4),                    -- âm trong báo cáo
    net_cash_operating DECIMAL(19,4),

    -- II. Hoạt động Đầu tư (Investing)
    fixed_assets_purchased DECIMAL(19,4),  -- âm (chi)
    fixed_assets_sold DECIMAL(19,4),       -- dương (thu) — placeholder cho extension tương lai
    net_cash_investing DECIMAL(19,4),

    -- III. Hoạt động Tài chính (Financing)
    owner_contributions DECIMAL(19,4),     -- Δ 411 dương = nhận góp vốn
    loans_received DECIMAL(19,4),          -- Δ 341 — placeholder
    loans_repaid DECIMAL(19,4),            -- placeholder
    net_cash_financing DECIMAL(19,4),

    -- Tổng kết
    net_change_in_cash DECIMAL(19,4),
    verification_diff DECIMAL(19,4)  -- (closing - opening) - net_change_in_cash, kỳ vọng ≈ 0
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_opening_cash DECIMAL(19,4) := 0;
    v_closing_cash DECIMAL(19,4) := 0;

    -- Σ flows trong kỳ từ P&L
    v_revenue DECIMAL(19,4) := 0;
    v_expense DECIMAL(19,4) := 0;
    v_profit_before_tax DECIMAL(19,4) := 0;
    v_tax_paid DECIMAL(19,4) := 0;

    -- Δ balances (closing - opening)
    v_depreciation DECIMAL(19,4) := 0;
    v_d_receivables DECIMAL(19,4) := 0;
    v_d_inventory DECIMAL(19,4) := 0;
    v_d_payables DECIMAL(19,4) := 0;
    v_d_unearned DECIMAL(19,4) := 0;
    v_d_fixed_assets DECIMAL(19,4) := 0;
    v_d_owner_capital DECIMAL(19,4) := 0;

    -- Pre-day = ngày liền trước p_from_date (cho opening balance)
    v_pre_day DATE := p_from_date - INTERVAL '1 day';

    -- Aggregated calculations
    v_net_operating DECIMAL(19,4) := 0;
    v_net_investing DECIMAL(19,4) := 0;
    v_net_financing DECIMAL(19,4) := 0;
    v_net_change DECIMAL(19,4) := 0;
    v_verif DECIMAL(19,4) := 0;
BEGIN
    -- ─────────────────────────────────────────────────────────────────────
    -- TIỀN ĐẦU KỲ / CUỐI KỲ (111 Tiền mặt + 112 Tiền gửi ngân hàng)
    -- ─────────────────────────────────────────────────────────────────────
    v_opening_cash := public.acc_balance_at(p_tenant_id, '111', v_pre_day)
                    + public.acc_balance_at(p_tenant_id, '112', v_pre_day);
    v_closing_cash := public.acc_balance_at(p_tenant_id, '111', p_to_date)
                    + public.acc_balance_at(p_tenant_id, '112', p_to_date);

    -- ─────────────────────────────────────────────────────────────────────
    -- I. HOẠT ĐỘNG KINH DOANH (Operating)
    -- ─────────────────────────────────────────────────────────────────────

    -- Lợi nhuận trước thuế = (Doanh thu 5xx) − (Chi phí 6xx + 8xx, KHÔNG bao gồm 821 thuế TNDN)
    -- Doanh thu trong kỳ (5xx) — credit-debit
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_revenue
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '5%';

    -- Chi phí KHÔNG bao gồm thuế TNDN (821) — debit-credit
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_expense
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND (a.account_code LIKE '6%' OR a.account_code LIKE '8%')
      AND a.account_code NOT LIKE '821%';

    v_profit_before_tax := v_revenue - v_expense;

    -- Thuế TNDN đã ghi nhận (821) — debit-credit (chi phí thuế)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_tax_paid
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '821%';

    -- Khấu hao TSCĐ (214) — phát sinh CREDIT trong kỳ (hao mòn tăng → ghi Có)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_depreciation
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '214%';

    -- Δ Khoản phải thu (131): tăng → tiền giảm (trừ ra)
    v_d_receivables := public.acc_balance_at(p_tenant_id, '131', p_to_date)
                     - public.acc_balance_at(p_tenant_id, '131', v_pre_day);

    -- Δ Hàng tồn kho (152, 153): tăng → tiền giảm
    v_d_inventory := (public.acc_balance_at(p_tenant_id, '152', p_to_date) + public.acc_balance_at(p_tenant_id, '153', p_to_date))
                   - (public.acc_balance_at(p_tenant_id, '152', v_pre_day) + public.acc_balance_at(p_tenant_id, '153', v_pre_day));

    -- Δ Khoản phải trả (331+333+334+338, KHÔNG bao gồm 3387): tăng → tiền tăng
    -- Tính bằng cách lấy tổng số dư của các prefix
    v_d_payables := (
        public.acc_balance_at(p_tenant_id, '331', p_to_date)
      + public.acc_balance_at(p_tenant_id, '333', p_to_date)
      + public.acc_balance_at(p_tenant_id, '334', p_to_date)
      + public.acc_balance_at(p_tenant_id, '335', p_to_date)
      + public.acc_balance_at(p_tenant_id, '338', p_to_date)
      - public.acc_balance_at(p_tenant_id, '3387', p_to_date)
    ) - (
        public.acc_balance_at(p_tenant_id, '331', v_pre_day)
      + public.acc_balance_at(p_tenant_id, '333', v_pre_day)
      + public.acc_balance_at(p_tenant_id, '334', v_pre_day)
      + public.acc_balance_at(p_tenant_id, '335', v_pre_day)
      + public.acc_balance_at(p_tenant_id, '338', v_pre_day)
      - public.acc_balance_at(p_tenant_id, '3387', v_pre_day)
    );

    -- Δ Doanh thu chưa thực hiện (3387 — khách trả tiền trước, tăng → tiền vào)
    v_d_unearned := public.acc_balance_at(p_tenant_id, '3387', p_to_date)
                  - public.acc_balance_at(p_tenant_id, '3387', v_pre_day);

    v_net_operating := v_profit_before_tax
                     + v_depreciation
                     - v_d_receivables       -- tăng phải thu = tiền giảm
                     - v_d_inventory          -- tăng kho = tiền giảm
                     + v_d_payables           -- tăng phải trả = tiền tăng
                     + v_d_unearned           -- tăng unearned = tiền tăng
                     - v_tax_paid;            -- thuế đã trả = tiền giảm

    -- ─────────────────────────────────────────────────────────────────────
    -- II. HOẠT ĐỘNG ĐẦU TƯ (Investing)
    -- ─────────────────────────────────────────────────────────────────────

    -- Δ TSCĐ nguyên giá (211): tăng = chi mua sắm = tiền giảm
    v_d_fixed_assets := public.acc_balance_at(p_tenant_id, '211', p_to_date)
                      - public.acc_balance_at(p_tenant_id, '211', v_pre_day);

    -- Negative if buying, positive if selling
    v_net_investing := -v_d_fixed_assets;

    -- ─────────────────────────────────────────────────────────────────────
    -- III. HOẠT ĐỘNG TÀI CHÍNH (Financing)
    -- ─────────────────────────────────────────────────────────────────────

    -- Δ Vốn chủ (411): tăng = nhận góp vốn = tiền vào
    v_d_owner_capital := public.acc_balance_at(p_tenant_id, '411', p_to_date)
                       - public.acc_balance_at(p_tenant_id, '411', v_pre_day);

    -- Placeholder: vay nợ 341 không seed sẵn trong COA hiện tại, để = 0
    v_net_financing := v_d_owner_capital;

    -- ─────────────────────────────────────────────────────────────────────
    -- TỔNG KẾT
    -- ─────────────────────────────────────────────────────────────────────
    v_net_change := v_net_operating + v_net_investing + v_net_financing;
    v_verif := (v_closing_cash - v_opening_cash) - v_net_change;

    RETURN QUERY SELECT
        v_opening_cash,
        v_closing_cash,
        v_profit_before_tax,
        v_depreciation,
        v_d_receivables,
        v_d_inventory,
        v_d_payables,
        v_d_unearned,
        v_tax_paid,
        v_net_operating,
        GREATEST(-v_d_fixed_assets, 0)::DECIMAL(19,4),  -- fixed_assets_purchased (positive number for display)
        0::DECIMAL(19,4),                                -- fixed_assets_sold (placeholder)
        v_net_investing,
        GREATEST(v_d_owner_capital, 0)::DECIMAL(19,4),  -- owner_contributions
        0::DECIMAL(19,4),                                -- loans_received (placeholder)
        0::DECIMAL(19,4),                                -- loans_repaid (placeholder)
        v_net_financing,
        v_net_change,
        v_verif;
END;
$$;
