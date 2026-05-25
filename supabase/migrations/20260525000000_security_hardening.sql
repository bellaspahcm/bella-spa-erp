-- =============================================================================
-- Migration: Security Hardening
-- Ngày: 2026-05-25
-- Fixes:
--   1. get_user_by_email_v1: thêm auth check (chỉ admin mới gọi được)
--   2. is_hq_super_admin(): hàm mới, phân biệt rõ HQ Admin với user không có tenant
--   3. Cập nhật tất cả RLS policies dùng pattern "IS NULL OR" sang dùng is_hq_super_admin()
-- =============================================================================


-- =============================================================================
-- 1. FIX: get_user_by_email_v1 — thêm auth check
-- Trước: bất kỳ ai (kể cả anon) đều có thể tra cứu thông tin nhân viên bằng email
-- Sau:   chỉ admin mới được gọi hàm này
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_by_email_v1(p_email text)
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    role text,
    status text,
    tenant_id uuid,
    created_at timestamptz,
    avatar_url text
) AS $$
BEGIN
    -- Chỉ admin (bao gồm HQ admin) mới được tra cứu user theo email
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: chỉ admin mới được tra cứu thông tin nhân viên.';
    END IF;

    RETURN QUERY
    SELECT u.id, u.email, u.full_name, u.role, u.status, u.tenant_id, u.created_at, u.avatar_url
    FROM public.users u
    WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 2. NEW FUNCTION: is_hq_super_admin()
-- Trả về TRUE chỉ khi user THỰC SỰ là admin của chi nhánh 'Bella Spa Headquarter'
-- Khác với get_auth_tenant_id() IS NULL (cũng trả về NULL khi user không có tenant_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_hq_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.tenants t ON t.id = u.tenant_id
        WHERE u.id = auth.uid()
          AND u.role = 'admin'
          AND t.name = 'Bella Spa Headquarter'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 3. FIX RLS POLICIES: thay pattern "get_auth_tenant_id() IS NULL OR ..."
--    bằng "is_hq_super_admin() OR tenant_id = get_auth_tenant_id()"
--
-- Lý do: khi user không có tenant_id (account lỗi hoặc mới tạo chưa gán branch),
-- get_auth_tenant_id() cũng trả về NULL → "IS NULL" = TRUE → user đó xem được
-- toàn bộ dữ liệu mọi chi nhánh — đây là lỗ hổng bảo mật nghiêm trọng.
-- =============================================================================

-- USERS
DROP POLICY IF EXISTS "Tenant view users" ON public.users;
CREATE POLICY "Tenant view users" ON public.users
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- CUSTOMERS
DROP POLICY IF EXISTS "Tenant view customers" ON public.customers;
CREATE POLICY "Tenant view customers" ON public.customers
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- BOOKINGS
DROP POLICY IF EXISTS "Tenant view bookings" ON public.bookings;
CREATE POLICY "Tenant view bookings" ON public.bookings
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- SESSION_LOGS
DROP POLICY IF EXISTS "Tenant view session logs" ON public.session_logs;
CREATE POLICY "Tenant view session logs" ON public.session_logs
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- REVENUE
DROP POLICY IF EXISTS "Tenant view revenue" ON public.revenue;
CREATE POLICY "Tenant view revenue" ON public.revenue
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- EXPENSES
DROP POLICY IF EXISTS "Tenant view expenses" ON public.expenses;
CREATE POLICY "Tenant view expenses" ON public.expenses
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- SALARY_RECORDS
DROP POLICY IF EXISTS "Tenant view salary records" ON public.salary_records;
CREATE POLICY "Tenant view salary records" ON public.salary_records
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- KPI_RECORDS
DROP POLICY IF EXISTS "Tenant read kpi_records" ON public.kpi_records;
CREATE POLICY "Tenant read kpi_records" ON public.kpi_records
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- ATTENDANCE
DROP POLICY IF EXISTS "Tenant view attendance" ON public.attendance;
CREATE POLICY "Tenant view attendance" ON public.attendance
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- KTV_SCHEDULE
DROP POLICY IF EXISTS "Tenant read ktv_schedule" ON public.ktv_schedule;
CREATE POLICY "Tenant read ktv_schedule" ON public.ktv_schedule
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- SHIFTS
DROP POLICY IF EXISTS "Tenant read shifts" ON public.shifts;
CREATE POLICY "Tenant read shifts" ON public.shifts
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- MEMBERSHIP_RECORDS
DROP POLICY IF EXISTS "Tenant isolation for membership_records" ON public.membership_records;
CREATE POLICY "Tenant isolation for membership_records" ON public.membership_records
    FOR ALL TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );
