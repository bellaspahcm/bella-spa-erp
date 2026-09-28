-- BDGF owner-operated approval mode for one-person company operation.
--
-- This preserves the existing separated approval mode by default while
-- allowing explicit owner-operated approvals to use the same identity for
-- requester and approver. All other BDGF controls remain unchanged.

ALTER TABLE public.bella_migration_approval
  ADD COLUMN IF NOT EXISTS approval_mode VARCHAR(32) NOT NULL DEFAULT 'separated';

ALTER TABLE public.bella_migration_approval
  DROP CONSTRAINT IF EXISTS bella_migration_approval_mode_check;

ALTER TABLE public.bella_migration_approval
  ADD CONSTRAINT bella_migration_approval_mode_check
  CHECK (approval_mode IN ('separated', 'owner_operated'));

ALTER TABLE public.bella_migration_approval
  DROP CONSTRAINT IF EXISTS no_self_approval;

ALTER TABLE public.bella_migration_approval
  ADD CONSTRAINT no_self_approval
  CHECK (
    (approval_mode = 'separated' AND requester_id <> approver_id)
    OR approval_mode = 'owner_operated'
  );

COMMENT ON COLUMN public.bella_migration_approval.approval_mode IS
  'BDGF approval mode. separated preserves requester_id != approver_id. owner_operated supports one-person company approval while retaining hash, expiry, environment/schema, token, executor and audit controls.';

COMMENT ON CONSTRAINT no_self_approval ON public.bella_migration_approval IS
  'Separated approvals require requester_id <> approver_id. Owner-operated approvals explicitly allow the same owner identity.';
