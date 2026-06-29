-- ============================================
-- Migration: Create booking_service_items table
-- Date: 2026-06-22 16:30:00
-- Epic: Advanced Commission System - Service-Level Commission Tracking
-- ============================================
--
-- Purpose:
-- Track commission per service within each booking for KTV salary calculations.
-- Supports flexible commission input (fixed amount OR percentage).
-- Module-specific feature for beauty_spa only.
--
-- Business Rules:
-- 1. Each row represents one service line within a booking
-- 2. Commission can be overridden per transaction (override_commission)
-- 3. Default commission comes from tenants.commission_config
-- 4. Module isolation: beauty_spa only
-- 5. Backward compatible: Other modules unaffected

CREATE TABLE IF NOT EXISTS public.booking_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  ktv_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Service details
  service_name TEXT NOT NULL,
  service_category TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  
  -- Flexible commission input (fixed amount OR percentage)
  override_commission_type TEXT CHECK (override_commission_type IN ('fixed', 'percentage')),
  override_commission_value NUMERIC(12,2),
  calculated_commission NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (calculated_commission >= 0),
  
  -- Status and metadata
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  completed_date DATE,
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT booking_service_items_commission_type_value_check
    CHECK (
      (override_commission_type IS NULL AND override_commission_value IS NULL)
      OR (override_commission_type IS NOT NULL AND override_commission_value IS NOT NULL)
    ),
  CONSTRAINT booking_service_items_percentage_range_check
    CHECK (
      override_commission_type IS NULL
      OR override_commission_type = 'fixed'
      OR (override_commission_type = 'percentage' AND override_commission_value BETWEEN 0 AND 100)
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_service_items_booking
  ON public.booking_service_items (booking_id, status);

CREATE INDEX IF NOT EXISTS idx_booking_service_items_ktv_month
  ON public.booking_service_items (ktv_id, completed_date)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_booking_service_items_tenant_date
  ON public.booking_service_items (tenant_id, completed_date, status);

-- RLS Policies
ALTER TABLE public.booking_service_items ENABLE ROW LEVEL SECURITY;

-- Read policy: KTV can see own records, admins/HR/accountants see all tenant records
DROP POLICY IF EXISTS "Service items KTV read own" ON public.booking_service_items;
CREATE POLICY "Service items KTV read own"
  ON public.booking_service_items
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

-- Write policy: Only admins/admin_staff can manage service items
DROP POLICY IF EXISTS "Service items admin manage" ON public.booking_service_items;
CREATE POLICY "Service items admin manage"
  ON public.booking_service_items
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
REVOKE ALL ON TABLE public.booking_service_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_service_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_service_items TO service_role;

-- Table comment
COMMENT ON TABLE public.booking_service_items IS
  'Service-level commission tracking for Beauty Spa bookings. Supports flexible commission input (fixed amount or percentage). Module-specific feature for beauty_spa only.';

COMMENT ON COLUMN public.booking_service_items.override_commission_type IS
  'Commission input type: fixed (amount in VND) or percentage (0-100%). If NULL, uses tenant default.';

COMMENT ON COLUMN public.booking_service_items.override_commission_value IS
  'Commission value: amount (e.g., 150000 VND) or percentage (e.g., 15 for 15%). Must match override_commission_type.';

COMMENT ON COLUMN public.booking_service_items.calculated_commission IS
  'Final calculated commission in VND. Computed from override or tenant default. Used in salary recalculation.';
