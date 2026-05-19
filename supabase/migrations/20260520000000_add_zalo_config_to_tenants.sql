-- Migration to add Zalo Official Account & ZNS configurations to the tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS zalo_app_id TEXT,
ADD COLUMN IF NOT EXISTS zalo_secret_key TEXT,
ADD COLUMN IF NOT EXISTS zalo_oa_id TEXT,
ADD COLUMN IF NOT EXISTS zalo_access_token TEXT,
ADD COLUMN IF NOT EXISTS zalo_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS zalo_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS zalo_template_reminder_id TEXT,
ADD COLUMN IF NOT EXISTS zalo_template_birthday_id TEXT,
ADD COLUMN IF NOT EXISTS zalo_auto_scan BOOLEAN DEFAULT TRUE;
