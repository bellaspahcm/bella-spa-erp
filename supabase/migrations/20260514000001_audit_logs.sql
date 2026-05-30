
-- Create the audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    module TEXT NOT NULL, -- 'SALARY', 'BOOKING', 'FINANCE', 'STAFF', 'CUSTOMER'
    target_id TEXT, -- ID of the record that was changed
    old_data JSONB,
    new_data JSONB,
    tenant_id UUID REFERENCES public.tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster searching
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to insert logs
CREATE POLICY "Allow authenticated users to insert logs" 
ON public.audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow users to view logs for their tenant
CREATE POLICY "Allow users to view logs for their tenant" 
ON public.audit_logs FOR SELECT 
TO authenticated 
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
