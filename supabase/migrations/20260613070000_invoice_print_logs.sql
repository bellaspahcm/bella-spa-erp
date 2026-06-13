CREATE TABLE IF NOT EXISTS public.invoice_print_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  session_log_id UUID REFERENCES public.session_logs(id),
  invoice_number TEXT NOT NULL,
  printed_by UUID REFERENCES public.users(id),
  print_count INTEGER NOT NULL DEFAULT 1 CHECK (print_count > 0),
  print_type TEXT NOT NULL DEFAULT 'original' CHECK (print_type IN ('original', 'reprint')),
  reason TEXT,
  amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  transfer_memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_print_logs_tenant_booking
  ON public.invoice_print_logs (tenant_id, booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_print_logs_invoice_number
  ON public.invoice_print_logs (tenant_id, invoice_number, created_at DESC);

ALTER TABLE public.invoice_print_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant view invoice print logs" ON public.invoice_print_logs;
CREATE POLICY "Tenant view invoice print logs"
  ON public.invoice_print_logs
  FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));

DROP POLICY IF EXISTS "Tenant insert invoice print logs" ON public.invoice_print_logs;
CREATE POLICY "Tenant insert invoice print logs"
  ON public.invoice_print_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()));

GRANT SELECT, INSERT ON public.invoice_print_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_print_logs TO service_role;
