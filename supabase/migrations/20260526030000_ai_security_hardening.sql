-- =============================================================================
-- Migration: AI Security Hardening (C2 + H1)
-- Ngày: 2026-05-26
-- Mục đích:
--   1. C2: Bỏ fallback `SELECT tenants LIMIT 1` nguy hiểm trong RPC AI agent.
--      → Service role BẮT BUỘC gọi set_session_tenant() trước khi gọi RPC.
--      → Nếu không có tenant context, RAISE EXCEPTION rõ ràng.
--   2. H1: Thêm tenant_lat, tenant_lon, gps_threshold_m vào bảng tenants.
--      → Sửa GPS anomaly detection dùng tenant coordinates thật.
--      → Backfill HQ + Quận 7 với toạ độ Saigon mặc định.
-- =============================================================================


-- =============================================================================
-- 1. H1: Thêm cột tenant GPS coordinates
-- =============================================================================
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS tenant_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS tenant_lon DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS gps_threshold_m INTEGER DEFAULT 500;

COMMENT ON COLUMN public.tenants.tenant_lat IS 'Vĩ độ trung tâm chi nhánh (degrees). Dùng cho GPS anomaly detection.';
COMMENT ON COLUMN public.tenants.tenant_lon IS 'Kinh độ trung tâm chi nhánh (degrees).';
COMMENT ON COLUMN public.tenants.gps_threshold_m IS 'Ngưỡng lệch GPS coi là anomaly (mét). Mặc định 500m.';

-- Backfill toạ độ Saigon mặc định cho các tenant chưa có
UPDATE public.tenants
SET tenant_lat = 10.7756,
    tenant_lon = 106.7019,
    gps_threshold_m = 500
WHERE tenant_lat IS NULL OR tenant_lon IS NULL;


-- =============================================================================
-- 2. C2 + H1: Override get_ai_attendance_kpis
--    - Bỏ fallback SELECT tenants LIMIT 1
--    - Dùng tenant coordinates thật cho GPS check
--    - Threshold tính theo mét (1 degree ≈ 111km tại equator)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_ai_attendance_kpis(
    p_month_year DATE
)
RETURNS TABLE (
    ktv_id UUID,
    ktv_name TEXT,
    total_shifts BIGINT,
    present_count BIGINT,
    late_count BIGINT,
    absent_count BIGINT,
    gps_anomaly_count BIGINT
) AS $$
#variable_conflict use_column
DECLARE
    v_tenant_id UUID;
    v_lat DOUBLE PRECISION;
    v_lon DOUBLE PRECISION;
    v_threshold_deg DOUBLE PRECISION;  -- Threshold converted to degrees squared
BEGIN
    -- Authorization: service_role HOẶC admin/accountant authenticated
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND users.role IN ('admin', 'accountant')
        ) THEN
            RAISE EXCEPTION 'Quyền hạn không hợp lệ. Bạn không có quyền truy cập dữ liệu nhân sự.';
        END IF;
    END IF;

    -- Lấy tenant_id từ context
    IF auth.role() = 'service_role' THEN
        -- ⚠️ C2 FIX: Service role PHẢI gọi set_session_tenant() trước
        v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Service role context error: must call set_session_tenant(tenant_id) before this RPC. Cross-tenant data leak protection.';
        END IF;
    ELSE
        v_tenant_id := get_my_tenant_id();
        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Tài khoản không liên kết với chi nhánh hợp lệ.';
        END IF;
    END IF;

    -- ⚠️ H1 FIX: Lấy GPS coordinates từ tenants table thay vì hardcode
    SELECT tenant_lat, tenant_lon,
           POWER(COALESCE(gps_threshold_m, 500) / 111000.0, 2)  -- Convert m → degrees², 1° ≈ 111km
    INTO v_lat, v_lon, v_threshold_deg
    FROM public.tenants
    WHERE id = v_tenant_id;

    -- Nếu tenant chưa có toạ độ → skip GPS check (trả 0 anomaly)
    IF v_lat IS NULL OR v_lon IS NULL THEN
        v_threshold_deg := NULL;  -- Disable GPS check
    END IF;

    RETURN QUERY
    WITH ktv_list AS (
        SELECT users.id, users.full_name, users.tenant_id
        FROM public.users
        WHERE users.role = 'ktv'
          AND users.tenant_id = v_tenant_id
    ),
    att_stats AS (
        SELECT
            attendance.ktv_id,
            COUNT(attendance.id) FILTER (WHERE attendance.status = 'present') AS present_c,
            COUNT(attendance.id) FILTER (WHERE attendance.status = 'late') AS late_c,
            COUNT(attendance.id) FILTER (WHERE attendance.status = 'absent') AS absent_c
        FROM public.attendance
        WHERE attendance.tenant_id = v_tenant_id
          AND date_trunc('month', attendance.date) = date_trunc('month', p_month_year)
        GROUP BY attendance.ktv_id
    ),
    shift_stats AS (
        SELECT
            shifts.ktv_id,
            COUNT(shifts.id) AS total_s,
            COUNT(shifts.id) FILTER (
                WHERE shifts.status = 'completed'
                  AND v_threshold_deg IS NOT NULL
                  AND shifts.checkin_lat IS NOT NULL
                  AND shifts.checkin_lon IS NOT NULL
                  AND (
                      (shifts.checkin_lat - v_lat) * (shifts.checkin_lat - v_lat)
                    + (shifts.checkin_lon - v_lon) * (shifts.checkin_lon - v_lon)
                  ) > v_threshold_deg
            ) AS gps_anom
        FROM public.shifts
        WHERE shifts.tenant_id = v_tenant_id
          AND date_trunc('month', shifts.date) = date_trunc('month', p_month_year)
        GROUP BY shifts.ktv_id
    )
    SELECT
        k.id AS ktv_id,
        k.full_name AS ktv_name,
        COALESCE(s.total_s, 0)::BIGINT AS total_shifts,
        COALESCE(a.present_c, 0)::BIGINT AS present_count,
        COALESCE(a.late_c, 0)::BIGINT AS late_count,
        COALESCE(a.absent_c, 0)::BIGINT AS absent_count,
        COALESCE(s.gps_anom, 0)::BIGINT AS gps_anomaly_count
    FROM ktv_list k
    LEFT JOIN att_stats a ON k.id = a.ktv_id
    LEFT JOIN shift_stats s ON k.id = s.ktv_id
    ORDER BY k.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_ai_attendance_kpis(DATE) TO authenticated, service_role;


-- =============================================================================
-- 3. C2: Override calculate_ktv_salary_sheet
--    Bỏ fallback SELECT tenants LIMIT 1 — bắt buộc set tenant context
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_ktv_salary_sheet(
    p_month_year DATE
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
    total_salary NUMERIC,
    total_sessions INTEGER,
    status TEXT
) AS $$
#variable_conflict use_column
DECLARE
    v_tenant_id UUID;
    v_bonus_5_star NUMERIC;
    v_bonus_4_5_star NUMERIC;
    v_bonus_4_star NUMERIC;
    v_kpi_target_sessions INTEGER;
    v_kpi_bonus_amount NUMERIC;
BEGIN
    -- Authorization
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND users.role IN ('admin', 'accountant')
        ) THEN
            RAISE EXCEPTION 'Quyền hạn không hợp lệ. Bạn không có quyền truy cập dữ liệu tính lương.';
        END IF;
    END IF;

    -- ⚠️ C2 FIX: Service role bắt buộc set_session_tenant()
    IF auth.role() = 'service_role' THEN
        v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Service role context error: must call set_session_tenant(tenant_id) before this RPC. Cross-tenant data leak protection.';
        END IF;
    ELSE
        v_tenant_id := get_my_tenant_id();
        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Tài khoản không liên kết với chi nhánh hợp lệ.';
        END IF;
    END IF;

    -- Đọc salary config
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
        SELECT users.id, users.full_name,
               COALESCE(users.base_salary, 6000000) AS raw_base_salary
        FROM public.users
        WHERE users.role = 'ktv' AND users.tenant_id = v_tenant_id
    ),
    actual_work_days AS (
        SELECT attendance.ktv_id,
               SUM(CASE
                   WHEN attendance.status IN ('present', 'late') THEN 1.0
                   WHEN attendance.status = 'half_day' THEN 0.5
                   ELSE 0.0
               END) AS work_days
        FROM public.attendance
        WHERE attendance.tenant_id = v_tenant_id
          AND date_trunc('month', attendance.date) = date_trunc('month', p_month_year)
        GROUP BY attendance.ktv_id
    ),
    completed_sessions AS (
        SELECT s.completed_by_ktv_id AS ktv_id,
               COUNT(s.id)::INTEGER AS sessions_count,
               SUM(COALESCE(b.ktv_commission, 150000)) AS total_commissions,
               AVG(COALESCE(
                   (SELECT sr.rating FROM public.session_reviews sr WHERE sr.session_log_id = s.id AND sr.status = 'approved' LIMIT 1),
                   s.rating, 5.0
               )) AS average_rating
        FROM public.session_logs s
        LEFT JOIN public.bookings b ON s.booking_id = b.id
        WHERE s.tenant_id = v_tenant_id AND s.status = 'completed'
          AND date_trunc('month', s.completed_date) = date_trunc('month', p_month_year)
        GROUP BY s.completed_by_ktv_id
    ),
    existing_salary_records AS (
        SELECT r.ktv_id,
               r.base_salary AS saved_base_salary,
               r.kpi_bonus AS saved_kpi_bonus,
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
        COALESCE(er.saved_base_salary::NUMERIC,
                 ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 26.0))::NUMERIC) AS base_salary,
        COALESCE(cs.total_commissions, 0)::NUMERIC AS session_bonus,
        COALESCE(CASE
            WHEN cs.average_rating = 5.0 THEN cs.sessions_count * v_bonus_5_star
            WHEN cs.average_rating >= 4.5 THEN cs.sessions_count * v_bonus_4_5_star
            WHEN cs.average_rating >= 4.0 THEN cs.sessions_count * v_bonus_4_star
            ELSE 0
        END, 0)::NUMERIC AS rating_bonus,
        COALESCE(er.saved_kpi_bonus::NUMERIC,
                 CASE WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount ELSE 0 END::NUMERIC) AS kpi_bonus,
        COALESCE(er.saved_deductions, 0)::NUMERIC AS deductions,
        COALESCE(er.saved_advances, 0)::NUMERIC AS advances,
        (
            COALESCE(er.saved_base_salary::NUMERIC, ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 26.0))::NUMERIC) +
            COALESCE(cs.total_commissions, 0)::NUMERIC +
            COALESCE(CASE
                WHEN cs.average_rating = 5.0 THEN cs.sessions_count * v_bonus_5_star
                WHEN cs.average_rating >= 4.5 THEN cs.sessions_count * v_bonus_4_5_star
                WHEN cs.average_rating >= 4.0 THEN cs.sessions_count * v_bonus_4_star
                ELSE 0
            END, 0)::NUMERIC +
            COALESCE(er.saved_kpi_bonus::NUMERIC,
                     CASE WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount ELSE 0 END::NUMERIC) -
            COALESCE(er.saved_deductions, 0)::NUMERIC -
            COALESCE(er.saved_advances, 0)::NUMERIC
        ) AS total_salary,
        COALESCE(cs.sessions_count, 0)::INTEGER AS total_sessions,
        COALESCE(er.record_status, 'draft') AS status
    FROM ktv_users u
    LEFT JOIN actual_work_days aw ON u.id = aw.ktv_id
    LEFT JOIN completed_sessions cs ON u.id = cs.ktv_id
    LEFT JOIN existing_salary_records er ON u.id = er.ktv_id
    ORDER BY u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.calculate_ktv_salary_sheet(DATE) TO authenticated, service_role;


NOTIFY pgrst, 'reload schema';
