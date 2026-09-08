-- Retail OS Grant Permissions
-- Date: 2026-09-06
-- Purpose: Grant table permissions to authenticated and service_role

-- Grant all permissions on retail tables to authenticated role
GRANT ALL ON public.retail_products TO authenticated, service_role;
GRANT ALL ON public.retail_product_variants TO authenticated, service_role;
GRANT ALL ON public.retail_product_batches TO authenticated, service_role;
GRANT ALL ON public.retail_inventory_movements TO authenticated, service_role;

-- Grant usage on sequences if any
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
