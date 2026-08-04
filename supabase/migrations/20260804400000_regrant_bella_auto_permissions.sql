-- ============================================================================
-- Bella Auto: Re-grant permissions ONLY for existing tables
-- Fix for: permission denied for table auto_bookings (Error code 42501)
-- Timestamp: 20260804400000
-- Strategy: Grant only on tables that definitely exist
-- ============================================================================

-- Core foundation tables (Phase 1-3 - always exist)
DO $$ 
BEGIN
  -- Brands, Models, Variants (Core foundation)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_brands') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_brands TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_models') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_models TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_variants') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_variants TO authenticated;
  END IF;
  
  -- Vehicles (Core inventory)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicles') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_vehicles TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicle_status_logs') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_vehicle_status_logs TO authenticated;
  END IF;
  
  -- Bookings & Leads (Phase 4 - critical for analytics)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_bookings') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_bookings TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_leads') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_leads TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_customer_journeys') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_customer_journeys TO authenticated;
  END IF;
  
  -- Deposits (critical for payments)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_deposits') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_deposits TO authenticated;
  END IF;
  
  -- Optional: Service Center (if exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_service_appointments') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_service_appointments TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_service_records') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_service_records TO authenticated;
  END IF;
  
  -- Optional: Trade-In Center (if exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_trade_in_valuations') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_trade_in_valuations TO authenticated;
  END IF;
  
  -- Optional: Finance Center (if exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_loan_applications') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_loan_applications TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_insurance_policies') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_insurance_policies TO authenticated;
  END IF;
  
  -- Optional: Rule Engine (if exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_pricing_rules') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_pricing_rules TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_discount_rules') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_discount_rules TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_business_rules') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_business_rules TO authenticated;
  END IF;
  
  -- Optional: Marketplace (if exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_marketplace_listings') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_marketplace_listings TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_marketplace_inquiries') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_marketplace_inquiries TO authenticated;
  END IF;
  
  -- Optional: Temporal History (if exists - SELECT only)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_vehicles_history') THEN
    GRANT SELECT ON public.auto_vehicles_history TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_bookings_history') THEN
    GRANT SELECT ON public.auto_bookings_history TO authenticated;
  END IF;
  
  -- Optional: Workshop (if exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_workshop_service_types') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_workshop_service_types TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_workshop_jobs') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_workshop_jobs TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_workshop_job_items') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_workshop_job_items TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_parts_inventory') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_parts_inventory TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_parts_usage') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_parts_usage TO authenticated;
  END IF;
  
  -- Optional: Repair Orders (Service center orders - if exists)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auto_repair_orders') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_repair_orders TO authenticated;
  END IF;
END $$;

-- Grant USAGE on sequences (for inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant service_role full access (for RPCs that use SECURITY DEFINER)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Log success
DO $$ 
BEGIN
  RAISE NOTICE 'Bella Auto permissions granted successfully for authenticated role';
END $$;



