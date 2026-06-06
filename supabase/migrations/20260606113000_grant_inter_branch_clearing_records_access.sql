-- =============================================================================
-- Migration: Grant inter-branch clearing table access
-- Date: 2026-06-06
-- Purpose:
--   The table already has RLS policies, but authenticated users also need
--   table-level privileges before PostgreSQL evaluates those policies.
--   Without GRANT, Finance Reconciliation shows:
--   "permission denied for table inter_branch_clearing_records".
-- =============================================================================

REVOKE ALL ON TABLE public.inter_branch_clearing_records FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inter_branch_clearing_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inter_branch_clearing_records TO service_role;

COMMENT ON TABLE public.inter_branch_clearing_records
IS 'Inter-branch clearing records. Table privileges are granted to authenticated users, while RLS limits access to HQ or related debtor/creditor branches.';

NOTIFY pgrst, 'reload schema';
