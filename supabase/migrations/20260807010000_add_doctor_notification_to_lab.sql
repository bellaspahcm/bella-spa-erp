-- Add doctor notification columns to hc_lab_orders for LIS CAP/JCI Audit Log persistence
ALTER TABLE public.hc_lab_orders 
ADD COLUMN IF NOT EXISTS doctor_notified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS doctor_notified_time TEXT;
