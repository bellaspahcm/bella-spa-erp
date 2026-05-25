-- Migration: 20260526000000_ai_agent_infrastructure.sql
-- Description: Cấu hình cơ sở dữ liệu và RLS cho hệ thống Bella AI ERP (Lõi AI + CHRO Agent)

-- 1. Tạo bảng cấu hình AI (Bot Token, Chat ID Telegram của chi nhánh)
CREATE TABLE IF NOT EXISTS public.ai_agent_configs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_tenant_ai_config UNIQUE(tenant_id)
);

-- 2. Tạo bảng nhật ký hoạt động của AI (Lưu vết hội thoại, phân tích phòng ban)
CREATE TABLE IF NOT EXISTS public.ai_agent_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender TEXT NOT NULL CONSTRAINT check_ai_sender CHECK (
        sender IN ('ceo', 'coo', 'cfo', 'chro', 'ktv_coordinator', 'sales_crm', 'marketing', 'operations_inventory')
    ),
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Kích hoạt Row Level Security (RLS) bảo mật đa chi nhánh
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_logs ENABLE ROW LEVEL SECURITY;

-- 4. Cấp quyền truy cập cho Authenticated và Service Role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_configs TO service_role;

GRANT SELECT, INSERT ON public.ai_agent_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_logs TO service_role;

-- 5. Tạo chính sách bảo mật RLS cho ai_agent_configs (Chỉ admin chi nhánh được quản lý)
CREATE POLICY "Admin có toàn quyền quản lý cấu hình AI của chi nhánh"
    ON public.ai_agent_configs
    FOR ALL
    TO authenticated
    USING (
        get_my_tenant_id() = tenant_id 
        AND 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'accountant')
        )
    );

-- 6. Tạo chính sách bảo mật RLS cho ai_agent_logs (Chỉ admin chi nhánh được xem)
CREATE POLICY "Admin có toàn quyền xem nhật ký AI của chi nhánh"
    ON public.ai_agent_logs
    FOR ALL
    TO authenticated
    USING (
        get_my_tenant_id() = tenant_id 
        AND 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'accountant')
        )
    );

-- 7. Viết hàm Database Function (RPC) an toàn cho CHRO Agent
-- Hàm: get_ai_attendance_kpis (Chấm công, GPS lệch và Đi trễ của KTV)
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
BEGIN
    -- Kiểm tra quyền bảo mật: Chỉ cho phép người dùng thuộc vai trò admin hoặc accountant
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'accountant')
    ) THEN
        RAISE EXCEPTION 'Quyền hạn không hợp lệ. Bạn không có quyền truy cập dữ liệu nhân sự.';
    END IF;

    RETURN QUERY
    WITH ktv_list AS (
        SELECT users.id, users.full_name, users.tenant_id
        FROM public.users
        WHERE users.role = 'ktv'
          AND users.tenant_id = get_my_tenant_id()
    ),
    att_stats AS (
        SELECT 
            attendance.ktv_id,
            COUNT(attendance.id) FILTER (WHERE attendance.status = 'present') AS present_c,
            COUNT(attendance.id) FILTER (WHERE attendance.status = 'late') AS late_c,
            COUNT(attendance.id) FILTER (WHERE attendance.status = 'absent') AS absent_c
        FROM public.attendance
        WHERE attendance.tenant_id = get_my_tenant_id()
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
        WHERE shifts.tenant_id = get_my_tenant_id()
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

-- Cấp quyền thực thi hàm RPC cho các vai trò authenticated và service_role
GRANT EXECUTE ON FUNCTION public.get_ai_attendance_kpis(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_attendance_kpis(DATE) TO service_role;
