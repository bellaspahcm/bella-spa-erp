-- =============================================================================
-- Verification: Check if product_sales_commission is included in reconciliation RPC
-- Run this in Supabase SQL Editor AFTER applying the migration
-- =============================================================================

-- Step 1: Check RPC exists
SELECT 
    routine_name, 
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'get_salary_reconciliation_report'
  AND routine_schema = 'public';

-- Expected: 1 row with routine_type = 'FUNCTION'

-- Step 2: Check return columns (should include product_sales_commission)
SELECT 
    parameter_name,
    data_type,
    ordinal_position
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND specific_name LIKE 'get_salary_reconciliation_report%'
  AND parameter_mode = 'OUT'
ORDER BY ordinal_position;

-- Expected columns (18 total):
-- 1. ktv_id (uuid)
-- 2. ktv_name (text)
-- 3. legacy_base_salary (numeric)
-- 4. legacy_session_bonus (numeric)
-- 5. legacy_kpi_bonus (numeric)
-- 6. legacy_product_sales_commission (numeric) ⭐ THIS ONE
-- 7. legacy_deductions (numeric)
-- 8. legacy_total (numeric)
-- 9. legacy_status (text)
-- 10. ai_base_salary (numeric)
-- 11. ai_session_bonus (numeric)
-- 12. ai_kpi_bonus (numeric)
-- 13. ai_product_sales_commission (numeric) ⭐ THIS ONE
-- 14. ai_deductions (numeric)
-- 15. ai_total (numeric)
-- 16. diff_total (numeric)
-- 17. diff_percent (numeric)
-- 18. status (text)

-- Step 3: Test with sample data (replace with your actual tenant_id)
-- Uncomment and replace 'your-tenant-id-here' with actual UUID
/*
SELECT 
    ktv_name,
    legacy_product_sales_commission,  -- Should NOT be NULL
    ai_product_sales_commission,      -- Should NOT be NULL
    legacy_total,
    ai_total
FROM public.get_salary_reconciliation_report(
    'your-tenant-id-here'::UUID,
    '2026-07-01'::DATE
)
LIMIT 5;
*/

-- Expected: Columns exist and show 0 or actual values (NOT NULL errors)
