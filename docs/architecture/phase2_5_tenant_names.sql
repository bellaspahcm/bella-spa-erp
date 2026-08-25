-- Get actual tenant names for the 18 orphans
SELECT 
    t.id,
    t.name,
    t.status,
    fcm.id as movement_id,
    fcm.recorded_at,
    CASE 
        WHEN t.name LIKE 'Test Tenant F5%' THEN 'TEST_TENANT'
        ELSE 'PRODUCTION_TENANT'
    END as classification
FROM tenants t
INNER JOIN finance_cash_movements fcm ON t.id = fcm.tenant_id
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
WHERE ft.id IS NULL
ORDER BY classification, t.name, fcm.recorded_at;
