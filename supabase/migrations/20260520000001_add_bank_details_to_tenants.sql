-- Migration to add Spa Email & Bank details to tenants table, and update payment method constraint in revenue table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS qr_bank_code TEXT,
ADD COLUMN IF NOT EXISTS qr_account_number TEXT,
ADD COLUMN IF NOT EXISTS qr_account_name TEXT;

-- Drop old check constraint if exists and add the new one supporting 'VietQR'
ALTER TABLE revenue DROP CONSTRAINT IF EXISTS revenue_payment_method_check;
ALTER TABLE revenue ADD CONSTRAINT revenue_payment_method_check CHECK (payment_method IN ('cash', 'bank_transfer', 'zalo_pay', 'momo', 'VietQR'));
