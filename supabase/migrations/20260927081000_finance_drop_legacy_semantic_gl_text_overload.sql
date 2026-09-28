-- Finance OS TT99 Slice 1 RPC overload cleanup.
-- Scope:
-- - Remove only the obsolete TEXT overload that makes PostgREST unable to
--   choose the canonical semantic GL mapping RPC.
-- - Preserve the repo-owned VARCHAR overload introduced by
--   20260927080000_finance_tt99_slice1_accounting_activation.sql.
--
-- This migration intentionally does not alter accounts, mappings, COA data,
-- accounting semantics, invoices, journals, or AR state.

-- zero-downtime: allow drop-object - reviewed RPC overload cleanup to remove PostgREST ambiguity while preserving canonical varchar signature
DROP FUNCTION IF EXISTS public.finance_get_accounting_semantic_gl_map_as_of(
  UUID,
  TEXT,
  DATE,
  TEXT
);
