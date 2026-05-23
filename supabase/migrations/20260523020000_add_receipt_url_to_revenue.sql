-- Migration: Add receipt_url column to revenue table to support proof-of-payment uploads for deposits and remaining payments
ALTER TABLE public.revenue ADD COLUMN IF NOT EXISTS receipt_url TEXT;
