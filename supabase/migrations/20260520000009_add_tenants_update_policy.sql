-- Migration: Add RLS update policy for tenants table
-- Since RLS is enabled on tenants but only "Public Select" exists, updates are blocked.

-- Add Policy to allow admins to update their own tenant
DROP POLICY IF EXISTS "Admin can update their own tenant" ON public.tenants;
CREATE POLICY "Admin can update their own tenant"
    ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (
        id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    )
    WITH CHECK (
        id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    );
