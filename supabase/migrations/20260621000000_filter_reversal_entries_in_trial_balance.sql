-- =============================================================================
-- Migration: Filter REVERSAL entries in Trial Balance
-- Date: 2026-06-21
-- Purpose:
--   Update get_trial_balance function to exclude REVERSAL/cleanup entries
--   from calculations to display clean numbers while preserving audit trail.
--
--   REVERSAL entries are identified by keywords in description:
--   - "Ghi đảo"
--   - "CLEANUP"
--   - "RESET"
--   - "Đảo"
--   - "REVERSAL"
--   - "Reversal"
--
--   These entries are kept in the database for audit purposes but excluded
--   from financial reports to prevent inflating/deflating account balances.
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
        -- FILTER OUT REVERSAL ENTRIES by description keywords
        SELECT 
            la.id AS acc_id,
            -- Số dư đầu năm tài chính
            COALESCE(SUM(l.debit_amount) FILTER (
                WHERE e.entry_date < v_year_start
                AND e.description NOT LIKE '%Ghi đảo%'
                AND e.description NOT LIKE '%CLEANUP%'
                AND e.description NOT LIKE '%RESET%'
                AND e.description NOT LIKE '%Đảo%'
                AND e.description NOT LIKE '%REVERSAL%'
                AND e.description NOT LIKE '%Reversal%'
            ), 0) AS pre_debit,
            COALESCE(SUM(l.credit_amount) FILTER (
                WHERE e.entry_date < v_year_start
                AND e.description NOT LIKE '%Ghi đảo%'
                AND e.description NOT LIKE '%CLEANUP%'
                AND e.description NOT LIKE '%RESET%'
                AND e.description NOT LIKE '%Đảo%'
                AND e.description NOT LIKE '%REVERSAL%'
                AND e.description NOT LIKE '%Reversal%'
            ), 0) AS pre_credit,
            -- Phát sinh trong kỳ (trong năm đến ngày báo cáo)
            COALESCE(SUM(l.debit_amount) FILTER (
                WHERE e.entry_date >= v_year_start 
                AND e.entry_date <= p_as_of_date
                AND e.description NOT LIKE '%Ghi đảo%'
                AND e.description NOT LIKE '%CLEANUP%'
                AND e.description NOT LIKE '%RESET%'
                AND e.description NOT LIKE '%Đảo%'
                AND e.description NOT LIKE '%REVERSAL%'
                AND e.description NOT LIKE '%Reversal%'
            ), 0) AS act_debit,
            COALESCE(SUM(l.credit_amount) FILTER (
                WHERE e.entry_date >= v_year_start 
                AND e.entry_date <= p_as_of_date
                AND e.description NOT LIKE '%Ghi đảo%'
                AND e.description NOT LIKE '%CLEANUP%'
                AND e.description NOT LIKE '%RESET%'
                AND e.description NOT LIKE '%Đảo%'
                AND e.description NOT LIKE '%REVERSAL%'
                AND e.description NOT LIKE '%Reversal%'
            ), 0) AS act_credit
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

-- Add comment to document the change
COMMENT ON FUNCTION public.get_trial_balance IS 
'Trial Balance report with REVERSAL/cleanup entries filtered out. 
REVERSAL entries (identified by keywords: Ghi đảo, CLEANUP, RESET, Đảo, REVERSAL, Reversal) 
are excluded from calculations to display clean numbers while preserving audit trail in database.
Updated: 2026-06-21';
