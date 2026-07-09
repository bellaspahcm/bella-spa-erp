-- TEMPORARY: Bypass security to test RPC
-- This is ONLY for testing. DO NOT use in production!

CREATE OR REPLACE FUNCTION public.calculate_ktv_salary_sheet_test(
    p_month_year DATE
)
RETURNS TABLE (
    ktv_id UUID,
    ktv_name TEXT,
    base_salary NUMERIC,
    session_bonus NUMERIC,
    rating_bonus NUMERIC,
    kpi_bonus NUMERIC,
    product_sales_commission NUMERIC,
    deductions NUMERIC,
    advances NUMERIC,
    total_salary NUMERIC,
    total_sessions INTEGER,
    status TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
    v_bonus_5_star NUMERIC;
    v_bonus_4_5_star NUMERIC;
    v_bonus_4_star NUMERIC;
    v_kpi_target_sessions INTEGER;
    v_kpi_bonus_amount NUMERIC;
BEGIN
    -- Get Beauty Spa Franchise Demo - TEST tenant for testing
    SELECT id INTO v_tenant_id 
    FROM public.tenants 
    WHERE name = 'Beauty Spa Franchise Demo - TEST' 
    LIMIT 1;
    
    -- Raise error if tenant not found
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy tenant "Beauty Spa Franchise Demo - TEST"';
    END IF;

    -- Read salary config
    SELECT 
        COALESCE((tenants.salary_config->>'bonus_5_star')::NUMERIC, 50000),
        COALESCE((tenants.salary_config->>'bonus_4_5_star')::NUMERIC, 30000),
        COALESCE((tenants.salary_config->>'bonus_4_star')::NUMERIC, 10000),
        COALESCE((tenants.salary_config->>'kpi_target_sessions')::INTEGER, 30),
        COALESCE((tenants.salary_config->>'kpi_bonus_amount')::NUMERIC, 1000000)
    INTO 
        v_bonus_5_star,
        v_bonus_4_5_star,
        v_bonus_4_star,
        v_kpi_target_sessions,
        v_kpi_bonus_amount
    FROM public.tenants
    WHERE tenants.id = v_tenant_id;

    RETURN QUERY
    WITH ktv_users AS (
        SELECT 
            users.id, 
            users.full_name, 
            COALESCE(users.base_salary, 6000000) AS raw_base_salary
        FROM public.users
        WHERE users.role = 'ktv'
          AND users.tenant_id = v_tenant_id
    ),
    actual_work_days AS (
        SELECT 
            attendance.ktv_id,
            SUM(
                CASE 
                    WHEN attendance.status IN ('present', 'late') THEN 1.0
                    WHEN attendance.status = 'half_day' THEN 0.5
                    ELSE 0.0
                END
            ) AS work_days,
            -- ⭐ Đếm số ngày trễ
            COUNT(CASE WHEN attendance.status = 'late' THEN 1 END) AS late_days,
            -- ⭐ Đếm số ngày vắng KHÔNG có phép approved (nghỉ không phép)
            COUNT(CASE 
                WHEN attendance.status = 'absent' 
                AND NOT EXISTS (
                    SELECT 1 FROM public.leave_requests lr
                    WHERE lr.staff_id = attendance.ktv_id
                      AND lr.tenant_id = attendance.tenant_id
                      AND lr.status = 'approved'
                      AND attendance.date >= lr.start_date
                      AND attendance.date <= lr.end_date
                )
                THEN 1 
            END) AS unauthorized_absent_days
        FROM public.attendance
        WHERE attendance.tenant_id = v_tenant_id
          AND date_trunc('month', attendance.date) = date_trunc('month', p_month_year)
        GROUP BY attendance.ktv_id
    ),
    auto_attendance_penalties AS (
        -- ⭐ PHẦN MỚI: Tính khấu trừ tự động từ vi phạm chấm công
        -- Phạt late + absent không phép (không có leave approved)
        SELECT
            aw.ktv_id,
            (
                COALESCE((SELECT (tenants.salary_config->>'penalty_late_per_day')::NUMERIC FROM public.tenants WHERE tenants.id = v_tenant_id), 50000) * aw.late_days +
                COALESCE((SELECT (tenants.salary_config->>'penalty_absent_per_day')::NUMERIC FROM public.tenants WHERE tenants.id = v_tenant_id), 200000) * aw.unauthorized_absent_days
            )::NUMERIC AS auto_penalty
        FROM actual_work_days aw
    ),
    completed_sessions AS (
        SELECT 
            s.completed_by_ktv_id AS ktv_id,
            COUNT(s.id)::INTEGER AS sessions_count,
            SUM(COALESCE(b.ktv_commission, 150000)) AS total_commissions,
            AVG(
                COALESCE(
                    (SELECT sr.rating FROM public.session_reviews sr WHERE sr.session_log_id = s.id AND sr.status = 'approved' LIMIT 1),
                    s.rating,
                    5.0
                )
            ) AS average_rating
        FROM public.session_logs s
        LEFT JOIN public.bookings b ON s.booking_id = b.id
        WHERE s.tenant_id = v_tenant_id
          AND s.status = 'completed'
          AND date_trunc('month', s.completed_date) = date_trunc('month', p_month_year)
        GROUP BY s.completed_by_ktv_id
    ),
    product_sales_commissions AS (
        SELECT
            ps.ktv_id,
            SUM(COALESCE(ps.calculated_commission, 0)) AS total_product_commission
        FROM public.product_sales ps
        WHERE ps.tenant_id = v_tenant_id
          AND ps.status = 'completed'
          AND date_trunc('month', ps.sale_date) = date_trunc('month', p_month_year)
        GROUP BY ps.ktv_id
    ),
    existing_salary_records AS (
        SELECT 
            r.ktv_id,
            r.base_salary AS saved_base_salary,
            r.session_bonus AS saved_session_bonus,
            r.rating_bonus AS saved_rating_bonus,
            r.kpi_bonus AS saved_kpi_bonus,
            r.product_sales_commission AS saved_product_sales_commission,
            r.violations_deduction AS saved_deductions,
            r.service_percentage_bonus AS saved_advances,
            r.status AS record_status
        FROM public.salary_records r
        WHERE r.tenant_id = v_tenant_id
          AND date_trunc('month', r.month_year) = date_trunc('month', p_month_year)
    )
    SELECT 
        u.id AS ktv_id,
        u.full_name AS ktv_name,
        COALESCE(
            er.saved_base_salary::NUMERIC,
            ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 0))::NUMERIC
        ) AS base_salary,
        COALESCE(er.saved_session_bonus::NUMERIC, cs.total_commissions, 0)::NUMERIC AS session_bonus,
        COALESCE(
            er.saved_rating_bonus::NUMERIC,
            CASE 
                WHEN cs.average_rating = 5.0 THEN cs.sessions_count * v_bonus_5_star
                WHEN cs.average_rating >= 4.5 THEN cs.sessions_count * v_bonus_4_5_star
                WHEN cs.average_rating >= 4.0 THEN cs.sessions_count * v_bonus_4_star
                ELSE 0
            END,
            0
        )::NUMERIC AS rating_bonus,
        COALESCE(
            er.saved_kpi_bonus::NUMERIC,
            CASE 
                WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount
                ELSE 0
            END::NUMERIC
        ) AS kpi_bonus,
        COALESCE(
            er.saved_product_sales_commission::NUMERIC,
            psc.total_product_commission,
            0
        )::NUMERIC AS product_sales_commission,
        COALESCE(
            er.saved_deductions,
            ap.auto_penalty,
            0
        )::NUMERIC AS deductions,
        COALESCE(er.saved_advances, 0)::NUMERIC AS advances,
        (
            COALESCE(er.saved_base_salary::NUMERIC, ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 0))::NUMERIC) +
            COALESCE(er.saved_session_bonus::NUMERIC, cs.total_commissions, 0)::NUMERIC +
            COALESCE(
                er.saved_rating_bonus::NUMERIC,
                CASE 
                    WHEN cs.average_rating = 5.0 THEN cs.sessions_count * v_bonus_5_star
                    WHEN cs.average_rating >= 4.5 THEN cs.sessions_count * v_bonus_4_5_star
                    WHEN cs.average_rating >= 4.0 THEN cs.sessions_count * v_bonus_4_star
                    ELSE 0
                END,
                0
            )::NUMERIC +
            COALESCE(er.saved_kpi_bonus::NUMERIC, CASE WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount ELSE 0 END::NUMERIC) +
            COALESCE(er.saved_product_sales_commission::NUMERIC, psc.total_product_commission, 0)::NUMERIC -
            COALESCE(er.saved_deductions, ap.auto_penalty, 0)::NUMERIC -
            COALESCE(er.saved_advances, 0)::NUMERIC
        ) AS total_salary,
        COALESCE(cs.sessions_count, 0)::INTEGER AS total_sessions,
        COALESCE(er.record_status, 'draft') AS status
    FROM ktv_users u
    LEFT JOIN actual_work_days aw ON u.id = aw.ktv_id
    LEFT JOIN auto_attendance_penalties ap ON u.id = ap.ktv_id
    LEFT JOIN completed_sessions cs ON u.id = cs.ktv_id
    LEFT JOIN product_sales_commissions psc ON u.id = psc.ktv_id
    LEFT JOIN existing_salary_records er ON u.id = er.ktv_id
    ORDER BY u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now test it
SELECT 
  ktv_name,
  base_salary,
  session_bonus,
  product_sales_commission,
  deductions,
  total_salary
FROM public.calculate_ktv_salary_sheet_test('2026-07-01'::DATE)
WHERE ktv_name LIKE '%Quang%';
