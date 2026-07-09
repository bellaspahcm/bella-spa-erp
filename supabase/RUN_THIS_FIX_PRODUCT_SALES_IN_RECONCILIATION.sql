-- =============================================================================
-- CHẠY SCRIPT NÀY TRONG SUPABASE DASHBOARD SQL EDITOR
-- Fix: Thêm product_sales_commission vào salary reconciliation RPC
-- =============================================================================

-- Drop existing function first to avoid return type conflict
DROP FUNCTION IF EXISTS public.calculate_ktv_salary_sheet(DATE);
DROP FUNCTION IF EXISTS public.get_salary_reconciliation_report(UUID, DATE);

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
    product_sales_commission NUMERIC,
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
    -- 1. Bảo mật: Chỉ quản lý/kế toán mới được xem bảng tính lương
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'accountant')
    ) THEN
        RAISE EXCEPTION 'Quyền hạn không hợp lệ. Bạn không có quyền truy cập dữ liệu tính lương.';
    END IF;

    -- Lấy tenant của chi nhánh hiện tại
    v_tenant_id := get_my_tenant_id();

    -- 2. Đọc cấu hình lương (salary_config JSONB) từ bảng tenants
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
    product_sales_commissions AS (
        -- ⭐ PHẦN MỚI: Sum product sales commission for each KTV this month
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
        -- Đọc các khoản điều chỉnh thủ công đã lưu (khấu trừ vi phạm, ứng trước)
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
        -- Lương cơ bản theo ngày công thực tế (Pro-rata: công thực tế / 26 ngày công chuẩn)
        COALESCE(
            er.saved_base_salary::NUMERIC,
            ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 26.0))::NUMERIC
        ) AS base_salary,
        
        -- Tổng hoa hồng ca làm thực tế
        COALESCE(
            er.saved_session_bonus::NUMERIC,
            cs.total_commissions,
            0
        )::NUMERIC AS session_bonus,
        
        -- Thưởng sao đánh giá động
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
        
        -- Thưởng KPI số ca đạt chỉ tiêu
        COALESCE(
            er.saved_kpi_bonus::NUMERIC,
            CASE 
                WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount
                ELSE 0
            END::NUMERIC
        ) AS kpi_bonus,
        
        -- ⭐ PHẦN MỚI: Hoa hồng bán hàng sản phẩm
        COALESCE(
            er.saved_product_sales_commission::NUMERIC,
            psc.total_product_commission,
            0
        )::NUMERIC AS product_sales_commission,
        
        -- ⭐ CẬP NHẬT: Khấu trừ vi phạm (ưu tiên saved, fallback về auto-calculated)
        COALESCE(
            er.saved_deductions,
            ap.auto_penalty,
            0
        )::NUMERIC AS deductions,
        
        -- Các điều chỉnh/tạm ứng khác
        COALESCE(er.saved_advances, 0)::NUMERIC AS advances,
        
        -- ⭐ CẬP NHẬT: Tổng thu thực lĩnh thực tế (THÊM product_sales_commission)
        (
            -- ⭐ CẬP NHẬT: THÊM auto_penalty vào total_salary
            COALESCE(er.saved_base_salary::NUMERIC, ROUND((u.raw_base_salary / 26.0) * COALESCE(aw.work_days, 26.0))::NUMERIC) +
            -- Hoa hồng ca làm
            COALESCE(er.saved_session_bonus::NUMERIC, cs.total_commissions, 0)::NUMERIC +
            -- Thưởng sao
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
            -- Thưởng KPI
            COALESCE(er.saved_kpi_bonus::NUMERIC, CASE WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount ELSE 0 END::NUMERIC) +
            -- ⭐ THÊM: Hoa hồng bán hàng sản phẩm
            COALESCE(er.saved_product_sales_commission::NUMERIC, psc.total_product_commission, 0)::NUMERIC -
            -- ⭐ CẬP NHẬT: Khấu trừ (ưu tiên saved, fallback về auto)
            COALESCE(er.saved_deductions, ap.auto_penalty, 0)::NUMERIC -
            -- Tạm ứng
            COALESCE(er.saved_advances, 0)::NUMERIC
        ) AS total_salary,
        
        -- Tổng số ca làm completed
        COALESCE(cs.sessions_count, 0)::INTEGER AS total_sessions,
        
        -- Trạng thái chốt lương
        COALESCE(er.record_status, 'draft') AS status
    FROM ktv_users u
    LEFT JOIN actual_work_days aw ON u.id = aw.ktv_id
    LEFT JOIN auto_attendance_penalties ap ON u.id = ap.ktv_id  -- ⭐ THÊM JOIN
    LEFT JOIN completed_sessions cs ON u.id = cs.ktv_id
    LEFT JOIN product_sales_commissions psc ON u.id = psc.ktv_id  -- ⭐ THÊM JOIN
    LEFT JOIN existing_salary_records er ON u.id = er.ktv_id
    ORDER BY u.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the reconciliation report RPC to include product_sales_commission
CREATE OR REPLACE FUNCTION public.get_salary_reconciliation_report(
    p_tenant_id UUID,
    p_month_year DATE
)
RETURNS TABLE (
    ktv_id UUID,
    ktv_name TEXT,
    legacy_base_salary NUMERIC,
    legacy_session_bonus NUMERIC,
    legacy_kpi_bonus NUMERIC,
    legacy_product_sales_commission NUMERIC,
    legacy_deductions NUMERIC,
    legacy_total NUMERIC,
    legacy_status TEXT,
    ai_base_salary NUMERIC,
    ai_session_bonus NUMERIC,
    ai_kpi_bonus NUMERIC,
    ai_product_sales_commission NUMERIC,
    ai_deductions NUMERIC,
    ai_total NUMERIC,
    diff_total NUMERIC,
    diff_percent NUMERIC,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
#variable_conflict use_column
DECLARE
    v_period_month DATE;
BEGIN
    -- Authorization (cùng pattern Phase 29.5)
    IF auth.role() <> 'service_role' THEN
        IF NOT (
            public.is_admin()
            AND (public.is_hq_super_admin() OR p_tenant_id = public.get_auth_tenant_id())
        ) THEN
            RAISE EXCEPTION 'Unauthorized: chỉ admin của chi nhánh mới được xem báo cáo đối soát lương.';
        END IF;
    END IF;

    v_period_month := date_trunc('month', p_month_year)::DATE;

    RETURN QUERY
    WITH ai_sheet AS (
        -- Gọi function AI để lấy bảng lương realtime
        SELECT
            s.ktv_id,
            s.ktv_name,
            s.base_salary AS ai_base,
            s.session_bonus AS ai_session,
            s.kpi_bonus AS ai_kpi,
            s.product_sales_commission AS ai_product_sales,  -- ⭐ THÊM
            s.deductions AS ai_ded,
            s.total_salary AS ai_tot
        FROM public.calculate_ktv_salary_sheet(p_month_year) s
    ),
    legacy_records AS (
        -- Lấy salary_records cũ (legacy) — nếu admin đã insert/confirm
        SELECT
            r.ktv_id,
            COALESCE(r.base_salary, 0)::NUMERIC AS legacy_base,
            COALESCE(r.service_percentage_bonus, 0)::NUMERIC AS legacy_session,
            COALESCE(r.kpi_bonus, 0)::NUMERIC AS legacy_kpi,
            COALESCE(r.product_sales_commission, 0)::NUMERIC AS legacy_product_sales,  -- ⭐ THÊM
            COALESCE(r.violations_deduction, 0)::NUMERIC AS legacy_ded,
            (
                COALESCE(r.base_salary, 0) +
                COALESCE(r.service_percentage_bonus, 0) +
                COALESCE(r.kpi_bonus, 0) +
                COALESCE(r.product_sales_commission, 0) -  -- ⭐ THÊM VÀO TỔNG
                COALESCE(r.violations_deduction, 0)
            )::NUMERIC AS legacy_tot,
            COALESCE(r.status, 'missing') AS legacy_stat
        FROM public.salary_records r
        WHERE r.tenant_id = p_tenant_id
          AND date_trunc('month', r.month_year::DATE)::DATE = v_period_month
    )
    SELECT
        ai.ktv_id,
        ai.ktv_name,
        COALESCE(lr.legacy_base, 0)::NUMERIC AS legacy_base_salary,
        COALESCE(lr.legacy_session, 0)::NUMERIC AS legacy_session_bonus,
        COALESCE(lr.legacy_kpi, 0)::NUMERIC AS legacy_kpi_bonus,
        COALESCE(lr.legacy_product_sales, 0)::NUMERIC AS legacy_product_sales_commission,  -- ⭐ THÊM
        COALESCE(lr.legacy_ded, 0)::NUMERIC AS legacy_deductions,
        COALESCE(lr.legacy_tot, 0)::NUMERIC AS legacy_total,
        COALESCE(lr.legacy_stat, 'missing')::TEXT AS legacy_status,
        ai.ai_base::NUMERIC AS ai_base_salary,
        ai.ai_session::NUMERIC AS ai_session_bonus,
        ai.ai_kpi::NUMERIC AS ai_kpi_bonus,
        ai.ai_product_sales::NUMERIC AS ai_product_sales_commission,  -- ⭐ THÊM
        ai.ai_ded::NUMERIC AS ai_deductions,
        ai.ai_tot::NUMERIC AS ai_total,
        (COALESCE(lr.legacy_tot, 0) - ai.ai_tot)::NUMERIC AS diff_total,
        CASE
            WHEN ai.ai_tot > 0 THEN
                (ABS(COALESCE(lr.legacy_tot, 0) - ai.ai_tot) / ai.ai_tot * 100)::NUMERIC(7,2)
            ELSE 0
        END AS diff_percent,
        CASE
            -- Legacy chưa có → cần admin xác nhận
            WHEN lr.legacy_tot IS NULL THEN 'PENDING_LEGACY'
            -- Diff tuyệt đối < 5,000đ → MATCH (bỏ qua lỗi làm tròn)
            WHEN ABS(COALESCE(lr.legacy_tot, 0) - ai.ai_tot) < 5000 THEN 'MATCH'
            -- Diff % < 1% → MINOR_DIFF
            WHEN ai.ai_tot > 0
                 AND ABS(COALESCE(lr.legacy_tot, 0) - ai.ai_tot) / ai.ai_tot < 0.01
                THEN 'MINOR_DIFF'
            -- Còn lại → MAJOR_DIFF
            ELSE 'MAJOR_DIFF'
        END::TEXT AS status
    FROM ai_sheet ai
    LEFT JOIN legacy_records lr ON lr.ktv_id = ai.ktv_id
    ORDER BY ai.ktv_name;
END;
$$;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ✅ DONE! Bây giờ reconciliation screen sẽ hiển thị đúng product_sales_commission
