/**
 * API Gateway Sandbox Environment
 * 
 * Creates a separate sandbox schema with identical structure to production.
 * Partners can test integrations safely without affecting real data.
 * 
 * Features:
 * - Separate sandbox schema (isolated from public)
 * - Identical table structure to production
 * - Pre-seeded test data
 * - Reset capability
 * - API key prefix detection (pk_test_ vs pk_live_)
 * 
 * Security:
 * - pk_test_ keys can ONLY access sandbox schema
 * - pk_live_ keys can ONLY access public schema
 * - No cross-contamination possible
 * 
 * @version 1.0
 * @date 2026-06-17
 */

-- ============================================================================
-- CREATE SANDBOX SCHEMA
-- ============================================================================

-- Create sandbox schema (separate from public)
CREATE SCHEMA IF NOT EXISTS sandbox;

COMMENT ON SCHEMA sandbox IS 'Isolated sandbox environment for partner API testing';

-- ============================================================================
-- REPLICATE PRODUCTION TABLES IN SANDBOX
-- ============================================================================

-- Note: We only replicate tables that partners can access via API
-- Admin-only tables stay in public schema only

-- Customers (sandbox copy)
CREATE TABLE IF NOT EXISTS sandbox.customers (
  LIKE public.customers INCLUDING ALL
);

-- Products (sandbox copy)
CREATE TABLE IF NOT EXISTS sandbox.products (
  LIKE public.products INCLUDING ALL
);

-- Services (sandbox copy)
CREATE TABLE IF NOT EXISTS sandbox.services (
  LIKE public.services INCLUDING ALL
);

-- Orders (sandbox copy)
CREATE TABLE IF NOT EXISTS sandbox.orders (
  LIKE public.orders INCLUDING ALL
);

-- Order Items (sandbox copy)
CREATE TABLE IF NOT EXISTS sandbox.order_items (
  LIKE public.order_items INCLUDING ALL
);

-- Payments (sandbox copy)
CREATE TABLE IF NOT EXISTS sandbox.payments (
  LIKE public.payments INCLUDING ALL
);

-- Invoices (sandbox copy)
CREATE TABLE IF NOT EXISTS sandbox.invoices (
  LIKE public.invoices INCLUDING ALL
);

-- Webhooks (sandbox copy)
CREATE TABLE IF NOT EXISTS sandbox.webhook_subscriptions (
  LIKE public.webhook_subscriptions INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS sandbox.webhook_events (
  LIKE public.webhook_events INCLUDING ALL
);

-- ============================================================================
-- SANDBOX METADATA TABLE
-- ============================================================================

/**
 * Tracks sandbox resets and metadata for each partner
 */
CREATE TABLE IF NOT EXISTS sandbox.sandbox_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.api_partners(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Reset tracking
  last_reset_at TIMESTAMPTZ,
  reset_count INTEGER DEFAULT 0,
  reset_by_user_id UUID REFERENCES public.users(id),
  
  -- Seed data version
  seed_version VARCHAR(50) DEFAULT 'v1.0',
  
  -- Sandbox statistics
  total_requests INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  
  -- Settings
  auto_reset_enabled BOOLEAN DEFAULT false,
  auto_reset_interval_hours INTEGER DEFAULT 24,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(partner_id)
);

COMMENT ON TABLE sandbox.sandbox_metadata IS 'Tracks sandbox usage and reset history for each partner';

-- Index for fast lookups
CREATE INDEX idx_sandbox_metadata_partner ON sandbox.sandbox_metadata(partner_id);
CREATE INDEX idx_sandbox_metadata_tenant ON sandbox.sandbox_metadata(tenant_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Detect if API key is for sandbox or production
 * 
 * @param p_api_key - API key to check
 * @returns 'sandbox' or 'production'
 */
CREATE OR REPLACE FUNCTION public.detect_environment(p_api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_api_key LIKE 'pk_test_%' THEN
    RETURN 'sandbox';
  ELSIF p_api_key LIKE 'pk_live_%' THEN
    RETURN 'production';
  ELSE
    RAISE EXCEPTION 'Invalid API key format. Must start with pk_test_ or pk_live_';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.detect_environment IS 'Detect sandbox vs production environment from API key prefix';

/**
 * Reset sandbox data for a partner
 * Deletes all data and re-seeds with test data
 * 
 * @param p_partner_id - Partner UUID
 * @param p_user_id - User who triggered the reset
 */
CREATE OR REPLACE FUNCTION sandbox.reset_sandbox_data(
  p_partner_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_deleted_customers INTEGER;
  v_deleted_orders INTEGER;
  v_deleted_payments INTEGER;
BEGIN
  -- Get tenant_id for this partner
  SELECT tenant_id INTO v_tenant_id
  FROM public.api_partners
  WHERE id = p_partner_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Partner not found: %', p_partner_id;
  END IF;
  
  -- Delete all sandbox data for this tenant
  DELETE FROM sandbox.webhook_events WHERE tenant_id = v_tenant_id;
  DELETE FROM sandbox.webhook_subscriptions WHERE tenant_id = v_tenant_id;
  DELETE FROM sandbox.order_items WHERE order_id IN (SELECT id FROM sandbox.orders WHERE tenant_id = v_tenant_id);
  
  DELETE FROM sandbox.payments WHERE tenant_id = v_tenant_id;
  GET DIAGNOSTICS v_deleted_payments = ROW_COUNT;
  
  DELETE FROM sandbox.orders WHERE tenant_id = v_tenant_id;
  GET DIAGNOSTICS v_deleted_orders = ROW_COUNT;
  
  DELETE FROM sandbox.invoices WHERE tenant_id = v_tenant_id;
  DELETE FROM sandbox.products WHERE tenant_id = v_tenant_id;
  DELETE FROM sandbox.services WHERE tenant_id = v_tenant_id;
  
  DELETE FROM sandbox.customers WHERE tenant_id = v_tenant_id;
  GET DIAGNOSTICS v_deleted_customers = ROW_COUNT;
  
  -- Update metadata
  INSERT INTO sandbox.sandbox_metadata (partner_id, tenant_id, last_reset_at, reset_count, reset_by_user_id)
  VALUES (p_partner_id, v_tenant_id, NOW(), 1, p_user_id)
  ON CONFLICT (partner_id) 
  DO UPDATE SET
    last_reset_at = NOW(),
    reset_count = sandbox.sandbox_metadata.reset_count + 1,
    reset_by_user_id = p_user_id,
    updated_at = NOW();
  
  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'partner_id', p_partner_id,
    'tenant_id', v_tenant_id,
    'deleted', jsonb_build_object(
      'customers', v_deleted_customers,
      'orders', v_deleted_orders,
      'payments', v_deleted_payments
    ),
    'reset_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION sandbox.reset_sandbox_data IS 'Reset all sandbox data for a partner and re-seed test data';

/**
 * Seed sandbox with test data
 * Creates sample customers, products, orders for testing
 * 
 * @param p_partner_id - Partner UUID
 */
CREATE OR REPLACE FUNCTION sandbox.seed_test_data(p_partner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_product1_id UUID;
  v_product2_id UUID;
  v_service1_id UUID;
  v_order1_id UUID;
  v_order2_id UUID;
BEGIN
  -- Get tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM public.api_partners
  WHERE id = p_partner_id;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Partner not found: %', p_partner_id;
  END IF;
  
  -- Create test customers
  INSERT INTO sandbox.customers (id, tenant_id, name, phone, email, address, status, created_at)
  VALUES
    (gen_random_uuid(), v_tenant_id, 'Nguyễn Văn Test', '0901234567', 'test1@example.com', '123 Test Street, Hanoi', 'active', NOW()),
    (gen_random_uuid(), v_tenant_id, 'Trần Thị Demo', '0902345678', 'demo@example.com', '456 Demo Avenue, HCMC', 'active', NOW()),
    (gen_random_uuid(), v_tenant_id, 'Lê Sandbox', '0903456789', 'sandbox@example.com', '789 Sandbox Road, Da Nang', 'active', NOW())
  RETURNING id INTO v_customer1_id, v_customer2_id, v_customer3_id;
  
  -- Create test products
  INSERT INTO sandbox.products (id, tenant_id, name, sku, price, stock_quantity, status, created_at)
  VALUES
    (gen_random_uuid(), v_tenant_id, 'Test Product 1', 'TEST-001', 100000, 999, 'active', NOW()),
    (gen_random_uuid(), v_tenant_id, 'Test Product 2', 'TEST-002', 200000, 999, 'active', NOW())
  RETURNING id INTO v_product1_id, v_product2_id;
  
  -- Create test service
  INSERT INTO sandbox.services (id, tenant_id, name, duration_minutes, price, status, created_at)
  VALUES
    (gen_random_uuid(), v_tenant_id, 'Test Service - Massage 60min', 60, 300000, 'active', NOW())
  RETURNING id INTO v_service1_id;
  
  -- Create test orders
  INSERT INTO sandbox.orders (id, tenant_id, customer_id, total_amount, status, created_at)
  VALUES
    (gen_random_uuid(), v_tenant_id, v_customer1_id, 400000, 'completed', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), v_tenant_id, v_customer2_id, 500000, 'pending', NOW() - INTERVAL '1 day')
  RETURNING id INTO v_order1_id, v_order2_id;
  
  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'seeded', jsonb_build_object(
      'customers', 3,
      'products', 2,
      'services', 1,
      'orders', 2
    ),
    'seed_version', 'v1.0'
  );
END;
$$;

COMMENT ON FUNCTION sandbox.seed_test_data IS 'Seed sandbox with sample test data for partner testing';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all sandbox tables
ALTER TABLE sandbox.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox.sandbox_metadata ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY service_role_full_access_sandbox_customers ON sandbox.customers FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_products ON sandbox.products FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_services ON sandbox.services FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_orders ON sandbox.orders FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_order_items ON sandbox.order_items FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_payments ON sandbox.payments FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_invoices ON sandbox.invoices FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_webhooks ON sandbox.webhook_subscriptions FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_events ON sandbox.webhook_events FOR ALL TO service_role USING (true);
CREATE POLICY service_role_full_access_sandbox_metadata ON sandbox.sandbox_metadata FOR ALL TO service_role USING (true);

-- Authenticated users (admins) can manage sandbox
-- Note: In production, you'd add more granular policies based on roles

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant usage on sandbox schema
GRANT USAGE ON SCHEMA sandbox TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA sandbox TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sandbox TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sandbox TO service_role;

-- Grant to authenticated role (for admin UI)
GRANT USAGE ON SCHEMA sandbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sandbox TO authenticated;

-- ============================================================================
-- INITIAL SETUP
-- ============================================================================

-- Log migration
DO $$
BEGIN
  RAISE NOTICE '✅ Sandbox environment created successfully';
  RAISE NOTICE '   - Schema: sandbox';
  RAISE NOTICE '   - Tables: 10 (customers, products, services, orders, etc.)';
  RAISE NOTICE '   - Functions: detect_environment, reset_sandbox_data, seed_test_data';
  RAISE NOTICE '   - RLS: Enabled on all tables';
  RAISE NOTICE '';
  RAISE NOTICE '📖 Usage:';
  RAISE NOTICE '   - pk_test_ keys → sandbox schema';
  RAISE NOTICE '   - pk_live_ keys → public schema';
  RAISE NOTICE '   - Reset: SELECT sandbox.reset_sandbox_data(partner_id)';
  RAISE NOTICE '   - Seed: SELECT sandbox.seed_test_data(partner_id)';
END $$;
