-- ============================================================================
-- BELLA RUNTIME MIGRATION: E1 GATE (SCHEMA-SAFE ABSOLUTE)
-- ============================================================================
-- Amendment: Amendment 12 v3 (APPROVED via Approval 3)
-- Purpose: Pre-migration database state verification with schema-safe introspection
-- Phase: PREFLIGHT (read-only, NO mutations)
-- Correction: V3 Correction 3 (schema-safe absolute, no assumptions)
--
-- Design: docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_COMPLETE.md Part E
-- Security Review: Metadata trust boundary (S.3)
-- Data Integrity Review: State verification (D.1-D.8)
--
-- GOVERNANCE STATUS:
-- - Approval 3: ✅ GRANTED (2026-08-19)
-- - Must execute BEFORE 05-A
-- - Read-only verification (0 mutations)
--
-- USAGE: SELECT * FROM migration_05_e1_gate();
-- ============================================================================

CREATE OR REPLACE FUNCTION migration_05_e1_gate()
RETURNS TABLE(
  check_name TEXT,
  status TEXT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, migration_evidence
AS $$
DECLARE
  v_runtime_tenant_id_type TEXT;
  v_runtime_registry_count INT;
  v_has_metadata BOOLEAN;
  v_metadata_type TEXT;
  v_get_auth_return_type TEXT;
  v_users_tenant_id_type TEXT;
  v_users_tenant_id_fk BOOLEAN;
  v_child_table TEXT;
  v_child_type TEXT;
BEGIN
  RAISE NOTICE 'E1 GATE: Starting pre-migration database state verification';
  RAISE NOTICE 'E1 MODE: READ-ONLY (0 mutations)';
  
  -- ==========================================================================
  -- E1.1: runtime_tenant_registry.tenant_id = TEXT (legacy state)
  -- ==========================================================================
  SELECT data_type INTO v_runtime_tenant_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'runtime_tenant_registry'
    AND column_name = 'tenant_id';
  
  RETURN QUERY SELECT 
    'E1.1: runtime_tenant_registry.tenant_id type'::TEXT,
    CASE 
      WHEN v_runtime_tenant_id_type = 'text' THEN 'PASS'
      WHEN v_runtime_tenant_id_type = 'uuid' THEN 'WARNING'
      ELSE 'FAIL' 
    END,
    format('Found: %s, Expected: text (pre-migration) or uuid (post-migration)', 
           COALESCE(v_runtime_tenant_id_type, 'NULL'));
  
  -- ==========================================================================
  -- E1.2: Runtime registry row count
  -- ==========================================================================
  SELECT COUNT(*) INTO v_runtime_registry_count
  FROM runtime_tenant_registry;
  
  RETURN QUERY SELECT 
    'E1.2: runtime_tenant_registry row count'::TEXT,
    CASE 
      WHEN v_runtime_registry_count = 5 THEN 'PASS' 
      WHEN v_runtime_registry_count = 3 THEN 'PASS' 
      WHEN v_runtime_registry_count = 0 THEN 'PASS' 
      ELSE 'DEVIATION' 
    END,
    format('Found: %s rows (expected: 5 pre-05-B, 3 post-05-B, 0 if empty)', v_runtime_registry_count);
  
  -- ==========================================================================
  -- E1.3: Canonical Runtime tenants check (schema-safe)
  -- 🔴 V3 CORRECTION 3: Schema-safe metadata introspection
  -- ==========================================================================
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'tenants' 
      AND column_name = 'metadata' 
      AND data_type = 'jsonb'
  ) INTO v_has_metadata;
  
  IF v_has_metadata THEN
    -- Full check with metadata
    DECLARE
      v_canonical_count INT;
    BEGIN
      SELECT COUNT(*) INTO v_canonical_count
      FROM public.tenants
      WHERE (metadata->>'test_infrastructure')::BOOLEAN = true
        AND metadata->>'provisioned_by' = 'migration_05b';
      
      RETURN QUERY SELECT 
        'E1.3: Canonical Runtime tenants (metadata-based)'::TEXT,
        CASE 
          WHEN v_canonical_count = 0 THEN 'PASS'
          WHEN v_canonical_count = 3 THEN 'WARNING'
          ELSE 'FAIL' 
        END,
        format('Found: %s canonical Runtime tenants (expected: 0 pre-05-B, 3 post-05-B)', v_canonical_count);
    END;
  ELSE
    -- Degraded check (metadata column missing or wrong type)
    RETURN QUERY SELECT 
      'E1.3: Canonical Runtime tenants (metadata unavailable)'::TEXT,
      'WARNING'::TEXT,
      'Cannot verify canonical tenant classification (metadata column missing or not jsonb). Assuming 05-B not executed yet.'::TEXT;
  END IF;
  
  -- ==========================================================================
  -- E1.4: canonical_tenant_map existence
  -- ==========================================================================
  DECLARE
    v_map_exists BOOLEAN;
    v_map_count INT;
  BEGIN
    SELECT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'migration_evidence'
        AND table_name = 'canonical_tenant_map'
    ) INTO v_map_exists;
    
    IF v_map_exists THEN
      SELECT COUNT(*) INTO v_map_count
      FROM migration_evidence.canonical_tenant_map;
      
      RETURN QUERY SELECT 
        'E1.4: canonical_tenant_map existence'::TEXT,
        CASE 
          WHEN v_map_count = 5 THEN 'WARNING'
          ELSE 'UNEXPECTED'
        END,
        format('Table exists: true, rows: %s (expected: not exist before 05-A, 5 rows after 05-A)', v_map_count);
    ELSE
      RETURN QUERY SELECT 
        'E1.4: canonical_tenant_map existence'::TEXT,
        'PASS'::TEXT,
        'Table exists: false (expected: 05-A will create this table)'::TEXT;
    END IF;
  END;
  
  -- ==========================================================================
  -- E1.5: get_auth_tenant_id() return type
  -- ==========================================================================
  SELECT pg_get_function_result(p.oid) INTO v_get_auth_return_type
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = 'get_auth_tenant_id';
  
  RETURN QUERY SELECT 
    'E1.5: get_auth_tenant_id() return type'::TEXT,
    CASE 
      WHEN v_get_auth_return_type = 'uuid' THEN 'PASS' 
      WHEN v_get_auth_return_type = 'text' THEN 'FAIL'
      ELSE 'FAIL' 
    END,
    format('Found: %s, Expected: uuid (Core canonical identity)', COALESCE(v_get_auth_return_type, 'FUNCTION NOT FOUND'));
  
  -- ==========================================================================
  -- E1.6: public.users.tenant_id (UUID + FK)
  -- ==========================================================================
  SELECT data_type INTO v_users_tenant_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tenant_id';
  
  SELECT EXISTS(
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'users'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'tenant_id'
  ) INTO v_users_tenant_id_fk;
  
  RETURN QUERY SELECT 
    'E1.6: public.users.tenant_id (UUID + FK)'::TEXT,
    CASE 
      WHEN v_users_tenant_id_type = 'uuid' AND v_users_tenant_id_fk THEN 'PASS' 
      ELSE 'FAIL' 
    END,
    format('Type: %s, FK to tenants: %s (expected: uuid + FK exists)', v_users_tenant_id_type, v_users_tenant_id_fk);
  
  -- ==========================================================================
  -- E1.7: Runtime child tables tenant_id types (pre-05-C: TEXT)
  -- ==========================================================================
  FOR v_child_table IN 
    SELECT unnest(ARRAY[
      'runtime_outbox', 
      'runtime_idempotency_registry', 
      'runtime_audit_log', 
      'runtime_quarantine'
    ])
  LOOP
    -- Check if table exists first
    IF NOT EXISTS(
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_child_table
    ) THEN
      RETURN QUERY SELECT 
        format('E1.7: %s.tenant_id type', v_child_table)::TEXT,
        'WARNING'::TEXT,
        format('Table %s does not exist', v_child_table);
      CONTINUE;
    END IF;
    
    SELECT data_type INTO v_child_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_child_table
      AND column_name = 'tenant_id';
    
    RETURN QUERY SELECT 
      format('E1.7: %s.tenant_id type', v_child_table)::TEXT,
      CASE 
        WHEN v_child_type = 'text' THEN 'PASS'
        WHEN v_child_type = 'uuid' THEN 'WARNING'
        WHEN v_child_type IS NULL THEN 'WARNING'
        ELSE 'FAIL' 
      END,
      format('Found: %s (expected: text pre-05-C, uuid post-05-C)', COALESCE(v_child_type, 'COLUMN MISSING'));
  END LOOP;
  
  -- ==========================================================================
  -- E1.8: Schema metadata availability summary
  -- ==========================================================================
  SELECT data_type INTO v_metadata_type
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'tenants' 
    AND column_name = 'metadata';
  
  RETURN QUERY SELECT 
    'E1.8: public.tenants.metadata availability'::TEXT,
    CASE 
      WHEN v_metadata_type = 'jsonb' THEN 'PASS'
      WHEN v_metadata_type IS NOT NULL THEN 'FAIL'
      ELSE 'WARNING'
    END,
    format('Type: %s (P4 collision gate requires jsonb for full forensics)', COALESCE(v_metadata_type, 'COLUMN MISSING'));
  
  RAISE NOTICE '
╔══════════════════════════════════════════════════════════╗
║ E1 GATE: DATABASE STATE VERIFICATION COMPLETE            ║
╠══════════════════════════════════════════════════════════╣
║ Mode:     READ-ONLY                                      ║
║ Mutations: 0                                             ║
║                                                          ║
║ Review all checks above.                                 ║
║                                                          ║
║ PASS = Expected state                                    ║
║ WARNING = Acceptable deviation or degraded mode          ║
║ FAIL = Blocking issue, requires resolution               ║
║                                                          ║
║ NEXT: If all PASS/acceptable WARNING → Proceed to 05-A   ║
║       If any FAIL → Resolve issue before migration       ║
╚══════════════════════════════════════════════════════════╝';
END;
$$;

COMMENT ON FUNCTION migration_05_e1_gate() IS
  'E1 Gate: Schema-safe database state verification (Amendment 12 v3).
   
   V3 Correction 3: Introspects schema BEFORE querying optional columns.
   
   Returns TABLE for structured verification results.
   
   PASS: Expected state
   WARNING: Acceptable deviation or cannot verify (schema missing)
   FAIL: Blocking issue
   
   Read-only verification (0 mutations).
   
   Execute BEFORE 05-A.';

-- ============================================================================
-- VERIFICATION: Test E1 gate availability
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'E1 Gate (schema-safe) function created successfully';
  RAISE NOTICE 'Usage: SELECT * FROM migration_05_e1_gate();';
  RAISE NOTICE 'Or run via Node.js: npm run migration:e1';
END $$;
