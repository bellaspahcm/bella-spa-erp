-- ============================================================================
-- BƯỚC 1: DEPLOY REAL ESTATE CORE SCHEMA
-- ============================================================================
-- Copy toàn bộ script này vào Supabase SQL Editor và chạy
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: ENUMS
-- ============================================================================

-- Product Type
DO $$ BEGIN
  CREATE TYPE product_type AS ENUM ('apartment', 'townhouse', 'shophouse', 'villa');
  RAISE NOTICE '  ✓ Created enum: product_type';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: product_type';
END $$;

-- Lead State
DO $$ BEGIN
  CREATE TYPE lead_state AS ENUM (
    'NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 
    'VISIT_SCHEDULED', 'NEGOTIATING', 'CONVERTED', 'LOST'
  );
  RAISE NOTICE '  ✓ Created enum: lead_state';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: lead_state';
END $$;

-- Booking State
DO $$ BEGIN
  CREATE TYPE booking_state AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'CANCELLED'
  );
  RAISE NOTICE '  ✓ Created enum: booking_state';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: booking_state';
END $$;

-- Contract State
DO $$ BEGIN
  CREATE TYPE contract_state AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'TERMINATED'
  );
  RAISE NOTICE '  ✓ Created enum: contract_state';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: contract_state';
END $$;

-- Reservation Status
DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM (
    'pending_deposit', 'deposited', 'converted_to_contract', 'cancelled'
  );
  RAISE NOTICE '  ✓ Created enum: reservation_status';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: reservation_status';
END $$;

-- ============================================================================
-- SECTION 2: ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add deleted_at to real_estate_projects if missing
DO $$ BEGIN
  ALTER TABLE real_estate_projects ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to real_estate_projects';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in real_estate_projects';
END $$;

-- Add area_m2 to real_estate_products if missing
DO $$ BEGIN
  ALTER TABLE real_estate_products ADD COLUMN area_m2 NUMERIC(10, 2) DEFAULT 0;
  RAISE NOTICE '  ✓ Added area_m2 to real_estate_products';
  
  -- Update existing rows with 0 to area value
  UPDATE real_estate_products SET area_m2 = area WHERE area_m2 = 0 OR area_m2 IS NULL;
  
  -- Now add constraint
  ALTER TABLE real_estate_products ADD CONSTRAINT real_estate_products_area_m2_positive CHECK (area_m2 > 0);
  RAISE NOTICE '  ✓ Added constraint for area_m2';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column area_m2 already exists in real_estate_products';
END $$;

-- Add deleted_at to real_estate_products if missing
DO $$ BEGIN
  ALTER TABLE real_estate_products ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to real_estate_products';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in real_estate_products';
END $$;

-- Add deleted_at to re_customers if missing
DO $$ BEGIN
  ALTER TABLE re_customers ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to re_customers';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in re_customers';
END $$;

-- Add deleted_at to re_leads if missing
DO $$ BEGIN
  ALTER TABLE re_leads ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to re_leads';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in re_leads';
END $$;

-- Add deleted_at to re_reservations if missing
DO $$ BEGIN
  ALTER TABLE re_reservations ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to re_reservations';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in re_reservations';
END $$;

-- Add deleted_at to re_bookings if missing
DO $$ BEGIN
  ALTER TABLE re_bookings ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to re_bookings';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in re_bookings';
END $$;

-- Add deleted_at to re_contracts if missing
DO $$ BEGIN
  ALTER TABLE re_contracts ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to re_contracts';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in re_contracts';
END $$;

-- Add deleted_at to re_transactions if missing
DO $$ BEGIN
  ALTER TABLE re_transactions ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to re_transactions';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in re_transactions';
END $$;

-- Add deleted_at to re_commissions if missing
DO $$ BEGIN
  ALTER TABLE re_commissions ADD COLUMN deleted_at TIMESTAMPTZ;
  RAISE NOTICE '  ✓ Added deleted_at to re_commissions';
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE '  ⚠️  Column deleted_at already exists in re_commissions';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  v_enum_count INT;
  v_column_count INT;
BEGIN
  -- Count enums
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_type
  WHERE typname IN (
    'product_type', 'lead_state', 'booking_state', 'contract_state', 'reservation_status'
  );
  
  -- Count deleted_at columns
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND (table_name LIKE 're_%' OR table_name LIKE 'real_estate_%')
    AND column_name = 'deleted_at';
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ REAL ESTATE SCHEMA PATCH DEPLOYED';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Enums: % | Deleted_at columns: %', v_enum_count, v_column_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ready for performance indexes deployment!';
  RAISE NOTICE '';
END $$;
