-- ============================================================================
-- ADD MISSING COLUMNS to EXISTING TABLES
-- ============================================================================
-- Run this BEFORE performance indexes if tables already exist
-- ============================================================================

-- Add deleted_at to real_estate_projects if missing
DO $$ BEGIN
  ALTER TABLE real_estate_projects ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add deleted_at and area_m2 to real_estate_products if missing
DO $$ BEGIN
  ALTER TABLE real_estate_products ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE real_estate_products ADD COLUMN area_m2 NUMERIC(10, 2) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Update area_m2 from area if needed
UPDATE real_estate_products 
SET area_m2 = COALESCE(area, 0) 
WHERE area_m2 = 0 OR area_m2 IS NULL;

-- Add deleted_at to re_customers if table exists
DO $$ BEGIN
  ALTER TABLE re_customers ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION 
  WHEN duplicate_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Add deleted_at to re_leads if table exists
DO $$ BEGIN
  ALTER TABLE re_leads ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION 
  WHEN duplicate_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Add deleted_at to re_reservations if table exists
DO $$ BEGIN
  ALTER TABLE re_reservations ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION 
  WHEN duplicate_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Add deleted_at to re_bookings if table exists
DO $$ BEGIN
  ALTER TABLE re_bookings ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION 
  WHEN duplicate_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Add deleted_at to re_contracts if table exists
DO $$ BEGIN
  ALTER TABLE re_contracts ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION 
  WHEN duplicate_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Add deleted_at to re_transactions if table exists
DO $$ BEGIN
  ALTER TABLE re_transactions ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION 
  WHEN duplicate_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Add deleted_at to re_commissions if table exists
DO $$ BEGIN
  ALTER TABLE re_commissions ADD COLUMN deleted_at TIMESTAMPTZ;
EXCEPTION 
  WHEN duplicate_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Verify
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name LIKE 're_%' OR table_name LIKE 'real_estate_%')
    AND column_name = 'deleted_at';
  
  RAISE NOTICE '✅ Added deleted_at to % tables. Ready for performance indexes!', v_count;
END $$;
