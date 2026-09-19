-- Migration: Create inventory_items table (MISSING SCHEMA HISTORY RECOVERY)
-- Date: 2026-09-16
-- Source: Reverse-engineered from E2E database (bmnbqbcdbuklhopfbopv)
-- Purpose: Repair migration chain reproducibility (P0)
--
-- Context:
-- The inventory_items table has been actively used in production since early development
-- but its CREATE TABLE migration was never committed to version control. This migration
-- restores the missing schema history to enable clean-build reproducibility.
--
-- Evidence:
-- - 76+ code references in src/__tests__/ and production code
-- - Referenced by migrations #2 (RLS), #12 (audit), #23 (policies)
-- - FK dependencies: inventory_logs, package_materials, drug_profiles, anesthesia_drugs
-- - Git history: No CREATE TABLE inventory_items found in any commit
--
-- Classification: MISSING_SCHEMA_HISTORY (lost migration)
--
-- Timestamp: 20260511500000 (between initial_schema and fix_permissions)

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    unit TEXT NOT NULL DEFAULT 'cái',
    stock_level NUMERIC NOT NULL DEFAULT 0,
    min_stock_level NUMERIC NOT NULL DEFAULT 10,
    price_per_unit NUMERIC NOT NULL DEFAULT 0,
    category TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for tenant isolation
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant 
ON public.inventory_items USING btree (tenant_id);

-- Create trigger for updated_at automation
-- (assumes update_updated_at_column function exists from initial_schema)
CREATE TRIGGER inventory_items_updated_at
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
COMMENT ON TABLE public.inventory_items IS 
'Inventory items catalog with stock levels. Used for service product consumption tracking, inventory management, and healthcare drug inventory integration.';

COMMENT ON COLUMN public.inventory_items.tenant_id IS 
'Tenant isolation - each branch maintains its own inventory';

COMMENT ON COLUMN public.inventory_items.stock_level IS 
'Current stock quantity (updated by inventory_logs)';

COMMENT ON COLUMN public.inventory_items.min_stock_level IS 
'Reorder point threshold for low stock alerts';

COMMENT ON COLUMN public.inventory_items.price_per_unit IS 
'Cost per unit for inventory valuation and cost tracking';

-- Note: RLS policies, audit triggers, and grants will be applied by subsequent migrations:
-- - 20260512000000_fix_permissions.sql (RLS disable during setup)
-- - 20260520000003_audit_all_tables.sql (audit trigger)
-- - 20260523010000_harden_all_database_rls.sql (RLS policies + enable RLS + grants)
