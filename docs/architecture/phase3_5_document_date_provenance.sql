-- Phase 3.5 Task 3: Classify document_date provenance (PROVABLE/INFERABLE/UNKNOWABLE)
-- Goal: Determine which F1 transactions have deterministic document_date from source

-- ============================================================================
-- CLASSIFICATION FRAMEWORK
-- ============================================================================
-- PROVABLE: Source table has explicit document/issue date field
-- INFERABLE: Can deduce from business logic/policy but requires assumption
-- UNKNOWABLE: Insufficient evidence, no source table or no date field

-- ============================================================================
-- 1. F3_AR_INVOICE → PROVABLE (finance_invoices.issue_date)
-- ============================================================================
SELECT 
    'F3_AR_INVOICE' AS source_type,
    'PROVABLE' AS classification,
    'finance_invoices.issue_date' AS provenance_field,
    COUNT(*) AS record_count,
    MIN(f1.posted_at) AS earliest_transaction,
    MAX(f1.posted_at) AS latest_transaction
FROM finance_transactions f1
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'F3_AR_INVOICE'
GROUP BY source_type;

-- Sample: Verify issue_date exists and is not NULL
SELECT 
    f1.id AS f1_id,
    f1.source_id,
    f1.posted_at AS f1_posted_at,
    fi.issue_date AS provable_document_date,
    fi.created_at AS fallback_timestamp
FROM finance_transactions f1
JOIN finance_invoices fi ON fi.id = f1.source_id::uuid
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'F3_AR_INVOICE'
ORDER BY f1.created_at
LIMIT 10;

-- ============================================================================
-- 2. SALES_ORDER → INFERABLE (business logic required)
-- ============================================================================
-- Must investigate: Does sales_orders table exist? Does it have order_date/booking_date?
-- If no explicit date field → UNKNOWABLE
-- If has created_at only → INFERABLE (with policy assumption)

SELECT 
    'SALES_ORDER' AS source_type,
    'INFERABLE' AS classification_candidate,
    'Requires business table investigation' AS note,
    COUNT(*) AS record_count
FROM finance_transactions f1
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'SALES_ORDER';

-- TODO: Check if sales_orders table exists and has date field
-- SELECT tablename FROM pg_tables WHERE tablename LIKE '%sales%' OR tablename LIKE '%order%';

-- ============================================================================
-- 3. SPA_BOOKING → INFERABLE (requires spa booking schema investigation)
-- ============================================================================
SELECT 
    'SPA_BOOKING' AS source_type,
    'INFERABLE' AS classification_candidate,
    'Requires spa_bookings table investigation' AS note,
    COUNT(*) AS record_count
FROM finance_transactions f1
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'SPA_BOOKING';

-- TODO: Check spa_bookings schema for booking_date or service_date

-- ============================================================================
-- 4. AP_PAYMENT → INFERABLE (finance_payments.payment_date?)
-- ============================================================================
SELECT 
    'AP_PAYMENT' AS source_type,
    'INFERABLE' AS classification_candidate,
    'Requires finance_payments schema investigation' AS note,
    COUNT(*) AS record_count
FROM finance_transactions f1
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'AP_PAYMENT';

-- TODO: Check if finance_payments has payment_date or execution_date

-- ============================================================================
-- 5. F2_CASH → COMPLEX (F2.effective_date provenance chain)
-- ============================================================================
-- F2.effective_date currently derived from F1.posted_at (WRONG per Phase 3.2)
-- But historical F2 records already have effective_date set
-- Classification: INFERABLE (from existing F2.effective_date)

SELECT 
    'F2_CASH' AS source_type,
    'INFERABLE' AS classification,
    'Use existing F2.effective_date (but verify semantic correctness)' AS provenance_strategy,
    COUNT(*) AS record_count
FROM finance_transactions f1
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'F2_CASH';

-- Verify F2.effective_date distribution
SELECT 
    f1.id AS f1_id,
    f1.posted_at AS f1_posted_at,
    f2.effective_date AS f2_effective_date,
    f2.created_at AS f2_created_at,
    (f1.posted_at::date = f2.effective_date::date) AS dates_match
FROM finance_transactions f1
JOIN finance_cash_movements f2 ON f2.transaction_id = f1.id
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type = 'F2_CASH'
ORDER BY f1.created_at
LIMIT 20;

-- ============================================================================
-- 6. TEST DATA → UNKNOWABLE (no business provenance)
-- ============================================================================
SELECT 
    f1.source_type,
    'UNKNOWABLE' AS classification,
    'Test artifact - no business source document' AS reason,
    COUNT(*) AS record_count
FROM finance_transactions f1
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type IN (
      'CONCURRENCY_TEST',
      'VERIFICATION',
      'F2_REGRESSION',
      'test'
  )
GROUP BY f1.source_type
ORDER BY record_count DESC;

-- ============================================================================
-- 7. PERIOD_CLOSE, MANUAL, NULL → Classification depends on investigation
-- ============================================================================
SELECT 
    f1.source_type,
    'REQUIRES_INVESTIGATION' AS classification,
    COUNT(*) AS record_count,
    MIN(f1.created_at) AS earliest,
    MAX(f1.created_at) AS latest
FROM finance_transactions f1
WHERE f1.lifecycle_state = 'POSTED'
  AND f1.source_type IN (
      'PERIOD_CLOSE',
      'MANUAL',
      'MIGRATION'
  )
GROUP BY f1.source_type;

-- ============================================================================
-- SUMMARY: document_date Provenance Classification
-- ============================================================================
SELECT 
    CASE 
        WHEN f1.source_type = 'F3_AR_INVOICE' THEN 'PROVABLE'
        WHEN f1.source_type IN ('SALES_ORDER', 'SPA_BOOKING', 'AP_PAYMENT', 'F2_CASH') THEN 'INFERABLE'
        WHEN f1.source_type IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test') THEN 'UNKNOWABLE'
        ELSE 'REQUIRES_INVESTIGATION'
    END AS document_date_classification,
    COUNT(*) AS record_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM finance_transactions f1
WHERE f1.lifecycle_state = 'POSTED'
GROUP BY document_date_classification
ORDER BY record_count DESC;
