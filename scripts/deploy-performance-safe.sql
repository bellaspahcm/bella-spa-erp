-- ============================================================================
-- REAL ESTATE PERFORMANCE OPTIMIZATION (SAFE VERSION)
-- ============================================================================
-- Only creates indexes on existing tables/columns
-- No assumptions about schema - safe for production
-- ============================================================================

-- Check if tables exist before creating indexes
DO $$
BEGIN
  -- ============================================================================
  -- PROJECTS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'real_estate_projects') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_projects_status_active
      ON real_estate_projects(tenant_id, status)
      WHERE status = 'active';
    
    CREATE INDEX IF NOT EXISTS idx_re_projects_location
      ON real_estate_projects(tenant_id, location);
    
    RAISE NOTICE '✓ Optimized: real_estate_projects';
  END IF;

  -- ============================================================================
  -- PRODUCTS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'real_estate_products') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_products_available
      ON real_estate_products(tenant_id, project_id, status)
      WHERE status = 'available';
    
    CREATE INDEX IF NOT EXISTS idx_re_products_type_status
      ON real_estate_products(tenant_id, product_type, status);
    
    CREATE INDEX IF NOT EXISTS idx_re_products_price_range
      ON real_estate_products(tenant_id, unit_price)
      WHERE status = 'available';
    
    RAISE NOTICE '✓ Optimized: real_estate_products';
  END IF;

  -- ============================================================================
  -- CUSTOMERS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 're_customers') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_customers_phone_lookup
      ON re_customers(tenant_id, phone);
    
    CREATE INDEX IF NOT EXISTS idx_re_customers_email_lookup
      ON re_customers(tenant_id, email)
      WHERE email IS NOT NULL;
    
    -- GIN index for tags (if column exists)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 're_customers' AND column_name = 'tags'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_re_customers_tags_gin
        ON re_customers USING GIN (tags);
    END IF;
    
    RAISE NOTICE '✓ Optimized: re_customers';
  END IF;

  -- ============================================================================
  -- LEADS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 're_leads') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_leads_active_state
      ON re_leads(tenant_id, state, assigned_to)
      WHERE state NOT IN ('CONVERTED', 'LOST');
    
    CREATE INDEX IF NOT EXISTS idx_re_leads_agent_active
      ON re_leads(tenant_id, assigned_to, state)
      WHERE assigned_to IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_re_leads_source_analytics
      ON re_leads(tenant_id, source, state, created_at DESC);
    
    RAISE NOTICE '✓ Optimized: re_leads';
  END IF;

  -- ============================================================================
  -- RESERVATIONS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 're_reservations') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_reservations_active
      ON re_reservations(tenant_id, status, product_id);
    
    CREATE INDEX IF NOT EXISTS idx_re_reservations_customer_history
      ON re_reservations(tenant_id, customer_id, created_at DESC);
    
    RAISE NOTICE '✓ Optimized: re_reservations';
  END IF;

  -- ============================================================================
  -- BOOKINGS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 're_bookings') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_bookings_active_state
      ON re_bookings(tenant_id, state, product_id)
      WHERE state IN ('DRAFT', 'PENDING_APPROVAL', 'CONFIRMED');
    
    CREATE INDEX IF NOT EXISTS idx_re_bookings_customer_history
      ON re_bookings(tenant_id, customer_id, state, created_at DESC);
    
    RAISE NOTICE '✓ Optimized: re_bookings';
  END IF;

  -- ============================================================================
  -- CONTRACTS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 're_contracts') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_contracts_active_state
      ON re_contracts(tenant_id, state, product_id)
      WHERE state IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE');
    
    CREATE INDEX IF NOT EXISTS idx_re_contracts_number_lookup
      ON re_contracts(tenant_id, contract_number)
      WHERE contract_number IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_re_contracts_customer_history
      ON re_contracts(tenant_id, customer_id, state, signed_date DESC NULLS LAST);
    
    RAISE NOTICE '✓ Optimized: re_contracts';
  END IF;

  -- ============================================================================
  -- TRANSACTIONS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 're_transactions') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_transactions_recent
      ON re_transactions(tenant_id, transaction_date DESC, status)
      WHERE status IN ('pending', 'completed');
    
    CREATE INDEX IF NOT EXISTS idx_re_transactions_contract
      ON re_transactions(tenant_id, contract_id, transaction_date DESC)
      WHERE contract_id IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_re_transactions_customer_history
      ON re_transactions(tenant_id, customer_id, transaction_date DESC, status);
    
    RAISE NOTICE '✓ Optimized: re_transactions';
  END IF;

  -- ============================================================================
  -- COMMISSIONS TABLE (if exists)
  -- ============================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 're_commissions') THEN
    
    CREATE INDEX IF NOT EXISTS idx_re_commissions_agent_pending
      ON re_commissions(tenant_id, agent_id, status)
      WHERE status IN ('pending', 'approved');
    
    CREATE INDEX IF NOT EXISTS idx_re_commissions_contract
      ON re_commissions(tenant_id, contract_id, status);
    
    RAISE NOTICE '✓ Optimized: re_commissions';
  END IF;

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE '✅ Real Estate Performance Optimization Complete';
  RAISE NOTICE '   Created indexes on existing tables only';
  RAISE NOTICE '   Safe for production deployment';
END $$;

-- Verify indexes created
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%'
ORDER BY tablename, indexname;
