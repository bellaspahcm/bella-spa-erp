-- ============================================================================
-- Bella Healthcare Platform — Gate 4A: Order Engine Repository Layer
-- Migration: 20260812030000_extend_clinical_orders_table.sql
--
-- PURPOSE: Extend existing hc_clinical_orders table for Order Engine requirements
--          - Add patient_party_id (ADR-011: patient derived from Encounter)
--          - Add request_id (idempotency support)
--          - Add version (optimistic locking)
--
-- STRATEGY: Safe additive migration (Constitution Law 4)
--           1. ADD columns (nullable)
--           2. BACKFILL patient_party_id from encounters
--           3. VERIFY data integrity
--           4. ADD constraints (FK, UNIQUE, NOT NULL)
--           5. ADD indexes
--
-- DEPENDENCIES:
--   - hc_clinical_orders table exists (20260808000006)
--   - hc_encounters.patient_party_id exists (20260806030000)
--
-- ROLLBACK: See end of file
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: ADD COLUMNS (Nullable First)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 1] Adding columns to hc_clinical_orders...';
END $$;

-- 1.1 Patient Party ID (will be backfilled, then made NOT NULL)
ALTER TABLE public.hc_clinical_orders
  ADD COLUMN IF NOT EXISTS patient_party_id UUID;

-- 1.2 Request ID (idempotency - nullable, not all orders require it)
ALTER TABLE public.hc_clinical_orders
  ADD COLUMN IF NOT EXISTS request_id UUID;

-- 1.3 Version (optimistic locking - default 1 for existing records)
ALTER TABLE public.hc_clinical_orders
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 1] Complete - 3 columns added';
END $$;

-- ============================================================================
-- PHASE 2: BACKFILL patient_party_id from encounters
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 2] Backfilling patient_party_id from hc_encounters...';
END $$;

UPDATE public.hc_clinical_orders o
SET patient_party_id = e.patient_party_id
FROM public.hc_encounters e
WHERE o.encounter_id = e.id
  AND o.patient_party_id IS NULL;

-- Verify backfill count
DO $$ 
DECLARE
  total_orders INTEGER;
  backfilled_orders INTEGER;
  null_patient_orders INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_orders FROM hc_clinical_orders;
  SELECT COUNT(*) INTO backfilled_orders FROM hc_clinical_orders WHERE patient_party_id IS NOT NULL;
  SELECT COUNT(*) INTO null_patient_orders FROM hc_clinical_orders WHERE patient_party_id IS NULL;
  
  RAISE NOTICE '[Phase 2] Total orders: %', total_orders;
  RAISE NOTICE '[Phase 2] Backfilled: %', backfilled_orders;
  RAISE NOTICE '[Phase 2] Null patients: %', null_patient_orders;
  
  IF null_patient_orders > 0 THEN
    RAISE WARNING '[Phase 2] % orders have NULL patient_party_id (orphaned or missing encounter)', null_patient_orders;
  ELSE
    RAISE NOTICE '[Phase 2] Complete - All orders have patient_party_id';
  END IF;
END $$;

-- ============================================================================
-- PHASE 3: DATA INTEGRITY VERIFICATION
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 3] Verifying data integrity...';
END $$;

-- 3.1 Check for orphaned orders (encounter not found)
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM hc_clinical_orders o
  LEFT JOIN hc_encounters e ON o.encounter_id = e.id
  WHERE e.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE EXCEPTION '[Phase 3] FAILED - % orphaned orders (encounter_id not found in hc_encounters)', orphaned_count;
  END IF;
  
  RAISE NOTICE '[Phase 3] Orphaned orders check: PASSED (0 orphaned)';
END $$;

-- 3.2 Check for patient mismatch (if patient_party_id was manually set)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM hc_clinical_orders o
  JOIN hc_encounters e ON o.encounter_id = e.id
  WHERE o.patient_party_id IS NOT NULL
    AND o.patient_party_id != e.patient_party_id;
  
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION '[Phase 3] FAILED - % orders have patient_party_id != encounter.patient_party_id', mismatch_count;
  END IF;
  
  RAISE NOTICE '[Phase 3] Patient consistency check: PASSED (0 mismatches)';
END $$;

-- 3.3 Check for duplicate (tenant_id, request_id) if request_id exists
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT tenant_id, request_id, COUNT(*) as cnt
    FROM hc_clinical_orders
    WHERE request_id IS NOT NULL
    GROUP BY tenant_id, request_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING '[Phase 3] % duplicate (tenant_id, request_id) pairs found - unique constraint will fail', duplicate_count;
    -- Not blocking - existing data may not have request_id yet
  ELSE
    RAISE NOTICE '[Phase 3] Request ID uniqueness check: PASSED (0 duplicates)';
  END IF;
END $$;

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 3] Complete - Data integrity verified';
END $$;

-- ============================================================================
-- PHASE 4: ADD CONSTRAINTS
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 4] Adding constraints...';
END $$;

-- 4.1 Ensure hc_encounters has composite index (required for FK)
CREATE INDEX IF NOT EXISTS idx_hc_encounters_id_patient 
  ON public.hc_encounters(id, patient_party_id);

RAISE NOTICE '[Phase 4] Composite index on hc_encounters: READY';

-- 4.2 FK: patient_party_id references party_parties
ALTER TABLE public.hc_clinical_orders
  ADD CONSTRAINT fk_clinical_orders_patient
  FOREIGN KEY (patient_party_id)
  REFERENCES public.party_parties(id)
  ON DELETE CASCADE;

RAISE NOTICE '[Phase 4] FK to party_parties: ADDED';

-- 4.3 Composite FK: (encounter_id, patient_party_id) matches hc_encounters
--     This enforces: orders.patient_party_id == encounters.patient_party_id
ALTER TABLE public.hc_clinical_orders
  ADD CONSTRAINT fk_clinical_orders_patient_matches_encounter
  FOREIGN KEY (encounter_id, patient_party_id)
  REFERENCES public.hc_encounters(id, patient_party_id)
  ON DELETE CASCADE;

RAISE NOTICE '[Phase 4] Composite FK (encounter, patient): ADDED - ADR-011 enforced';

-- 4.4 UNIQUE constraint: (tenant_id, request_id) for idempotency
--     Partial index: only when request_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_hc_clinical_orders_request_id 
  ON public.hc_clinical_orders(tenant_id, request_id)
  WHERE request_id IS NOT NULL;

RAISE NOTICE '[Phase 4] Tenant-scoped idempotency index: ADDED';

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 4] Complete - Constraints added';
END $$;

-- ============================================================================
-- PHASE 5: SET NOT NULL (After Backfill)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 5] Setting NOT NULL constraints...';
END $$;

-- 5.1 patient_party_id must be NOT NULL (after backfill)
ALTER TABLE public.hc_clinical_orders
  ALTER COLUMN patient_party_id SET NOT NULL;

RAISE NOTICE '[Phase 5] patient_party_id: SET NOT NULL';

-- 5.2 version already has DEFAULT 1 NOT NULL (set in Phase 1)
-- 5.3 request_id remains NULLABLE (not all orders have request_id)

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 5] Complete - NOT NULL constraints set';
END $$;

-- ============================================================================
-- PHASE 6: ADD PERFORMANCE INDEXES
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 6] Adding performance indexes...';
END $$;

-- 6.1 Index for patient-based queries (e.g., patient medication history)
CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_patient 
  ON public.hc_clinical_orders(tenant_id, patient_party_id, order_status);

-- 6.2 Index for version-based optimistic locking queries
CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_version 
  ON public.hc_clinical_orders(id, version);

-- Note: idx_hc_clinical_orders_encounter already exists from 20260808000006

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 6] Complete - Performance indexes added';
END $$;

-- ============================================================================
-- PHASE 7: ADD COLUMN COMMENTS (Documentation)
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 7] Adding column comments...';
END $$;

COMMENT ON COLUMN public.hc_clinical_orders.patient_party_id IS
  'Patient ID derived from Encounter (ADR-011). Enforced by composite FK (encounter_id, patient_party_id) → hc_encounters. Used for patient-based queries without JOIN.';

COMMENT ON COLUMN public.hc_clinical_orders.request_id IS
  'Idempotency key (nullable). Client-provided UUID for preventing duplicate order creation. UNIQUE (tenant_id, request_id) enforced. NULL for system-generated orders.';

COMMENT ON COLUMN public.hc_clinical_orders.version IS
  'Optimistic locking version (default 1). Incremented on every update. Service checks version before update to prevent lost updates in concurrent modifications.';

DO $$ 
BEGIN
  RAISE NOTICE '[Phase 7] Complete - Column comments added';
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

DO $$ 
DECLARE
  total_orders INTEGER;
  orders_with_patient INTEGER;
  orders_with_version INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_orders FROM hc_clinical_orders;
  SELECT COUNT(*) INTO orders_with_patient FROM hc_clinical_orders WHERE patient_party_id IS NOT NULL;
  SELECT COUNT(*) INTO orders_with_version FROM hc_clinical_orders WHERE version >= 1;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total orders: %', total_orders;
  RAISE NOTICE 'Orders with patient_party_id: %', orders_with_patient;
  RAISE NOTICE 'Orders with version: %', orders_with_version;
  RAISE NOTICE '';
  RAISE NOTICE 'Constraints added:';
  RAISE NOTICE '  - FK: patient_party_id → party_parties';
  RAISE NOTICE '  - Composite FK: (encounter_id, patient_party_id) → hc_encounters (ADR-011)';
  RAISE NOTICE '  - UNIQUE INDEX: (tenant_id, request_id) WHERE request_id IS NOT NULL';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes added:';
  RAISE NOTICE '  - idx_hc_encounters_id_patient (composite for FK)';
  RAISE NOTICE '  - idx_hc_clinical_orders_request_id (tenant-scoped idempotency)';
  RAISE NOTICE '  - idx_hc_clinical_orders_patient (patient-based queries)';
  RAISE NOTICE '  - idx_hc_clinical_orders_version (optimistic locking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Implement SupabaseOrderRepository (STEP 6C)';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (For Emergency Use)
-- ============================================================================

-- Uncomment and run if rollback needed:
/*
BEGIN;

-- Drop constraints
ALTER TABLE public.hc_clinical_orders
  DROP CONSTRAINT IF EXISTS fk_clinical_orders_patient_matches_encounter;

ALTER TABLE public.hc_clinical_orders
  DROP CONSTRAINT IF EXISTS fk_clinical_orders_patient;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_hc_clinical_orders_request_id;
DROP INDEX IF EXISTS public.idx_hc_clinical_orders_patient;
DROP INDEX IF EXISTS public.idx_hc_clinical_orders_version;
DROP INDEX IF EXISTS public.idx_hc_encounters_id_patient;

-- Drop columns
ALTER TABLE public.hc_clinical_orders
  DROP COLUMN IF EXISTS patient_party_id,
  DROP COLUMN IF EXISTS request_id,
  DROP COLUMN IF EXISTS version;

COMMIT;
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
