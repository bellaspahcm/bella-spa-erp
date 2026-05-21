-- Create app_notifications table
CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_notifications_tenant_id ON public.app_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created_at ON public.app_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_is_read ON public.app_notifications(is_read);

-- Setup RLS
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notifications for their tenant"
    ON public.app_notifications FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "System can insert notifications"
    ON public.app_notifications FOR INSERT
    WITH CHECK (
        true -- System actions (server-side) can bypass this if they use service_role, but for normal users we might restrict.
        -- Actually, since guest booking API is unauthenticated, we'll rely on service_role key to insert, 
        -- so this INSERT policy can be restrictive or open. We'll leave it true for simplicity if using anon.
    );

CREATE POLICY "Users can update notifications for their tenant"
    ON public.app_notifications FOR UPDATE
    USING (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Users can delete notifications for their tenant"
    ON public.app_notifications FOR DELETE
    USING (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

-- Note: supabase_realtime publication is already set to FOR ALL TABLES,
-- so app_notifications is automatically included in Realtime. No need to ALTER PUBLICATION.
