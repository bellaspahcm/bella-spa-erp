# P0.3 Phase 4B.3 — Database Verification Decisions

**Phase:** Phase 4B.3 — Database Verification  
**Status:** 🔒 DECISIONS FROZEN  
**Date:** 2026-08-25  
**Authority:** Human Architect  
**Predecessor:** `P0_3_PHASE4B_3_DISCOVERY.md` (commit d9f52c9c)

---

## Decision Authority

These decisions are **FROZEN** and form the basis for Phase 4B.3 Contract.

**Modification requires:**
- Architectural gap discovery
- Human Architect approval
- Architecture Decision Record (ADR)

---

## Core Architectural Principle

> **4B.3 verifies PostgreSQL database state post-migration. Supabase is an infrastructure adapter, NOT an architectural dependency.**

**Implication:** Contract and verification logic MUST be database-platform-agnostic to support future migration to self-hosted PostgreSQL in Vietnam.

---

## Decision Matrix

| ID | Question | Decision | Rationale |
|----|----------|----------|-----------|
| **D1** | Verification Scope | **Minimal + Security-Critical** | Sufficient proof without becoming full DB auditor |
| **D2** | Drift Detection | **Deletion/Change=FAIL; Additive=WARNING** | Platform expansion vs. data safety |
| **D3** | RLS Verification | **Mandatory for Security-Critical Objects** | Tenant isolation is architectural invariant |
| **D4** | Expectation Declaration | **No `.expect.json` in Phase 1** | Reduce authoring burden; design for future extension |
| **D5** | Verification Timing | **Immediate (same job)** | Fail-fast; migration SUCCESS + verification FAIL → BLOCK |
| **D6** | Engine Location | **Node.js + PostgreSQL Adapter** | Cross-platform; VN-ready; consistent with 4B.2 |
| **D7** | Evidence Storage | **Artifact + Governance DB Record** | Portable evidence + authoritative audit trail |

---

## D1: Verification Scope — Minimal + Security-Critical

### Decision

**Verify in Phase 1:**
- ✅ Migration applied (check migration history)
- ✅ Expected tables exist
- ✅ Expected columns exist with correct types
- ✅ Primary keys exist
- ✅ Foreign keys exist (referential integrity)
- ✅ **Security-critical RLS policies** (tenant isolation, data access control)
- ✅ **NOT NULL constraints** (data integrity)

**Do NOT verify in Phase 1:**
- ❌ Indexes (performance optimization, not correctness)
- ❌ Functions/triggers (semantic complexity)
- ❌ UNIQUE/CHECK constraints (unless security-critical)
- ❌ Data integrity (orphan records, duplicates) — deferred to Phase 2

**Expandable:** Architecture supports incremental addition of checks.

### Rationale

1. **Sufficient proof:** Verifies migration applied correctly without excessive complexity
2. **Security-first:** RLS verification ensures tenant isolation (P0 invariant)
3. **Not a full auditor:** 4B.3 is migration verification, not database health monitoring
4. **Incremental expansion:** Can add comprehensive checks in Phase 2/3

### Security-Critical Objects

**Mandatory RLS verification for:**
- `runtime_tenant_registry` (tenant identity)
- `hc_*` tables (Healthcare Kernel — patient data)
- `edu_*` tables (Education Kernel — student data)
- `logistics_*` tables (Logistics Kernel — shipment data)
- All tables with `tenant_id` column

**RLS Policy Requirements:**
- RLS ENABLED
- SELECT/INSERT/UPDATE/DELETE policies exist
- Policies enforce `tenant_id` isolation

**Violation → FAIL**

---

## D2: Drift Detection — Deletion/Change FAIL; Additive WARNING

### Decision

**Schema Change Classification:**

| Change Type | Verification Result | Example |
|-------------|---------------------|---------|
| **Expected object missing** | ❌ FAIL | Migration creates `patients` table, but table not found |
| **Expected object type changed** | ❌ FAIL | `patient_id` expected `UUID`, found `TEXT` |
| **Expected constraint removed** | ❌ FAIL | Primary key removed from `patients` |
| **Unexpected deletion** | ❌ FAIL | Column `email` existed before, now missing |
| **Unexpected modification** | ❌ FAIL | Column `status` changed from `TEXT` to `INT` |
| **Unexpected additive object** | ⚠️ WARNING | New table `temp_analytics` not in expectations |
| **Unexpected additive column** | ⚠️ WARNING | New column `metadata JSONB` in existing table |
| **Security object unexpected change** | ❌ FAIL | RLS policy modified without declaration |

### Rationale

**Bella is Platform of Platforms:**
- Healthcare Kernel, Education Kernel, Logistics Kernel, Finance Kernel
- Product Verticals built on top
- Schema continuously expands

**Strict deletion/modification detection:**
- Protects against unintended schema destruction
- Prevents type changes that break application code
- Ensures referential integrity maintained

**Permissive additive detection:**
- Allows parallel module development
- Migration A adds `patients`, Migration B adds `analytics` → Both valid
- Platform expansion should not block each other

**Exception — Security namespace:**
- Unexpected RLS changes → FAIL (even if additive)
- Unexpected tenant isolation bypass → FAIL

### Implementation

```javascript
if (expectedObject.missing) return 'FAIL';
if (actualObject.typeChanged) return 'FAIL';
if (actualObject.deleted) return 'FAIL';
if (actualObject.modified) return 'FAIL';
if (actualObject.additive && !actualObject.securityCritical) return 'WARNING';
if (actualObject.additive && actualObject.securityCritical) return 'FAIL';
```

---

## D3: RLS Verification — Mandatory for Security-Critical Objects

### Decision

**RLS Verification Strategy:**

```
Migration affects RLS explicitly?
  └─ YES → Verify RLS changes applied

Table is security-critical?
  └─ YES → Mandatory RLS verification (regardless of migration intent)
  └─ NO  → Skip RLS verification

Unknown/Error?
  └─ FAIL-CLOSED
```

**Security-Critical Tables:**
- Any table with `tenant_id` column
- `runtime_tenant_registry`
- Healthcare Kernel tables (`hc_*`)
- Education Kernel tables (`edu_*`)
- Logistics Kernel tables (`logistics_*`)
- Finance Kernel tables (`finance_*`)

**RLS Verification Checks:**
1. ✅ RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
2. ✅ Required policies exist (SELECT, INSERT, UPDATE, DELETE)
3. ✅ Policy definitions enforce tenant isolation
4. ✅ No policy bypass (`USING (true)` on tenant-isolated table → FAIL)

**Failure Semantics:**
- RLS disabled on security-critical table → **FAIL**
- Required policy missing → **FAIL**
- Policy allows cross-tenant access → **FAIL**
- Cannot determine RLS state → **FAIL (fail-closed)**

### Rationale

**Tenant isolation is architectural invariant:**
- Multi-tenant SaaS architecture
- Data leakage = P0 security breach
- Cannot rely on migration author to remember RLS

**Migration may unintentionally disable RLS:**
```sql
-- Migration: 20260825_add_patient_status.sql
ALTER TABLE hc_patients ADD COLUMN status TEXT;

-- Unintended side effect (due to incorrect migration script):
-- RLS disabled during ALTER TABLE
```

**Verification must catch this:**
```
Migration: add_patient_status
Expected: hc_patients has RLS enabled
Actual: hc_patients RLS disabled
Result: FAIL → Deployment BLOCKED
```

**Not all tables need RLS:**
- Reference data (ICD codes, drug database)
- System configuration (feature flags)
- Non-tenant-scoped analytics

**Conditional verification avoids false positives.**

---

## D4: Expectation Declaration — No `.expect.json` in Phase 1

### Decision

**Phase 1 Expectations Source:**
- ✅ **Contract-defined invariants** (tables exist, tenant isolation enforced)
- ✅ **Known security requirements** (RLS on tenant-scoped tables)
- ✅ **PostgreSQL introspection** (actual state discovery)
- ❌ **NO `.expect.json` files** (deferred to Phase 2+)

**Expected State Derivation:**
```
Migration SQL
     │
     ▼
Contract/Invariants
     │
     ▼
Expected State (minimal)
     │
     ├─ Tables created in migration
     ├─ Columns added/modified
     ├─ RLS requirements (if security-critical)
     └─ Constraints (PK, FK)
     │
     ▼
Compare with Actual State
     │
     ▼
PASS / FAIL / WARNING
```

**Future Evolution:**
```
Phase 1: Contract + invariants
         ↓
Phase 2: .expect.json (explicit declarations)
         ↓
Phase 3: Schema Registry (automated expectation generation)
```

### Rationale

**Reduce authoring burden:**
- Migration author should not write two files (`.sql` + `.expect.json`)
- Contract enforcement should be automatic where possible

**Design for future extension:**
- Verification Engine MUST support explicit expectations
- Architecture does not preclude `.expect.json`
- Phase 1 proves verification concept; Phase 2 adds declarations

**Introspection ≠ Expectation:**
- Introspection tells us: "Database is currently X"
- Introspection does NOT tell us: "Database should be Y"
- **Expected state MUST come from contract/declaration, NOT guessed**

**Phase 1 Expected State:**
```javascript
// Derived from contract invariants
const expectedState = {
  securityCriticalTables: ['hc_patients', 'edu_students', ...],
  rlsRequired: true,
  tenantIsolationEnforced: true,
};

// Migration-specific (can be inferred from SQL or declared)
const migrationExpectations = {
  tablesCreated: ['hc_appointments'],
  columnsAdded: { hc_patients: ['status'] },
};
```

**NOT implicit guessing:**
```javascript
// ❌ WRONG: Cannot guess correctness
if (table.exists) {
  return 'PASS'; // What if table SHOULD NOT exist?
}
```

---

## D5: Verification Timing — Immediate (Same Job)

### Decision

**Verification executes IMMEDIATELY after BDGF migration:**

```yaml
migrate-database:
  steps:
    - Step 6: Execute BDGF wrapper
    - Step 7: Record execution evidence
    - Step 8: Verify database state (NEW)
    - Step 9: Record verification evidence (NEW)
```

**Control Flow:**
```
BDGF Migration
      │
      ▼
   SUCCESS
      │
      ▼
Database Verification
      │
  ┌───┴───┐
  ▼       ▼
PASS    FAIL
  │       │
  ▼       ▼
Step 9  ABORT
  │       │
  ▼       ▼
Deploy  BLOCK
Eligible
```

**Job Dependency (unchanged from 4B.2):**
```yaml
promote:
  needs: [detect-changes, preview, smoke, migrate-database]
  if: |
    always() &&
    needs.detect-changes.outputs.docs_only != 'true' &&
    (needs.detect-changes.outputs.needs_migration != 'true' ||
     needs.migrate-database.result == 'success')
```

**migrate-database result = SUCCESS** only if:
1. ✅ BDGF execution SUCCESS
2. ✅ Database verification PASS

### Rationale

**Fail-fast principle:**
- Detect verification failure immediately
- Do not proceed to deployment with incorrect database state
- Minimize blast radius

**Single job = atomic operation:**
- Migration + Verification = single unit of work
- No partial success state ("migration succeeded but verification pending")
- Clear success/failure signal to downstream jobs

**Avoid timing issues:**
- Immediate verification captures state right after migration
- Delayed verification risks state drift (other migrations, manual changes)

**NOT separate job:**
```yaml
# ❌ WRONG: Separate jobs introduce race conditions
migrate-database:
  - Execute migration

verify-database:  # Runs later
  needs: [migrate-database]
  - Verify state  # State may have changed!
```

---

## D6: Engine Location — Node.js + PostgreSQL Adapter

### Decision

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│ 4B.3 Verification Engine (Node.js)                      │
│ - Expectation parser                                    │
│ - Verification orchestrator                             │
│ - Evidence generator                                    │
│ - Result aggregator                                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ PostgreSQL Adapter (Abstract Interface)                 │
│ - connect(url)                                          │
│ - querySchema(table)                                    │
│ - queryConstraints(table)                               │
│ - queryRLS(table)                                       │
│ - disconnect()                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
┌────────────────────┐   ┌───────────────────────┐
│ Supabase Adapter   │   │ Self-Hosted Adapter   │
│ (Phase 1)          │   │ (Future VN Server)    │
│                    │   │                       │
│ - Supabase client  │   │ - pg client           │
│ - Connection pool  │   │ - Direct connection   │
│ - Current          │   │ - Future              │
└────────────────────┘   └───────────────────────┘
```

**Implementation Language:** Node.js (ESM)

**File Structure:**
```
scripts/verification/
├── verify-database.mjs          # Main entry point
├── verification-engine.mjs      # Core logic
├── adapters/
│   ├── postgresql-adapter.mjs   # Abstract interface
│   ├── supabase-adapter.mjs     # Supabase implementation
│   └── self-hosted-adapter.mjs  # Future VN implementation
├── expectations/
│   └── contract-invariants.mjs  # Security requirements
└── evidence/
    └── evidence-generator.mjs   # Evidence artifact creation
```

### Rationale

**Node.js:**
- ✅ Cross-platform (Windows dev, Linux CI, VN servers)
- ✅ Consistent with 4B.2 BDGF integration
- ✅ Rich PostgreSQL ecosystem (`pg` library)
- ✅ JSON manipulation (expectations, evidence)
- ✅ GitHub Actions native support

**NOT SQL function:**
- ❌ Less portable (Supabase-specific PL/pgSQL)
- ❌ Harder to test in isolation
- ❌ Tight coupling to database version

**NOT separate service:**
- ❌ Adds deployment complexity
- ❌ Overkill for Phase 1 scope
- ❌ Can evolve to service later if needed

**PostgreSQL Adapter Pattern:**
- ✅ Database-agnostic contract
- ✅ Supabase = adapter implementation (not architectural dependency)
- ✅ Future VN migration = swap adapter (zero contract change)
- ✅ Testable with mock adapter

**Adapter Interface Example:**
```javascript
class PostgreSQLAdapter {
  async connect(config) { /* ... */ }
  async queryTables(schema) { /* ... */ }
  async queryColumns(table) { /* ... */ }
  async queryConstraints(table) { /* ... */ }
  async queryRLS(table) { /* ... */ }
  async disconnect() { /* ... */ }
}
```

**Supabase Adapter:**
```javascript
class SupabaseAdapter extends PostgreSQLAdapter {
  constructor(supabaseUrl, supabaseKey) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }
  // Implement interface using Supabase client
}
```

**Future Self-Hosted Adapter:**
```javascript
class SelfHostedAdapter extends PostgreSQLAdapter {
  constructor(connectionString) {
    this.pool = new pg.Pool({ connectionString });
  }
  // Implement interface using pg client
}
```

**Contract remains unchanged.**

---

## D7: Evidence Storage — Artifact + Governance DB Record

### Decision

**Dual Evidence Storage:**

**1. GitHub Actions Artifact (Portable Evidence)**
```json
{
  "verification_id": "<UUID>",
  "migration_id": "20260825120000_add_patients",
  "commit_sha": "ac2bcef2...",
  "environment": "production",
  "timestamp": "2026-08-25T10:30:00Z",
  "overall_result": "PASS",
  "checks_passed": 12,
  "checks_failed": 0,
  "checks_warning": 1,
  "checks": [ /* detailed results */ ]
}
```

**Storage:** GitHub Actions artifact (90-day retention)  
**Format:** JSON  
**Purpose:** Portable, downloadable, CI/CD integration

**2. Database Governance Record (Authoritative Audit)**
```sql
CREATE TABLE migration_governance.verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID REFERENCES migration_governance.approvals(id),
  migration_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  environment TEXT NOT NULL,
  verification_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overall_result TEXT NOT NULL CHECK (overall_result IN ('PASS', 'FAIL', 'WARNING', 'ERROR')),
  checks_passed INT NOT NULL,
  checks_failed INT NOT NULL,
  checks_warning INT NOT NULL,
  evidence_artifact_path TEXT, -- GitHub Actions artifact URL
  verification_engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Storage:** `migration_governance` schema  
**Format:** PostgreSQL table  
**Purpose:** Long-term audit trail, queryable history

### Rationale

**Why both?**

**Artifact advantages:**
- ✅ Portable (download, share, archive)
- ✅ Human-readable JSON
- ✅ CI/CD integration (artifact download API)
- ✅ Version control friendly

**Artifact disadvantages:**
- ❌ 90-day retention only
- ❌ Not queryable (must download)
- ❌ Separate from approval records

**DB Record advantages:**
- ✅ Permanent retention
- ✅ Queryable (SQL joins with approvals)
- ✅ Authoritative audit trail
- ✅ Integration with governance schema

**DB Record disadvantages:**
- ❌ Not portable
- ❌ Requires database access to view
- ❌ Couples verification to database

**Combined = Best of both worlds:**
- Artifact for CI/CD workflows
- DB record for long-term governance
- Cross-reference via `evidence_artifact_path`

### Read-Only Verification Principle

**Critical Boundary:**

```
┌─────────────────────────────────────────┐
│ Application/Business Schema             │
│ - hc_patients, edu_students, etc.       │
│                                         │
│ Verification: READ ONLY                 │
└─────────────────────────────────────────┘
                  ↓ READ
┌─────────────────────────────────────────┐
│ Verification Engine                     │
│ - Query schema                          │
│ - Query constraints                     │
│ - Query RLS                             │
│ - Compare expected vs actual            │
│                                         │
│ NO WRITES to business schema            │
└─────────────────────────────────────────┘
                  ↓ WRITE
┌─────────────────────────────────────────┐
│ Governance Schema                       │
│ - migration_governance.verification_... │
│                                         │
│ Verification: WRITE audit records       │
└─────────────────────────────────────────┘
```

**Verification does NOT:**
- ❌ Repair database state
- ❌ Modify application tables
- ❌ Auto-fix schema issues
- ❌ Rollback migrations

**Verification ONLY:**
- ✅ Read application schema
- ✅ Write governance audit
- ✅ Generate evidence
- ✅ Report PASS/FAIL

**Repair = Manual DBA responsibility.**

---

## Frozen Architectural Constraints

### Non-Negotiable (from 4B.2 Baseline)

1. ✅ **NO BDGF modifications** (frozen boundary)
2. ✅ **NO Healthcare/Logistics/Finance Kernel modifications** (frozen boundary)
3. ✅ **Contract → Test → Evidence → Implementation → Certificate** (proven process)
4. ✅ **Fail-closed by default** (no "best effort" modes)
5. ✅ **Database-agnostic design** (PostgreSQL, not Supabase-specific)

### Additional 4B.3 Constraints

6. ✅ **Read-only verification** (no database repair)
7. ✅ **Security-first** (tenant isolation mandatory)
8. ✅ **Platform-friendly** (additive changes = WARNING, not FAIL)
9. ✅ **VN-ready** (adapter pattern for self-hosted PostgreSQL)
10. ✅ **Incremental expansion** (Phase 1 minimal, Phase 2+ comprehensive)

---

## Failure Semantics (Comprehensive)

### Result States

| State | Definition | Downstream Action | Example |
|-------|------------|-------------------|---------|
| **PASS** | All critical checks passed | Deployment ELIGIBLE | Expected tables exist, RLS enabled |
| **WARNING** | Non-critical checks failed | Deployment ELIGIBLE | Recommended index missing, additive column |
| **FAIL** | One or more critical checks failed | Deployment BLOCKED | RLS disabled, expected table missing |
| **ERROR** | Verification engine failure | Deployment BLOCKED | Cannot connect to DB, query timeout |

### Check Classification

| Check Type | Example | Failure Result |
|------------|---------|----------------|
| **Security-critical** | RLS policy missing on `hc_patients` | ❌ FAIL |
| **Schema structure** | Expected table `hc_appointments` missing | ❌ FAIL |
| **Type integrity** | `patient_id` type changed `UUID→TEXT` | ❌ FAIL |
| **Referential integrity** | Foreign key `tenant_id` missing | ❌ FAIL |
| **Unexpected deletion** | Column `email` deleted | ❌ FAIL |
| **Unexpected modification** | Column `status` type changed | ❌ FAIL |
| **Additive change** | New column `metadata JSONB` added | ⚠️ WARNING |
| **Performance optimization** | Recommended index missing | ⚠️ WARNING |
| **Unknown state** | Cannot query schema | ❌ ERROR → FAIL |

### Fail-Closed Principles

```
Known PASS          → PASS
Known FAIL          → FAIL
Known WARNING       → WARNING (deployment eligible)
Unknown/Error       → FAIL (fail-closed)
```

**Examples:**

```javascript
// Database unreachable
if (!canConnect) return 'ERROR'; // → FAIL deployment

// RLS state unknown
if (rls === undefined) return 'ERROR'; // → FAIL deployment

// Expected table state unknown
if (tableExists === undefined) return 'ERROR'; // → FAIL deployment
```

**NO "best effort" mode:**
```javascript
// ❌ WRONG
if (!canVerifyRLS) {
  log('Warning: Could not verify RLS');
  return 'WARNING'; // ← Dangerous!
}

// ✅ CORRECT
if (!canVerifyRLS) {
  return 'ERROR'; // → FAIL deployment (fail-closed)
}
```

---

## VN Migration Readiness

### Current Architecture (2026)

```
Bella SPA ERP (Vercel)
         │
         ▼
Supabase PostgreSQL (US/Singapore)
         │
         ▼
4B.3 Verification (Supabase Adapter)
```

### Future Architecture (2027+)

```
Bella SPA ERP (VN Server)
         │
         ▼
Self-Hosted PostgreSQL (VN Data Center)
         │
         ▼
4B.3 Verification (Self-Hosted Adapter)
```

### Migration Path

**Phase 1 (Current):**
```javascript
const adapter = new SupabaseAdapter(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
```

**Phase 2 (VN Migration):**
```javascript
const adapter = new SelfHostedAdapter(
  process.env.POSTGRES_CONNECTION_STRING
);
```

**Contract unchanged. Zero code change in:**
- Verification Engine
- Expectations
- Evidence Generation
- Workflow Integration

**Only changed file:**
```
scripts/verification/adapters/self-hosted-adapter.mjs
```

**This is the power of database-agnostic architecture.**

---

## Decision Summary

| Decision | Impact | VN-Ready | Security | Platform-Friendly |
|----------|--------|----------|----------|-------------------|
| **D1: Minimal + Security** | Low complexity, high value | ✅ | ✅ | ✅ |
| **D2: Additive WARNING** | Supports parallel development | ✅ | ✅ | ✅ |
| **D3: RLS Mandatory** | Enforces tenant isolation | ✅ | ✅ | ⚠️ |
| **D4: No .expect.json** | Low authoring burden | ✅ | ✅ | ✅ |
| **D5: Immediate** | Fail-fast, atomic operation | ✅ | ✅ | ✅ |
| **D6: Node.js + Adapter** | Cross-platform, swappable | ✅ | ✅ | ✅ |
| **D7: Artifact + DB** | Portable + authoritative | ✅ | ✅ | ✅ |

**Overall:** ✅ **All decisions support VN migration, security, and platform expansion.**

---

## Next Steps

```
✅ DISCOVERY (d9f52c9c)
✅ DECISIONS (CURRENT)
         ↓
⏳ CONTRACT DRAFT
         ↓
⏳ CONTRACT REVIEW
         ↓
⏳ CONTRACT FREEZE 🔒
         ↓
⏳ TEST HARNESS (7 scenarios)
         ↓
⏳ IMPLEMENTATION
         ↓
⏳ EVIDENCE
         ↓
⏳ CERTIFICATE
```

**Next Artifact:** `P0_3_PHASE4B_3_CONTRACT.md`

---

**STATUS:** 🔒 **DECISIONS FROZEN**

**These 7 decisions form the foundation for Phase 4B.3 Contract. No modifications without ADR.**

---

**END OF DECISIONS**
