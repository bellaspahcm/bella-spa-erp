-- Verify 0 orphans remaining after cleanup
SELECT COUNT(*) as remaining_orphans 
FROM finance_cash_movements fcm 
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id 
WHERE ft.id IS NULL;
