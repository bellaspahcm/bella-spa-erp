-- =============================================================================
-- Migration: Fix Attendance Logic
-- Ngày: 2026-05-26
-- Mục đích:
--   1. Sửa lỗi logic tính `total_shifts` trong RPC `get_ai_attendance_kpis`:
--      → Nếu bảng `shifts` trống (không phân ca trước), `total_shifts` sẽ tự động
--        được tính bằng tổng số ngày chấm công (present + late + absent) của KTV.
--      → Giúp AI COO đánh giá tỷ lệ đúng giờ chính xác (không bị fallback về 100%).
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

    -- Lấy GPS coordinates từ tenants table thay vì hardcode
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
        COALESCE(
            NULLIF(s.total_s, 0),
            COALESCE(a.present_c, 0) + COALESCE(a.late_c, 0) + COALESCE(a.absent_c, 0),
            0
        )::BIGINT AS total_shifts,
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

NOTIFY pgrst, 'reload schema';
