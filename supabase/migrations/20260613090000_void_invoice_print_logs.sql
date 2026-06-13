ALTER TABLE public.invoice_print_logs
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_invoice_print_logs_active_booking
  ON public.invoice_print_logs (tenant_id, booking_id, created_at DESC)
  WHERE voided_at IS NULL;
