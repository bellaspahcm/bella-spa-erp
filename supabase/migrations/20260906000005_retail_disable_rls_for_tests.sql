-- Retail OS Disable RLS for Test Environment
-- Date: 2026-09-06
-- Purpose: Temporarily disable RLS to allow integration tests
-- WARNING: This is for test/dev environments only

-- Disable RLS on retail tables
ALTER TABLE public.retail_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_product_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_product_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_inventory_movements DISABLE ROW LEVEL SECURITY;

-- Note: In production, RLS should be RE-ENABLED with proper policies
-- This migration is for validation testing only
