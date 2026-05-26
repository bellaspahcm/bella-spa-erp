-- =============================================================================
-- Migration: Add HR and Accountant Security Integration & Database Synchronization
-- Ngày: 2026-05-26
-- =============================================================================

-- 1. Cập nhật CHECK constraint trên users.role để hỗ trợ thêm vai trò 'hr'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'ktv_lead', 'ktv', 'admin_staff', 'accountant', 'hr'));

-- 2. Thêm hàm kiểm tra bảo mật definer cho HR và Kế toán
CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN COALESCE(user_role = 'hr', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN COALESCE(user_role = 'accountant', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cập nhật role_permissions mặc định của tất cả các chi nhánh hiện có
UPDATE public.tenants
SET role_permissions = role_permissions || 
  '{"admin_staff": {"dashboard": true, "customers": true, "bookings": true, "sessions": true, "chat": true, "crm": true, "services": true, "inventory": true, "finance": true, "reconciliation": false, "salary": false, "audit": false, "settings": false},
    "accountant": {"dashboard": true, "customers": false, "bookings": false, "sessions": false, "chat": false, "crm": false, "services": true, "inventory": true, "finance": true, "reconciliation": true, "salary": true, "audit": false, "settings": false},
    "hr": {"dashboard": true, "customers": false, "bookings": false, "sessions": true, "chat": false, "crm": false, "services": false, "inventory": false, "finance": false, "reconciliation": false, "salary": true, "audit": false, "settings": false}}'::jsonb;

-- 4. Cập nhật hàm onboard_tenant() để tự động nạp phân quyền mặc định cho chi nhánh mới đăng ký
CREATE OR REPLACE FUNCTION public.onboard_tenant(
    p_spa_name TEXT,
    p_contact_phone TEXT,
    p_address TEXT,
    p_email TEXT,
    p_admin_id UUID,
    p_admin_email TEXT,
    p_admin_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_package_id UUID;
    v_ktv_id UUID;
    v_customer_id UUID;
    v_booking_id UUID;
    v_role_permissions JSONB;
    v_salary_config JSONB;
    v_coa_count INTEGER;
BEGIN
    -- 1. Check email duplicate
    IF EXISTS (SELECT 1 FROM public.users WHERE email = p_admin_email) THEN
        RAISE EXCEPTION 'Email % đã tồn tại trong hệ thống.', p_admin_email;
    END IF;

    -- 2. Default configs (Updated to include ktv_lead, admin_staff, accountant, and hr)
    v_role_permissions := '{"ktv_lead": {"dashboard": true, "customers": false, "bookings": true, "sessions": true, "chat": true, "crm": true, "services": true, "finance": false, "reconciliation": false, "inventory": false, "salary": false, "audit": false, "settings": false},
                            "admin_staff": {"dashboard": true, "customers": true, "bookings": true, "sessions": true, "chat": true, "crm": true, "services": true, "inventory": true, "finance": true, "reconciliation": false, "salary": false, "audit": false, "settings": false},
                            "accountant": {"dashboard": true, "customers": false, "bookings": false, "sessions": false, "chat": false, "crm": false, "services": true, "inventory": true, "finance": true, "reconciliation": true, "salary": true, "audit": false, "settings": false},
                            "hr": {"dashboard": true, "customers": false, "bookings": false, "sessions": true, "chat": false, "crm": false, "services": false, "inventory": false, "finance": false, "reconciliation": false, "salary": true, "audit": false, "settings": false}}'::jsonb;
    v_salary_config := '{"bonus_5_star": 50000, "bonus_4_5_star": 30000, "bonus_4_star": 10000, "kpi_target_sessions": 30, "kpi_bonus_amount": 1000000}'::jsonb;

    -- 3. Create tenant
    INSERT INTO public.tenants (
        name, contact_phone, address, email, status, role_permissions, salary_config
    )
    VALUES (
        p_spa_name, p_contact_phone, p_address, p_email, 'active', v_role_permissions, v_salary_config
    )
    RETURNING id INTO v_tenant_id;

    -- 4. Create admin user
    INSERT INTO public.users (id, email, full_name, role, status, tenant_id)
    VALUES (p_admin_id, p_admin_email, p_admin_name, 'admin', 'active', v_tenant_id);

    -- 5. Seed sample package
    INSERT INTO public.packages (
        name, description, price, full_price, duration, total_sessions, ktv_commission, status, tenant_id
    )
    VALUES (
        'Massage Bầu VIP Nhật Bản',
        'Gói chăm sóc massage bầu cao cấp theo liệu trình Nhật Bản giúp thư giãn cơ thể và giảm stress cho mẹ.',
        1200000, 1200000, '90 phút/buổi', 10, 150000, 'active', v_tenant_id
    )
    RETURNING id INTO v_package_id;

    -- 6. Seed sample KTV
    v_ktv_id := uuid_generate_v4();
    INSERT INTO public.users (id, email, full_name, role, status, tenant_id)
    VALUES (
        v_ktv_id,
        'ktv.mau.' || substring(v_tenant_id::text from 1 for 8) || '@bellaspa.com.vn',
        'Trần Thị Mai (KTV Mẫu)', 'ktv', 'active', v_tenant_id
    );

    -- 7. Seed sample customer
    INSERT INTO public.customers (phone, name_mother, name_baby, dob_baby, address, status, tenant_id)
    VALUES (
        '0987' || substring(v_tenant_id::text from 1 for 6),
        'Phạm Thu Hương (Khách Mẫu)', 'Bé Bơ',
        CURRENT_DATE - INTERVAL '10 days', p_address, 'active', v_tenant_id
    )
    RETURNING id INTO v_customer_id;

    -- 8. Seed sample booking
    INSERT INTO public.bookings (
        booking_number, customer_id, package_id, status, deposit_amount, full_price,
        start_date, end_date, total_sessions, completed_sessions, contract_signed,
        assigned_ktv_id, tenant_id
    )
    VALUES (
        'BK-' || UPPER(substring(v_tenant_id::text from 1 for 5)),
        v_customer_id, v_package_id, 'booked', 200000, 1200000,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '10 days', 10, 0, TRUE,
        v_ktv_id, v_tenant_id
    )
    RETURNING id INTO v_booking_id;

    -- 9. Seed default Chart of Accounts (Thông tư 133)
    BEGIN
        v_coa_count := public.seed_default_coa(v_tenant_id);
        RAISE NOTICE '[onboard_tenant] Seeded % accounting accounts for tenant %', v_coa_count, v_tenant_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[onboard_tenant] Failed to seed COA for tenant %: %', v_tenant_id, SQLERRM;
    END;

    -- 10. Auto-create accounting period cho tháng hiện tại
    BEGIN
        PERFORM public.ensure_open_period(v_tenant_id, CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[onboard_tenant] Failed to create accounting period for tenant %: %', v_tenant_id, SQLERRM;
    END;

    RETURN v_tenant_id;
END;
$$;

-- 5. Cập nhật các chính sách bảo mật RLS hỗ trợ HR và Accountant quản lý dữ liệu chi nhánh
-- A. staff_leaves
DROP POLICY IF EXISTS "Admin leaves policy" ON public.staff_leaves;
CREATE POLICY "Admin leaves policy" ON public.staff_leaves
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role IN ('admin', 'ktv_lead', 'admin_staff', 'accountant', 'hr')
        )
    );

-- B. users
DROP POLICY IF EXISTS "Admin quản lý users chi nhánh" ON public.users;
CREATE POLICY "Admin quản lý users chi nhánh"
    ON public.users
    FOR ALL
    TO authenticated
    USING (
        (public.is_admin() OR public.is_hr() OR public.is_accountant()) 
        AND tenant_id = public.get_auth_tenant_id()
    );

-- C. salary_records
DROP POLICY IF EXISTS "Admin quản lý salary_records" ON public.salary_records;
CREATE POLICY "Admin quản lý salary_records"
    ON public.salary_records
    FOR ALL
    TO authenticated
    USING (
        (public.is_admin() OR public.is_hr() OR public.is_accountant()) 
        AND tenant_id = public.get_auth_tenant_id()
    );

-- D. attendance
DROP POLICY IF EXISTS "Admin quản lý attendance" ON public.attendance;
CREATE POLICY "Admin quản lý attendance"
    ON public.attendance
    FOR ALL
    TO authenticated
    USING (
        (public.is_admin() OR public.is_hr() OR public.is_accountant()) 
        AND tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        (public.is_admin() OR public.is_hr() OR public.is_accountant()) 
        AND tenant_id = public.get_auth_tenant_id()
    );

-- E. Chart of Accounts (accounting_accounts)
DROP POLICY IF EXISTS "Admin manage accounting_accounts" ON public.accounting_accounts;
CREATE POLICY "Admin manage accounting_accounts"
    ON public.accounting_accounts
    FOR ALL TO authenticated
    USING (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    )
    WITH CHECK (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

-- F. accounting_periods
DROP POLICY IF EXISTS "Admin manage accounting_periods" ON public.accounting_periods;
CREATE POLICY "Admin manage accounting_periods"
    ON public.accounting_periods
    FOR ALL TO authenticated
    USING (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    )
    WITH CHECK (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

-- G. journal_entries (insert)
DROP POLICY IF EXISTS "Admin insert journal_entries" ON public.journal_entries;
CREATE POLICY "Admin insert journal_entries"
    ON public.journal_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

-- H. journal_entries (update)
DROP POLICY IF EXISTS "Admin update journal_entries" ON public.journal_entries;
CREATE POLICY "Admin update journal_entries"
    ON public.journal_entries
    FOR UPDATE TO authenticated
    USING (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    )
    WITH CHECK (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

-- I. journal_lines (insert)
DROP POLICY IF EXISTS "Admin insert journal_lines" ON public.journal_lines;
CREATE POLICY "Admin insert journal_lines"
    ON public.journal_lines
    FOR INSERT TO authenticated
    WITH CHECK (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR EXISTS (
                SELECT 1 FROM public.journal_entries je
                WHERE je.id = journal_lines.entry_id
                  AND je.tenant_id = public.get_auth_tenant_id()
            )
        )
    );

-- J. journal_lines (update)
DROP POLICY IF EXISTS "Admin update journal_lines" ON public.journal_lines;
CREATE POLICY "Admin update journal_lines"
    ON public.journal_lines
    FOR UPDATE TO authenticated
    USING (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR EXISTS (
                SELECT 1 FROM public.journal_entries je
                WHERE je.id = journal_lines.entry_id
                  AND je.tenant_id = public.get_auth_tenant_id()
            )
        )
    );

-- K. journal_lines (delete on draft)
DROP POLICY IF EXISTS "Admin delete journal_lines on draft" ON public.journal_lines;
CREATE POLICY "Admin delete journal_lines on draft"
    ON public.journal_lines
    FOR DELETE TO authenticated
    USING (
        (public.is_admin() OR public.is_accountant())
        AND EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_lines.entry_id
              AND je.status = 'DRAFT'
              AND (
                  public.is_hq_super_admin()
                  OR je.tenant_id = public.get_auth_tenant_id()
              )
        )
    );


-- 6. Cập nhật bảo mật các hàm RPC tính lương và KPIs chấm công để cho phép HR truy cập dữ liệu
-- A. get_ai_attendance_kpis
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

-- B. calculate_ktv_salary_sheet
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

-- C. get_salary_reconciliation
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
            (
                COALESCE(r.base_salary,               0) +
                COALESCE(r.kpi_bonus,                 0) +
                COALESCE(r.service_percentage_bonus,  0) +
                COALESCE(r.rating_bonus,              0) -
                COALESCE(r.violations_deduction,      0)
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


-- 7. Nạp lại schema cache của PostgREST
NOTIFY pgrst, 'reload schema';
