-- Migration: 20260526020000_allow_service_role_ai_rpc.sql
-- Description: Cho phép vai trò service_role (hệ thống chạy ngầm) gọi các hàm RPC get_ai_attendance_kpis và calculate_ktv_salary_sheet để phục vụ Telegram Webhook và Cron Job Autopilot

-- 1. Sửa hàm get_ai_attendance_kpis
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
BEGIN
    -- Kiểm tra quyền bảo mật: Cho phép service_role HOẶC (người dùng authenticated phải là admin/accountant)
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'accountant')
        ) THEN
            RAISE EXCEPTION 'Quyền hạn không hợp lệ. Bạn không có quyền truy cập dữ liệu nhân sự.';
        END IF;
    END IF;

    -- Lấy tenant_id của ngữ cảnh hiện tại
    IF auth.role() = 'service_role' THEN
        -- Chạy ngầm thì cần đảm bảo có tenant context (lấy tenant đầu tiên làm mặc định hoặc dựa trên tham số nếu có, ở đây get_my_tenant_id() có thể trả về null nếu không có auth.uid())
        -- Để an toàn cho service_role, chúng ta lấy tenant_id từ session config nếu được set, hoặc lấy từ tenant đầu tiên của hệ thống làm fallback
        v_tenant_id := COALESCE(
            NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
            (SELECT id FROM public.tenants LIMIT 1)
        );
    ELSE
        v_tenant_id := get_my_tenant_id();
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
                  AND (
                    (shifts.checkin_lat IS NOT NULL AND shifts.checkin_lon IS NOT NULL AND 
                     (shifts.checkin_lat - 10.7756)*(shifts.checkin_lat - 10.7756) + 
                     (shifts.checkin_lon - 106.7019)*(shifts.checkin_lon - 106.7019) > 0.0001) -- Ngưỡng lệch vị trí
                  )
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


-- 2. Sửa hàm calculate_ktv_salary_sheet
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
    -- Kiểm tra quyền bảo mật: Cho phép service_role HOẶC (người dùng authenticated phải là admin/accountant)
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'accountant')
        ) THEN
            RAISE EXCEPTION 'Quyền hạn không hợp lệ. Bạn không có quyền truy cập dữ liệu tính lương.';
        END IF;
    END IF;

    -- Lấy tenant_id của ngữ cảnh hiện tại
    IF auth.role() = 'service_role' THEN
        v_tenant_id := COALESCE(
            NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
            (SELECT id FROM public.tenants LIMIT 1)
        );
    ELSE
        v_tenant_id := get_my_tenant_id();
    END IF;

    -- Đọc cấu hình lương (salary_config JSONB) từ bảng tenants
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
        -- Đếm số ngày công thực tế trong tháng (present/late = 1.0, half_day = 0.5)
        SELECT 
            attendance.ktv_id,
            SUM(
                CASE 
                    WHEN attendance.status IN ('present', 'late') THEN 1.0
                    WHEN attendance.status = 'half_day' THEN 0.5
                    ELSE 0.0
                END
            ) AS work_days
        FROM public.attendance
        WHERE attendance.tenant_id = v_tenant_id
          AND date_trunc('month', attendance.date) = date_trunc('month', p_month_year)
        GROUP BY attendance.ktv_id
    ),
    completed_sessions AS (
        -- Lấy toàn bộ buổi đã làm và hoa hồng tương ứng
        SELECT 
            s.completed_by_ktv_id AS ktv_id,
            COUNT(s.id)::INTEGER AS sessions_count,
            SUM(COALESCE(b.ktv_commission, 150000)) AS total_commissions,
            -- Tính điểm rating trung bình để làm cơ sở thưởng đánh giá
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
    existing_salary_records AS (
        -- Đọc các khoản điều chỉnh thủ công đã lưu (khấu trừ vi phạm, ứng trước)
        SELECT 
            r.ktv_id,
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
        -- Lương cơ bản theo ngày công thực tế (Pro-rata: công thực tế / 26 ngày công chuẩn)
        COALESCE(
            er.saved_base_salary::NUMERIC,
            ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 26.0))::NUMERIC
        ) AS base_salary,
        
        -- Tổng hoa hồng ca làm thực tế
        COALESCE(cs.total_commissions, 0)::NUMERIC AS session_bonus,
        
        -- Thưởng sao đánh giá động
        COALESCE(
            CASE 
                WHEN cs.average_rating = 5.0 THEN cs.sessions_count * v_bonus_5_star
                WHEN cs.average_rating >= 4.5 THEN cs.sessions_count * v_bonus_4_5_star
                WHEN cs.average_rating >= 4.0 THEN cs.sessions_count * v_bonus_4_star
                ELSE 0
            END,
            0
        )::NUMERIC AS rating_bonus,
        
        -- Thưởng KPI số ca đạt chỉ tiêu
        COALESCE(
            er.saved_kpi_bonus::NUMERIC,
            CASE 
                WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount
                ELSE 0
            END::NUMERIC
        ) AS kpi_bonus,
        
        -- Khấu trừ lỗi vi phạm (đi trễ, vi phạm GPS)
        COALESCE(er.saved_deductions, 0)::NUMERIC AS deductions,
        
        -- Các điều chỉnh/tạm ứng khác
        COALESCE(er.saved_advances, 0)::NUMERIC AS advances,
        
        -- Tổng thu thực lĩnh thực tế
        (
            -- Lương cứng
            COALESCE(er.saved_base_salary::NUMERIC, ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 26.0))::NUMERIC) +
            -- Hoa hồng ca làm
            COALESCE(cs.total_commissions, 0)::NUMERIC +
            -- Thưởng sao
            COALESCE(
                CASE 
                    WHEN cs.average_rating = 5.0 THEN cs.sessions_count * v_bonus_5_star
                    WHEN cs.average_rating >= 4.5 THEN cs.sessions_count * v_bonus_4_5_star
                    WHEN cs.average_rating >= 4.0 THEN cs.sessions_count * v_bonus_4_star
                    ELSE 0
                END,
                0
            )::NUMERIC +
            -- Thưởng KPI
            COALESCE(er.saved_kpi_bonus::NUMERIC, CASE WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount ELSE 0 END::NUMERIC) -
            -- Khấu trừ
            COALESCE(er.saved_deductions, 0)::NUMERIC -
            -- Tạm ứng
            COALESCE(er.saved_advances, 0)::NUMERIC
        ) AS total_salary,
        
        -- Tổng số ca làm completed
        COALESCE(cs.sessions_count, 0)::INTEGER AS total_sessions,
        
        -- Trạng thái chốt lương
        COALESCE(er.record_status, 'draft') AS status
    FROM ktv_users u
    LEFT JOIN actual_work_days aw ON u.id = aw.ktv_id
    LEFT JOIN completed_sessions cs ON u.id = cs.ktv_id
    LEFT JOIN existing_salary_records er ON u.id = er.ktv_id
    ORDER BY u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Tạo hàm set_session_tenant để service_role thiết lập tenant context cho session
CREATE OR REPLACE FUNCTION public.set_session_tenant(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_session_tenant(UUID) TO authenticated, service_role;

