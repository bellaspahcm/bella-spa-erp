-- ============================================================================
-- REAL ESTATE PERFORMANCE OPTIMIZATION
-- ============================================================================
-- Purpose: Add indexes and optimizations for Real Estate module
-- Based on: Beauty Spa performance patterns (20260622280000)
-- Date: 2026-08-02
-- ============================================================================

-- ============================================================================
-- 1. PROJECTS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for filtering active projects
CREATE INDEX IF NOT EXISTS idx_re_projects_status_active
  ON real_estate_projects(tenant_id, status)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Index for location-based searches
CREATE INDEX IF NOT EXISTS idx_re_projects_location
  ON real_estate_projects(tenant_id, location)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. PRODUCTS/UNITS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for available units queries (most common)
CREATE INDEX IF NOT EXISTS idx_re_products_available
  ON real_estate_products(tenant_id, project_id, status)
  WHERE status = 'available' AND deleted_at IS NULL;

-- Index for unit type filtering
CREATE INDEX IF NOT EXISTS idx_re_products_type_status
  ON real_estate_products(tenant_id, product_type, status)
  WHERE deleted_at IS NULL;

-- Index for price range queries
CREATE INDEX IF NOT EXISTS idx_re_products_price_range
  ON real_estate_products(tenant_id, unit_price)
  WHERE status = 'available' AND deleted_at IS NULL;

-- Index for area filtering
CREATE INDEX IF NOT EXISTS idx_re_products_area_range
  ON real_estate_products(tenant_id, area_m2)
  WHERE status = 'available' AND deleted_at IS NULL;

-- Composite index for dashboard stats
CREATE INDEX IF NOT EXISTS idx_re_products_dashboard_stats
  ON real_estate_products(tenant_id, project_id, status, product_type)
  INCLUDE (unit_price, area_m2)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 3. CUSTOMERS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for phone number searches (frequent lookup)
CREATE INDEX IF NOT EXISTS idx_re_customers_phone_lookup
  ON re_customers(tenant_id, phone)
  WHERE deleted_at IS NULL;

-- Index for email searches
CREATE INDEX IF NOT EXISTS idx_re_customers_email_lookup
  ON re_customers(tenant_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;

-- GIN index for tags searches
CREATE INDEX IF NOT EXISTS idx_re_customers_tags_gin
  ON re_customers USING GIN (tags)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. LEADS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for active leads (most common query)
CREATE INDEX IF NOT EXISTS idx_re_leads_active_state
  ON re_leads(tenant_id, state, assigned_to)
  WHERE state NOT IN ('CONVERTED', 'LOST') AND deleted_at IS NULL;

-- Index for agent's assigned leads
CREATE INDEX IF NOT EXISTS idx_re_leads_agent_active
  ON re_leads(tenant_id, assigned_to, state)
  WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;

-- Index for lead source analytics
CREATE INDEX IF NOT EXISTS idx_re_leads_source_analytics
  ON re_leads(tenant_id, source, state, created_at DESC)
  INCLUDE (campaign_id)
  WHERE deleted_at IS NULL;

-- Index for recent leads (last 30 days)
CREATE INDEX IF NOT EXISTS idx_re_leads_recent
  ON re_leads(tenant_id, created_at DESC, state)
  WHERE created_at > NOW() - INTERVAL '30 days' AND deleted_at IS NULL;

-- ============================================================================
-- 5. RESERVATIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for active reservations
CREATE INDEX IF NOT EXISTS idx_re_reservations_active
  ON re_reservations(tenant_id, status, product_id)
  WHERE status IN ('pending_deposit', 'deposited') AND deleted_at IS NULL;

-- Index for customer's reservation history
CREATE INDEX IF NOT EXISTS idx_re_reservations_customer_history
  ON re_reservations(tenant_id, customer_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Index for product's reservation history
CREATE INDEX IF NOT EXISTS idx_re_reservations_product_history
  ON re_reservations(tenant_id, product_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 6. BOOKINGS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for active bookings (FSM state-based)
CREATE INDEX IF NOT EXISTS idx_re_bookings_active_state
  ON re_bookings(tenant_id, state, product_id)
  WHERE state IN ('DRAFT', 'PENDING_APPROVAL', 'CONFIRMED') AND deleted_at IS NULL;

-- Index for customer's booking history
CREATE INDEX IF NOT EXISTS idx_re_bookings_customer_history
  ON re_bookings(tenant_id, customer_id, state, created_at DESC)
  WHERE deleted_at IS NULL;

-- Index for recent bookings analytics
CREATE INDEX IF NOT EXISTS idx_re_bookings_recent_analytics
  ON re_bookings(tenant_id, created_at DESC, state)
  INCLUDE (booking_fee)
  WHERE created_at > NOW() - INTERVAL '90 days' AND deleted_at IS NULL;

-- ============================================================================
-- 7. CONTRACTS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for active contracts
CREATE INDEX IF NOT EXISTS idx_re_contracts_active_state
  ON re_contracts(tenant_id, state, product_id)
  WHERE state IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE') AND deleted_at IS NULL;

-- Index for contract number lookup (unique search)
CREATE INDEX IF NOT EXISTS idx_re_contracts_number_lookup
  ON re_contracts(tenant_id, contract_number)
  WHERE contract_number IS NOT NULL AND deleted_at IS NULL;

-- Index for customer's contracts
CREATE INDEX IF NOT EXISTS idx_re_contracts_customer_history
  ON re_contracts(tenant_id, customer_id, state, signed_date DESC NULLS LAST)
  WHERE deleted_at IS NULL;

-- Index for contracts by date range
CREATE INDEX IF NOT EXISTS idx_re_contracts_date_range
  ON re_contracts(tenant_id, signed_date, state)
  INCLUDE (contract_price)
  WHERE signed_date IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- 8. TRANSACTIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for recent transactions (financial reporting)
CREATE INDEX IF NOT EXISTS idx_re_transactions_recent
  ON re_transactions(tenant_id, transaction_date DESC, status)
  WHERE status IN ('pending', 'completed') AND deleted_at IS NULL;

-- Index for contract's transactions
CREATE INDEX IF NOT EXISTS idx_re_transactions_contract
  ON re_transactions(tenant_id, contract_id, transaction_date DESC)
  WHERE contract_id IS NOT NULL AND deleted_at IS NULL;

-- Index for customer's payment history
CREATE INDEX IF NOT EXISTS idx_re_transactions_customer_history
  ON re_transactions(tenant_id, customer_id, transaction_date DESC, status)
  WHERE deleted_at IS NULL;

-- Index for transaction type analytics
CREATE INDEX IF NOT EXISTS idx_re_transactions_type_analytics
  ON re_transactions(tenant_id, transaction_type, transaction_date)
  INCLUDE (amount, status)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 9. COMMISSIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for agent's pending commissions
CREATE INDEX IF NOT EXISTS idx_re_commissions_agent_pending
  ON re_commissions(tenant_id, agent_id, status)
  WHERE status IN ('pending', 'approved') AND deleted_at IS NULL;

-- Index for contract's commissions
CREATE INDEX IF NOT EXISTS idx_re_commissions_contract
  ON re_commissions(tenant_id, contract_id, status)
  WHERE deleted_at IS NULL;

-- Index for commission reporting (monthly)
CREATE INDEX IF NOT EXISTS idx_re_commissions_monthly_report
  ON re_commissions(tenant_id, DATE_TRUNC('month', earned_at), status)
  INCLUDE (agent_id, commission_amount)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_index_count INT;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%';
  
                                      END $$;
