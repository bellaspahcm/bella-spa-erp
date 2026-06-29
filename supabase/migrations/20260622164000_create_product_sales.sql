-- ============================================
-- Migration: Create product_sales table
-- Date: 2026-06-22 16:40:00
-- Epic: Advanced Commission System - Product Sales Commission Tracking
-- ============================================
--
-- Purpose:
-- Track product sales and commissions for KTV retail sales.
-- Supports flexible commission input (fixed amount OR percentage of sales).
-- Module-specific feature for beauty_spa only.
--
-- Business Rules:
-- 1. Each row represents one product sale transaction
-- 2. Commission can be overridden per transaction (override_commission)
-- 3. Default commission comes from tenants.commission_config.product_sales_commission_default
-- 4. Module isolation: beauty_spa only
-- 5. Backward compatible: Other modules unaffected

CREATE TABLE IF NOT EXISTS public.product_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  ktv_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Product details
  product_name TEXT NOT NULL,
  product_category TEXT,
  product_sku TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_sales_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_sales_amount >= 0),
  
  -- Flexible commission input (fixed amount OR percentage of sales)
  override_commission_type TEXT CHECK (override_commission_type IN ('fixed', 'percentage')),
  override_commission_value NUMERIC(12,2),
  calculated_commission NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (calculated_commission >= 0),
  
  -- Status and metadata
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'zalo_pay', 'momo', 'card')),
  sale_date DATE NOT NULL,
  notes TEXT,
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT product_sales_commission_type_value_check
    CHECK (
      (override_commission_type IS NULL AND override_commission_value IS NULL)
      OR (override_commission_type IS NOT NULL AND override_commission_value IS NOT NULL)
    ),
  CONSTRAINT product_sales_percentage_range_check
    CHECK (
      override_commission_type IS NULL
      OR override_commission_type = 'fixed'
      OR (override_commission_type = 'percentage' AND override_commission_value BETWEEN 0 AND 100)
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_sales_ktv_month
  ON public.product_sales (ktv_id, sale_date)
  WHERE status IN ('completed', 'refunded');

CREATE INDEX IF NOT EXISTS idx_product_sales_tenant_date
  ON public.product_sales (tenant_id, sale_date, status);

CREATE INDEX IF NOT EXISTS idx_product_sales_customer
  ON public.product_sales (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_sales_booking
  ON public.product_sales (booking_id)
  WHERE booking_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

-- Read policy: KTV can see own records, admins/HR/accountants see all tenant records
DROP POLICY IF EXISTS "Product sales KTV read own" ON public.product_sales;
CREATE POLICY "Product sales KTV read own"
  ON public.product_sales
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND (
        ktv_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr', 'accountant')
        )
      )
    )
  );

-- Write policy: Only admins/admin_staff can manage product sales
DROP POLICY IF EXISTS "Product sales admin manage" ON public.product_sales;
CREATE POLICY "Product sales admin manage"
  ON public.product_sales
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

-- Grants
REVOKE ALL ON TABLE public.product_sales FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_sales TO service_role;

-- Table comment
COMMENT ON TABLE public.product_sales IS
  'Product sales and commission tracking for Beauty Spa KTVs. Supports flexible commission input (fixed amount or percentage of sales). Module-specific feature for beauty_spa only.';

COMMENT ON COLUMN public.product_sales.override_commission_type IS
  'Commission input type: fixed (amount in VND) or percentage (0-100% of sales). If NULL, uses tenant default.';

COMMENT ON COLUMN public.product_sales.override_commission_value IS
  'Commission value: amount (e.g., 50000 VND) or percentage (e.g., 10 for 10% of sales). Must match override_commission_type.';

COMMENT ON COLUMN public.product_sales.calculated_commission IS
  'Final calculated commission in VND. Computed from override or tenant default. Used in salary recalculation.';
