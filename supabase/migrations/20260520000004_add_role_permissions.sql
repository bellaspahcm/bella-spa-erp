-- Migration: Add role_permissions to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS role_permissions JSONB DEFAULT '{"ktv_lead": {"dashboard": true, "customers": false, "bookings": true, "sessions": true, "chat": true, "crm": true, "services": true, "finance": false, "reconciliation": false, "inventory": false, "salary": false, "audit": false, "settings": false}}'::jsonb;
