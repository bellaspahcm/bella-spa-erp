-- Create public.promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    discount_code TEXT,
    discount_percent NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT true,
    start_date DATE,
    end_date DATE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Tenant users can manage promotions" ON public.promotions;
DROP POLICY IF EXISTS "Public can read promotions" ON public.promotions;

-- Create Policies
CREATE POLICY "Tenant users can manage promotions"
    ON public.promotions
    FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Public can read promotions"
    ON public.promotions
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);
