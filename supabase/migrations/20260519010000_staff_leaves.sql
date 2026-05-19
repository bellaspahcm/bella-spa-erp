-- Migration: Create staff_leaves table and set RLS policies
-- Applied on 2026-05-19

CREATE TABLE IF NOT EXISTS public.staff_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    leave_date DATE NOT NULL,
    leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('full_day', 'morning', 'afternoon')),
    reason TEXT,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approved_by UUID REFERENCES public.users(id),
    tenant_id UUID REFERENCES public.tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;

-- KTV Policy: Can view and insert their own leaves
CREATE POLICY "KTV leaves policy" ON public.staff_leaves
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admin Policy: Can manage all leaves
CREATE POLICY "Admin leaves policy" ON public.staff_leaves
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role IN ('admin', 'ktv_lead', 'admin_staff', 'accountant')
        )
    );

-- Trigger for updated_at
DO $$ BEGIN
    CREATE TRIGGER update_staff_leaves_updated_at BEFORE UPDATE ON public.staff_leaves FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
