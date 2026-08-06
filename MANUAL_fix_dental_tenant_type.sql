-- Fix: Set Bella Dental Clinic back to dental type
UPDATE tenants
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"healthcareType": "dental"}'::jsonb
WHERE id = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d';

-- Verify
SELECT 
  id, 
  name, 
  metadata->>'healthcareType' as healthcare_type
FROM tenants
WHERE id = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d';
