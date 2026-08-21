# G3a BASELINE: ENVIRONMENT

**Date:** 2026-08-20  
**Purpose:** Document runtime environment for baseline execution  

---

## RUNTIME ENVIRONMENT

### Node.js

**Version:** v25.7.0  
**Package Manager:** npm 11.10.1

### PowerShell

**Version:** 5.1.26100.9168  
**Platform:** Windows

### Database

**System:** PostgreSQL 17.6  
**Provider:** Supabase  
**Connection:** DATABASE_URL (environment variable)  
**Host:** lvnvkpyxtuilhrabtlwv.supabase.co

### Schema State (at baseline)

**Pre-Migration State:**
- runtime_tenant_registry table exists
- tenant_id type: text (TEXT-based, not UUID yet)
- No FK constraint on tenant_id
- 5 TEXT fixtures present
- RLS enabled, 1 policy active
- migration_evidence schema does NOT exist
- canonical_tenant_map table does NOT exist

**This is the expected state for Amendment 12 v3 execution.**

---

## DEPENDENCIES

### Core Dependencies

**From package.json:**
- pg (PostgreSQL client)
- dotenv (environment variables)
- fs/promises (file operations - Node.js built-in)

### Gate-Specific

**Package Integrity:**
- fs module (file existence checks)
- No database connection required

**E0 Gate:**
- pg client (database queries)
- File system access (migration file verification)

**E1 Gate:**
- pg client (runtime precondition checks)
- dotenv (DATABASE_URL)

---

## GIT STATE

**Commit:** 4174960  
**Branch:** (current branch at baseline)  
**Status:** Clean (no uncommitted changes)

**Tracked Files:**
- scripts/verify-amendment-12-v3-package-integrity.mjs
- scripts/run-e0-artifact-integrity-gate.mjs
- scripts/run-e1-verification.mjs
- supabase/migrations/20260819040000_*.sql (6 migration files)

---

## FILE PATHS

### Gate Scripts

```
scripts/verify-amendment-12-v3-package-integrity.mjs  (~420 lines)
scripts/run-e0-artifact-integrity-gate.mjs            (~470 lines)
scripts/run-e1-verification.mjs                       (~301 lines)
```

### Migration Files

```
supabase/migrations/20260819040000_runtime_migration_e1_gate_schema_safe.sql
supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql
supabase/migrations/20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql
supabase/migrations/20260819050002_runtime_migration_05b_canonical_tenant_creation.sql
supabase/migrations/20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql
supabase/migrations/20260819050004_runtime_migration_e3_post_05c_verification.sql
```

---

## EXECUTION COMMANDS

### Direct Node Execution

```bash
node scripts/verify-amendment-12-v3-package-integrity.mjs
node scripts/run-e0-artifact-integrity-gate.mjs
node scripts/run-e1-verification.mjs
```

### Expected npm Scripts (not present in package.json)

```bash
npm run verify:amendment-12:package-integrity  # Script not found
npm run verify:amendment-12:e0                 # Script not found
npm run verify:amendment-12:e1                 # Script not found
```

**Note:** Gates executed via direct Node.js, not npm scripts.

---

## ENVIRONMENT VARIABLES

**Required:**
- DATABASE_URL (PostgreSQL connection string)

**Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Source:** `.env` file (workspace root)

**Security:** Connection string contains credentials (not logged)

---

## BASELINE EXECUTION TIMESTAMPS

**Package Integrity:** 2026-08-20 (exact time in evidence file)  
**E0 Gate:** 2026-08-20 (exact time in evidence file)  
**E1 Gate:** 2026-08-20 (exact time in evidence file)  
**Failure Test 1:** 2026-08-20 (exact time in evidence file)

---

## SYSTEM INFORMATION

**OS:** Windows  
**Architecture:** (platform from Node)  
**Shell:** PowerShell 5.1

---

## REPRODUCIBILITY

**To reproduce baseline:**

1. **Checkout Git commit:** `git checkout 4174960`
2. **Install dependencies:** `npm install`
3. **Configure environment:** Create `.env` with DATABASE_URL
4. **Ensure database state:** Pre-migration (TEXT tenant_id, 5 fixtures)
5. **Run gates:**
   ```bash
   node scripts/verify-amendment-12-v3-package-integrity.mjs
   node scripts/run-e0-artifact-integrity-gate.mjs
   node scripts/run-e1-verification.mjs
   ```
6. **Expected results:** 52/52, 33/33, 10/10 PASS

**Requirements:**
- Node.js v25+ (or compatible version)
- PostgreSQL 17.6 database access
- Same schema state (pre-migration)

---

## BASELINE FREEZE CONSTRAINTS

**During baseline:**
- No code changes to gate scripts
- No database mutations
- No migration execution
- No dependency updates

**Purpose:** Baseline must be immutable reference point

**After baseline LOCKED:**
- Gate refactoring allowed (Layer 2)
- Must maintain same behavior (95/95 PASS)
- Must maintain same failure semantics

---

**Environment:** ✅ DOCUMENTED  
**Reproducibility:** ✅ SPECIFIED  
**Next:** Complete evidence archive, LOCK baseline  
