-- Beauty OS History Contract: assignment/resource history is append-only.
-- Approved canonical tables:
--   beauty_professional_assignment_history
--   beauty_resource_allocation_history

REVOKE UPDATE, DELETE ON public.beauty_professional_assignment_history FROM authenticated;
REVOKE UPDATE, DELETE ON public.beauty_resource_allocation_history FROM authenticated;

DROP POLICY IF EXISTS beauty_assignment_history_tenant_isolation ON public.beauty_professional_assignment_history;
DROP POLICY IF EXISTS beauty_allocation_history_tenant_isolation ON public.beauty_resource_allocation_history;
DROP POLICY IF EXISTS beauty_assignment_history_select ON public.beauty_professional_assignment_history;
DROP POLICY IF EXISTS beauty_assignment_history_insert ON public.beauty_professional_assignment_history;
DROP POLICY IF EXISTS beauty_assignment_history_no_update ON public.beauty_professional_assignment_history;
DROP POLICY IF EXISTS beauty_assignment_history_no_delete ON public.beauty_professional_assignment_history;
DROP POLICY IF EXISTS beauty_allocation_history_select ON public.beauty_resource_allocation_history;
DROP POLICY IF EXISTS beauty_allocation_history_insert ON public.beauty_resource_allocation_history;
DROP POLICY IF EXISTS beauty_allocation_history_no_update ON public.beauty_resource_allocation_history;
DROP POLICY IF EXISTS beauty_allocation_history_no_delete ON public.beauty_resource_allocation_history;

CREATE POLICY beauty_assignment_history_select
  ON public.beauty_professional_assignment_history
  FOR SELECT
  TO authenticated
  USING (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY beauty_assignment_history_insert
  ON public.beauty_professional_assignment_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY beauty_assignment_history_no_update
  ON public.beauty_professional_assignment_history
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY beauty_assignment_history_no_delete
  ON public.beauty_professional_assignment_history
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY beauty_allocation_history_select
  ON public.beauty_resource_allocation_history
  FOR SELECT
  TO authenticated
  USING (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY beauty_allocation_history_insert
  ON public.beauty_resource_allocation_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hq_super_admin() OR tenant_id = public.get_auth_tenant_id());

CREATE POLICY beauty_allocation_history_no_update
  ON public.beauty_resource_allocation_history
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY beauty_allocation_history_no_delete
  ON public.beauty_resource_allocation_history
  FOR DELETE
  TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.fn_prevent_beauty_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Beauty OS history tables are append-only. % on % is forbidden by Beauty OS History Contract.',
    TG_OP,
    TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_beauty_assignment_history_append_only
  ON public.beauty_professional_assignment_history;
CREATE TRIGGER trg_beauty_assignment_history_append_only
  BEFORE UPDATE OR DELETE ON public.beauty_professional_assignment_history
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_beauty_history_mutation();

DROP TRIGGER IF EXISTS trg_beauty_allocation_history_append_only
  ON public.beauty_resource_allocation_history;
CREATE TRIGGER trg_beauty_allocation_history_append_only
  BEFORE UPDATE OR DELETE ON public.beauty_resource_allocation_history
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_beauty_history_mutation();

COMMENT ON TABLE public.beauty_professional_assignment_history IS
  'Beauty OS canonical assignment history. Append-only: INSERT and tenant SELECT only; UPDATE/DELETE prohibited.';
COMMENT ON TABLE public.beauty_resource_allocation_history IS
  'Beauty OS canonical resource allocation history. Append-only: INSERT and tenant SELECT only; UPDATE/DELETE prohibited.';
