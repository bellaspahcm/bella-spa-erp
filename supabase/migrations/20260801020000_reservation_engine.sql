-- ============================================================================
-- Bella EIP — Reservation Engine & Advisory Locks (Capability 2)
-- Architectural Invariant 01: Fully Additive, Zero Impact on Production Tenants
-- Timestamp: 20260801020000
-- ============================================================================

-- 1. Create re_reservations Table
CREATE TABLE IF NOT EXISTS public.re_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.real_estate_products(id) ON DELETE CASCADE,
  user_id UUID,
  customer_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'expired', 'converted')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_reservations_lookup 
  ON public.re_reservations (tenant_id, product_id, status);

CREATE INDEX IF NOT EXISTS idx_re_reservations_expiry 
  ON public.re_reservations (expires_at) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.re_reservations ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Tenant Access (Authenticated Users & Service Role)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to re_reservations') THEN
    CREATE POLICY "Allow authenticated users full access to re_reservations" 
      ON public.re_reservations FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- Grants
REVOKE ALL ON TABLE public.re_reservations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_reservations TO service_role;

-- 2. Supabase RPC Function: reserve_product (utilizing pg_advisory_xact_lock to prevent double holds)
CREATE OR REPLACE FUNCTION public.reserve_product(
  p_tenant_id UUID,
  p_product_id UUID,
  p_user_id UUID,
  p_customer_id UUID,
  p_duration_minutes INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status TEXT;
  v_reservation_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Acquire transaction-level advisory lock on the product identifier (to prevent race conditions)
  PERFORM pg_advisory_xact_lock(hashtext(p_product_id::text));

  -- 2. Query current product status
  SELECT status INTO v_current_status
  FROM public.real_estate_products
  WHERE id = p_product_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRODUCT_NOT_FOUND');
  END IF;

  -- 3. Block holds if product is already locked, booked, deposited or contracted
  IF v_current_status <> 'available' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRODUCT_NOT_AVAILABLE', 'current_status', v_current_status);
  END IF;

  -- 4. Calculate expiry time
  v_expires_at := now() + (p_duration_minutes * interval '1 minute');

  -- 5. Insert hold record
  INSERT INTO public.re_reservations (
    tenant_id,
    product_id,
    user_id,
    customer_id,
    status,
    expires_at
  )
  VALUES (
    p_tenant_id,
    p_product_id,
    p_user_id,
    p_customer_id,
    'active',
    v_expires_at
  )
  RETURNING id INTO v_reservation_id;

  -- 6. Update product status to 'booked' (simulating lock state)
  UPDATE public.real_estate_products
  SET status = 'booked',
      updated_at = now()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'expires_at', to_char(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
END;
$$;
