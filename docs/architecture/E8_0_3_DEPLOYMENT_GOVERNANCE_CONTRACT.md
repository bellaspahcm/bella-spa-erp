# E8.0.3: Deployment Governance Contract

**Date:** 2026-08-24  
**Status:** 🟡 DESIGN PHASE  
**Type:** GOVERNANCE CONTRACT (NO IMPLEMENTATION YET)

---

## Purpose

**Establish enforceable contract for database migration deployment in Bella Platform.**

**NOT a document. A verifiable contract enforced by code + infrastructure.**

---

## 7 Core Principles

### Principle 1: Migration Identity

**Canonical ID:** `YYYYMMDDHHMMSS` (14-digit timestamp)

**Requirements:**
- ✅ MUST use 14-digit timestamp format
- ✅ MUST be unique across all migrations
- ✅ MUST match Git filename (excluding description)
- ❌ MUST NOT use abbreviated format (8-digit)
- ❌ MUST NOT include description in version ID

**Enforcement:**
```typescript
function validateMigrationIdentity(filename: string): boolean {
  const pattern = /^(\d{14})_[\w]+\.sql$/;
  const match = filename.match(pattern);
  
  if (!match) return false;
  
  const timestamp = match[1];
  // Validate timestamp is valid date
  const year = parseInt(timestamp.substring(0, 4));
  const month = parseInt(timestamp.substring(4, 6));
  const day = parseInt(timestamp.substring(6, 8));
  const hour = parseInt(timestamp.substring(8, 10));
  const minute = parseInt(timestamp.substring(10, 12));
  const second = parseInt(timestamp.substring(12, 14));
  
  // Validate ranges
  return year >= 2020 && year <= 2100 &&
         month >= 1 && month <= 12 &&
         day >= 1 && day <= 31 &&
         hour >= 0 && hour <= 23 &&
         minute >= 0 && minute <= 59 &&
         second >= 0 && second <= 59;
}
```

---

### Principle 2: Source of Truth

**Three-way immutable verification:**

```
Git Migration File
    +
Immutable Checksum
    +
Production Provenance
    =
Source of Truth
```

**Requirements:**
- ✅ Migration file MUST exist in Git
- ✅ Checksum MUST be SHA-256 of migration SQL
- ✅ Provenance MUST record: version, checksum, commit SHA, executor, timestamp
- ❌ Manual modification of provenance FORBIDDEN

**Schema:**
```sql
CREATE TABLE deployment_provenance (
  migration_version TEXT PRIMARY KEY,
  migration_name TEXT NOT NULL,
  file_checksum TEXT NOT NULL, -- SHA-256
  git_commit_sha TEXT NOT NULL,
  executor TEXT NOT NULL, -- 'deployment_engine' or specific service account
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_duration_ms INTEGER,
  result TEXT NOT NULL, -- 'SUCCESS' | 'FAILED' | 'ROLLED_BACK'
  evidence JSONB NOT NULL
);
```

---

### Principle 3: Preflight Validation

**MUST validate before execution:**

#### 3.1 Migration Identity Validation
```typescript
async function validateIdentity(migration: Migration): Promise<ValidationResult> {
  // Check canonical format
  // Check uniqueness
  // Check Git file exists
  // Check no duplicate in production
}
```

#### 3.2 Dependency Validation
```typescript
async function validateDependencies(migration: Migration): Promise<ValidationResult> {
  // Check all referenced tables/functions exist
  // Check all required migrations applied
  // Check no circular dependencies
}
```

#### 3.3 Checksum Validation
```typescript
async function validateChecksum(migration: Migration): Promise<ValidationResult> {
  const fileContent = await readMigrationFile(migration.version);
  const computedChecksum = sha256(fileContent);
  const gitChecksum = await getGitFileChecksum(migration.version);
  
  if (computedChecksum !== gitChecksum) {
    return { valid: false, reason: 'Checksum mismatch' };
  }
  
  return { valid: true };
}
```

#### 3.4 Current Database State Validation
```typescript
async function validateDatabaseState(): Promise<ValidationResult> {
  // Check schema_migrations consistency
  // Check for pending migrations
  // Check for drift between code and DB
}
```

#### 3.5 Destructive Change Detection
```typescript
async function detectDestructiveChanges(sql: string): Promise<DestructiveChange[]> {
  const destructivePatterns = [
    /DROP\s+TABLE/i,
    /DROP\s+COLUMN/i,
    /DROP\s+CONSTRAINT/i,
    /DELETE\s+FROM/i,
    /TRUNCATE/i,
    /ALTER\s+COLUMN.*DROP/i
  ];
  
  const detected: DestructiveChange[] = [];
  
  for (const pattern of destructivePatterns) {
    if (pattern.test(sql)) {
      detected.push({
        type: pattern.source,
        requiresApproval: true,
        recoveryStrategy: 'REQUIRED'
      });
    }
  }
  
  return detected;
}
```

#### 3.6 Tenant/RLS Safety Validation
```typescript
async function validateTenantSafety(sql: string): Promise<ValidationResult> {
  // Check RLS policies not disabled
  // Check tenant_id not dropped
  // Check cross-tenant queries not introduced
  // Check service_role bypass not added
}
```

**Preflight Gate:**
```
ALL validations PASS → Proceed to Execution Gate
ANY validation FAIL → STOP + Evidence + Recovery Path
```

---

### Principle 4: Controlled Execution

**ONLY Deployment Engine can execute production migrations.**

#### 4.1 Execution Boundary

**Allowed:**
```
Deployment Engine → Production DB
```

**FORBIDDEN:**
```
AI Agent → Production DB
Developer → psql → Production DB
Dashboard → Production DB
Migration Script → Production DB
Supabase CLI → Production DB (unless via Deployment Engine)
```

#### 4.2 Execution Credentials

**Deployment Engine credentials:**
- Dedicated database role: `bella_deployment_engine`
- Limited to: CREATE, ALTER, DROP (schema only)
- NO data modification without explicit approval
- NO RLS bypass
- NO superuser

**All other credentials:**
- ❌ NO DDL permission on production
- ✅ Read-only or app-level DML only

#### 4.3 Execution Protocol

```typescript
async function executeMigration(migration: Migration): Promise<ExecutionResult> {
  const transaction = await beginTransaction();
  
  try {
    // Execute SQL
    await transaction.query(migration.sql);
    
    // Record provenance
    await transaction.query(`
      INSERT INTO deployment_provenance (
        migration_version, migration_name, file_checksum,
        git_commit_sha, executor, result, evidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      migration.version,
      migration.name,
      migration.checksum,
      migration.gitSHA,
      'deployment_engine',
      'SUCCESS',
      JSON.stringify({
        preflight: migration.preflightResults,
        executionStart: migration.startTime,
        executionEnd: Date.now()
      })
    ]);
    
    // Commit transaction
    await transaction.commit();
    
    return { success: true, provenance: recorded };
    
  } catch (error) {
    await transaction.rollback();
    
    // Record failure
    await recordFailure(migration, error);
    
    return { success: false, error };
  }
}
```

---

### Principle 5: Provenance Recording

**Immutable evidence for every deployment.**

**Required fields:**
- `migration_version`: Canonical 14-digit ID
- `migration_name`: Human-readable name
- `file_checksum`: SHA-256 of migration SQL
- `git_commit_sha`: Exact Git commit
- `executor`: Service account (must be 'deployment_engine')
- `executed_at`: Timestamp (immutable)
- `execution_duration_ms`: Performance tracking
- `result`: SUCCESS | FAILED | ROLLED_BACK
- `evidence`: JSONB with preflight results, execution log, verification

**Audit trail:**
```sql
-- Every change to provenance must be logged
CREATE TABLE deployment_audit_log (
  id SERIAL PRIMARY KEY,
  migration_version TEXT NOT NULL,
  action TEXT NOT NULL, -- 'DEPLOYED' | 'VERIFIED' | 'FAILED' | 'RECOVERED'
  actor TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB NOT NULL
);
```

---

### Principle 6: Post-Deployment Verification

**Verify schema + invariants + contracts after deployment.**

#### 6.1 Schema Verification
```typescript
async function verifySchema(migration: Migration): Promise<VerificationResult> {
  // Check all expected objects created
  // Check no unexpected objects
  // Check object definitions match migration intent
}
```

#### 6.2 Invariant Verification
```typescript
async function verifyInvariants(): Promise<VerificationResult> {
  // Check RLS policies active
  // Check constraints enforced
  // Check indexes exist
  // Check foreign keys valid
}
```

#### 6.3 Contract Verification
```typescript
async function verifyContracts(): Promise<VerificationResult> {
  // Check Finance OS contracts (F1/F2/F5)
  // Check Healthcare OS contracts (H1-H12)
  // Check Logistics OS contracts (E7.1-E7.3)
  // Check cross-kernel contracts
}
```

**Verification Gate:**
```
ALL verifications PASS → Migration COMPLETE
ANY verification FAIL → Trigger Recovery Strategy
```

---

### Principle 7: AI Deployment Boundary

**AI can PROPOSE. AI cannot DEPLOY.**

#### 7.1 AI Capability Boundary

**Allowed:**
```
AI → Generate Migration SQL
AI → Validate Migration Syntax
AI → Propose Architecture
AI → Write Tests
AI → Generate Documentation
```

**FORBIDDEN:**
```
AI → Execute Production SQL
AI → Modify schema_migrations
AI → Bypass Deployment Gate
AI → Direct database access
```

#### 7.2 Infrastructure Enforcement

**AI credentials:**
- ❌ NO DATABASE_URL with DDL permission
- ❌ NO SERVICE_ROLE_KEY
- ❌ NO bella_deployment_engine credentials
- ✅ Read-only query permission (for investigation)

**Deployment credentials:**
- 🔒 Stored in secure vault
- 🔒 Accessible only to Deployment Engine service
- 🔒 Not exposed to AI agents or developer environments

#### 7.3 Enforcement Check

```typescript
function canDeploy(actor: Actor): boolean {
  if (actor.type === 'AI_AGENT') return false;
  if (actor.type === 'DEVELOPER' && !actor.hasDeploymentApproval) return false;
  if (actor.type === 'DEPLOYMENT_ENGINE') return true;
  
  return false;
}
```

---

## Recovery Strategy Requirement

**Every migration MUST declare recovery strategy.**

**NOT: "All migrations must be rollback-safe"**

**CORRECT: "All migrations must have explicit recovery strategy"**

### Recovery Strategy Types

#### 1. Transactional Rollback
```yaml
recovery_strategy: ROLLBACK
conditions:
  - No data modification
  - DDL within transaction boundary
  - No external side effects
procedure: |
  Transaction rollback automatic
```

#### 2. Compensating Migration
```yaml
recovery_strategy: COMPENSATING
conditions:
  - Data transformation applied
  - Destructive change executed
  - Rollback would lose data
procedure: |
  Create reverse migration: 20260824000001_reverse_cleanup.sql
  Document compensation logic
  Test compensation on staging
```

#### 3. Restore Procedure
```yaml
recovery_strategy: RESTORE
conditions:
  - Ledger/financial changes
  - Immutable historical records
  - Constraint tightening
procedure: |
  Restore from pre-migration snapshot
  Document snapshot procedure
  Test restore on staging
```

#### 4. Forward-Fix Procedure
```yaml
recovery_strategy: FORWARD_FIX
conditions:
  - Migration partially succeeded
  - Rollback not safe
  - Production state recoverable
procedure: |
  Create fix migration: 20260824000002_fix_cleanup.sql
  Document fix logic
  Apply to production
```

**Migration must include:**
```sql
-- Recovery Strategy: COMPENSATING
-- Reason: Deletes test data from finance_transactions (irreversible)
-- Procedure: If recovery needed, create compensating migration to restore
--            test tenant data from backup or regenerate via RPC
-- Test Coverage: scripts/test_cleanup_recovery.ts
```

---

## E8.0.3 Acceptance Gates

**E8.0.3 PASS requires ALL gates verified:**

| Gate | Requirement | Enforcement |
|------|-------------|-------------|
| G1 | Canonical migration identity | Code validation |
| G2 | Immutable checksum | SHA-256 verification |
| G3 | Preflight detects drift | Automated validation |
| G4 | Dependency validation | Graph analysis |
| G5 | Destructive-change detection | Pattern matching |
| G6 | RLS/tenant safety validation | Policy check |
| G7 | Controlled production executor | Credential boundary |
| G8 | Provenance/evidence recording | Immutable log |
| G9 | Post-deploy invariant verification | Contract tests |
| G10 | Recovery strategy declared | Migration metadata |
| G11 | AI cannot directly deploy | Infrastructure boundary |
| G12 | Direct psql/Dashboard path governed | Credential isolation |

---

## Infrastructure Enforcement

### Credential Isolation

**Production database roles:**

```sql
-- Deployment Engine (ONLY role with DDL)
CREATE ROLE bella_deployment_engine WITH LOGIN PASSWORD '<vault>';
GRANT CREATE, USAGE ON SCHEMA public TO bella_deployment_engine;
GRANT CREATE ON DATABASE postgres TO bella_deployment_engine;
-- DDL permissions granted per deployment

-- Application (NO DDL)
CREATE ROLE bella_application WITH LOGIN PASSWORD '<vault>';
GRANT USAGE ON SCHEMA public TO bella_application;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bella_application;
-- NO DDL permissions

-- AI Investigation (READ ONLY)
CREATE ROLE bella_ai_readonly WITH LOGIN PASSWORD '<vault>';
GRANT USAGE ON SCHEMA public TO bella_ai_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bella_ai_readonly;
-- NO DDL, NO DML

-- Developer (LOCAL ONLY)
-- Production credentials NOT accessible to developers
-- Developers use local Supabase instance
```

**.env credential governance:**
```bash
# AI Agent environment (NO production access)
DATABASE_URL=<local_supabase_url>
DATABASE_EXECUTOR_URL=<local_supabase_url>

# Production Deployment Engine (vault-managed)
PRODUCTION_DEPLOYMENT_URL=<vault_secret>
```

---

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│  AI / Developer                                              │
│  ↓                                                           │
│  Migration Proposal (Git PR)                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Architecture Guard (Pre-commit Hook)                        │
│  ├─ Healthcare Kernel Freeze Check                          │
│  ├─ Logistics Kernel Freeze Check                           │
│  └─ Migration Identity Validation                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Deployment Preflight (CI/Deployment Engine)                 │
│  ├─ G1: Migration Identity                                  │
│  ├─ G2: Checksum                                            │
│  ├─ G3: Drift Detection                                     │
│  ├─ G4: Dependency Validation                               │
│  ├─ G5: Destructive Change Detection                        │
│  ├─ G6: RLS/Tenant Safety                                   │
│  └─ G10: Recovery Strategy                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
            ┌──────┴──────┐
            │             │
          FAIL          PASS
            │             │
            ▼             ▼
         ┌────┐    ┌─────────────────────────────────────────┐
         │STOP│    │  Execution Gate (G7: Deployment Engine) │
         └────┘    │  ├─ Controlled SQL execution            │
                   │  ├─ Transaction management              │
                   │  └─ G8: Provenance recording            │
                   └──────────────┬──────────────────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────────────────┐
                   │  Production DB                           │
                   └──────────────┬──────────────────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────────────────┐
                   │  Post-Deployment Verification (G9)       │
                   │  ├─ Schema verification                  │
                   │  ├─ Invariant verification               │
                   │  └─ Contract verification                │
                   └──────────────┬──────────────────────────┘
                                  │
                           ┌──────┴──────┐
                           │             │
                         FAIL          PASS
                           │             │
                           ▼             ▼
                  ┌────────────────┐  ┌─────┐
                  │ Trigger        │  │DONE │
                  │ Recovery (G10) │  └─────┘
                  └────────────────┘
```

---

## Blocked Paths (Enforced)

```
❌ AI ──────────────────────X────────────► Production DB
❌ Developer ───────────────X────────────► Production DB
❌ psql ────────────────────X────────────► Production DB
❌ Dashboard ───────────────X────────────► Production DB
❌ Migration Script ────────X────────────► Production DB
❌ Supabase CLI (direct) ───X────────────► Production DB

                            │
                            ▼
                    Deployment Gate
                       (G7 + G11)
```

**Enforcement:** Infrastructure + Credentials + Code

---

## E8.0.3 Status

**Design Phase:** ✅ COMPLETE

**Next Steps:**
1. ✅ Contract documented (this file)
2. ⏳ E8.0.4: Implement Deployment Adapter
3. ⏳ E8.1: Preflight validation implementation
4. ⏳ E8.2: Evidence/provenance implementation
5. ⏳ E8.3: Deploy 20260824000000 via governed path
6. ⏳ E8.4: Post-deployment verification

**DO NOT:**
- ❌ Deploy E8 before implementing contract
- ❌ Bypass contract for "quick fix"
- ❌ Modify E7 baseline

---

## Platform Maturity Milestone

**This contract marks transition from:**

```
Developer-controlled database
    ↓
Platform-governed database
```

**Bella Platform moves from:**
- "Developers can change DB" 
- **TO:** "Platform controls all DB changes"

**Deployment becomes a platform capability, not a developer action.**

---

**E8.0.3 Contract Design: COMPLETE. Ready for implementation approval.**
