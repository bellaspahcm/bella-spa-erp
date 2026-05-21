-- 1. Helper Security Definer Functions to bypass RLS and prevent infinite recursion on tables
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN COALESCE(user_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
DECLARE
    t_id UUID;
BEGIN
    SELECT tenant_id INTO t_id FROM public.users WHERE id = auth.uid();
    RETURN t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_valid_tenant(t_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.tenants WHERE id = t_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. HARDEN: Guest tạo bookings must use a valid tenant
DROP POLICY IF EXISTS "Guest tạo bookings" ON bookings;
CREATE POLICY "Guest tạo bookings"
    ON bookings
    FOR INSERT
    TO anon
    WITH CHECK (public.is_valid_tenant(tenant_id));

-- 3. Bật RLS và thiết lập policy cho bảng customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin quản lý customers" ON customers;
CREATE POLICY "Admin quản lý customers"
    ON customers
    FOR ALL
    TO authenticated
    USING (public.is_admin() AND tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "KTV xem customers cùng chi nhánh" ON customers;
CREATE POLICY "KTV xem customers cùng chi nhánh"
    ON customers
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Guest tạo customer khi booking" ON customers;
CREATE POLICY "Guest tạo customer khi booking"
    ON customers
    FOR INSERT
    TO anon
    WITH CHECK (public.is_valid_tenant(tenant_id));

-- 4. Bật RLS và thiết lập policy cho bảng users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User tự xem và sửa chính mình" ON users;
CREATE POLICY "User tự xem và sửa chính mình"
    ON users
    FOR ALL
    TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Admin quản lý users chi nhánh" ON users;
CREATE POLICY "Admin quản lý users chi nhánh"
    ON users
    FOR ALL
    TO authenticated
    USING (public.is_admin() AND tenant_id = public.get_auth_tenant_id());

-- 5. Bật RLS và thiết lập policy cho bảng salary_records
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin quản lý salary_records" ON salary_records;
CREATE POLICY "Admin quản lý salary_records"
    ON salary_records
    FOR ALL
    TO authenticated
    USING (public.is_admin() AND tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "KTV xem salary_records của mình" ON salary_records;
CREATE POLICY "KTV xem salary_records của mình"
    ON salary_records
    FOR SELECT
    TO authenticated
    USING (ktv_id = auth.uid());
