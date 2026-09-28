-- Bella Preschool - Parent/Guardian user profile capability
--
-- Scope:
-- - Allow legitimate parent accounts in public.users for Preschool Parent Daily
--   Experience browser verification and runtime access.
-- - Preserve all existing user roles.
-- - Do not grant parent any staff/admin capability or alter RLS/policies.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'admin',
    'ktv_lead',
    'ktv',
    'admin_staff',
    'accountant',
    'hr',
    'student',
    'parent'
  ));
