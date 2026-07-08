-- ============================================
-- Migration: Add Advanced Commission Columns to salary_records
-- Date: 2026-06-22 20:00:00
-- Epic: Advanced Commission System (Task 28-32)
-- ============================================
--
-- Purpose:
-- Add commission tracking columns to salary_records table to support:
-- - Service commission (from booking_service_items)
-- - Product sales commission (from product_sales)
-- - Position-based bonus multiplier
-- - Seniority bonus
-- - Manual salary adjustments (bonus/deduction)
--
-- Business Rules:
-- 1. All commission columns are nullable (backward compatible)
-- 2. Default to NULL (not 0) to distinguish "not calculated" from "calculated as 0"
-- 3. Numeric(12,2) to store VND amounts up to 999,999,999,999.99
-- 4. Check constraints ensure non-negative amounts
-- 5. Module isolation: Only used by beauty_spa module
--
-- Backward Compatibility:
-- - Existing salary_records rows: New columns default to NULL
-- - Baby Care module: Columns remain NULL (not used)
-- - Beauty Spa module: Columns populated by recalculateAndSaveSalaryRecordEngine

-- Add service commission column
ALTER TABLE public.salary_records
ADD COLUMN IF NOT EXISTS service_commission NUMERIC(12,2) DEFAULT NULL
CHECK (service_commission IS NULL OR service_commission >= 0);

-- Add product sales commission column
ALTER TABLE public.salary_records
ADD COLUMN IF NOT EXISTS product_sales_commission NUMERIC(12,2) DEFAULT NULL
CHECK (product_sales_commission IS NULL OR product_sales_commission >= 0);

-- Add position bonus column (multiplier applied to service commission)
ALTER TABLE public.salary_records
ADD COLUMN IF NOT EXISTS position_bonus NUMERIC(12,2) DEFAULT NULL
CHECK (position_bonus IS NULL OR position_bonus >= 0);

-- Add seniority bonus column (percentage of base salary based on years of service)
ALTER TABLE public.salary_records
ADD COLUMN IF NOT EXISTS seniority_bonus NUMERIC(12,2) DEFAULT NULL
CHECK (seniority_bonus IS NULL OR seniority_bonus >= 0);

-- Add manual adjustments column (net amount: positive = bonus, negative = deduction)
ALTER TABLE public.salary_records
ADD COLUMN IF NOT EXISTS manual_adjustments NUMERIC(12,2) DEFAULT NULL;

-- Add index for reporting queries
CREATE INDEX IF NOT EXISTS idx_salary_records_commissions
  ON public.salary_records (tenant_id, month_year)
  WHERE service_commission IS NOT NULL
     OR product_sales_commission IS NOT NULL;

-- Column comments
COMMENT ON COLUMN public.salary_records.service_commission IS
  'Commission earned from spa services (from booking_service_items.calculated_commission). Used by beauty_spa module only.';

COMMENT ON COLUMN public.salary_records.product_sales_commission IS
  'Commission earned from product sales (from product_sales.calculated_commission). Used by beauty_spa module only.';

COMMENT ON COLUMN public.salary_records.position_bonus IS
  'Position-based bonus multiplier applied to service commission. Junior: 1.0x, Senior: 1.2x, Lead: 1.5x. Used by beauty_spa module only.';

COMMENT ON COLUMN public.salary_records.seniority_bonus IS
  'Years-of-service bonus calculated as percentage of base salary. 0-1yr: 0%, 1-3yr: 5%, 3-5yr: 10%, 5+yr: 15%. Used by beauty_spa module only.';

COMMENT ON COLUMN public.salary_records.manual_adjustments IS
  'Net manual adjustments from salary_adjustments table. Positive = bonus, negative = deduction. Sum of approved adjustments for the month.';

-- No RLS changes needed - inherits from existing salary_records policies
