-- ============================================================================
-- FIX ENUM VALUES
-- ============================================================================
-- Check and fix reservation_status enum
-- ============================================================================

-- Drop and recreate reservation_status enum with correct values
DO $$ 
BEGIN
  -- Drop the enum if it exists
  DROP TYPE IF EXISTS reservation_status CASCADE;
  
  -- Recreate with correct values
  CREATE TYPE reservation_status AS ENUM (
    'pending_deposit', 
    'deposited', 
    'converted_to_contract', 
    'cancelled'
  );
  
  RAISE NOTICE '✅ Fixed reservation_status enum with correct values';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error: %', SQLERRM;
END $$;

-- Verify all enums exist
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_type
  WHERE typname IN (
    'product_type', 'lead_state', 'booking_state', 
    'contract_state', 'reservation_status'
  );
  
  IF v_count = 5 THEN
    RAISE NOTICE '✅ All 5 enums verified: product_type, lead_state, booking_state, contract_state, reservation_status';
  ELSE
    RAISE NOTICE '⚠️ Only % enums found, expected 5', v_count;
  END IF;
END $$;
