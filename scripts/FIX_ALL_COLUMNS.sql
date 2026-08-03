-- ============================================================================
-- FIX ALL MISSING COLUMNS
-- ============================================================================
-- Add all missing columns to existing tables
-- ============================================================================

-- Projects table
DO $$ BEGIN ALTER TABLE real_estate_projects ADD COLUMN launch_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE real_estate_projects ADD COLUMN completion_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE real_estate_projects ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE real_estate_projects ADD COLUMN developer TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE real_estate_projects ADD COLUMN description TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Products table
DO $$ BEGIN ALTER TABLE real_estate_products ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE real_estate_products ADD COLUMN area_m2 NUMERIC(10, 2) DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE real_estate_products ADD COLUMN floor_number INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE real_estate_products ADD COLUMN direction TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Update area_m2 from area
UPDATE real_estate_products SET area_m2 = COALESCE(area, 0) WHERE area_m2 = 0 OR area_m2 IS NULL;

-- Customers table (if exists)
DO $$ BEGIN ALTER TABLE re_customers ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_customers ADD COLUMN family_members JSONB DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_customers ADD COLUMN co_owners JSONB DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_customers ADD COLUMN investment_profile JSONB; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- Leads table (if exists)
DO $$ BEGIN ALTER TABLE re_leads ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_leads ADD COLUMN state_changed_at TIMESTAMPTZ DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_leads ADD COLUMN campaign_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- Reservations table (if exists)
DO $$ BEGIN ALTER TABLE re_reservations ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_reservations ADD COLUMN reserved_at TIMESTAMPTZ DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_reservations ADD COLUMN deposited_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_reservations ADD COLUMN converted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_reservations ADD COLUMN cancelled_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- Bookings table (if exists)
DO $$ BEGIN ALTER TABLE re_bookings ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_bookings ADD COLUMN state_changed_at TIMESTAMPTZ DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_bookings ADD COLUMN submitted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_bookings ADD COLUMN confirmed_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_bookings ADD COLUMN cancelled_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- Contracts table (if exists)
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN state_changed_at TIMESTAMPTZ DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN installments JSONB DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN signed_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN start_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN end_date DATE; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN submitted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN activated_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_contracts ADD COLUMN terminated_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- Transactions table (if exists)
DO $$ BEGIN ALTER TABLE re_transactions ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_transactions ADD COLUMN installment_number INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_transactions ADD COLUMN payment_method TEXT; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_transactions ADD COLUMN reference_number TEXT; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- Commissions table (if exists)
DO $$ BEGIN ALTER TABLE re_commissions ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_commissions ADD COLUMN earned_at TIMESTAMPTZ DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_commissions ADD COLUMN approved_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE re_commissions ADD COLUMN paid_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- Summary
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(DISTINCT table_name) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name LIKE 're_%' OR table_name LIKE 'real_estate_%');
  
  RAISE NOTICE '✅ Fixed all columns for % Real Estate tables', v_count;
  RAISE NOTICE '✅ Ready for performance indexes deployment!';
END $$;
