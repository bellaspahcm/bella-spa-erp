-- Migration: Harden Row-Level Security (RLS) across all tables to enforce strict data isolation for branches
-- Drops insecure / permissive 'true' policies and ensures robust tenant filtering based on public.get_auth_tenant_id()

-- =========================================================================
-- 1. USERS
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.users;
DROP POLICY IF EXISTS "authenticated_access" ON public.users;
DROP POLICY IF EXISTS "Public Select" ON public.users;

DROP POLICY IF EXISTS "Tenant view users" ON public.users;
CREATE POLICY "Tenant view users" ON public.users
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 2. CUSTOMERS
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.customers;
DROP POLICY IF EXISTS "Public Select" ON public.customers;
DROP POLICY IF EXISTS "Public Insert Update" ON public.customers;
DROP POLICY IF EXISTS "authenticated_access" ON public.customers;
DROP POLICY IF EXISTS "Tenant view customers" ON public.customers;

CREATE POLICY "Tenant view customers" ON public.customers
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 3. BOOKINGS
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.bookings;
DROP POLICY IF EXISTS "Guest xem bookings" ON public.bookings;
DROP POLICY IF EXISTS "Guest xem bookings (Blocked)" ON public.bookings;
DROP POLICY IF EXISTS "Tenant view bookings" ON public.bookings;

CREATE POLICY "Guest xem bookings (Blocked)" ON public.bookings
    FOR SELECT TO anon
    USING (false);

CREATE POLICY "Tenant view bookings" ON public.bookings
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 4. SESSION_LOGS
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.session_logs;
DROP POLICY IF EXISTS "Tenant view session logs" ON public.session_logs;

CREATE POLICY "Tenant view session logs" ON public.session_logs
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 5. REVENUE
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.revenue;
DROP POLICY IF EXISTS "Public Insert Update" ON public.revenue;
DROP POLICY IF EXISTS "Public Select" ON public.revenue;
DROP POLICY IF EXISTS "authenticated_access" ON public.revenue;
DROP POLICY IF EXISTS "Tenant view revenue" ON public.revenue;

CREATE POLICY "Tenant view revenue" ON public.revenue
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 6. EXPENSES
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.expenses;
DROP POLICY IF EXISTS "Public Select" ON public.expenses;
DROP POLICY IF EXISTS "authenticated_access" ON public.expenses;
DROP POLICY IF EXISTS "Tenant view expenses" ON public.expenses;

CREATE POLICY "Tenant view expenses" ON public.expenses
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 7. SALARY_RECORDS
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.salary_records;
DROP POLICY IF EXISTS "Public Select" ON public.salary_records;
DROP POLICY IF EXISTS "Tenant view salary records" ON public.salary_records;

CREATE POLICY "Tenant view salary records" ON public.salary_records
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 8. KPI_RECORDS
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.kpi_records;
DROP POLICY IF EXISTS "Tenant read kpi_records" ON public.kpi_records;

CREATE POLICY "Tenant read kpi_records" ON public.kpi_records
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 9. ATTENDANCE
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.attendance;
DROP POLICY IF EXISTS "Admins have full access on attendance" ON public.attendance;
DROP POLICY IF EXISTS "Tenant view attendance" ON public.attendance;

CREATE POLICY "Tenant view attendance" ON public.attendance
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 10. KTV_SCHEDULE
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.ktv_schedule;
DROP POLICY IF EXISTS "Tenant read ktv_schedule" ON public.ktv_schedule;

CREATE POLICY "Tenant read ktv_schedule" ON public.ktv_schedule
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 11. SHIFTS
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.shifts;
DROP POLICY IF EXISTS "Tenant read shifts" ON public.shifts;

CREATE POLICY "Tenant read shifts" ON public.shifts
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 12. MEMBERSHIP_RECORDS
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.membership_records;
DROP POLICY IF EXISTS "Tenant isolation for membership_records" ON public.membership_records;

CREATE POLICY "Tenant isolation for membership_records" ON public.membership_records
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 13. PACKAGES
-- =========================================================================
DROP POLICY IF EXISTS "Allow authenticated users to view packages" ON public.packages;
DROP POLICY IF EXISTS "Allow admins to manage packages" ON public.packages;
DROP POLICY IF EXISTS "Tenant global access" ON public.packages;
DROP POLICY IF EXISTS "Tenant read packages" ON public.packages;

CREATE POLICY "Tenant read packages" ON public.packages
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id() OR is_hq_template = true);

DROP POLICY IF EXISTS "Tenant admin manage packages" ON public.packages;
CREATE POLICY "Tenant admin manage packages" ON public.packages
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND tenant_id = public.get_auth_tenant_id()))
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND tenant_id = public.get_auth_tenant_id()));

-- =========================================================================
-- 14. INVENTORY_ITEMS
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated Insert" ON public.inventory_items;
DROP POLICY IF EXISTS "Tenant isolation for inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Staff can view inventory in tenant" ON public.inventory_items;
DROP POLICY IF EXISTS "Admins can manage inventory in tenant" ON public.inventory_items;
DROP POLICY IF EXISTS "tenant_update_inventory_items" ON public.inventory_items;
DROP POLICY IF EXISTS "tenant_delete_inventory_items" ON public.inventory_items;

CREATE POLICY "Tenant isolation for inventory items" ON public.inventory_items
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 15. INVENTORY_LOGS
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.inventory_logs;
DROP POLICY IF EXISTS "Authenticated Insert" ON public.inventory_logs;
DROP POLICY IF EXISTS "Tenant isolation for inventory logs" ON public.inventory_logs;

CREATE POLICY "Tenant isolation for inventory logs" ON public.inventory_logs
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 16. PACKAGE_MATERIALS
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.package_materials;
DROP POLICY IF EXISTS "Authenticated Insert" ON public.package_materials;
DROP POLICY IF EXISTS "Tenant isolation for package_materials" ON public.package_materials;

CREATE POLICY "Tenant isolation for package_materials" ON public.package_materials
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 17. SESSION_REVIEWS
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.session_reviews;
DROP POLICY IF EXISTS "Public Insert Update" ON public.session_reviews;
DROP POLICY IF EXISTS "Public review submission" ON public.session_reviews;
DROP POLICY IF EXISTS "Tenant isolation for session reviews" ON public.session_reviews;

CREATE POLICY "Guest submit review" ON public.session_reviews
    FOR INSERT TO public
    WITH CHECK (public.is_valid_tenant(tenant_id));

CREATE POLICY "Tenant read session_reviews" ON public.session_reviews
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY "Tenant admin manage session_reviews" ON public.session_reviews
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND tenant_id = public.get_auth_tenant_id()))
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND tenant_id = public.get_auth_tenant_id()));

-- =========================================================================
-- 18. CHAT_MESSAGES
-- =========================================================================
DROP POLICY IF EXISTS "Enable all actions for authenticated users" ON public.chat_messages;
DROP POLICY IF EXISTS "Tenant isolation for chat_messages" ON public.chat_messages;

CREATE POLICY "Tenant isolation for chat_messages" ON public.chat_messages
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 19. APP_NOTIFICATIONS
-- =========================================================================
DROP POLICY IF EXISTS "System can insert notifications" ON public.app_notifications;
DROP POLICY IF EXISTS "Tenant isolation for app_notifications" ON public.app_notifications;

CREATE POLICY "Tenant isolation for app_notifications" ON public.app_notifications
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- =========================================================================
-- 20. TENANTS
-- =========================================================================
DROP POLICY IF EXISTS "Public Select" ON public.tenants;
DROP POLICY IF EXISTS "Tenant read tenants" ON public.tenants;

CREATE POLICY "Tenant read tenants" ON public.tenants
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Tenant update tenants" ON public.tenants;
CREATE POLICY "Tenant update tenants" ON public.tenants
    FOR UPDATE TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND id = public.get_auth_tenant_id()))
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND id = public.get_auth_tenant_id()));
