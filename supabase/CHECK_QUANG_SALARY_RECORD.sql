-- Kiểm tra salary_records của KTV Quang tháng 7/2026
SELECT 
  sr.id,
  sr.ktv_id,
  u.full_name,
  sr.month_year,
  sr.base_salary,
  sr.session_bonus,
  sr.product_sales_commission,
  sr.violations_deduction,
  sr.service_percentage_bonus,
  sr.total_salary,
  sr.status
FROM public.salary_records sr
JOIN public.users u ON sr.ktv_id = u.id
WHERE u.full_name = 'Quang'
  AND date_trunc('month', sr.month_year) = '2026-07-01'::DATE
ORDER BY sr.created_at DESC;
