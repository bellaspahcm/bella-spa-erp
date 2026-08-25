-- PHASE 2.5: CLEANUP SAFETY GATE
-- Purpose: Verify 18 orphan tenants have NO Spa/business dependencies
-- Date: 2026-08-24

-- Get the 18 orphan tenant_ids
WITH orphan_tenants AS (
    SELECT DISTINCT fcm.tenant_id
    FROM finance_cash_movements fcm
    LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    WHERE ft.id IS NULL
),
-- Safety Check 1: Tenant types
tenant_check AS (
    SELECT 
        t.id,
        t.name,
        t.status,
        CASE 
            WHEN t.name LIKE '%Spa%' THEN 'SPA_TENANT'
            WHEN t.name LIKE '%Test%' THEN 'TEST_TENANT'
            WHEN t.name LIKE '%Demo%' THEN 'DEMO_TENANT'
            WHEN t.name LIKE '%Production%' THEN 'PRODUCTION_TENANT'
            WHEN t.name LIKE '%Pilot%' THEN 'PILOT_TENANT'
            ELSE 'UNKNOWN_TYPE'
        END as tenant_type,
        t.created_at
    FROM orphan_tenants ot
    INNER JOIN tenants t ON ot.tenant_id = t.id
),
-- Safety Check 2: Spa bookings
booking_check AS (
    SELECT COUNT(*) as booking_count
    FROM orphan_tenants ot
    INNER JOIN bookings b ON ot.tenant_id = b.tenant_id
),
-- Safety Check 3: Spa revenue
revenue_check AS (
    SELECT COUNT(*) as revenue_count
    FROM orphan_tenants ot
    INNER JOIN revenue r ON ot.tenant_id = r.tenant_id
),
-- Safety Check 4: Finance transactions
tx_check AS (
    SELECT COUNT(*) as transaction_count
    FROM orphan_tenants ot
    INNER JOIN finance_transactions ft ON ot.tenant_id = ft.tenant_id
),
-- Safety Check 5: Finance invoices
invoice_check AS (
    SELECT COUNT(*) as invoice_count
    FROM orphan_tenants ot
    INNER JOIN finance_invoices fi ON ot.tenant_id = fi.tenant_id
)
-- Final summary
SELECT 
    'SAFETY_GATE_RESULT' as check_type,
    (SELECT COUNT(*) FROM tenant_check WHERE tenant_type IN ('SPA_TENANT', 'PRODUCTION_TENANT', 'PILOT_TENANT')) as unsafe_tenant_count,
    (SELECT booking_count FROM booking_check) as spa_bookings,
    (SELECT revenue_count FROM revenue_check) as spa_revenue,
    (SELECT transaction_count FROM tx_check) as finance_transactions,
    (SELECT invoice_count FROM invoice_check) as finance_invoices,
    CASE 
        WHEN (SELECT COUNT(*) FROM tenant_check WHERE tenant_type IN ('SPA_TENANT', 'PRODUCTION_TENANT', 'PILOT_TENANT')) > 0 
        THEN 'BLOCKED_PRODUCTION_TENANT'
        WHEN (SELECT booking_count FROM booking_check) > 0 
        THEN 'BLOCKED_SPA_BOOKINGS'
        WHEN (SELECT revenue_count FROM revenue_check) > 0 
        THEN 'BLOCKED_SPA_REVENUE'
        WHEN (SELECT transaction_count FROM tx_check) > 0 
        THEN 'BLOCKED_FINANCE_TX'
        ELSE 'SAFE_TO_DELETE'
    END as gate_status;
