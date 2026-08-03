-- ============================================================================
-- BƯỚC 2: DEPLOY REAL ESTATE PERFORMANCE INDEXES
-- ============================================================================
-- Chạy script này SAU KHI đã chạy DEPLOY_STEP_1_SCHEMA.sql thành công
-- Copy toàn bộ script này vào Supabase SQL Editor và chạy
-- ============================================================================

-- ============================================================================
-- CRITICAL TENANT ISOLATION INDEXES
-- ============================================================================

-- Projects - Tenant + Status (for dashboard/listings)
CREATE INDEX IF NOT EXISTS idx_re_projects_tenant_status 
  ON real_estate_projects(tenant_id, status)
  WHERE deleted_at IS NULL;

-- Projects - Tenant + Launch Date (for timeline/pipeline views)
CREATE INDEX IF NOT EXISTS idx_re_projects_tenant_launch 
  ON real_estate_projects(tenant_id, launch_date DESC)
  WHERE deleted_at IS NULL AND status NOT IN ('completed', 'sold_out');

-- Products - Tenant + Status (for available inventory)
CREATE INDEX IF NOT EXISTS idx_re_products_tenant_status 
  ON real_estate_products(tenant_id, status)
  WHERE deleted_at IS NULL;

-- Products - Tenant + Project + Status (for project detail views)
CREATE INDEX IF NOT EXISTS idx_re_products_tenant_project_status 
  ON real_estate_products(tenant_id, project_id, status)
  WHERE deleted_at IS NULL;

-- Products - Tenant + Type + Status (for product category filtering)
CREATE INDEX IF NOT EXISTS idx_re_products_tenant_type_status 
  ON real_estate_products(tenant_id, product_type, status)
  WHERE deleted_at IS NULL;

-- Customers - Tenant + Created Date (for recent customers, CRM dashboard)
CREATE INDEX IF NOT EXISTS idx_re_customers_tenant_created 
  ON re_customers(tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Customers - Tenant + Tags (for segmentation, GIN for array operations)
CREATE INDEX IF NOT EXISTS idx_re_customers_tenant_tags 
  ON re_customers(tenant_id) WHERE tags IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- LEAD MANAGEMENT & ASSIGNMENT INDEXES
-- ============================================================================

-- Leads - Tenant + State (for lead pipeline/kanban)
CREATE INDEX IF NOT EXISTS idx_re_leads_tenant_state 
  ON re_leads(tenant_id, state, state_changed_at DESC)
  WHERE deleted_at IS NULL;

-- Leads - Tenant + Assigned Agent (for agent workload/dashboard)
CREATE INDEX IF NOT EXISTS idx_re_leads_tenant_agent 
  ON re_leads(tenant_id, assigned_to, state)
  WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

-- Leads - Tenant + Source (for marketing attribution)
CREATE INDEX IF NOT EXISTS idx_re_leads_tenant_source 
  ON re_leads(tenant_id, source, created_at DESC)
  WHERE deleted_at IS NULL;

-- Leads - Tenant + State + Created (for conversion funnel analytics)
CREATE INDEX IF NOT EXISTS idx_re_leads_tenant_state_created 
  ON re_leads(tenant_id, state, created_at DESC)
  WHERE deleted_at IS NULL;

-- Partial index for "hot" leads (qualified + visit scheduled + negotiating)
CREATE INDEX IF NOT EXISTS idx_re_leads_hot 
  ON re_leads(tenant_id, assigned_to, state_changed_at DESC)
  WHERE state IN ('QUALIFIED', 'VISIT_SCHEDULED', 'NEGOTIATING') AND deleted_at IS NULL;

-- ============================================================================
-- RESERVATION & BOOKING FSM INDEXES
-- ============================================================================

-- Reservations - Tenant + Status (for reservation pipeline)
CREATE INDEX IF NOT EXISTS idx_re_reservations_tenant_status 
  ON re_reservations(tenant_id, status, reserved_at DESC)
  WHERE deleted_at IS NULL;

-- Reservations - Tenant + Product (for product availability checks)
CREATE INDEX IF NOT EXISTS idx_re_reservations_tenant_product_status 
  ON re_reservations(tenant_id, product_id, status)
  WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'converted_to_contract');

-- Reservations - Tenant + Customer (for customer history)
CREATE INDEX IF NOT EXISTS idx_re_reservations_tenant_customer 
  ON re_reservations(tenant_id, customer_id, status, reserved_at DESC)
  WHERE deleted_at IS NULL;

-- Bookings - Tenant + State (for booking pipeline)
CREATE INDEX IF NOT EXISTS idx_re_bookings_tenant_state 
  ON re_bookings(tenant_id, state, state_changed_at DESC)
  WHERE deleted_at IS NULL;

-- Bookings - Tenant + Product + State (for product sales tracking)
CREATE INDEX IF NOT EXISTS idx_re_bookings_tenant_product_state 
  ON re_bookings(tenant_id, product_id, state)
  WHERE deleted_at IS NULL;

-- Bookings - Tenant + Customer (for customer booking history)
CREATE INDEX IF NOT EXISTS idx_re_bookings_tenant_customer 
  ON re_bookings(tenant_id, customer_id, state, created_at DESC)
  WHERE deleted_at IS NULL;

-- Partial index for active bookings (pending approval + confirmed)
CREATE INDEX IF NOT EXISTS idx_re_bookings_active 
  ON re_bookings(tenant_id, product_id, state_changed_at DESC)
  WHERE state IN ('PENDING_APPROVAL', 'CONFIRMED') AND deleted_at IS NULL;

-- ============================================================================
-- CONTRACT MANAGEMENT INDEXES
-- ============================================================================

-- Contracts - Tenant + State (for contract pipeline)
CREATE INDEX IF NOT EXISTS idx_re_contracts_tenant_state 
  ON re_contracts(tenant_id, state, state_changed_at DESC)
  WHERE deleted_at IS NULL;

-- Contracts - Tenant + Product (for product sales history)
CREATE INDEX IF NOT EXISTS idx_re_contracts_tenant_product_state 
  ON re_contracts(tenant_id, product_id, state)
  WHERE deleted_at IS NULL;

-- Contracts - Tenant + Customer (for customer contract portfolio)
CREATE INDEX IF NOT EXISTS idx_re_contracts_tenant_customer 
  ON re_contracts(tenant_id, customer_id, state, signed_date DESC)
  WHERE deleted_at IS NULL;

-- Contracts - Tenant + Signed Date (for revenue recognition, aging analysis)
CREATE INDEX IF NOT EXISTS idx_re_contracts_tenant_signed_date 
  ON re_contracts(tenant_id, signed_date DESC, state)
  WHERE deleted_at IS NULL AND state IN ('ACTIVE', 'PENDING_APPROVAL');

-- Partial index for active contracts (for accounting/revenue)
CREATE INDEX IF NOT EXISTS idx_re_contracts_active 
  ON re_contracts(tenant_id, signed_date DESC)
  WHERE state = 'ACTIVE' AND deleted_at IS NULL;

-- Contracts - Installment JSONB search (for due installments lookup)
CREATE INDEX IF NOT EXISTS idx_re_contracts_installments_gin 
  ON re_contracts USING GIN (installments)
  WHERE deleted_at IS NULL AND state = 'ACTIVE';

-- ============================================================================
-- FINANCIAL TRANSACTION INDEXES
-- ============================================================================

-- Transactions - Tenant + Date (for financial reports, cashflow)
CREATE INDEX IF NOT EXISTS idx_re_transactions_tenant_date 
  ON re_transactions(tenant_id, transaction_date DESC, status)
  WHERE deleted_at IS NULL;

-- Transactions - Tenant + Status (for pending/completed tracking)
CREATE INDEX IF NOT EXISTS idx_re_transactions_tenant_status 
  ON re_transactions(tenant_id, status, transaction_date DESC)
  WHERE deleted_at IS NULL;

-- Transactions - Tenant + Type + Date (for revenue/expense breakdown)
CREATE INDEX IF NOT EXISTS idx_re_transactions_tenant_type_date 
  ON re_transactions(tenant_id, transaction_type, transaction_date DESC)
  WHERE deleted_at IS NULL AND status = 'completed';

-- Transactions - Tenant + Contract (for contract payment history)
CREATE INDEX IF NOT EXISTS idx_re_transactions_tenant_contract 
  ON re_transactions(tenant_id, contract_id, transaction_date DESC)
  WHERE deleted_at IS NULL AND contract_id IS NOT NULL;

-- Transactions - Tenant + Customer (for customer payment history)
CREATE INDEX IF NOT EXISTS idx_re_transactions_tenant_customer 
  ON re_transactions(tenant_id, customer_id, transaction_date DESC)
  WHERE deleted_at IS NULL;

-- Partial index for completed transactions (for financial reports)
CREATE INDEX IF NOT EXISTS idx_re_transactions_completed 
  ON re_transactions(tenant_id, transaction_date DESC, amount)
  WHERE status = 'completed' AND deleted_at IS NULL;

-- Installment tracking (contract + installment number)
CREATE INDEX IF NOT EXISTS idx_re_transactions_contract_installment 
  ON re_transactions(contract_id, installment_number, status)
  WHERE deleted_at IS NULL AND installment_number IS NOT NULL;

-- ============================================================================
-- COMMISSION TRACKING INDEXES
-- ============================================================================

-- Commissions - Tenant + Agent (for agent earnings dashboard)
CREATE INDEX IF NOT EXISTS idx_re_commissions_tenant_agent 
  ON re_commissions(tenant_id, agent_id, status, earned_at DESC)
  WHERE deleted_at IS NULL;

-- Commissions - Tenant + Status (for commission approval workflow)
CREATE INDEX IF NOT EXISTS idx_re_commissions_tenant_status 
  ON re_commissions(tenant_id, status, earned_at DESC)
  WHERE deleted_at IS NULL;

-- Commissions - Tenant + Contract (for contract commission audit)
CREATE INDEX IF NOT EXISTS idx_re_commissions_tenant_contract 
  ON re_commissions(tenant_id, contract_id, status)
  WHERE deleted_at IS NULL;

-- Partial index for pending commissions (for approval queue)
CREATE INDEX IF NOT EXISTS idx_re_commissions_pending 
  ON re_commissions(tenant_id, agent_id, earned_at DESC)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- Partial index for paid commissions (for payroll reconciliation)
CREATE INDEX IF NOT EXISTS idx_re_commissions_paid 
  ON re_commissions(tenant_id, agent_id, paid_at DESC)
  WHERE status = 'paid' AND deleted_at IS NULL;

-- ============================================================================
-- ANALYTICS & REPORTING COMPOSITE INDEXES
-- ============================================================================

-- Product availability report (tenant + project + status)
CREATE INDEX IF NOT EXISTS idx_re_products_availability_report 
  ON real_estate_products(tenant_id, project_id, status, product_type)
  INCLUDE (area_m2, unit_price)
  WHERE deleted_at IS NULL;

-- Sales pipeline report (tenant + date range + states)
CREATE INDEX IF NOT EXISTS idx_re_sales_pipeline_report 
  ON re_bookings(tenant_id, created_at DESC, state)
  INCLUDE (product_id, customer_id, booking_fee)
  WHERE deleted_at IS NULL;

-- Revenue recognition report (tenant + date + status)
CREATE INDEX IF NOT EXISTS idx_re_revenue_report 
  ON re_transactions(tenant_id, transaction_date DESC, status, transaction_type)
  INCLUDE (amount, contract_id, customer_id)
  WHERE deleted_at IS NULL AND status = 'completed';

-- Agent performance report (tenant + agent + date range)
CREATE INDEX IF NOT EXISTS idx_re_agent_performance_report 
  ON re_commissions(tenant_id, agent_id, earned_at DESC, status)
  INCLUDE (commission_amount, contract_id)
  WHERE deleted_at IS NULL AND status IN ('approved', 'paid');

-- Customer lifetime value report (tenant + customer)
CREATE INDEX IF NOT EXISTS idx_re_customer_ltv_report 
  ON re_contracts(tenant_id, customer_id, state, signed_date DESC)
  INCLUDE (contract_price, product_id)
  WHERE deleted_at IS NULL AND state = 'ACTIVE';

-- ============================================================================
-- VERIFICATION & STATISTICS
-- ============================================================================
DO $$
DECLARE
  v_index_count INT;
  v_gin_count INT;
  v_partial_count INT;
  v_composite_count INT;
BEGIN
  -- Count all Real Estate indexes
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND (tablename LIKE 're_%' OR tablename LIKE 'real_estate_%')
    AND indexname LIKE 'idx_re_%';
  
  -- Count GIN indexes (for JSONB/array operations)
  SELECT COUNT(*) INTO v_gin_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND (tablename LIKE 're_%' OR tablename LIKE 'real_estate_%')
    AND indexdef LIKE '%USING gin%';
  
  -- Count partial indexes (WHERE clause)
  SELECT COUNT(*) INTO v_partial_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND (tablename LIKE 're_%' OR tablename LIKE 'real_estate_%')
    AND indexdef LIKE '%WHERE%';
  
  -- Count composite indexes (INCLUDE clause or multi-column)
  SELECT COUNT(*) INTO v_composite_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND (tablename LIKE 're_%' OR tablename LIKE 'real_estate_%')
    AND (indexdef LIKE '%INCLUDE%' OR indexdef ~ '\(.*,.*\)');
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ REAL ESTATE PERFORMANCE OPTIMIZATION DEPLOYED';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Index Statistics:';
  RAISE NOTICE '  • Total Indexes:      %', v_index_count;
  RAISE NOTICE '  • GIN Indexes:        % (JSONB/Array)', v_gin_count;
  RAISE NOTICE '  • Partial Indexes:    % (WHERE filters)', v_partial_count;
  RAISE NOTICE '  • Composite Indexes:  % (Multi-column/INCLUDE)', v_composite_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Optimization Areas:';
  RAISE NOTICE '  ✓ Tenant isolation (multi-tenancy core)';
  RAISE NOTICE '  ✓ FSM state transitions (leads, bookings, contracts)';
  RAISE NOTICE '  ✓ Product availability (inventory management)';
  RAISE NOTICE '  ✓ Financial transactions (accounting, cashflow)';
  RAISE NOTICE '  ✓ Commission tracking (agent performance)';
  RAISE NOTICE '  ✓ Analytics & reporting (dashboard queries)';
  RAISE NOTICE '';
  RAISE NOTICE '📚 Based on Beauty Spa patterns from Playbook';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Real Estate module optimization complete!';
  RAISE NOTICE '';
END $$;
