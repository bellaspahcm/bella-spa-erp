# P0.3 Phase 4B.3 — Database Verification Discovery

**Phase:** Phase 4B.3 — Database Verification  
**Status:** 🟡 DISCOVERY IN PROGRESS  
**Date:** 2026-08-25  
**Authority:** Phase 4B Control Plane

---

## Core Question

> **"Sau khi BDGF đã cho phép migration chạy, Bella cần bằng chứng gì để có thể nói một cách có kiểm chứng rằng database hiện đang ở đúng state mong muốn?"**

---

## Discovery Scope

### What 4B.3 Is

**4B.3 Database Verification** is a **post-migration validation layer** that:
- Verifies database state after BDGF-authorized migration execution
- Validates schema invariants (tables, columns, indexes, constraints)
- Checks data integrity constraints
- Verifies RLS policies (if migration affects security)
- Generates verification evidence
- **Controls downstream deployment eligibility**

### What 4B.3 Is NOT

**4B.3 Does NOT:**
- ❌ Execute migrations (BDGF responsibility via R4.3.3)
- ❌ Authorize migrations (BDGF R4 approval contract)
- ❌ Orchestrate provenance (4B.2 responsibility)
- ❌ Approve migrations (4B.4 human workflow)
- ❌ Rollback migrations (DBA manual responsibility)
- ❌ Fix database state (read-only verification)
- ❌ Modify BDGF frozen components

### Separation of Concerns

```
┌────────────────────────────────────────────────────────────┐
│ BDGF (R4)                                                  │
│ "Is migration authorized?"                                 │
│ - Approval verification (8 invariants I0-I7)              │
│ - Gate token issuance                                      │
│ - Migration hash verification                              │
│ - Authorized execution path                                │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ 4B.2 BDGF Integration                                      │
│ "How is migration orchestrated?"                           │
│ - Canonical commit provenance (P0.1/P0.2)                 │
│ - Migration discovery (git diff)                           │
│ - BDGF wrapper invocation                                  │
│ - Evidence artifact generation                             │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ 4B.3 Database Verification (NEW)                           │
│ "Is database in correct state?"                            │
│ - Schema validation (tables, columns, indexes)             │
│ - Constraint verification (PK, FK, CHECK, UNIQUE)         │
│ - RLS policy verification                                  │
│ - Data integrity checks                                    │
│ - Verification evidence generation                         │
│ - Deployment eligibility decision                          │
└────────────────────────────────────────────────────────────┘
```

**NO OVERLAP. CLEAN BOUNDARIES.**

---

## Existing Verification Capabilities

### 1. Migration Governance Schema (20260820100000)

**Table:** `migration_governance.approvals`

**Relevant Fields:**
- `verification_gates_status` (JSONB) — Gate results (E0, E1, etc.)
- `execution_evidence_path` — Evidence artifact location
- `consumed_at` — Execution timestamp

**Observation:** Approval tracking exists, but no post-execution database state verification.

### 2. Post-Migration Verification Pattern (E3 Gate)

**File:** `supabase/migrations/20260819050004_runtime_migration_e3_post_05c_verification.sql`

**Pattern:**
```sql
CREATE OR REPLACE FUNCTION migration_05_e3_gate()
RETURNS TABLE(
  check_name TEXT,
  status TEXT,
  details TEXT
)
```

**Checks:**
- Column type verification (`TEXT` → `UUID`)
- Foreign key existence
- RLS policy existence
- Orphan record detection
- Data integrity constraints

**Result:**
- ✅ PASS → Migration verified
- ❌ FAIL → EXCEPTION raised

**Observation:** Precedent exists for post-migration verification functions. This pattern can be generalized.

### 3. Supabase Schema Introspection

**PostgreSQL Information Schema:**
```sql
information_schema.tables
information_schema.columns
information_schema.table_constraints
information_schema.constraint_column_usage
information_schema.key_column_usage
information_schema.referential_constraints
```

**Supabase-Specific:**
```sql
pg_catalog.pg_class
pg_catalog.pg_constraint
pg_catalog.pg_policy (RLS policies)
pg_catalog.pg_index
```

**Observation:** Full introspection capability available. No additional tooling needed.

### 4. Existing Verification Scripts

**Found:**
- `scripts/run-e1-verification.mjs` — Phase 4 verification
- `supabase/tests/booking_engine_schema_verification.sql` — Schema tests
- `scripts/bdgf/r4-4-3-audit-verification.mjs` — BDGF audit verification

**Observation:** Verification scripts exist but are not integrated into deployment pipeline.

---

## Gap Analysis

### Gap 1: No Automated Post-Migration Verification

**Current State:**
- BDGF executes migration
- 4B.2 generates execution evidence
- **NO automated database state verification**

**Gap:**
- Cannot verify migration applied correctly
- Cannot verify schema invariants hold
- Cannot detect unexpected side effects
- Cannot provide deployment eligibility evidence

**Risk:** HIGH (deployment may proceed with broken database state)

### Gap 2: No Database-Agnostic Verification Layer

**Current State:**
- Supabase-specific introspection queries
- Hard-coded table/column checks

**Gap:**
- Cannot migrate to self-hosted PostgreSQL (future VN deployment)
- Verification logic tightly coupled to Supabase

**Risk:** MEDIUM (future migration friction)

### Gap 3: No Verification Evidence Standard

**Current State:**
- 4B.2 generates execution evidence (approval_id, commit_sha, migration_file)
- **NO database verification evidence**

**Gap:**
- Cannot audit verification results
- Cannot prove database correctness
- Cannot compare pre/post state

**Risk:** HIGH (audit gap)

### Gap 4: No Deployment Blocking on Verification Failure

**Current State:**
- `promote` job depends on `migrate-database` result
- **NO dependency on database verification**

**Gap:**
- Deployment may proceed even if verification fails
- No fail-closed behavior for database state

**Risk:** CRITICAL (P0 control flow violation)

### Gap 5: No Schema Expectation Declaration

**Current State:**
- Migration SQL files exist
- **NO machine-readable schema expectations**

**Gap:**
- Cannot verify "migration creates table X with columns Y, Z"
- Cannot detect schema drift
- Cannot validate RLS policy changes

**Risk:** MEDIUM (manual verification required)

---

## Verification Target Requirements

### 1. Schema Structure Verification

**What to Verify:**
- ✅ Expected tables exist
- ✅ Expected columns exist with correct types
- ✅ Expected indexes exist
- ✅ Expected constraints exist (PK, FK, UNIQUE, CHECK)
- ✅ No unexpected tables/columns (drift detection)

**Method:**
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '<expected_table>';
```

### 2. Constraint Verification

**What to Verify:**
- ✅ Primary keys defined
- ✅ Foreign keys defined with correct references
- ✅ UNIQUE constraints defined
- ✅ CHECK constraints defined
- ✅ NOT NULL constraints defined

**Method:**
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = '<expected_table>';
```

### 3. RLS Policy Verification (Security-Critical)

**What to Verify:**
- ✅ RLS enabled on security-sensitive tables
- ✅ Expected policies exist
- ✅ Policy definitions correct (SELECT, INSERT, UPDATE, DELETE)
- ✅ No unexpected policy bypass

**Method:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = '<expected_table>';
```

**Critical:** RLS verification MUST be fail-closed. Any RLS mismatch → BLOCK deployment.

### 4. Function/Trigger Verification

**What to Verify:**
- ✅ Expected functions exist
- ✅ Expected triggers exist
- ✅ Trigger timing correct (BEFORE/AFTER)
- ✅ Trigger events correct (INSERT/UPDATE/DELETE)

**Method:**
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public';

SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = '<expected_table>';
```

### 5. Data Integrity Verification (Optional)

**What to Verify:**
- ✅ No orphan records (FK integrity)
- ✅ No duplicate records (UNIQUE integrity)
- ✅ No NULL violations (NOT NULL integrity)

**Method:**
```sql
-- Orphan detection
SELECT COUNT(*) FROM child_table c
LEFT JOIN parent_table p ON c.parent_id = p.id
WHERE p.id IS NULL;
```

**Decision Needed:** Should 4B.3 verify data integrity or only schema integrity?

---

## Database-Agnostic Architecture

### Proposed Layering

```
┌─────────────────────────────────────────────────────────────┐
│ 4B.3 Verification Contract (Abstract)                       │
│ - Input: migration_id, environment, expected_state          │
│ - Output: verification_result, evidence_artifact            │
│ - Semantics: verify(expected) → PASS/FAIL                   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ Verification Engine (Implementation-Agnostic Logic)         │
│ - Schema expectation parser                                 │
│ - Verification orchestrator                                 │
│ - Evidence generator                                        │
│ - Result aggregator                                         │
└─────────────────────────────────────────────────────────────┘
                         ↓
            ┌────────────┴────────────┐
            ▼                         ▼
┌─────────────────────┐   ┌─────────────────────────┐
│ PostgreSQL Adapter  │   │ Future Adapter          │
│ (Supabase Current)  │   │ (Self-Hosted VN)        │
│                     │   │                         │
│ - PG introspection  │   │ - Same introspection    │
│ - Supabase RLS      │   │ - Standard PG RLS       │
│ - Connection pool   │   │ - Direct connection     │
└─────────────────────┘   └─────────────────────────┘
```

**Key Principle:** Verification semantics independent of infrastructure.

**Migration Path:**
```
2026: Supabase (managed PostgreSQL)
       ↓
2027: Self-hosted PostgreSQL (VN data center)
       ↓
Verification logic: UNCHANGED (only adapter swapped)
```

---

## Verification Evidence Requirements

### Minimum Evidence Fields

```json
{
  "verification_id": "<UUID>",
  "migration_id": "<migration_id from 4B.2>",
  "commit_sha": "<commit_sha from 4B.2>",
  "migration_file": "<migration_file>",
  "environment": "production",
  "database_identity": "<database_connection_string_hash>",
  "verification_timestamp": "<ISO 8601>",
  "verification_engine_version": "1.0.0",
  
  "checks_executed": [
    {
      "check_type": "schema_structure",
      "check_name": "table_patients_exists",
      "expected": "table 'hc_patients' with 10 columns",
      "actual": "table 'hc_patients' with 10 columns",
      "result": "PASS"
    },
    {
      "check_type": "constraint",
      "check_name": "patients_pk",
      "expected": "PRIMARY KEY on patient_id",
      "actual": "PRIMARY KEY on patient_id",
      "result": "PASS"
    },
    {
      "check_type": "rls_policy",
      "check_name": "patients_tenant_isolation",
      "expected": "RLS enabled, policy 'tenant_isolation_policy'",
      "actual": "RLS enabled, policy 'tenant_isolation_policy'",
      "result": "PASS"
    }
  ],
  
  "checks_passed": 15,
  "checks_failed": 0,
  "checks_warning": 2,
  "overall_result": "PASS",
  
  "failure_details": [],
  "warning_details": [
    "Index 'idx_patients_email' missing (recommended but not required)"
  ]
}
```

### Evidence vs. Authoritative Record

**Evidence Artifact:** Verification results (JSON file, GitHub Actions artifact, 90-day retention)

**Authoritative Record:** Database audit table (permanent)

```sql
CREATE TABLE migration_governance.verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID REFERENCES migration_governance.approvals(id),
  migration_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  environment TEXT NOT NULL,
  verification_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overall_result TEXT NOT NULL CHECK (overall_result IN ('PASS', 'FAIL', 'ERROR')),
  checks_passed INT NOT NULL,
  checks_failed INT NOT NULL,
  checks_warning INT NOT NULL,
  evidence_artifact_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Decision:** Both evidence artifact (portable) AND database record (authoritative).

---

## Failure Semantics

### Verification Result States

| Result | Meaning | Downstream Action |
|--------|---------|-------------------|
| **PASS** | All checks passed | Deployment ELIGIBLE |
| **FAIL** | One or more critical checks failed | Deployment BLOCKED |
| **WARNING** | Non-critical checks failed | Deployment ELIGIBLE (with warnings) |
| **ERROR** | Verification itself failed (e.g., DB unreachable) | Deployment BLOCKED (fail-closed) |

### Fail-Closed Principles

1. **Unknown state = FAIL**
   - Cannot connect to database → FAIL
   - Cannot query schema → FAIL
   - Unexpected error → FAIL

2. **Security checks = FAIL-CLOSED**
   - RLS policy missing → FAIL
   - RLS disabled on sensitive table → FAIL
   - Unexpected policy → FAIL

3. **Schema invariants = FAIL-CLOSED**
   - Expected table missing → FAIL
   - Expected column missing → FAIL
   - Unexpected column (drift) → WARNING or FAIL?

4. **Optional checks = WARNING**
   - Recommended index missing → WARNING
   - Performance optimization missing → WARNING

**Decision Needed:** Should unexpected columns (drift) be FAIL or WARNING?

### Control Flow

```
Migration Execution (4B.2)
         │
         ▼
    ✅ SUCCESS
         │
         ▼
Database Verification (4B.3)
         │
    ┌────┴────┐
    ▼         ▼
  PASS      FAIL
    │         │
    ▼         ▼
Deployment  Deployment
ELIGIBLE    BLOCKED
```

**Critical:** Verification FAIL → `promote` job BLOCKED via job dependency.

---

## Verification Scope Decision

### Option 1: Minimal Verification (Recommended for Phase 1)

**Verify:**
- ✅ Migration applied (check migration history table)
- ✅ Expected tables exist
- ✅ Expected columns exist with correct types
- ✅ Primary keys exist
- ✅ Foreign keys exist

**Do NOT verify:**
- ❌ Indexes (performance optimization, not correctness)
- ❌ Functions/triggers (complex, requires semantic analysis)
- ❌ Data integrity (can be added in Phase 2)
- ❌ RLS policies (unless migration explicitly modifies RLS)

**Rationale:** Start with minimum authoritative verification set. Expand incrementally.

### Option 2: Comprehensive Verification

**Verify:**
- ✅ All Option 1 checks
- ✅ Indexes
- ✅ UNIQUE/CHECK constraints
- ✅ Functions/triggers
- ✅ RLS policies (always)
- ✅ Data integrity (orphans, duplicates)

**Rationale:** Maximum confidence, but higher implementation complexity and execution time.

### Option 3: Declaration-Driven Verification

**Approach:**
- Migration author declares expected state in `<migration_file>.expect.json`
- Verification engine compares actual state to expectation
- Only verify what is declared

**Example:**
```json
{
  "migration_id": "20260825120000_add_patients_table",
  "expected_schema": {
    "tables": [
      {
        "name": "hc_patients",
        "columns": [
          {"name": "patient_id", "type": "uuid", "nullable": false},
          {"name": "tenant_id", "type": "uuid", "nullable": false}
        ],
        "primary_key": ["patient_id"],
        "foreign_keys": [
          {"column": "tenant_id", "references": "runtime_tenant_registry(tenant_id)"}
        ]
      }
    ]
  }
}
```

**Rationale:** Explicit expectations, no implicit assumptions. But adds authoring burden.

**Decision Needed:** Which verification scope for Phase 1?

---

## Integration Points

### 1. Workflow Integration (4B.2 → 4B.3)

**Current:**
```yaml
migrate-database:
  - Step 6: Execute BDGF
  - Step 7: Record evidence artifact
```

**Proposed:**
```yaml
migrate-database:
  - Step 6: Execute BDGF
  - Step 7: Record execution evidence
  - Step 8: Verify database state (NEW)
  - Step 9: Record verification evidence (NEW)
```

**Job Dependency:**
```yaml
promote:
  needs: [detect-changes, preview, smoke, migrate-database]
  if: |
    always() &&
    needs.detect-changes.outputs.docs_only != 'true' &&
    (needs.detect-changes.outputs.needs_migration != 'true' ||
     needs.migrate-database.result == 'success')
```

**No change needed** — `migrate-database` encompasses both execution AND verification.

### 2. BDGF Integration

**4B.3 Does NOT modify BDGF.**

**Sequence:**
```
4B.2 → BDGF (execute) → 4B.3 (verify)
```

**Evidence Chain:**
```
4B.2 execution evidence:
  {
    "approval_id": "...",
    "migration_file": "...",
    "commit_sha": "...",
    "result": "SUCCESS"
  }

4B.3 verification evidence:
  {
    "migration_id": "...",
    "commit_sha": "...",
    "checks_passed": 15,
    "checks_failed": 0,
    "overall_result": "PASS"
  }
```

**Both evidence artifacts uploaded to GitHub Actions.**

---

## Open Questions for Decisions Phase

### Q1: Verification Scope
**Question:** Minimal (tables/columns/PKs only) or Comprehensive (all constraints/RLS/data)?  
**Recommendation:** Minimal for Phase 1, expand incrementally.

### Q2: Drift Detection
**Question:** Should unexpected columns/tables cause FAIL or WARNING?  
**Recommendation:** WARNING (unexpected additions), FAIL (unexpected deletions).

### Q3: RLS Verification Always or Conditional?
**Question:** Always verify RLS policies, or only when migration modifies RLS?  
**Recommendation:** Always verify for security-critical tables (tenant_isolation).

### Q4: Declaration-Driven or Introspection-Only?
**Question:** Require `.expect.json` files, or infer expectations from migration SQL?  
**Recommendation:** Introspection-only for Phase 1 (lower friction), add declarations later if needed.

### Q5: Verification Timing
**Question:** Immediate (part of migrate-database job) or Delayed (separate job)?  
**Recommendation:** Immediate (same job, fail-fast).

### Q6: Verification Engine Location
**Question:** Node.js script, SQL function, or separate service?  
**Recommendation:** Node.js script (consistent with 4B.2, easy to maintain).

### Q7: Evidence Storage
**Question:** GitHub Actions artifact only, or also database table?  
**Recommendation:** Both (artifact = portable, DB = authoritative).

---

## Next Steps

1. **Freeze Decisions** (based on open questions)
2. **Draft 4B.3 Contract** (inputs, outputs, steps, success criteria)
3. **Contract Review & Freeze**
4. **Build Test Harness** (7 scenarios like 4B.2)
5. **Implementation** (verification engine + workflow integration)
6. **Evidence Generation**
7. **Completion Certificate**

---

## Precedents & References

### Existing Bella Patterns
- **E3 Gate** (`20260819050004_runtime_migration_e3_post_05c_verification.sql`) — Post-migration verification function pattern
- **Migration Governance** (`20260820100000_migration_governance_approvals.sql`) — Approval tracking schema
- **4B.2 BDGF Integration** (`P0_3_PHASE4B_2_CONTRACT.md`) — Provenance and evidence pattern

### Industry Standards
- **Flyway Callbacks** — Post-migration validation scripts
- **Liquibase Preconditions** — Pre/post-migration state verification
- **Django Migrations** — `RunSQL` with validation queries
- **Alembic** — Post-upgrade verification scripts

---

## Architectural Constraints

### Non-Negotiable (from 4B.2 Baseline)

1. **NO BDGF modifications** (frozen boundary)
2. **NO Healthcare/Logistics Kernel modifications** (frozen boundary)
3. **Contract → Test → Evidence → Implementation → Certificate** (proven process)
4. **Fail-closed by default** (no "best effort" modes)
5. **Database-agnostic design** (future VN migration readiness)

### Preferred

1. **Minimal scope for Phase 1** (expand incrementally)
2. **Node.js implementation** (consistent with 4B.2)
3. **Immediate verification** (fail-fast)
4. **Both artifact and DB evidence** (portable + authoritative)

---

**STATUS:** 🟡 DISCOVERY COMPLETE — AWAITING DECISIONS

**Next Artifact:** `P0_3_PHASE4B_3_DECISIONS.md`

---

**END OF DISCOVERY**
