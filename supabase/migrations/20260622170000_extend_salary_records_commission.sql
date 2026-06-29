-- ============================================
-- Migration: Extend salary_records table for advanced commission system
-- Date: 2026-06-22 17:00:00
-- Epic: Advanced Commission System - Salary Records Extension
-- ============================================
--
-- Purpose:
-- Add 5 new columns to salary_records table to support advanced commission tracking:
-- 1. service_commission - Commission from booking services
-- 2. product_sales_commission - Commission from product sales
-- 3. position_bonus - Bonus based on position tier (Junior/Senior/Lead)
-- 4. seniority_bonus - Bonus based on years of service
-- 5. manual_adjustments - Net manual bonuses/deductions from admin
--
-- Business Rules:
-- 1. All new columns DEFAULT 0 for backward compatibility
-- 2. Existing salary_records rows are not affected (DEFAULT values applied)
-- 3. Total salary formula extended to include new components
-- 4. Module-agnostic: All modules can use these columns, but beauty_spa uses them primarily
--
-- Formula Extension:
-- OLD: total_salary = base_salary + session_bonus + rating_bonus + kpi_bonus - violations_deduction - service_percentage_bonus
-- NEW: total_salary = base_salary + session_bonus + rating_bonus + kpi_bonus + service_commission + product_sales_commission + position_bonus + seniority_bonus + manual_adjustments - violations_deduction - service_percentage_bonus

-- Add new commission columns to salary_records
ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS service_commission NUMERIC(12,2) DEFAULT 0 CHECK (service_commission >= 0),
  ADD COLUMN IF NOT EXISTS product_sales_commission NUMERIC(12,2) DEFAULT 0 CHECK (product_sales_commission >= 0),
  ADD COLUMN IF NOT EXISTS position_bonus NUMERIC(12,2) DEFAULT 0 CHECK (position_bonus >= 0),
  ADD COLUMN IF NOT EXISTS seniority_bonus NUMERIC(12,2) DEFAULT 0 CHECK (seniority_bonus >= 0),
  ADD COLUMN IF NOT EXISTS manual_adjustments NUMERIC(12,2) DEFAULT 0;

-- Update existing rows to have 0 values for new columns (if not already set by DEFAULT)
UPDATE public.salary_records
SET
  service_commission = COALESCE(service_commission, 0),
  product_sales_commission = COALESCE(product_sales_commission, 0),
  position_bonus = COALESCE(position_bonus, 0),
  seniority_bonus = COALESCE(seniority_bonus, 0),
  manual_adjustments = COALESCE(manual_adjustments, 0)
WHERE
  service_commission IS NULL
  OR product_sales_commission IS NULL
  OR position_bonus IS NULL
  OR seniority_bonus IS NULL
  OR manual_adjustments IS NULL;

-- Make columns NOT NULL after backfilling
ALTER TABLE public.salary_records
  ALTER COLUMN service_commission SET NOT NULL,
  ALTER COLUMN product_sales_commission SET NOT NULL,
  ALTER COLUMN position_bonus SET NOT NULL,
  ALTER COLUMN seniority_bonus SET NOT NULL,
  ALTER COLUMN manual_adjustments SET NOT NULL;

-- Column comments
COMMENT ON COLUMN public.salary_records.service_commission IS
  'Total commission from booking service items (calculated from booking_service_items table). Beauty Spa module primary usage.';

COMMENT ON COLUMN public.salary_records.product_sales_commission IS
  'Total commission from product sales (calculated from product_sales table). Beauty Spa module primary usage.';

COMMENT ON COLUMN public.salary_records.position_bonus IS
  'Bonus based on position tier multiplier (Junior: 1.0x, Senior: 1.2x, Lead: 1.5x). Applied to service_commission.';

COMMENT ON COLUMN public.salary_records.seniority_bonus IS
  'Bonus based on years of service (0-1y: 0%, 1-3y: 5%, 3-5y: 10%, 5+y: 15%). Applied to base_salary.';

COMMENT ON COLUMN public.salary_records.manual_adjustments IS
  'Net manual adjustments from admin (bonuses - deductions from salary_adjustments table). Can be positive or negative.';

-- Migration validation query (for manual verification after migration)
-- SELECT
--   COUNT(*) as total_records,
--   COUNT(*) FILTER (WHERE service_commission = 0) as zero_service_commission,
--   COUNT(*) FILTER (WHERE product_sales_commission = 0) as zero_product_sales,
--   COUNT(*) FILTER (WHERE position_bonus = 0) as zero_position_bonus,
--   COUNT(*) FILTER (WHERE seniority_bonus = 0) as zero_seniority_bonus,
--   COUNT(*) FILTER (WHERE manual_adjustments = 0) as zero_manual_adjustments
-- FROM public.salary_records;
