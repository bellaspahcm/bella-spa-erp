-- =============================================================================
-- Migration: Accounting Core Reporting Functions (Thông tư 133/2016/TT-BTC)
-- Ngày: 2026-05-25
-- Mục đích:
--   Triển khai 4 hàm báo cáo tài chính lõi phục vụ hiển thị UI và xuất Excel:
--     1. get_trial_balance(tenant_id, as_of_date)
--     2. get_income_statement(tenant_id, from_date, to_date)
--     3. get_balance_sheet(tenant_id, as_of_date)
--     4. get_account_ledger(tenant_id, account_id, from_date, to_date)
--
--   Các hàm tính toán chỉ trên các tài khoản lá (leaf accounts - không có con)
--   để tránh việc cộng trùng số liệu của tài khoản nhóm (tài khoản cha).
-- =============================================================================


-- =============================================================================
-- 1. Function: get_trial_balance
-- Bảng Cân đối Phát sinh (Trial Balance) chuẩn chỉnh kế toán
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_trial_balance(
    p_tenant_id UUID,
    p_as_of_date DATE
)
RETURNS TABLE (
    account_id UUID,
    account_code TEXT,
    account_name TEXT,
    account_type TEXT,
    opening_debit DECIMAL(19,4),
    opening_credit DECIMAL(19,4),
    period_debit DECIMAL(19,4),
    period_credit DECIMAL(19,4),
    closing_debit DECIMAL(19,4),
    closing_credit DECIMAL(19,4)
) AS $$
DECLARE
    v_year_start DATE;
BEGIN
    v_year_start := date_trunc('year', p_as_of_date)::DATE;

    RETURN QUERY
    WITH leaf_accounts AS (
        -- Chỉ lấy các tài khoản lá (không có tài khoản con) để tránh tính trùng số dư
        SELECT a.id, a.account_code, a.account_name, a.account_type
        FROM public.accounting_accounts a
        WHERE a.tenant_id = p_tenant_id
          AND a.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM public.accounting_accounts sub 
              WHERE sub.tenant_id = p_tenant_id AND sub.parent_id = a.id
          )
    ),
    raw_sums AS (
        -- Cộng gộp Debit/Credit trước năm và trong năm
        SELECT 
            la.id AS acc_id,
            -- Số dư đầu năm tài chính
            COALESCE(SUM(l.debit_amount) FILTER (WHERE e.entry_date < v_year_start), 0) AS pre_debit,
            COALESCE(SUM(l.credit_amount) FILTER (WHERE e.entry_date < v_year_start), 0) AS pre_credit,
            -- Phát sinh trong kỳ (trong năm đến ngày báo cáo)
            COALESCE(SUM(l.debit_amount) FILTER (WHERE e.entry_date >= v_year_start AND e.entry_date <= p_as_of_date), 0) AS act_debit,
            COALESCE(SUM(l.credit_amount) FILTER (WHERE e.entry_date >= v_year_start AND e.entry_date <= p_as_of_date), 0) AS act_credit
        FROM leaf_accounts la
        LEFT JOIN public.journal_lines l ON l.account_id = la.id
        LEFT JOIN public.journal_entries e ON e.id = l.entry_id AND e.status = 'POSTED'
        GROUP BY la.id
    ),
    balances AS (
        -- Tính số dư đầu kỳ (Opening) và số dư cuối kỳ (Closing) dựa theo loại tài khoản
        SELECT 
            la.id AS acc_id,
            la.account_code,
            la.account_name,
            la.account_type,
            
            -- Số dư đầu năm (Opening balances)
            CASE 
                WHEN la.account_type IN ('ASSET', 'EXPENSE') THEN 
                    GREATEST(rs.pre_debit - rs.pre_credit, 0)
                ELSE 
                    0
            END::DECIMAL(19,4) AS op_debit,
            
            CASE 
                WHEN la.account_type NOT IN ('ASSET', 'EXPENSE') THEN 
                    GREATEST(rs.pre_credit - rs.pre_debit, 0)
                ELSE 
                    0
            END::DECIMAL(19,4) AS op_credit,

            rs.act_debit AS pd_debit,
            rs.act_credit AS pd_credit,

            -- Số dư cuối kỳ (Closing balances)
            CASE 
                WHEN la.account_type IN ('ASSET', 'EXPENSE') THEN
                    GREATEST((rs.pre_debit + rs.act_debit) - (rs.pre_credit + rs.act_credit), 0)
                ELSE
                    0
            END::DECIMAL(19,4) AS cl_debit,

            CASE 
                WHEN la.account_type NOT IN ('ASSET', 'EXPENSE') THEN
                    GREATEST((rs.pre_credit + rs.act_credit) - (rs.pre_debit + rs.act_debit), 0)
                ELSE
                    0
            END::DECIMAL(19,4) AS cl_credit
        FROM leaf_accounts la
        JOIN raw_sums rs ON rs.acc_id = la.id
    )
    SELECT * FROM balances
    ORDER BY account_code ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 2. Function: get_income_statement
-- Báo cáo Kết quả Kinh doanh (P&L) chuẩn Thông tư 133
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_income_statement(
    p_tenant_id UUID,
    p_from_date DATE,
    p_to_date DATE
)
RETURNS TABLE (
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
    net_profit DECIMAL(19,4)
) AS $$
DECLARE
    v_gross_rev DECIMAL(19,4) := 0;
    v_deductions DECIMAL(19,4) := 0;
    v_cogs DECIMAL(19,4) := 0;
    v_fin_inc DECIMAL(19,4) := 0;
    v_fin_exp DECIMAL(19,4) := 0;
    v_ope_exp DECIMAL(19,4) := 0;
    v_oth_inc DECIMAL(19,4) := 0;
    v_oth_exp DECIMAL(19,4) := 0;
    v_tax_exp DECIMAL(19,4) := 0;
BEGIN
    -- Doanh thu bán hàng (511)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_gross_rev
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '511%';

    -- Khoản giảm trừ doanh thu (521)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_deductions
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '521%';

    -- Giá vốn hàng bán (632)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_cogs
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '632%';

    -- Doanh thu tài chính (515)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_fin_inc
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '515%';

    -- Chi phí tài chính (635)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_fin_exp
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '635%';

    -- Chi phí quản lý kinh doanh (642)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_ope_exp
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '642%';

    -- Thu nhập khác (711)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_oth_inc
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '711%';

    -- Chi phí khác (811)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_oth_exp
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '811%';

    -- Chi phí thuế TNDN (821)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_tax_exp
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date BETWEEN p_from_date AND p_to_date
      AND a.account_code LIKE '821%';

    RETURN QUERY SELECT
        v_gross_rev,
        v_deductions,
        (v_gross_rev - v_deductions)::DECIMAL(19,4),
        v_cogs,
        (v_gross_rev - v_deductions - v_cogs)::DECIMAL(19,4),
        v_fin_inc,
        v_fin_exp,
        v_ope_exp,
        (v_gross_rev - v_deductions - v_cogs + v_fin_inc - v_fin_exp - v_ope_exp)::DECIMAL(19,4),
        v_oth_inc,
        v_oth_exp,
        (v_gross_rev - v_deductions - v_cogs + v_fin_inc - v_fin_exp - v_ope_exp + v_oth_inc - v_oth_exp)::DECIMAL(19,4),
        v_tax_exp,
        (v_gross_rev - v_deductions - v_cogs + v_fin_inc - v_fin_exp - v_ope_exp + v_oth_inc - v_oth_exp - v_tax_exp)::DECIMAL(19,4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 3. Function: get_balance_sheet
-- Bảng Cân đối Kế toán (Balance Sheet) thời gian thực và luôn tự cân đối
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_balance_sheet(
    p_tenant_id UUID,
    p_as_of_date DATE
)
RETURNS TABLE (
    cash_and_equivalents DECIMAL(19,4),
    accounts_receivable DECIMAL(19,4),
    inventory DECIMAL(19,4),
    fixed_assets_cost DECIMAL(19,4),
    accumulated_depreciation DECIMAL(19,4),
    prepaid_expenses DECIMAL(19,4),
    total_assets DECIMAL(19,4),
    
    accounts_payable DECIMAL(19,4),
    taxes_payable DECIMAL(19,4),
    employee_payables DECIMAL(19,4),
    unearned_revenue DECIMAL(19,4),
    other_payables DECIMAL(19,4),
    total_liabilities DECIMAL(19,4),
    
    owners_capital DECIMAL(19,4),
    retained_earnings DECIMAL(19,4),
    total_equity DECIMAL(19,4),
    total_equity_and_liabilities DECIMAL(19,4)
) AS $$
DECLARE
    -- TÀI SẢN (ASSET - Nợ tăng Có giảm)
    v_cash DECIMAL(19,4) := 0;
    v_rec DECIMAL(19,4) := 0;
    v_inv DECIMAL(19,4) := 0;
    v_fa_cost DECIMAL(19,4) := 0;
    v_fa_dep DECIMAL(19,4) := 0;
    v_prepaid DECIMAL(19,4) := 0;
    v_tot_assets DECIMAL(19,4) := 0;

    -- NỢ PHẢI TRẢ (LIABILITY - Có tăng Nợ giảm)
    v_pay DECIMAL(19,4) := 0;
    v_tax DECIMAL(19,4) := 0;
    v_emp DECIMAL(19,4) := 0;
    v_unearned DECIMAL(19,4) := 0;
    v_oth_pay DECIMAL(19,4) := 0;
    v_tot_liab DECIMAL(19,4) := 0;

    -- VỐN CHỦ (EQUITY - Có tăng Nợ giảm)
    v_capital DECIMAL(19,4) := 0;
    v_retained DECIMAL(19,4) := 0;
    v_tot_eq DECIMAL(19,4) := 0;

    -- Biến tạm tính Lợi nhuận tích lũy (Real-time current profit)
    v_all_revenue DECIMAL(19,4) := 0;
    v_all_expense DECIMAL(19,4) := 0;
BEGIN
    -- 1. TÀI SẢN
    -- Tiền mặt & ngân hàng (111 + 112)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_cash
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND (a.account_code LIKE '111%' OR a.account_code LIKE '112%');

    -- Phải thu khách hàng (131 + 138)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_rec
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND (a.account_code LIKE '131%' OR a.account_code LIKE '138%');

    -- Kho hàng vật tư (152 + 153)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_inv
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND (a.account_code LIKE '152%' OR a.account_code LIKE '153%');

    -- Tài sản cố định (211)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_fa_cost
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code LIKE '211%';

    -- Hao mòn tài sản cố định (214) (Lưu ý: bình thường tài khoản này dư Có, phản ánh giá trị giảm đi)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_fa_dep
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code LIKE '214%';

    -- Chi phí trả trước (242)
    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_prepaid
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code LIKE '242%';

    v_tot_assets := v_cash + v_rec + v_inv + v_fa_cost - v_fa_dep + v_prepaid;


    -- 2. NỢ PHẢI TRẢ
    -- Phải trả nhà cung cấp (331)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_pay
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code LIKE '331%';

    -- Thuế phải nộp (333)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_tax
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code LIKE '333%';

    -- Phải trả người lao động (334)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_emp
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code LIKE '334%';

    -- Doanh thu chưa thực hiện (3387)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_unearned
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code = '3387';

    -- Phải trả khác (335 + 338 ngoại trừ 3387)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_oth_pay
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND (a.account_code LIKE '335%' OR (a.account_code LIKE '338%' AND a.account_code != '3387'));

    v_tot_liab := v_pay + v_tax + v_emp + v_unearned + v_oth_pay;


    -- 3. VỐN CHỦ SỞ HỮU
    -- Vốn đầu tư (411)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_capital
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code LIKE '411%';

    -- Lợi nhuận chưa phân phối tích lũy (421)
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_retained
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_code LIKE '421%';

    -- TÍNH TOÁN LỢI NHUẬN RÒNG CHƯA KẾT CHUYỂN TRONG KỲ
    -- Để Bảng Cân đối Kế toán luôn cân 100% thời gian thực trước khi chạy bút toán khóa sổ
    SELECT COALESCE(SUM(l.credit_amount - l.debit_amount), 0) INTO v_all_revenue
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_type = 'REVENUE';

    SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0) INTO v_all_expense
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounting_accounts a ON a.id = l.account_id
    WHERE e.tenant_id = p_tenant_id AND e.status = 'POSTED' AND e.entry_date <= p_as_of_date
      AND a.account_type = 'EXPENSE';

    v_retained := v_retained + (v_all_revenue - v_all_expense);
    v_tot_eq := v_capital + v_retained;

    RETURN QUERY SELECT
        v_cash, v_rec, v_inv, v_fa_cost, v_fa_dep, v_prepaid, v_tot_assets,
        v_pay, v_tax, v_emp, v_unearned, v_oth_pay, v_tot_liab,
        v_capital, v_retained, v_tot_eq, (v_tot_liab + v_tot_eq)::DECIMAL(19,4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 4. Function: get_account_ledger
-- Sổ Chi tiết Tài khoản (Account Ledger / General Ledger Card)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_account_ledger(
    p_tenant_id UUID,
    p_account_id UUID,
    p_from_date DATE,
    p_to_date DATE
)
RETURNS TABLE (
    line_id UUID,
    entry_id UUID,
    entry_date DATE,
    description TEXT,
    reference_type TEXT,
    reference_id UUID,
    debit_amount DECIMAL(19,4),
    credit_amount DECIMAL(19,4),
    running_balance DECIMAL(19,4)
) AS $$
DECLARE
    v_account_type TEXT;
    v_pre_debit DECIMAL(19,4) := 0;
    v_pre_credit DECIMAL(19,4) := 0;
    v_open_bal DECIMAL(19,4) := 0;
BEGIN
    -- Lấy loại tài khoản để biết chiều tăng giảm số dư
    SELECT account_type INTO v_account_type
    FROM public.accounting_accounts
    WHERE id = p_account_id AND tenant_id = p_tenant_id;

    IF v_account_type IS NULL THEN
        RAISE EXCEPTION 'Tài khoản không tồn tại.';
    END IF;

    -- Tính số phát sinh lũy kế trước p_from_date
    SELECT 
        COALESCE(SUM(l.debit_amount), 0), 
        COALESCE(SUM(l.credit_amount), 0)
    INTO v_pre_debit, v_pre_credit
    FROM public.journal_lines l
    JOIN public.journal_entries e ON e.id = l.entry_id
    WHERE l.account_id = p_account_id
      AND e.tenant_id = p_tenant_id
      AND e.status = 'POSTED'
      AND e.entry_date < p_from_date;

    -- Xác định số dư đầu kỳ (Opening balance)
    IF v_account_type IN ('ASSET', 'EXPENSE') THEN
        v_open_bal := v_pre_debit - v_pre_credit;
    ELSE
        v_open_bal := v_pre_credit - v_pre_debit;
    END IF;

    -- Trả về dòng Số dư đầu kỳ trước
    line_id := NULL;
    entry_id := NULL;
    entry_date := p_from_date;
    description := 'Số dư đầu kỳ';
    reference_type := NULL;
    reference_id := NULL;
    debit_amount := 0;
    credit_amount := 0;
    running_balance := v_open_bal;
    
    RETURN NEXT;

    -- Trả về các dòng phát sinh chi tiết trong kỳ với Running Balance
    RETURN QUERY
    WITH details AS (
        SELECT 
            l.id AS l_id,
            e.id AS e_id,
            e.entry_date AS e_date,
            e.description AS e_desc,
            e.reference_type AS e_ref_type,
            e.reference_id AS e_ref_id,
            l.debit_amount AS d_amt,
            l.credit_amount AS c_amt,
            -- Tính số dư tích lũy chạy theo trật tự thời gian
            SUM(
                CASE 
                    WHEN v_account_type IN ('ASSET', 'EXPENSE') THEN
                        l.debit_amount - l.credit_amount
                    ELSE
                        l.credit_amount - l.debit_amount
                END
            ) OVER (ORDER BY e.entry_date ASC, e.created_at ASC, l.id ASC) AS cumulative_activity
        FROM public.journal_lines l
        JOIN public.journal_entries e ON e.id = l.entry_id
        WHERE l.account_id = p_account_id
          AND e.tenant_id = p_tenant_id
          AND e.status = 'POSTED'
          AND e.entry_date BETWEEN p_from_date AND p_to_date
        ORDER BY e.entry_date ASC, e.created_at ASC, l.id ASC
    )
    SELECT 
        d.l_id,
        d.e_id,
        d.e_date,
        d.e_desc,
        d.e_ref_type,
        d.e_ref_id,
        d.d_amt,
        d.c_amt,
        (v_open_bal + d.cumulative_activity)::DECIMAL(19,4)
    FROM details d;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
