# Unknown Migrations Verification Report

**Date:** 2026-08-24T10:19:43.494Z
**Method:** pg_catalog artifact verification
**Migrations Verified:** 11

---

## Summary

- **Class A** (DDL not applied): 0
- **Class B** (DDL applied): 11
- **Partial** (Mixed state): 0

---

## Detailed Results

### 20260819040000_runtime_migration_e1_gate_schema_safe.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 1  
**Artifacts Found:** 1  
**Artifacts Missing:** 0

**Found:**
- ✅ function:migration_05_e1_gate

---

### 20260819050000_runtime_migration_05a_classification_reservation.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 2  
**Artifacts Found:** 2  
**Artifacts Missing:** 0

**Found:**
- ✅ function:migration_05a_preflight_p4_collision_gate
- ✅ table:migration_evidence

---

### 20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 1  
**Artifacts Found:** 1  
**Artifacts Missing:** 0

**Found:**
- ✅ function:migration_05_e2_orphan_safety_gate

---

### 20260819050002_runtime_migration_05b_canonical_tenant_creation.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 5  
**Artifacts Found:** 5  
**Artifacts Missing:** 0

**Found:**
- ✅ function:migration_05b_preflight_p2_reservation_complete
- ✅ function:migration_05b_preflight_p3_schema_compatibility
- ✅ function:migration_05b_preflight_collision_recheck
- ✅ function:migration_05b_create_canonical_tenants
- ✅ function:migration_evidence

---

### 20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 6  
**Artifacts Found:** 6  
**Artifacts Missing:** 0

**Found:**
- ✅ function:migration_05c_preflight_verify_05b_complete
- ✅ function:migration_05c_preflight_verify_mapping_completeness
- ✅ function:migration_05c_update_text_to_uuid
- ✅ function:migration_05c_alter_column_types
- ✅ function:migration_05c_add_fk_constraints
- ✅ function:migration_05c_verify_rls_preservation

---

### 20260819050004_runtime_migration_e3_post_05c_verification.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 1  
**Artifacts Found:** 1  
**Artifacts Missing:** 0

**Found:**
- ✅ function:migration_05_e3_gate

---

### 20260820110000_database_role_separation_v2.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 1  
**Artifacts Found:** 1  
**Artifacts Missing:** 0

**Found:**
- ✅ table:migration_governance

---

### 20260820140000_enable_rls_block_service_key.sql

**Classification:** B  
**Confidence:** LOW  
**Notes:** No verifiable artifacts (policies/roles/schemas only)

**Artifacts Checked:** 0  
**Artifacts Found:** 0  
**Artifacts Missing:** 0

---

### 20260820151000_r4_3_gate_tokens.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 4  
**Artifacts Found:** 4  
**Artifacts Missing:** 0

**Found:**
- ✅ function:prevent_audit_modification
- ✅ table:bella_gate_tokens
- ✅ table:bella_execution_audit
- ✅ column:bella_migration_approval.execution_started_at

---

### 20260820152000_r4_4_monitoring_audit.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 3  
**Artifacts Found:** 3  
**Artifacts Missing:** 0

**Found:**
- ✅ function:update_incidents_updated_at
- ✅ table:bella_security_incidents
- ✅ table:bella_recovery_actions

---

### 20260820150000_r4_approval_contract.sql

**Classification:** B  
**Confidence:** HIGH  
**Notes:** All artifacts exist

**Artifacts Checked:** 1  
**Artifacts Found:** 1  
**Artifacts Missing:** 0

**Found:**
- ✅ table:bella_migration_approval

---

## Recommended Actions

### Class B Migrations (Record History Only)

1. `20260819040000_runtime_migration_e1_gate_schema_safe.sql`
   - INSERT into schema_migrations only
   - DDL already applied (1 artifacts verified)

1. `20260819050000_runtime_migration_05a_classification_reservation.sql`
   - INSERT into schema_migrations only
   - DDL already applied (2 artifacts verified)

1. `20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql`
   - INSERT into schema_migrations only
   - DDL already applied (1 artifacts verified)

1. `20260819050002_runtime_migration_05b_canonical_tenant_creation.sql`
   - INSERT into schema_migrations only
   - DDL already applied (5 artifacts verified)

1. `20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql`
   - INSERT into schema_migrations only
   - DDL already applied (6 artifacts verified)

1. `20260819050004_runtime_migration_e3_post_05c_verification.sql`
   - INSERT into schema_migrations only
   - DDL already applied (1 artifacts verified)

1. `20260820110000_database_role_separation_v2.sql`
   - INSERT into schema_migrations only
   - DDL already applied (1 artifacts verified)

1. `20260820140000_enable_rls_block_service_key.sql`
   - INSERT into schema_migrations only
   - DDL already applied (0 artifacts verified)

1. `20260820151000_r4_3_gate_tokens.sql`
   - INSERT into schema_migrations only
   - DDL already applied (4 artifacts verified)

1. `20260820152000_r4_4_monitoring_audit.sql`
   - INSERT into schema_migrations only
   - DDL already applied (3 artifacts verified)

1. `20260820150000_r4_approval_contract.sql`
   - INSERT into schema_migrations only
   - DDL already applied (1 artifacts verified)

---

**Status:** Verification complete  
**Next:** Reconcile based on classification results
