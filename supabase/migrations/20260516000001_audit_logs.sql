-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO service_role;
GRANT SELECT ON public.audit_logs TO anon;

-- Admins can read audit logs for their tenant
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs
    FOR SELECT
    USING (
        get_my_tenant_id() = tenant_id 
        AND 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'accountant')
        )
    );

-- System can insert audit logs (bypassing RLS via SECURITY DEFINER in the trigger function)

-- Trigger function to automatically log changes
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    record_tenant_id UUID;
BEGIN
    -- Try to get the user ID from the Supabase auth context
    current_user_id := auth.uid();
    
    -- Determine the tenant_id from the record
    IF TG_OP = 'DELETE' THEN
        record_tenant_id := OLD.tenant_id;
    ELSE
        record_tenant_id := NEW.tenant_id;
    END IF;

    -- Insert the audit log record
    INSERT INTO public.audit_logs (
        tenant_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        changed_by_id
    ) VALUES (
        record_tenant_id,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END,
        current_user_id
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to sensitive tables

-- 1. Revenue
DROP TRIGGER IF EXISTS audit_revenue_changes ON public.revenue;
CREATE TRIGGER audit_revenue_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.revenue
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 2. Expenses
DROP TRIGGER IF EXISTS audit_expenses_changes ON public.expenses;
CREATE TRIGGER audit_expenses_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 3. Salary Records
DROP TRIGGER IF EXISTS audit_salary_changes ON public.salary_records;
CREATE TRIGGER audit_salary_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.salary_records
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
