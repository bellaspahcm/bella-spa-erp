-- Brand Service Master Migration
-- Add centralized package template distribution columns to public.packages

ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS is_hq_template boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS price_cap bigint,
ADD COLUMN IF NOT EXISTS price_floor bigint,
ADD COLUMN IF NOT EXISTS allowed_franchise_override boolean DEFAULT true;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_packages_template_id ON public.packages(template_id);
CREATE INDEX IF NOT EXISTS idx_packages_is_hq_template ON public.packages(is_hq_template);
