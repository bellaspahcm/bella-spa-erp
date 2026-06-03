-- Keep revenue.revenue_type constraint aligned with current SIMPLE finance flows.
-- Refund rows store a positive amount for SIMPLE reports and carry refund semantics
-- through revenue_type/accounting metadata into the PROFESSIONAL accounting outbox.

ALTER TABLE public.revenue
  DROP CONSTRAINT IF EXISTS revenue_revenue_type_check;

ALTER TABLE public.revenue
  ADD CONSTRAINT revenue_revenue_type_check
  CHECK (
    revenue_type IN (
      'deposit',
      'session_completed',
      'additional',
      'package_payment',
      'remaining_payment',
      'package_sale',
      'refund'
    )
  );
