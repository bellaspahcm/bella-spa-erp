-- =============================================================================
-- Migration: Update GPS Threshold & Customer GPS
-- Ngày: 2026-05-30
-- Mục đích:
--   1. Thêm hai cột latitude và longitude vào bảng customers để lưu tọa độ nhà khách.
--   2. Cập nhật giá trị mặc định của gps_threshold_m trong bảng tenants thành 200 (mét).
--   3. Cập nhật các bản ghi tenant hiện có có gps_threshold_m = 500 thành 200.
--   4. Viết lại hàm RPC get_ai_attendance_kpis để:
--      → Quét dữ liệu thực tế từ session_logs thay vì bảng shifts trống.
--      → So khớp vị trí check-in của KTV với tọa độ nhà khách (customers).
--      → Fallback so khớp với tọa độ chi nhánh nếu nhà khách chưa có tọa độ chuẩn.
-- =============================================================================

-- 1. Thêm cột tọa độ vào bảng customers
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.customers.latitude IS 'Vĩ độ nhà khách hàng (định vị GPS chuẩn).';
COMMENT ON COLUMN public.customers.longitude IS 'Kinh độ nhà khách hàng (định vị GPS chuẩn).';

-- 2. Cập nhật giá trị mặc định của sai số GPS thành 200m trong tenants
ALTER TABLE public.tenants 
  ALTER COLUMN gps_threshold_m SET DEFAULT 200;

-- 3. Cập nhật các tenant hiện tại đang dùng ngưỡng cũ 500m hoặc NULL về 200m
UPDATE public.tenants 
  SET gps_threshold_m = 200 
  WHERE gps_threshold_m = 500 OR gps_threshold_m IS NULL;

-- 4. Viết lại hàm RPC get_ai_attendance_kpis
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
    v_threshold_deg DOUBLE PRECISION;  -- Ngưỡng độ bình phương (cho chi nhánh)
BEGIN
    -- Authorization: service_role HOẶC admin/accountant/hr authenticated
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND users.role IN ('admin', 'accountant', 'hr')
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

    -- Lấy tọa độ và ngưỡng sai số của chi nhánh
    SELECT tenant_lat, tenant_lon,
           POWER(COALESCE(gps_threshold_m, 200) / 111000.0, 2)  -- Đổi m → độ bình phương, 1° ≈ 111km
    INTO v_lat, v_lon, v_threshold_deg
    FROM public.tenants
    WHERE id = v_tenant_id;

    -- Nếu tenant chưa cấu hình tọa độ → tắt kiểm tra GPS dự phòng cho chi nhánh
    IF v_lat IS NULL OR v_lon IS NULL THEN
        v_threshold_deg := NULL;
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
        -- Lấy dữ liệu ca hoàn thành thực tế từ session_logs và đối chiếu tọa độ
        SELECT
            s.completed_by_ktv_id AS ktv_id,
            COUNT(s.id) AS total_s,
            COUNT(s.id) FILTER (
                WHERE s.status = 'completed'
                  AND s.checkin_lat IS NOT NULL
                  AND s.checkin_lon IS NOT NULL
                  AND (
                      CASE
                          -- Nếu khách hàng đã có tọa độ GPS chuẩn → So khớp với tọa độ khách hàng (ngưỡng gps_threshold_m, mặc định 200m)
                          WHEN c.latitude IS NOT NULL AND c.longitude IS NOT NULL THEN
                              (
                                  (s.checkin_lat::double precision - c.latitude) * (s.checkin_lat::double precision - c.latitude)
                                + (s.checkin_lon::double precision - c.longitude) * (s.checkin_lon::double precision - c.longitude)
                              ) > POWER(COALESCE(t.gps_threshold_m, 200) / 111000.0, 2)
                          -- Fallback: So khớp với chi nhánh nếu chưa cấu hình tọa độ khách hàng
                          ELSE
                              v_threshold_deg IS NOT NULL AND (
                                  (s.checkin_lat::double precision - v_lat) * (s.checkin_lat::double precision - v_lat)
                                + (s.checkin_lon::double precision - v_lon) * (s.checkin_lon::double precision - v_lon)
                              ) > v_threshold_deg
                      END
                  )
            ) AS gps_anom
        FROM public.session_logs s
        LEFT JOIN public.bookings b ON s.booking_id = b.id
        LEFT JOIN public.customers c ON b.customer_id = c.id
        LEFT JOIN public.tenants t ON s.tenant_id = t.id
        WHERE s.tenant_id = v_tenant_id
          AND date_trunc('month', s.completed_date) = date_trunc('month', p_month_year)
        GROUP BY s.completed_by_ktv_id
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
