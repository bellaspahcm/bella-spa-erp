-- Add doctor notification columns to hc_imaging_orders for RIS PACS Critical Findings Audit Log
ALTER TABLE public.hc_imaging_orders 
ADD COLUMN IF NOT EXISTS doctor_notified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS doctor_notified_time TEXT;
