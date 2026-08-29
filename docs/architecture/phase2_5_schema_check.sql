-- Check F2 schema date columns
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'finance_cash_movements' 
  AND column_name IN ('effective_date', 'recorded_at', 'document_date', 'accounting_date') 
ORDER BY ordinal_position;
