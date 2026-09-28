-- R3 runtime boundary: resolve the transitional person identity without
-- exposing the migration-owned identity_migration_mapping table.

CREATE OR REPLACE FUNCTION public.resolve_student_person_id(p_party_id UUID)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.person_id
  FROM public.identity_migration_mapping AS m
  WHERE m.party_id = p_party_id
    AND m.tenant_id = public.get_auth_tenant_id()
    AND m.status = 'party_created'
    AND m.sealed_at IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_student_person_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_student_person_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_student_person_id(UUID) TO authenticated;
