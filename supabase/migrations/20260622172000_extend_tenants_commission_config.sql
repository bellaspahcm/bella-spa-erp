-- ============================================
-- Migration: Extend tenants.commission_config for advanced commission defaults
-- Date: 2026-06-22 17:20:00
-- Epic: Advanced Commission System - Tenant-Level Commission Configuration
-- ============================================
--
-- Purpose:
-- Extend tenants table with commission_config JSONB field (or update existing field)
-- to store tenant-level default commission rates and settings.
--
-- Business Rules:
-- 1. Commission config is stored as JSONB for flexibility
-- 2. Defaults are used when override_commission is not specified in transactions
-- 3. Each tenant can customize their commission rates independently
-- 4. If commission_config is NULL, system uses hardcoded defaults
-- 5. Module-specific: Primarily for beauty_spa, but other modules can add configs
--
-- Default Commission Config Structure:
-- {
--   "service_commission_default": {
--     "type": "fixed",           // "fixed" or "percentage"
--     "value": 150000            // Amount (VND) or percentage (0-100)
--   },
--   "product_sales_commission_default": {
--     "type": "percentage",
--     "value": 10                // 10% of sales amount
--   },
--   "position_multipliers": {
--     "junior": 1.0,
--     "senior": 1.2,
--     "lead": 1.5
--   },
--   "seniority_bonus_rates": {
--     "0_to_1_year": 0.00,       // 0% bonus
--     "1_to_3_years": 0.05,      // 5% bonus
--     "3_to_5_years": 0.10,      // 10% bonus
--     "5_plus_years": 0.15       // 15% bonus
--   }
-- }

-- Check if commission_config column exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'commission_config'
  ) THEN
    ALTER TABLE public.tenants
      ADD COLUMN commission_config JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for commission_config JSONB queries
CREATE INDEX IF NOT EXISTS idx_tenants_commission_config
  ON public.tenants USING GIN (commission_config);

-- Update existing tenants to have default commission config if NULL or empty
UPDATE public.tenants
SET commission_config = jsonb_build_object(
  'service_commission_default', jsonb_build_object(
    'type', 'fixed',
    'value', 150000
  ),
  'product_sales_commission_default', jsonb_build_object(
    'type', 'percentage',
    'value', 10
  ),
  'position_multipliers', jsonb_build_object(
    'junior', 1.0,
    'senior', 1.2,
    'lead', 1.5
  ),
  'seniority_bonus_rates', jsonb_build_object(
    '0_to_1_year', 0.00,
    '1_to_3_years', 0.05,
    '3_to_5_years', 0.10,
    '5_plus_years', 0.15
  )
)
WHERE commission_config IS NULL
   OR commission_config = '{}'::jsonb
   OR NOT (commission_config ? 'service_commission_default');

-- Column comment
COMMENT ON COLUMN public.tenants.commission_config IS
  'JSONB configuration for commission defaults and settings. Includes service commission defaults, product sales commission defaults, position multipliers, and seniority bonus rates. Used primarily by Beauty Spa module but extensible for other modules.';

-- Migration validation query (for manual verification after migration)
-- SELECT
--   id,
--   name,
--   commission_config -> 'service_commission_default' as service_default,
--   commission_config -> 'product_sales_commission_default' as product_default,
--   commission_config -> 'position_multipliers' as position_multipliers,
--   commission_config -> 'seniority_bonus_rates' as seniority_rates
-- FROM public.tenants
-- WHERE commission_config IS NOT NULL
-- LIMIT 10;
