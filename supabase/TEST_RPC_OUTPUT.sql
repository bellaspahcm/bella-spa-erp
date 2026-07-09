-- Test RPC output for KTV Quang
-- Run this to see what calculate_ktv_salary_sheet returns

SELECT 
  ktv_name,
  base_salary,
  session_bonus,
  rating_bonus,
  kpi_bonus,
  product_sales_commission,
  deductions,
  advances,
  total_salary,
  total_sessions,
  status
FROM public.calculate_ktv_salary_sheet('2026-07-01'::DATE)
WHERE ktv_name LIKE '%Quang%'
ORDER BY ktv_name;
