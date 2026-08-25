-- PHASE 2.5: Final Causality Verification

-- 1. Confirm 18 orphans still exist
SELECT COUNT(*) as current_orphan_count
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
WHERE ft.id IS NULL;

-- 2. Get tenant existence status
SELECT 
    fcm.tenant_id,
    COUNT(*) as movement_count,
    CASE 
        WHEN t.id IS NOT NULL THEN 'TENANT_EXISTS'
        ELSE 'TENANT_DELETED'
    END as tenant_status,
    t.name as tenant_name
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
LEFT JOIN tenants t ON fcm.tenant_id = t.id
WHERE ft.id IS NULL
GROUP BY fcm.tenant_id, t.id, t.name
ORDER BY tenant_status, tenant_name;

-- 3. Summary of evidence collected
SELECT 
    'EVIDENCE SUMMARY' as report_section,
    '18 orphan movements' as finding_1,
    'ALL source_ids NOT FOUND in business tables' as finding_2,
    'f5_test_cleanup_rPC exists and can delete F1' as finding_3,
    'Test pattern matches (15M, PAYMENT, INFLOW, cash-idemp-)' as finding_4,
    'Causality NOT YET PROVEN (no RPC invocation log)' as finding_5,
    'UNDETERMINED with STRONG SUSPECT' as current_status;
