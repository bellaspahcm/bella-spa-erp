-- Migration: Fix legacy Bella Spa RLS policies that were missing or dropped in the active database
-- Date: 2026-08-16
-- Epic: Database configuration recovery & RLS hardening

-- 1. tenants
DROP POLICY IF EXISTS "Tenant read tenants" ON public.tenants;
CREATE POLICY "Tenant read tenants" ON public.tenants
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR id = public.get_auth_tenant_id());

-- 2. packages
DROP POLICY IF EXISTS "Tenant read packages" ON public.packages;
CREATE POLICY "Tenant read packages" ON public.packages
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id() OR is_hq_template = true);

DROP POLICY IF EXISTS "Tenant admin manage packages" ON public.packages;
CREATE POLICY "Tenant admin manage packages" ON public.packages
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND tenant_id = public.get_auth_tenant_id()))
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND tenant_id = public.get_auth_tenant_id()));

-- 3. chat_messages
DROP POLICY IF EXISTS "Tenant isolation for chat_messages" ON public.chat_messages;
CREATE POLICY "Tenant isolation for chat_messages" ON public.chat_messages
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 4. membership_records
DROP POLICY IF EXISTS "Tenant isolation for membership_records" ON public.membership_records;
CREATE POLICY "Tenant isolation for membership_records" ON public.membership_records
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 5. attendance
DROP POLICY IF EXISTS "Tenant view attendance" ON public.attendance;
CREATE POLICY "Tenant view attendance" ON public.attendance
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 6. inventory_items
DROP POLICY IF EXISTS "Tenant isolation for inventory items" ON public.inventory_items;
CREATE POLICY "Tenant isolation for inventory items" ON public.inventory_items
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 7. inventory_logs
DROP POLICY IF EXISTS "Tenant isolation for inventory logs" ON public.inventory_logs;
CREATE POLICY "Tenant isolation for inventory logs" ON public.inventory_logs
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

-- 8. booking_resources
DROP POLICY IF EXISTS "Booking resources read scoped tenant data" ON public.booking_resources;
CREATE POLICY "Booking resources read scoped tenant data" ON public.booking_resources
    FOR SELECT TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());

DROP POLICY IF EXISTS "Booking resources admin manage scoped tenant data" ON public.booking_resources;
CREATE POLICY "Booking resources admin manage scoped tenant data" ON public.booking_resources
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND tenant_id = public.get_auth_tenant_id()))
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR (public.is_admin() AND tenant_id = public.get_auth_tenant_id()));

-- 9. booking_service_items
DROP POLICY IF EXISTS "Service items KTV read own" ON public.booking_service_items;
CREATE POLICY "Service items KTV read own" ON public.booking_service_items
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND (
        ktv_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr', 'accountant')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Service items admin manage" ON public.booking_service_items;
CREATE POLICY "Service items admin manage" ON public.booking_service_items
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

-- 10. product_sales
DROP POLICY IF EXISTS "Product sales KTV read own" ON public.product_sales;
CREATE POLICY "Product sales KTV read own" ON public.product_sales
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND (
        ktv_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr', 'accountant')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Product sales admin manage" ON public.product_sales;
CREATE POLICY "Product sales admin manage" ON public.product_sales
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

-- 11. salary_adjustments
DROP POLICY IF EXISTS "Salary adjustments KTV read own" ON public.salary_adjustments;
CREATE POLICY "Salary adjustments KTV read own" ON public.salary_adjustments
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND (
        ktv_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr', 'accountant')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Salary adjustments admin manage" ON public.salary_adjustments;
CREATE POLICY "Salary adjustments admin manage" ON public.salary_adjustments
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  );

-- 12. salary_records
DROP POLICY IF EXISTS "Tenant view salary records" ON public.salary_records;
CREATE POLICY "Tenant view salary records" ON public.salary_records
    FOR ALL TO authenticated
    USING (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id());
