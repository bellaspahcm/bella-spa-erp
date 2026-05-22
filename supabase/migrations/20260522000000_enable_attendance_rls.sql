-- Enable Row-Level Security on attendance table
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Clean up any previous fallback or temporary policies
DROP POLICY IF EXISTS "Public Insert Update" ON public.attendance;
DROP POLICY IF EXISTS "Admin quản lý attendance" ON public.attendance;
DROP POLICY IF EXISTS "KTV xem attendance của mình" ON public.attendance;
DROP POLICY IF EXISTS "KTV insert attendance của mình" ON public.attendance;
DROP POLICY IF EXISTS "KTV update attendance của mình" ON public.attendance;

-- 1. Admin Policy: Full CRUD permission on all attendance logs in their tenant
CREATE POLICY "Admin quản lý attendance"
    ON public.attendance
    FOR ALL
    TO authenticated
    USING (public.is_admin() AND tenant_id = public.get_auth_tenant_id())
    WITH CHECK (public.is_admin() AND tenant_id = public.get_auth_tenant_id());

-- 2. KTV Select Policy: Allow KTV to read their own attendance records
CREATE POLICY "KTV xem attendance của mình"
    ON public.attendance
    FOR SELECT
    TO authenticated
    USING (ktv_id = auth.uid() AND tenant_id = public.get_auth_tenant_id());

-- 3. KTV Insert Policy: Allow KTV to check-in (insert) their own attendance records
CREATE POLICY "KTV insert attendance của mình"
    ON public.attendance
    FOR INSERT
    TO authenticated
    WITH CHECK (ktv_id = auth.uid() AND tenant_id = public.get_auth_tenant_id());

-- 4. KTV Update Policy: Allow KTV to check-out (update) their own attendance records
CREATE POLICY "KTV update attendance của mình"
    ON public.attendance
    FOR UPDATE
    TO authenticated
    USING (ktv_id = auth.uid() AND tenant_id = public.get_auth_tenant_id())
    WITH CHECK (ktv_id = auth.uid() AND tenant_id = public.get_auth_tenant_id());
