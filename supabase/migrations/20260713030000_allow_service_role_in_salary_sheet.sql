-- Migration: 20260713030000_allow_service_role_in_salary_sheet.sql
-- Description: Allow calculate_ktv_salary_sheet to accept p_tenant_id directly to support stateless REST client calls from service_role.

-- First, drop the existing function to avoid postgres signature mismatch
DROP FUNCTION IF EXISTS public.calculate_ktv_salary_sheet(DATE);

-- Recreate it with p_tenant_id DEFAULT NULL
CREATE OR REPLACE FUNCTION public.calculate_ktv_salary_sheet(
    p_month_year DATE,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    ktv_id UUID,
    ktv_name TEXT,
    base_salary NUMERIC,
    session_bonus NUMERIC,
    rating_bonus NUMERIC,
    kpi_bonus NUMERIC,
    deductions NUMERIC,
    advances NUMERIC,
    product_sales_commission NUMERIC,
    total_salary NUMERIC,
    total_sessions NUMERIC,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
    v_tenant_id UUID;
    v_bonus_5_star NUMERIC;
    v_bonus_4_5_star NUMERIC;
    v_bonus_4_star NUMERIC;
    v_penalty_late NUMERIC;
    v_penalty_absent NUMERIC;
BEGIN
    -- 1. Bảo mật: Cho phép service_role HOẶC (người dùng authenticated phải là admin/accountant/hr)
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND users.role IN ('admin', 'accountant', 'hr')
        ) THEN
            RAISE EXCEPTION 'Quyền hạn không hợp lệ. Bạn không có quyền truy cập dữ liệu tính lương.';
        END IF;
    END IF;

    -- Lấy tenant_id của ngữ cảnh hiện tại
    IF p_tenant_id IS NOT NULL THEN
        v_tenant_id := p_tenant_id;
    ELSIF auth.role() = 'service_role' THEN
        v_tenant_id := COALESCE(
            NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
            (SELECT id FROM public.tenants LIMIT 1)
        );
    ELSE
        v_tenant_id := public.get_my_tenant_id();
        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Tài khoản không liên kết với chi nhánh hợp lệ.';
        END IF;
    END IF;

    SELECT
        COALESCE((tenants.salary_config->>'bonus_5_star')::NUMERIC, 50000),
        COALESCE((tenants.salary_config->>'bonus_4_5_star')::NUMERIC, 30000),
        COALESCE((tenants.salary_config->>'bonus_4_star')::NUMERIC, 10000),
        COALESCE((tenants.salary_config->>'penalty_late_per_day')::NUMERIC, 50000),
        COALESCE((tenants.salary_config->>'penalty_absent_per_day')::NUMERIC, 200000)
    INTO
        v_bonus_5_star,
        v_bonus_4_5_star,
        v_bonus_4_star,
        v_penalty_late,
        v_penalty_absent
    FROM public.tenants
    WHERE tenants.id = v_tenant_id;

    RETURN QUERY
    WITH ktv_users AS (
        SELECT users.id, users.full_name,
               COALESCE(users.base_salary, 6000000) AS raw_base_salary
        FROM public.users
        WHERE users.role = 'ktv'
          AND users.tenant_id = v_tenant_id
    ),
    actual_work_days AS (
        SELECT attendance.ktv_id,
               SUM(CASE
                   WHEN attendance.status IN ('present', 'late') THEN 1.0
                   WHEN attendance.status = 'half_day' THEN 0.5
                   ELSE 0.0
               END)::NUMERIC AS work_days,
               COUNT(*) FILTER (WHERE attendance.status = 'late')::NUMERIC AS late_days,
               COUNT(*) FILTER (WHERE attendance.status = 'absent')::NUMERIC AS absent_days
        FROM public.attendance
        WHERE attendance.tenant_id = v_tenant_id
          AND date_trunc('month', attendance.date) = date_trunc('month', p_month_year)
        GROUP BY attendance.ktv_id
    ),
    completed_sessions AS (
        SELECT s.completed_by_ktv_id AS ktv_id,
               SUM(COALESCE(p.session_multiplier, 1.0))::NUMERIC AS sessions_count,
               SUM(COALESCE(b.ktv_commission, 150000))::NUMERIC AS total_commissions,
               AVG(approved_reviews.rating)::NUMERIC AS average_rating
        FROM public.session_logs s
        LEFT JOIN public.bookings b ON s.booking_id = b.id
        LEFT JOIN public.packages p ON b.package_name = p.name AND b.tenant_id = p.tenant_id
        LEFT JOIN LATERAL (
            SELECT sr.rating
            FROM public.session_reviews sr
            WHERE sr.session_log_id = s.id
              AND sr.status = 'approved'
            LIMIT 1
        ) approved_reviews ON TRUE
        WHERE s.tenant_id = v_tenant_id
          AND s.status = 'completed'
          AND date_trunc('month', s.completed_date) = date_trunc('month', p_month_year)
        GROUP BY s.completed_by_ktv_id
    ),
    kpi_stats AS (
        SELECT kpi_records.ktv_id,
               COALESCE(SUM(kpi_records.bonus_amount), 0)::NUMERIC AS kpi_bonus
        FROM public.kpi_records
        WHERE kpi_records.tenant_id = v_tenant_id
          AND date_trunc('month', kpi_records.month_year) = date_trunc('month', p_month_year)
        GROUP BY kpi_records.ktv_id
    ),
    product_sales_commissions AS (
        SELECT ps.ktv_id,
               COALESCE(SUM(ps.calculated_commission), 0)::NUMERIC AS total_product_commission
        FROM public.product_sales ps
        WHERE ps.tenant_id = v_tenant_id
          AND ps.status IN ('completed', 'pending')
          AND date_trunc('month', ps.sale_date) = date_trunc('month', p_month_year)
        GROUP BY ps.ktv_id
    ),
    leaderboard AS (
        SELECT *
        FROM public.get_ktv_leaderboard(v_tenant_id, p_month_year)
    ),
    existing_salary_records AS (
        SELECT r.ktv_id,
               r.base_salary AS saved_base_salary,
               r.kpi_bonus AS saved_kpi_bonus,
               r.violations_deduction AS saved_deductions,
               r.service_percentage_bonus AS saved_advances,
               r.session_bonus AS saved_session_bonus,
               r.rating_bonus AS saved_rating_bonus,
               r.total_sessions AS saved_total_sessions,
               r.total_salary AS saved_total_salary,
               r.product_sales_commission AS saved_product_commission,
               r.status AS record_status,
               (COALESCE(r.status, 'draft') <> 'draft') AS is_saved_financial_record
        FROM public.salary_records r
        WHERE r.tenant_id = v_tenant_id
          AND date_trunc('month', r.month_year) = date_trunc('month', p_month_year)
    ),
    calculated AS (
        SELECT
            u.id AS ktv_id,
            u.full_name AS ktv_name,
            COALESCE(er.record_status, 'draft') AS status,
            COALESCE(cs.sessions_count, 0)::NUMERIC AS live_total_sessions,
            COALESCE(cs.total_commissions, 0)::NUMERIC AS live_session_bonus,
            COALESCE(
                CASE
                    WHEN lb.average_rating = 5.0 THEN COALESCE(cs.sessions_count, 0) * v_bonus_5_star
                    WHEN lb.average_rating >= 4.5 THEN COALESCE(cs.sessions_count, 0) * v_bonus_4_5_star
                    WHEN lb.average_rating >= 4.0 THEN COALESCE(cs.sessions_count, 0) * v_bonus_4_star
                    ELSE 0
                END,
                0
            )::NUMERIC AS live_rating_bonus,
            COALESCE(kpi.kpi_bonus, 0)::NUMERIC AS live_kpi_bonus,
            COALESCE(lb.late_days, aw.late_days, 0) * v_penalty_late + COALESCE(lb.absent_days, aw.absent_days, 0) * v_penalty_absent AS live_deductions,
            ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 0.0))::NUMERIC AS live_base_salary,
            COALESCE(er.saved_advances, 0)::NUMERIC AS advances,
            COALESCE(psc.total_product_commission, 0)::NUMERIC AS live_product_commission,
            er.saved_base_salary,
            er.saved_session_bonus,
            er.saved_rating_bonus,
            er.saved_kpi_bonus,
            er.saved_deductions,
            er.saved_total_sessions,
            er.saved_total_salary,
            er.saved_product_commission,
            COALESCE(er.is_saved_financial_record, FALSE) AS is_saved_financial_record
        FROM ktv_users u
        LEFT JOIN actual_work_days aw ON u.id = aw.ktv_id
        LEFT JOIN completed_sessions cs ON u.id = cs.ktv_id
        LEFT JOIN kpi_stats kpi ON u.id = kpi.ktv_id
        LEFT JOIN product_sales_commissions psc ON u.id = psc.ktv_id
        LEFT JOIN leaderboard lb ON u.id = lb.ktv_id
        LEFT JOIN existing_salary_records er ON u.id = er.ktv_id
    ),
    resolved AS (
        SELECT
            calculated.ktv_id,
            calculated.ktv_name,
            CASE
                WHEN calculated.is_saved_financial_record AND calculated.saved_base_salary IS NOT NULL THEN calculated.saved_base_salary::NUMERIC
                ELSE calculated.live_base_salary
            END AS base_salary,
            CASE
                WHEN calculated.is_saved_financial_record AND calculated.saved_session_bonus IS NOT NULL THEN calculated.saved_session_bonus::NUMERIC
                ELSE calculated.live_session_bonus
            END AS session_bonus,
            CASE
                WHEN calculated.is_saved_financial_record AND calculated.saved_rating_bonus IS NOT NULL THEN calculated.saved_rating_bonus::NUMERIC
                ELSE calculated.live_rating_bonus
            END AS rating_bonus,
            CASE
                WHEN calculated.is_saved_financial_record AND calculated.saved_kpi_bonus IS NOT NULL THEN calculated.saved_kpi_bonus::NUMERIC
                ELSE calculated.live_kpi_bonus
            END AS kpi_bonus,
            CASE
                WHEN calculated.is_saved_financial_record AND calculated.saved_deductions IS NOT NULL THEN calculated.saved_deductions::NUMERIC
                ELSE calculated.live_deductions
            END AS deductions,
            calculated.advances,
            CASE
                WHEN calculated.is_saved_financial_record AND calculated.saved_product_commission IS NOT NULL THEN calculated.saved_product_commission::NUMERIC
                ELSE calculated.live_product_commission
            END AS product_sales_commission,
            CASE
                WHEN calculated.is_saved_financial_record AND calculated.saved_total_sessions IS NOT NULL THEN calculated.saved_total_sessions::NUMERIC
                ELSE calculated.live_total_sessions
            END AS total_sessions,
            calculated.saved_total_salary,
            calculated.is_saved_financial_record,
            calculated.status
        FROM calculated
    )
    SELECT
        resolved.ktv_id,
        resolved.ktv_name,
        resolved.base_salary,
        resolved.session_bonus,
        resolved.rating_bonus,
        resolved.kpi_bonus,
        resolved.deductions,
        resolved.advances,
        resolved.product_sales_commission,
        CASE
            WHEN resolved.is_saved_financial_record AND resolved.saved_total_salary IS NOT NULL THEN resolved.saved_total_salary::NUMERIC
            ELSE GREATEST(
                resolved.base_salary
                + resolved.session_bonus
                + resolved.rating_bonus
                + resolved.kpi_bonus
                + resolved.product_sales_commission
                - resolved.deductions
                - resolved.advances,
                0
            )::NUMERIC
        END AS total_salary,
        resolved.total_sessions,
        resolved.status
    FROM resolved
    ORDER BY resolved.ktv_name;
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.calculate_ktv_salary_sheet(DATE, UUID) TO authenticated, service_role;

-- Reload Schema
NOTIFY pgrst, 'reload schema';
