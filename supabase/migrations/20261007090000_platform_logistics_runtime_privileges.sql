-- Platform: minimum Logistics runtime privileges and tenant context alignment.
--
-- Scope:
-- - Use Bella's canonical authenticated runtime tenant source:
--   public.get_auth_tenant_id().
-- - Grant only the minimum privileges needed for Warehouse Stock-In proof.
-- - Do not create roles, aliases, RPC facades, Logistics schema, or broaden
--   Logistics capability.
-- - Some CI baselines do not deploy the sealed Logistics schema. In those
--   environments this migration records as applied without creating Logistics
--   objects; canonical DBs with Logistics deployed receive the grants/policies.

DO $$
BEGIN
  IF to_regnamespace('logistics') IS NULL THEN
    RAISE NOTICE 'Skipping Logistics runtime privileges: schema logistics is not deployed in this database.';
    RETURN;
  END IF;

  IF to_regclass('logistics.items') IS NULL
    OR to_regclass('logistics.locations') IS NULL
    OR to_regclass('logistics.inventory') IS NULL
    OR to_regclass('logistics.inventory_movements') IS NULL
    OR to_regclass('logistics.traceability') IS NULL
  THEN
    RAISE NOTICE 'Skipping Logistics runtime privileges: required Logistics tables are not deployed in this database.';
    RETURN;
  END IF;

  GRANT USAGE ON SCHEMA logistics TO authenticated;

  GRANT SELECT
    ON logistics.items,
       logistics.locations
    TO authenticated;

  GRANT SELECT, INSERT, UPDATE
    ON logistics.inventory,
       logistics.traceability
    TO authenticated;

  GRANT SELECT, INSERT
    ON logistics.inventory_movements
    TO authenticated;

  DROP POLICY IF EXISTS items_tenant_isolation ON logistics.items;
  CREATE POLICY items_tenant_isolation
    ON logistics.items
    FOR ALL
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

  DROP POLICY IF EXISTS locations_tenant_isolation ON logistics.locations;
  CREATE POLICY locations_tenant_isolation
    ON logistics.locations
    FOR ALL
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

  DROP POLICY IF EXISTS inventory_tenant_isolation ON logistics.inventory;
  CREATE POLICY inventory_tenant_isolation
    ON logistics.inventory
    FOR ALL
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

  DROP POLICY IF EXISTS movements_tenant_isolation ON logistics.inventory_movements;
  CREATE POLICY movements_tenant_isolation
    ON logistics.inventory_movements
    FOR ALL
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());

  DROP POLICY IF EXISTS traceability_tenant_isolation ON logistics.traceability;
  CREATE POLICY traceability_tenant_isolation
    ON logistics.traceability
    FOR ALL
    TO authenticated
    USING (tenant_id = public.get_auth_tenant_id())
    WITH CHECK (tenant_id = public.get_auth_tenant_id());
END $$;
