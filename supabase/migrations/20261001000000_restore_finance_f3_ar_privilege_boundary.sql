-- Migration: 20261001000000_restore_finance_f3_ar_privilege_boundary
-- Component: Finance F3 Accounts Receivable privilege boundary restore
-- Purpose:
--   Restore the canonical F3 AR direct-access contract after broad schema grants
--   gave anon/authenticated write privileges on all public tables.
--
-- Canonical contract:
--   - anon has no direct table access to F3 AR tables.
--   - authenticated has tenant-scoped SELECT access only.
--   - writes continue through service_role / SECURITY DEFINER finance boundaries.

REVOKE ALL ON public.finance_invoices FROM anon, authenticated;
REVOKE ALL ON public.finance_invoice_lines FROM anon, authenticated;
REVOKE ALL ON public.finance_receivable_ledger FROM anon, authenticated;
REVOKE ALL ON public.finance_receivable_positions FROM anon, authenticated;
REVOKE ALL ON public.finance_receivable_allocations FROM anon, authenticated;
REVOKE ALL ON public.finance_receivable_adjustments FROM anon, authenticated;

GRANT SELECT ON public.finance_invoices TO authenticated;
GRANT SELECT ON public.finance_invoice_lines TO authenticated;
GRANT SELECT ON public.finance_receivable_ledger TO authenticated;
GRANT SELECT ON public.finance_receivable_positions TO authenticated;
GRANT SELECT ON public.finance_receivable_allocations TO authenticated;
GRANT SELECT ON public.finance_receivable_adjustments TO authenticated;
