-- PHASE 2.5: ROOT CAUSE FORENSICS
-- Purpose: Investigate 18 orphan movements to establish definitive root cause
-- Date: 2026-08-24
-- Status: READ-ONLY INVESTIGATION

-- =============================================================================
-- INVESTIGATION 1: Business Domain — Do source_id records exist?
-- =============================================================================

-- List of 18 orphan source_ids
WITH orphan_sources AS (
    SELECT DISTINCT
        fcm.source_id,
        fcm.source_type,
        fcm.id as movement_id,
        fcm.f1_transaction_id,
        fcm.recorded_at
    FROM finance_cash_movements fcm
    LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    WHERE ft.id IS NULL
    ORDER BY fcm.recorded_at
)
SELECT 
    os.source_id,
    os.source_type,
    os.movement_id,
    os.f1_transaction_id,
    os.recorded_at,
    -- Check various business domain tables
    CASE 
        WHEN os.source_id::uuid IS NOT NULL THEN 'VALID_UUID'
        ELSE 'INVALID_UUID'
    END as uuid_format,
    -- We'll need to check actual business tables
    -- Placeholder for now - need to know actual schema
    'NEEDS_BUSINESS_DOMAIN_CHECK' as business_domain_status
FROM orphan_sources os
ORDER BY os.recorded_at;

-- =============================================================================
-- INVESTIGATION 2: Check if source_id pattern matches test data
-- =============================================================================

-- All 18 orphans have identical characteristics - check if this is a pattern
SELECT 
    fcm.amount_minor,
    fcm.currency,
    fcm.direction,
    fcm.source_type,
    ba.account_number,
    fcm.description,
    COUNT(*) as count_with_same_pattern
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
LEFT JOIN finance_bank_accounts ba
    ON fcm.bank_account_id = ba.id
    AND fcm.tenant_id = ba.tenant_id
WHERE ft.id IS NULL
GROUP BY 
    fcm.amount_minor,
    fcm.currency,
    fcm.direction,
    fcm.source_type,
    ba.account_number,
    fcm.description;

-- =============================================================================
-- INVESTIGATION 3: Audit Trail — Check for F1 transaction history
-- =============================================================================

-- Check if audit schema exists
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.schemata 
    WHERE schema_name = 'audit'
) as audit_schema_exists;

-- Check if there's an audit table for finance_transactions
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'audit' 
    AND table_name LIKE '%finance_transaction%'
) as finance_transactions_audit_exists;

-- =============================================================================
-- INVESTIGATION 4: Migration History — Check for cleanup operations
-- =============================================================================

-- Get all Finance OS migrations
SELECT 
    version,
    name,
    CASE 
        WHEN name LIKE '%finance%' THEN 'FINANCE_RELATED'
        WHEN name LIKE '%seed%' THEN 'SEED_DATA'
        WHEN name LIKE '%test%' THEN 'TEST_DATA'
        WHEN name LIKE '%cleanup%' THEN 'CLEANUP'
        ELSE 'OTHER'
    END as migration_category
FROM supabase_migrations.schema_migrations
WHERE version LIKE '202608%'
    AND (
        name LIKE '%finance%'
        OR name LIKE '%seed%'
        OR name LIKE '%test%'
        OR name IS NULL
    )
ORDER BY version;

-- =============================================================================
-- INVESTIGATION 5: Check for soft-delete or archive mechanisms
-- =============================================================================

-- Check if finance_transactions has soft-delete columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'finance_transactions'
    AND (
        column_name LIKE '%deleted%'
        OR column_name LIKE '%archived%'
        OR column_name LIKE '%status%'
    );

-- Check actual status values in finance_transactions if status column exists
SELECT 
    status,
    COUNT(*) as count
FROM finance_transactions
WHERE status IS NOT NULL
GROUP BY status;

-- =============================================================================
-- INVESTIGATION 6: Transaction Boundary Analysis
-- =============================================================================

-- Check idempotency keys pattern
WITH orphan_idemp AS (
    SELECT 
        fcm.idempotency_key,
        fcm.source_id,
        fcm.f1_transaction_id,
        fcm.recorded_at
    FROM finance_cash_movements fcm
    LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    WHERE ft.id IS NULL
)
SELECT 
    idempotency_key,
    CASE 
        WHEN idempotency_key LIKE 'cash-idemp-%' THEN 'STANDARD_PATTERN'
        ELSE 'NON_STANDARD'
    END as pattern_type,
    source_id,
    f1_transaction_id,
    recorded_at
FROM orphan_idemp
ORDER BY recorded_at;

-- =============================================================================
-- INVESTIGATION 7: Check if F1 IDs exist in ANY table (relocated?)
-- =============================================================================

-- Get the 18 missing F1 transaction IDs
WITH missing_f1_ids AS (
    SELECT DISTINCT f1_transaction_id
    FROM finance_cash_movements fcm
    LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    WHERE ft.id IS NULL
)
SELECT 
    f1_transaction_id,
    'FINANCE_TRANSACTIONS' as expected_table,
    'NOT_FOUND' as status
FROM missing_f1_ids;

-- Note: Would need to check if these IDs appear in any other tables
-- (archived_transactions, deleted_transactions, etc.) if they exist
