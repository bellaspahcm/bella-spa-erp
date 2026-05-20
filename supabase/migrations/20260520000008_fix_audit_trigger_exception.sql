-- Fix: Wrap audit log insert in exception handler so failures don't rollback main transaction
-- Root cause: audit_logs has RLS enabled but no INSERT policy, causing trigger to fail silently
-- and rollback the parent UPDATE (e.g., on tenants table)

-- 1. Add permissive INSERT policy for audit_logs
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can insert audit logs" ON public.audit_logs;
CREATE POLICY "Anon can insert audit logs"
    ON public.audit_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 2. Update the trigger function to gracefully handle insert failures
-- so that a failed audit log NEVER rolls back the main operation
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    record_tenant_id UUID;
BEGIN
    -- Try to get the user ID from the Supabase auth context
    BEGIN
        current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
    END;
    
    -- Determine the tenant_id from the record
    BEGIN
        IF TG_TABLE_NAME = 'tenants' THEN
            IF TG_OP = 'DELETE' THEN
                record_tenant_id := OLD.id;
            ELSE
                record_tenant_id := NEW.id;
            END IF;
        ELSE
            IF TG_OP = 'DELETE' THEN
                record_tenant_id := OLD.tenant_id;
            ELSE
                record_tenant_id := NEW.tenant_id;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        record_tenant_id := NULL;
    END;

    -- Insert the audit log record - wrapped in exception so failures never block main operation
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
        -- Audit log failure should NEVER block the main operation
        -- Log to PostgreSQL server logs instead
        RAISE WARNING 'audit_log_event failed for table % op %: %', TG_TABLE_NAME, TG_OP, SQLERRM;
    END;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
