-- ============================================================================
-- Bella Auto Performance Optimization Indexes
-- Created: 2026-08-04
-- Purpose: Optimize query performance for baseline verification
-- Impact: Reduces P95 latency from 979ms to <200ms target
-- Note: Using non-concurrent index creation for migration pipeline compatibility
-- ============================================================================

-- 1. Optimize vehicle inventory queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_auto_vehicles_tenant_status_created 
ON public.auto_vehicles (tenant_id, status, created_at DESC);

-- 2. Covering index for vehicle catalog joins (reduces JOIN cost)
CREATE INDEX IF NOT EXISTS idx_auto_vehicles_tenant_variant_status
ON public.auto_vehicles (tenant_id, variant_id, status)
INCLUDE (vin, color_exterior, model_year, list_price);

-- 3. Optimize temporal history queries
CREATE INDEX IF NOT EXISTS idx_auto_vehicles_history_valid_from
ON public.auto_vehicles_history (tenant_id, valid_from DESC, valid_to DESC)
WHERE valid_to IS NULL; -- Only index current records

-- 4. Optimize variant lookup (used in JOIN queries)
CREATE INDEX IF NOT EXISTS idx_auto_variants_model_active
ON public.auto_variants (tenant_id, model_id, is_active)
WHERE is_active = true;

-- 5. Optimize model lookup
CREATE INDEX IF NOT EXISTS idx_auto_models_brand_active
ON public.auto_models (tenant_id, brand_id, is_active)
WHERE is_active = true;

-- 6. Optimize journey stage lookups
CREATE INDEX IF NOT EXISTS idx_auto_journey_stages_tenant_code
ON public.auto_journey_stages (tenant_id, code)
WHERE is_active = true;

-- Performance validation query (should return <200ms after indexing)
-- SELECT COUNT(*) FROM auto_vehicles WHERE tenant_id = 'xxx' AND status = 'showroom';
