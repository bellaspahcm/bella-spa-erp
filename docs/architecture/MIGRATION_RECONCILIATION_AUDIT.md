# Migration Reconciliation Audit Report

**Date:** 2026-08-24T10:17:38.457Z
**Mode:** READ-ONLY Investigation
**Migrations Audited:** 16

---

## Classification Summary

- **Class A** (DDL not run): 0
- **Class B** (DDL exists, history missing): 5
- **Class C** (DDL partial): 0
- **Class D** (Obsolete): 0
- **Unknown** (Manual check needed): 11

---

## Detailed Audit Results

| Migration | Local | Remote History | DDL Applied | Class | Action |
|-----------|-------|----------------|-------------|-------|--------|
| 20260819040000_runtime_migration_e1_gate_schema_safe.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260819050000_runtime_migration_05a_classification_reservation.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260819050002_runtime_migration_05b_canonical_tenant_creation.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260819050004_runtime_migration_e3_post_05c_verification.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260820110000_database_role_separation_v2.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260820140000_enable_rls_block_service_key.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260820_r4_3_gate_tokens.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260820_r4_4_monitoring_audit.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260820_r4_approval_contract.sql | ✅ | ❌ | UNKNOWN | UNKNOWN | Manual investigation required |
| 20260821115404_logistics_schema.sql | ✅ | ❌ | YES | B | Record history only (DDL exists, history missing) |
| 20260821_create_accessorial_rates_table.sql | ✅ | ❌ | YES | B | Record history only (DDL exists, history missing) |
| 20260821_create_carrier_rates_table.sql | ✅ | ❌ | YES | B | Record history only (DDL exists, history missing) |
| 20260821_create_discrepancies_table.sql | ✅ | ❌ | YES | B | Record history only (DDL exists, history missing) |
| 20260821_create_freight_audit_tables.sql | ✅ | ❌ | YES | B | Record history only (DDL exists, history missing) |

---

## Next Steps

### Class B Migrations (Record History Only)

- `20260821115404_logistics_schema.sql`
  - Action: INSERT into schema_migrations only
  - DDL already applied

- `20260821_create_accessorial_rates_table.sql`
  - Action: INSERT into schema_migrations only
  - DDL already applied

- `20260821_create_carrier_rates_table.sql`
  - Action: INSERT into schema_migrations only
  - DDL already applied

- `20260821_create_discrepancies_table.sql`
  - Action: INSERT into schema_migrations only
  - DDL already applied

- `20260821_create_freight_audit_tables.sql`
  - Action: INSERT into schema_migrations only
  - DDL already applied

### Unknown Classification (Manual Check)

- `20260819040000_runtime_migration_e1_gate_schema_safe.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260819050000_runtime_migration_05a_classification_reservation.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260819050002_runtime_migration_05b_canonical_tenant_creation.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260819050004_runtime_migration_e3_post_05c_verification.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260820110000_database_role_separation_v2.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260820140000_enable_rls_block_service_key.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260820_r4_3_gate_tokens.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260820_r4_4_monitoring_audit.sql`
  - Notes: Requires manual schema inspection (no specific check implemented)
  - Action: Requires specific schema verification

- `20260820_r4_approval_contract.sql`
  - Notes: Cannot verify remotely (requires specific table/function check)
  - Action: Requires specific schema verification

---

## Reconciliation Strategy

1. Review audit results
2. For Class A: Apply migrations in order
3. For Class B: Record history only
4. For Class C/Unknown: Manual investigation
5. Verify: `npx supabase db push` should succeed
6. Deploy: `20260824000000_finance_test_cleanup_rpc.sql`

---

**Status:** Audit complete, awaiting reconciliation decision
