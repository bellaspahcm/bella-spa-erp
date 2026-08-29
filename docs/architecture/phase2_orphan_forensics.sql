-- PHASE 2: ORPHAN FORENSIC INVESTIGATION
-- Purpose: Extract complete details for 18 orphan movements
-- Date: 2026-08-24
-- Status: READ-ONLY EVIDENCE GATHERING

-- =============================================================================
-- Query 1: Full orphan details
-- =============================================================================
SELECT 
    fcm.id AS orphan_id,
    fcm.tenant_id,
    t.name AS tenant_name,
    fcm.bank_account_id,
    ba.account_number,
    ba.account_name,
    fcm.direction,
    fcm.amount_minor,
    fcm.currency,
    fcm.functional_amount_minor,
    fcm.functional_currency,
    fcm.effective_date,
    fcm.recorded_at,
    fcm.f1_transaction_id,
    fcm.cash_leg_reference,
    fcm.source_type,
    fcm.source_id,
    fcm.description,
    fcm.idempotency_key,
    fcm.created_at
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
LEFT JOIN tenants t ON fcm.tenant_id = t.id
LEFT JOIN finance_bank_accounts ba 
    ON fcm.bank_account_id = ba.id 
    AND fcm.tenant_id = ba.tenant_id
WHERE ft.id IS NULL
ORDER BY fcm.tenant_id, fcm.recorded_at;

-- =============================================================================
-- Query 2: Orphan summary statistics
-- =============================================================================
SELECT 
    COUNT(*) as total_orphans,
    COUNT(DISTINCT fcm.tenant_id) as unique_tenants,
    COUNT(DISTINCT fcm.bank_account_id) as unique_bank_accounts,
    COUNT(DISTINCT fcm.source_type) as unique_source_types,
    SUM(fcm.amount_minor) as total_amount_minor,
    MIN(fcm.recorded_at) as earliest_orphan,
    MAX(fcm.recorded_at) as latest_orphan,
    COUNT(DISTINCT DATE(fcm.recorded_at)) as unique_dates
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
WHERE ft.id IS NULL;

-- =============================================================================
-- Query 3: Compare total movements (orphan vs valid lineage)
-- =============================================================================
SELECT 
    CASE 
        WHEN ft.id IS NULL THEN 'ORPHAN'
        ELSE 'VALID_LINEAGE'
    END as lineage_status,
    COUNT(*) as movement_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage,
    SUM(fcm.amount_minor) as total_amount_minor
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
GROUP BY lineage_status
ORDER BY lineage_status;

-- =============================================================================
-- Query 4: Check if F1 transaction IDs are valid UUIDs
-- =============================================================================
SELECT 
    fcm.id AS orphan_id,
    fcm.f1_transaction_id,
    CASE 
        WHEN fcm.f1_transaction_id IS NULL THEN 'NULL'
        WHEN fcm.f1_transaction_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN 'VALID_UUID'
        ELSE 'INVALID_UUID'
    END as uuid_validation
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
WHERE ft.id IS NULL;

-- =============================================================================
-- Query 5: Timeline analysis (orphan creation clusters)
-- =============================================================================
SELECT 
    DATE(fcm.recorded_at) as orphan_date,
    EXTRACT(HOUR FROM fcm.recorded_at) as hour,
    COUNT(*) as orphan_count,
    STRING_AGG(fcm.id::text, ', ' ORDER BY fcm.recorded_at) as orphan_ids
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
WHERE ft.id IS NULL
GROUP BY DATE(fcm.recorded_at), EXTRACT(HOUR FROM fcm.recorded_at)
ORDER BY orphan_date, hour;

-- =============================================================================
-- Query 6: Check for duplicate source_id across all movements
-- =============================================================================
SELECT 
    fcm.source_id,
    COUNT(*) as usage_count,
    STRING_AGG(
        CASE 
            WHEN ft.id IS NULL THEN 'ORPHAN:' || fcm.id::text
            ELSE 'VALID:' || fcm.id::text
        END, 
        ', ' 
        ORDER BY fcm.created_at
    ) as movement_list
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
WHERE fcm.source_id IN (
    SELECT fcm2.source_id 
    FROM finance_cash_movements fcm2
    LEFT JOIN finance_transactions ft2 
        ON fcm2.f1_transaction_id = ft2.id 
        AND fcm2.tenant_id = ft2.tenant_id
    WHERE ft2.id IS NULL
)
GROUP BY fcm.source_id
HAVING COUNT(*) > 1;

-- =============================================================================
-- Query 7: Check migration history
-- =============================================================================
SELECT 
    version,
    name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '202608%'
ORDER BY version;
