-- Migration: F2 Cash Temporal Contract — Add effective_date Column
-- Description: Adds effective_date to finance_cash_movements and backfills from finance_transactions.posted_at
-- Contract: F2_CASH:v1 Temporal Authority
-- Invariants: INV-F2-T1 (effective_date immutable), INV-F2-T3 (temporal determinism)
-- Architecture Decision: effective_date = F1.posted_at (business/accounting date), recorded_at = projection timestamp
-- Date: 2026-08-24
-- Status: ✅ APPROVED (M1)

-- =========================================================================
-- STEP 1: ADD COLUMN (nullable initially for backfill)
-- =========================================================================

ALTER TABLE public.finance_cash_movements
    ADD COLUMN effective_date TIMESTAMPTZ;

COMMENT ON COLUMN public.finance_cash_movements.effective_date IS
    'F2 Cash Temporal Contract v1.2: Business effective date (accounting date / Vietnamese "ngày hạch toán"). '
    'Sourced from f1_transaction.posted_at. Immutable after INSERT. Used for temporal as_of queries. '
    'INV-F2-T1: effective_date = f1_transaction.posted_at at projection time. '
    'INV-F2-T3: Temporal determinism — same as_of always returns same results.';

-- =========================================================================
-- STEP 2: TEMPORARILY DISABLE IMMUTABILITY TRIGGERS FOR BACKFILL
-- =========================================================================

-- CRITICAL: finance_cash_movements has multiple triggers that block UPDATEs:
--   1. trg_finance_cash_movements_immutability (immutability_guard)
--   2. trg_finance_cash_movements_mutation_guard (mutation_guard)
-- We must temporarily disable them to backfill effective_date from F1 authoritative source.
-- This is a one-time migration operation. Triggers will be re-enabled immediately after backfill.

DO $$
BEGIN
    -- Disable immutability trigger
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'finance_cash_movements'
          AND trigger_name = 'trg_finance_cash_movements_immutability'
    ) THEN
        DROP TRIGGER trg_finance_cash_movements_immutability ON public.finance_cash_movements;
        RAISE NOTICE 'M1: Temporarily disabled immutability trigger for backfill';
    ELSE
        RAISE NOTICE 'M1: No immutability trigger found (expected on fresh database)';
    END IF;

    -- Disable mutation guard trigger
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'finance_cash_movements'
          AND trigger_name = 'trg_finance_cash_movements_mutation_guard'
    ) THEN
        DROP TRIGGER trg_finance_cash_movements_mutation_guard ON public.finance_cash_movements;
        RAISE NOTICE 'M1: Temporarily disabled mutation guard trigger for backfill';
    ELSE
        RAISE NOTICE 'M1: No mutation guard trigger found (expected on fresh database)';
    END IF;
END $$;

-- =========================================================================
-- STEP 3: BACKFILL FROM F1 TRANSACTIONS (Authoritative Source)
-- =========================================================================

-- Backfill effective_date from finance_transactions.posted_at
-- This establishes the F1 → F2 temporal lineage (INV-F2-T1)
-- Authority: F1.posted_at (business/accounting date)
UPDATE public.finance_cash_movements fcm
SET effective_date = ft.posted_at
FROM public.finance_transactions ft
WHERE fcm.f1_transaction_id = ft.id
  AND fcm.tenant_id = ft.tenant_id
  AND fcm.effective_date IS NULL;

-- =========================================================================
-- STEP 3b: FALLBACK FOR ORPHAN MOVEMENTS (Data Integrity Issue)
-- =========================================================================

-- CRITICAL: Some cash movements may be orphaned (F1 transaction deleted or never existed).
-- For these movements, we use recorded_at as fallback temporal authority.
-- This violates strict INV-F2-T1 (effective_date = F1.posted_at) but allows migration to proceed.
-- These movements should be flagged for manual review.

UPDATE public.finance_cash_movements fcm
SET effective_date = fcm.recorded_at  -- Fallback: use projection time as effective date
WHERE fcm.effective_date IS NULL      -- Only orphan movements
  AND fcm.f1_transaction_id IS NOT NULL;  -- Has F1 reference but F1 transaction missing

-- Log orphan movements for manual review
DO $$
DECLARE
    v_orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_orphan_count
    FROM public.finance_cash_movements fcm
    LEFT JOIN public.finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    WHERE ft.id IS NULL
      AND fcm.f1_transaction_id IS NOT NULL;
    
    IF v_orphan_count > 0 THEN
        RAISE WARNING 'M1: % orphan cash movements detected (F1 transaction missing). Used recorded_at as fallback temporal authority. Manual review recommended.',
            v_orphan_count;
    END IF;
END $$;

-- =========================================================================
-- STEP 4: RE-ENABLE IMMUTABILITY TRIGGERS (if they existed)
-- =========================================================================

-- Re-create the triggers if they existed before
-- This ensures cash movements remain immutable after migration completes
DO $$
BEGIN
    -- Re-enable immutability trigger
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'finance_cash_movements_immutability_guard'
    ) THEN
        CREATE TRIGGER trg_finance_cash_movements_immutability
            BEFORE UPDATE OR DELETE ON public.finance_cash_movements
            FOR EACH ROW EXECUTE FUNCTION public.finance_cash_movements_immutability_guard();
        
        RAISE NOTICE 'M1: Re-enabled immutability trigger';
    ELSE
        RAISE NOTICE 'M1: No immutability guard function found (expected on fresh database)';
    END IF;

    -- Re-enable mutation guard trigger
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'finance_cash_mutation_guard'
    ) THEN
        CREATE TRIGGER trg_finance_cash_movements_mutation_guard
            BEFORE INSERT OR UPDATE OR DELETE ON public.finance_cash_movements
            FOR EACH ROW EXECUTE FUNCTION public.finance_cash_mutation_guard();
        
        RAISE NOTICE 'M1: Re-enabled mutation guard trigger';
    ELSE
        RAISE NOTICE 'M1: No mutation guard function found (expected on fresh database)';
    END IF;
END $$;

-- =========================================================================
-- STEP 5: VERIFY BACKFILL COMPLETE (no NULL values remain)
-- =========================================================================

DO $$
DECLARE
    v_null_count INTEGER;
    v_total_count INTEGER;
BEGIN
    SELECT 
        COUNT(*) FILTER (WHERE effective_date IS NULL),
        COUNT(*)
    INTO v_null_count, v_total_count
    FROM public.finance_cash_movements;

    IF v_null_count > 0 THEN
        RAISE EXCEPTION 'F2_BACKFILL_INCOMPLETE: % of % cash movements have NULL effective_date after backfill. '
                        'Manual intervention required to establish F1 lineage for orphaned movements.',
            v_null_count, v_total_count
        USING ERRCODE = 'F2010';
    END IF;

    RAISE NOTICE 'M1 Verification: Backfill complete. All % cash movements have effective_date.', v_total_count;
END $$;

-- =========================================================================
-- STEP 6: VERIFY F1 LINEAGE (effective_date = F1.posted_at)
-- =========================================================================

DO $$
DECLARE
    v_total_movements INTEGER;
    v_valid_lineage INTEGER;
    v_orphan_fallback INTEGER;
    v_invalid_lineage INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE fcm.effective_date = ft.posted_at),
        COUNT(*) FILTER (WHERE ft.id IS NULL AND fcm.effective_date = fcm.recorded_at),
        COUNT(*) FILTER (WHERE ft.id IS NOT NULL AND fcm.effective_date IS DISTINCT FROM ft.posted_at)
    INTO v_total_movements, v_valid_lineage, v_orphan_fallback, v_invalid_lineage
    FROM public.finance_cash_movements fcm
    LEFT JOIN public.finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id;

    IF v_invalid_lineage > 0 THEN
        RAISE EXCEPTION 'F2_M1_LINEAGE_FAILED: % of % movements have effective_date != F1.posted_at (invalid lineage)',
            v_invalid_lineage, v_total_movements
        USING ERRCODE = 'F2011',
              HINT = 'Cash movements with valid F1 transaction must have effective_date = finance_transactions.posted_at';
    END IF;

    IF v_orphan_fallback > 0 THEN
        RAISE NOTICE 'M1 Verification: F1 lineage established. % valid lineage, % orphan fallback (recorded_at used).', 
            v_valid_lineage, v_orphan_fallback;
    ELSE
        RAISE NOTICE 'M1 Verification: F1 lineage valid. All % movements have effective_date = F1.posted_at.', v_total_movements;
    END IF;
END $$;

-- =========================================================================
-- STEP 7: MAKE NOT NULL (enforce immutability)
-- =========================================================================

ALTER TABLE public.finance_cash_movements
    ALTER COLUMN effective_date SET NOT NULL;

-- =========================================================================
-- STEP 8: ADD INDEX FOR TEMPORAL QUERIES
-- =========================================================================

-- Index for temporal as_of queries (tenant + bank_account + effective_date)
-- Supports: finance_get_cash_movements_as_of() WHERE effective_date <= p_as_of
CREATE INDEX idx_finance_cash_movements_effective_date 
    ON public.finance_cash_movements(tenant_id, bank_account_id, effective_date);

COMMENT ON INDEX idx_finance_cash_movements_effective_date IS
    'F2 Temporal Contract: Supports as_of temporal queries by effective_date (business date). '
    'Used by finance_get_cash_movements_as_of() to filter movements <= p_as_of.';

-- =========================================================================
-- VERIFICATION CHECKLIST
-- =========================================================================

-- Post-migration verification queries:
-- 
-- 1. Verify column exists:
--    SELECT effective_date FROM finance_cash_movements LIMIT 1;
--
-- 2. Verify no NULL values:
--    SELECT COUNT(*) FROM finance_cash_movements WHERE effective_date IS NULL;
--    -- Expected: 0
--
-- 3. Verify backfill lineage (effective_date matches F1 posted_at):
--    SELECT fcm.id, fcm.effective_date, ft.posted_at, fcm.effective_date = ft.posted_at AS lineage_valid
--    FROM finance_cash_movements fcm
--    JOIN finance_transactions ft ON fcm.f1_transaction_id = ft.id AND fcm.tenant_id = ft.tenant_id
--    LIMIT 10;
--    -- Expected: lineage_valid = TRUE for all rows
--
-- 4. Verify index exists:
--    SELECT indexname FROM pg_indexes 
--    WHERE tablename = 'finance_cash_movements' AND indexname = 'idx_finance_cash_movements_effective_date';
--    -- Expected: 1 row

-- =========================================================================
-- SEMANTIC FIELD DEFINITIONS (POST-MIGRATION)
-- =========================================================================

-- Field           | Semantic                          | Temporal Authority
-- ----------------|-----------------------------------|-------------------
-- effective_date  | Business/accounting date          | ✅ YES (F1 posted_at)
-- recorded_at     | Projection timestamp              | ❌ NO (system observation)
-- created_at      | Row creation timestamp            | ❌ NO (database metadata)
--
-- INV-F2-T1: effective_date immutable after INSERT
-- INV-F2-T2: effective_date = F1.posted_at (authoritative source)
-- INV-F2-T3: Temporal determinism (same as_of → same results regardless of query time)

-- Migration complete. F2 temporal authority established.
