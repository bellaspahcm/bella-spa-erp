-- =============================================================================
-- Migration: Fix Salary Reconciliation Logic & Sync
-- Ngày: 2026-05-30
-- Mục đích:
--   1. Sửa hàm public.get_salary_reconciliation_report để tính đúng legacy_total
--      (Bao gồm base_salary, session_bonus, kpi_bonus, rating_bonus trừ đi violations_deduction).
--   2. Sửa hàm public.calculate_ktv_salary_sheet để nếu đã có salary_records
--      được lưu (status !== 'draft') thì dùng trực tiếp total_salary, session_bonus,
--      rating_bonus đã lưu thay vì tính toán lại realtime sai lệch.
-- =============================================================================

-- 1. Sửa hàm calculate_ktv_salary_sheet
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
    -- Authorization: service_role HOẶC admin/accountant/hr authenticated
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND users.role IN ('admin', 'accountant', 'hr')
        ) THEN
            RAISE EXCEPTION 'Quyền hạn không hợp lệ. Bạn không có quyền truy cập dữ liệu tính lương.';
        END IF;
    END IF;

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
               r.session_bonus AS saved_session_bonus,
               r.rating_bonus AS saved_rating_bonus,
               r.total_salary AS saved_total_salary,
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
        COALESCE(er.saved_session_bonus::NUMERIC,
                 COALESCE(cs.total_commissions, 0)::NUMERIC) AS session_bonus,
        COALESCE(er.saved_rating_bonus::NUMERIC,
                 COALESCE(CASE
                     WHEN cs.average_rating = 5.0 THEN cs.sessions_count * v_bonus_5_star
                     WHEN cs.average_rating >= 4.5 THEN cs.sessions_count * v_bonus_4_5_star
                     WHEN cs.average_rating >= 4.0 THEN cs.sessions_count * v_bonus_4_star
                     ELSE 0
                 END, 0)::NUMERIC) AS rating_bonus,
        COALESCE(er.saved_kpi_bonus::NUMERIC,
                 CASE WHEN COALESCE(cs.sessions_count, 0) > v_kpi_target_sessions THEN v_kpi_bonus_amount ELSE 0 END::NUMERIC) AS kpi_bonus,
        COALESCE(er.saved_deductions, 0)::NUMERIC AS deductions,
        COALESCE(er.saved_advances, 0)::NUMERIC AS advances,
        COALESCE(er.saved_total_salary::NUMERIC,
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
            )::NUMERIC
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


-- 2. Sửa hàm get_salary_reconciliation_report để lấy đúng legacy_total và legacy_session
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
    legacy_deductions NUMERIC,
    legacy_total NUMERIC,
    legacy_status TEXT,
    ai_base_salary NUMERIC,
    ai_session_bonus NUMERIC,
    ai_kpi_bonus NUMERIC,
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
    -- Authorization
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
            s.deductions AS ai_ded,
            s.total_salary AS ai_tot
        FROM public.calculate_ktv_salary_sheet(p_month_year) s
    ),
    legacy_records AS (
        -- Lấy salary_records cũ (legacy) — nếu admin đã insert/confirm
        -- Sử dụng chính xác session_bonus, rating_bonus và total_salary
        SELECT
            r.ktv_id,
            COALESCE(r.base_salary, 0)::NUMERIC AS legacy_base,
            COALESCE(r.session_bonus, 0)::NUMERIC AS legacy_session,
            COALESCE(r.kpi_bonus, 0)::NUMERIC AS legacy_kpi,
            COALESCE(r.violations_deduction, 0)::NUMERIC AS legacy_ded,
            COALESCE(r.total_salary, 
                (
                    COALESCE(r.base_salary, 0) +
                    COALESCE(r.session_bonus, 0) +
                    COALESCE(r.kpi_bonus, 0) +
                    COALESCE(r.rating_bonus, 0) -
                    COALESCE(r.violations_deduction, 0) -
                    COALESCE(r.service_percentage_bonus, 0)
                )
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
        COALESCE(lr.legacy_ded, 0)::NUMERIC AS legacy_deductions,
        COALESCE(lr.legacy_tot, 0)::NUMERIC AS legacy_total,
        COALESCE(lr.legacy_stat, 'missing')::TEXT AS legacy_status,
        ai.ai_base::NUMERIC AS ai_base_salary,
        ai.ai_session::NUMERIC AS ai_session_bonus,
        ai.ai_kpi::NUMERIC AS ai_kpi_bonus,
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


-- 3. Sửa hàm get_salary_reconciliation để đồng bộ số liệu trên trang Đối soát AI Copilot
CREATE OR REPLACE FUNCTION public.get_salary_reconciliation(
    p_month_year DATE
)
RETURNS TABLE (
    ktv_id              UUID,
    ktv_name            TEXT,
    legacy_total        NUMERIC,    -- tổng lương từ salary_records (kế toán chốt)
    ai_total            NUMERIC,    -- tổng lương từ calculate_ktv_salary_sheet (AI tính)
    diff_amount         NUMERIC,    -- ai_total - legacy_total
    diff_percent        NUMERIC,    -- |diff| / legacy_total * 100, NULL nếu NO_LEGACY
    status              TEXT,       -- MATCH / MINOR_DIFF / MAJOR_DIFF / NO_LEGACY
    legacy_status       TEXT,       -- trạng thái chốt trong salary_records
    has_legacy_record   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
#variable_conflict use_column
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Bảo mật: cho phép admin / accountant / hr / super_admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'accountant', 'hr', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Quyền hạn không hợp lệ. Chỉ Admin / Kế toán / Nhân sự được xem báo cáo đối soát lương.';
    END IF;

    v_tenant_id := public.get_my_tenant_id();

    RETURN QUERY
    WITH
    legacy AS (
        SELECT
            r.ktv_id,
            COALESCE(r.total_salary, 
                (
                    COALESCE(r.base_salary,               0) +
                    COALESCE(r.session_bonus,             0) +
                    COALESCE(r.kpi_bonus,                 0) +
                    COALESCE(r.rating_bonus,              0) -
                    COALESCE(r.violations_deduction,      0) -
                    COALESCE(r.service_percentage_bonus,  0)
                )
            )::NUMERIC                      AS total_legacy,
            r.status                        AS rec_status
        FROM public.salary_records r
        WHERE r.tenant_id = v_tenant_id
          AND date_trunc('month', r.month_year) = date_trunc('month', p_month_year)
    ),
    ai_calc AS (
        SELECT
            s.ktv_id,
            s.ktv_name,
            s.total_salary::NUMERIC AS total_ai
        FROM public.calculate_ktv_salary_sheet(p_month_year) s
    )
    SELECT
        ac.ktv_id,
        ac.ktv_name,
        COALESCE(lg.total_legacy, 0)                                AS legacy_total,
        ac.total_ai                                                 AS ai_total,
        (ac.total_ai - COALESCE(lg.total_legacy, 0))                AS diff_amount,
        CASE
            WHEN lg.total_legacy IS NULL OR lg.total_legacy = 0 THEN NULL
            ELSE ROUND(
                ABS(ac.total_ai - lg.total_legacy) / lg.total_legacy * 100,
                2
            )
        END                                                         AS diff_percent,
        CASE
            WHEN lg.total_legacy IS NULL                            THEN 'NO_LEGACY'
            WHEN ABS(ac.total_ai - lg.total_legacy) < 5000
              OR (lg.total_legacy > 0
                  AND ABS(ac.total_ai - lg.total_legacy) / lg.total_legacy * 100 < 1)
                                                                    THEN 'MATCH'
            WHEN lg.total_legacy > 0
              AND ABS(ac.total_ai - lg.total_legacy) / lg.total_legacy * 100 < 5
                                                                    THEN 'MINOR_DIFF'
            ELSE                                                         'MAJOR_DIFF'
        END                                                         AS status,
        COALESCE(lg.rec_status, 'none')                             AS legacy_status,
        (lg.ktv_id IS NOT NULL)                                     AS has_legacy_record
    FROM ai_calc ac
    LEFT JOIN legacy lg ON lg.ktv_id = ac.ktv_id
    ORDER BY
        CASE
            WHEN lg.total_legacy IS NULL OR lg.total_legacy = 0 THEN NULL
            ELSE ABS(ac.total_ai - lg.total_legacy) / lg.total_legacy * 100
        END DESC NULLS FIRST,
        ac.ktv_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_salary_reconciliation(DATE) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
