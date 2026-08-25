# P0.3-PHASE 4B: CONTROL PLANE CONTRACT

**Phase:** Phase 4B.0 — Contract Review (Pre-Implementation)  
**Status:** APPROVED WITH AMENDMENTS ✅  
**Prerequisite:** Phase 4A PASS ✅

---

## 🎯 PHASE 4B OBJECTIVE

**Build the Golden Path Control Plane:**

Integrate BDGF policy engine into `deploy-production.yml` to enforce:
- Single production deployment path (`git push` → GitHub Actions → BDGF → bella_migration_executor)
- Zero-knowledge deployment (no credentials in repository)
- Fail-closed behavior (unsafe changes blocked)
- Database-before-application ordering
- Forward-only migrations (no schema rollback)
- Full audit trail

---

## 🏗️ CONTROL PLANE ARCHITECTURE (LOCKED)

```
Developer / AI
      │
      │ git push → protected branch (PRODUCTION entry point)
      │
      │ Exception: workflow_dispatch for non-production verification
      │             (test/break-glass only, NO production mutation)
      ▼
GitHub Actions (CONTROL PLANE)
      │
      ├── Checkout code
      ├── Architecture Guard (frozen layer compliance)
      ├── Tests (unit + integration)
      ├── Security scan
      ├── Change Detection (app/DB/mixed)
      │
      ▼
BDGF Policy Engine
      │
      ├── Migration safety analysis
      ├── Risk classification (auto/human approval)
      ├── Gate token generation
      └── Approval workflow
      │
      ▼
migration-executor.mjs (EXECUTION)
      │
      ├── Gate token validation
      ├── Token consumption (single-use)
      └── Execute via bella_migration_executor
      │
      ▼
bella_migration_executor (DB IDENTITY)
      │
      └── PostgreSQL (MUTATION)
      │
      ▼
Database Verification
      │
      ├── Schema validation
      ├── RLS policy check
      ├── Permission verification
      └── Data integrity check
      │
      ▼
Vercel Deployment (CONDITIONAL)
      │
      ├── Build application
      ├── Deploy preview
      ├── Smoke test
      └── Promote to production (manual approval)
      │
      ▼
Audit Trail
      │
      └── Record: commit, migration, gate, approval, result
      │
      ▼
🟢 LIVE
```

---

## 🚫 FORBIDDEN PATHS (MUST NOT EXIST IN PHASE 4B)

```
❌ GitHub Actions ────→ psql ────→ Production DB
❌ GitHub Actions ────→ supabase db push ────→ Production DB
❌ GitHub Actions ────→ SUPABASE_SERVICE_ROLE_KEY ────→ Production mutation
❌ GitHub Actions ────→ bella_developer ────→ Production mutation
❌ GitHub Actions ────→ Direct PostgreSQL client ────→ Production DB
```

**Enforcement:** Phase 4B must ONLY use `DATABASE_EXECUTOR_URL` → `migration-executor.mjs` → `bella_migration_executor`

---

## 📋 PHASE 4B EXECUTION PLAN (4 CHECKPOINTS)

### Checkpoint 4B.0: Contract Review ⏳ NOW

**Objective:** Lock architectural contract before implementation

**Tasks:**
- [x] Review control plane architecture (above diagram)
- [x] Validate forbidden paths (no bypasses)
- [ ] Review forward-only migration principle
- [ ] Define failure modes and rollback policy
- [ ] Lock Definition of Done (11 criteria)
- [ ] Approve contract → proceed to 4B.1

**Deliverable:** This document (locked contract)

---

### Checkpoint 4B.1: Change Detection

**Objective:** Detect change types (app-only, DB-only, mixed) to route correctly

**Implementation:**
- Add job: `detect-changes` in `deploy-production.yml`
- Analyze changed files (`git diff`)
- Classify: `app_changed`, `db_changed`, `infra_changed`, `docs_only`
- Output: `needs_migration`, `needs_app_deploy`, `risk_class`

**Routing Matrix (LOCKED):**

| Change Type | Migration | DB Verify | App Deploy |
|-------------|-----------|-----------|------------|
| Docs-only | ❌ | ❌ | ❌ |
| App-only | ❌ | Baseline/health | ✅ |
| DB-only | ✅ | ✅ | ❌ |
| Mixed | ✅ | ✅ | ✅ |
| Infra/control-plane | ❌* | Special gate | Conditional |

*Infra/control-plane changes have explicit HIGH_RISK classification

**Test Cases:**
- `src/**` → `APP`
- `supabase/migrations/**` → `DB`
- `src/** + migrations/**` → `MIXED`
- `docs/**` → `DOCS_ONLY`
- `.github/workflows/**` → `INFRA/HIGH_RISK`
- `scripts/bdgf/**` → `INFRA/HIGH_RISK`

**Deliverable:** Change detection job (verified with test commits)

**IMPORTANT:** Change detection only classifies. BDGF is the policy authority.

---

### Checkpoint 4B.2: BDGF Integration

**Objective:** Integrate BDGF policy engine for migration execution

**Implementation:**
- Add job: `migrate-database` (conditional on `needs_migration=true`)
- Inject secrets: `DATABASE_EXECUTOR_URL`, `GATE_SIGNING_KEY`
- Call: `node scripts/bdgf/execute-migration-wrapper.mjs`
- Verify: Gate token validated, migration executed, token consumed

**Test Cases:**
- Valid migration → Executed successfully
- Missing gate token → BLOCKED
- Invalid gate signature → BLOCKED
- Replayed token → BLOCKED
- Unsafe migration (detected by safety analysis) → BLOCKED

**Deliverable:** BDGF-integrated migration job (verified with test migration)

---

### Checkpoint 4B.3: DB Verification → Vercel Promotion

**Objective:** Verify DB state before app deployment, conditional promotion

**Implementation:**
- Add job: `verify-database` (runs after `migrate-database`)
- Verify: Schema, RLS, permissions, data integrity
- Add job: `deploy-application` (conditional on DB verification PASS)
- Vercel preview → smoke test → manual promotion

**Test Cases:**
- DB migration success + verification PASS → App deploys
- DB migration success + verification FAIL → App deployment BLOCKED
- DB migration FAIL → App deployment BLOCKED (old app still serves)
- App build FAIL → DB remains migrated (forward-only), old app serves

**Deliverable:** Conditional deployment pipeline (verified with test scenarios)

---

### Checkpoint 4B.4: Audit + Failure-Path Validation

**Objective:** Full audit trail, validate all failure modes

**Implementation:**
- Add job: `audit-deployment` (always runs, even on failure)
- Record: commit SHA, changes, gate token, approval, migration result, deployment result
- Store: GitHub Actions logs + optional DB audit table

**Test Cases:**
- Successful deployment → Full audit record
- Failed migration → Audit with failure reason
- Blocked unsafe change → Audit with block reason
- Manual approval denied → Audit with denial reason

**Deliverable:** Audit logging + failure mode validation report

---

## 🔒 FORWARD-ONLY MIGRATION PRINCIPLE (LOCKED)

**Principle 2 from Golden Path Contract:**

### Scenario 1: Migration Fails DURING Transaction

```
Migration execution (within PostgreSQL transaction)
        ↓
ERROR detected (constraint violation, syntax error, etc.)
        ↓
PostgreSQL automatically rolls back transaction
        ↓
NO changes committed to production
        ↓
App deployment BLOCKED (Contract 9: DB before app)
        ↓
Production state: UNCHANGED (safe)
        ↓
Developer fix: New commit with corrected migration
```

**This is acceptable rollback** — transaction-level, no production state changed.

### Scenario 2: Migration Succeeds but Verification Fails

```
Migration execution (transaction commits successfully)
        ↓
Database state CHANGED (schema mutation applied)
        ↓
Verification step detects inconsistency (e.g., missing RLS policy)
        ↓
Verification FAIL
        ↓
App deployment BLOCKED
        ↓
Database state: MIGRATED (forward-only, cannot rollback)
        ↓
Old app continues serving (MUST remain compatible with new schema)
        ↓
Developer fix: NEW FORWARD MIGRATION to correct state
```

**This is forward-only** — once committed, only forward corrections allowed.

**COMPATIBILITY INVARIANT:**

Committed database changes MUST preserve compatibility with the currently serving application until application promotion succeeds.

**Preferred migration pattern:**
```
Expand (add new schema elements, preserve old)
    ↓
Deploy compatible application (uses both old and new)
    ↓
Migrate/backfill data
    ↓
Contract later (remove old schema elements)
```

**Migration safety gate MUST block:**
- `DROP COLUMN` on columns used by current app
- `DROP TABLE` on tables accessed by current app
- `ALTER COLUMN` type changes that break current app
- RLS policy removal without replacement
- Breaking constraint additions without migration path

### Scenario 3: Migration Succeeds, App Deployment Fails

```
Migration execution (commits successfully)
        ↓
Database verification PASS
        ↓
App build/deployment FAIL (e.g., build error, smoke test fail)
        ↓
Database state: MIGRATED (forward-only)
        ↓
App state: OLD VERSION STILL SERVING
        ↓
Developer fix: Fix app code, push new commit
        ↓
Next deployment: DB migration already applied (idempotent), app deploys
```

**This is forward-only** — DB does not rollback, app retries.

---

## ✅ DEFINITION OF DONE (11 CRITERIA)

Phase 4B is **COMPLETE** when ALL criteria verified:

### 1. Change Detection ✅

- [ ] App-only change → `needs_app_deploy=true`, `needs_migration=false`
- [ ] DB-only change → `needs_migration=true`, `needs_app_deploy=false`
- [ ] Mixed change → Both `true`
- [ ] Docs-only → Both `false` (deployment skipped)

### 2. BDGF Integration ✅

- [ ] Migration executor uses `DATABASE_EXECUTOR_URL` (not other credentials)
- [ ] Gate token required (missing token → BLOCK)
- [ ] Invalid gate signature → BLOCK
- [ ] Replayed token → BLOCK (single-use enforced)

### 3. Migration Safety ✅

- [ ] Unsafe migration (breaking change) → BLOCKED before execution
- [ ] RLS policy removal → BLOCKED
- [ ] Non-idempotent migration → BLOCKED or WARNING

### 4. Execution Isolation ✅

- [ ] Only `bella_migration_executor` role used for DB mutation
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` for production mutation
- [ ] No direct `psql` or `supabase db push` in workflow

### 5. Database Verification ✅

- [ ] Schema verification runs after migration
- [ ] RLS policy verification runs
- [ ] Permission verification runs
- [ ] Verification FAIL → App deployment BLOCKED

### 6. Conditional App Deployment ✅

- [ ] DB migration success + verification PASS → App deploys
- [ ] DB migration FAIL → App deployment BLOCKED
- [ ] DB verification FAIL → App deployment BLOCKED
- [ ] App deployment FAIL → DB remains migrated (no rollback)

### 7. Forward-Only Enforcement ✅

- [ ] Transaction-level rollback allowed (pre-commit)
- [ ] Post-commit rollback FORBIDDEN (forward corrections only)
- [ ] No schema rewind mechanism in workflow

### 8. Vercel Promotion ✅

- [ ] Vercel preview deployed first
- [ ] Smoke test runs on preview
- [ ] Promotion to production requires manual approval (or auto if safe)
- [ ] Smoke test FAIL → Promotion BLOCKED

### 9. Audit Trail ✅

- [ ] Every deployment logged (success or failure)
- [ ] Audit includes: commit SHA, migration identity, change classification, risk classification, gate token ID/fingerprint, gate issuance/consumption timestamp, approval identity/result, execution result, verification result, deployment result
- [ ] Audit accessible in GitHub Actions logs
- [ ] Raw credentials NEVER logged (DATABASE_EXECUTOR_URL, GATE_SIGNING_KEY, gate token, VERCEL_TOKEN)

### 10. Failure Modes ✅

- [ ] All failures = fail-closed with bounded partial state
- [ ] Before DB commit: failure → transaction abort → no DB mutation
- [ ] After DB commit: rollback forbidden, app promotion may stop, old compatible app remains serving, correction via forward deployment only
- [ ] Migration FAIL → App not deployed, old app serves
- [ ] App FAIL → DB migrated (compatible schema), old app serves, next deploy retries app only

### 11. No Bypass Paths ✅

- [ ] No production mutation outside GitHub Actions → BDGF → bella_migration_executor
- [ ] Legacy paths (bash scripts, psql, supabase CLI) NOT invoked by workflow
- [ ] Manual bypass paths remain available but NOT part of Golden Path (Phase 5 will handle)

---

## 🚨 IMPLEMENTATION CONSTRAINTS (MUST ENFORCE)

### Constraint 1: No Code Changes Outside Control Plane

**Allowed:**
- ✅ Modify `.github/workflows/deploy-production.yml`
- ✅ Add workflow helper scripts (if needed)
- ✅ Modify BDGF scripts (if required for CI integration)

**Forbidden:**
- ❌ Modify legacy deployment scripts (Phase 5)
- ❌ Modify local .env (Phase 5)
- ❌ Deprecate manual paths (Phase 5)
- ❌ Modify application code (not in scope)

### Constraint 2: Reuse Existing BDGF Components

**REUSE (don't rebuild):**
- `scripts/bdgf/migration-executor.mjs` (R4.3.3 security boundary)
- `scripts/bdgf/gate-token.mjs` (token validation)
- `scripts/bdgf/execute-migration-wrapper.mjs` (CLI interface)

**MAY ADD (if needed):**
- Gate token generation script (if not exists)
- Migration safety analysis script (if not exists)
- DB verification script (if not exists)

### Constraint 3: Secret Injection Only

**All production secrets MUST be:**
- Stored in GitHub Environment "Production"
- Injected at runtime via `${{ secrets.SECRET_NAME }}`
- Never hardcoded in workflow

**Verified in Phase 4A:**
- `DATABASE_EXECUTOR_URL` ✅
- `GATE_SIGNING_KEY` ✅

**May need to add:**
- `VERCEL_TOKEN` (already exists in GitHub Secrets)

### Constraint 4: Test Before Production

**Every checkpoint MUST be tested:**
- Test with non-production commits (feature branch)
- Test with dry-run migrations (no production impact)
- Verify failure modes before live deployment

**Production deployment only after Phase 4B.4 complete.**

---

## 📊 PHASE 4B CHECKPOINT STATUS

| Checkpoint | Status | Deliverable | Blocking Issues |
|------------|--------|-------------|-----------------|
| **4B.0: Contract Review** | ✅ APPROVED (5 amendments applied) | This document | None |
| **4B.1: Change Detection** | ▶ NEXT | Change detection job | None |
| **4B.2: BDGF Integration** | ⏳ PENDING | Migration execution job | Blocked by 4B.1 |
| **4B.3: DB Verification** | ⏳ PENDING | Conditional deployment | Blocked by 4B.2 |
| **4B.4: Audit + Validation** | ⏳ PENDING | Audit + failure tests | Blocked by 4B.3 |

---

## 🎯 PHASE 4B.0 APPROVAL CHECKLIST

**Before proceeding to 4B.1, confirm:**

- [x] Control plane architecture diagram approved (no forbidden paths)
- [x] Forward-only migration principle clarified (transaction vs post-commit)
- [x] Definition of Done (11 criteria) approved
- [x] Implementation constraints approved (no legacy path modification)
- [x] 4 checkpoint plan approved (sequential execution)

**Status:** ✅ ALL APPROVED WITH 5 AMENDMENTS

**Amendments Applied:**
1. ✅ `git push` entry point clarified (workflow_dispatch = test/break-glass only)
2. ✅ Audit logging secured (no raw credentials, token ID/fingerprint only)
3. ✅ Compatibility invariant added (committed schema MUST remain compatible with old app)
4. ✅ Failure mode wording corrected (bounded partial state, not "no partial state")
5. ✅ Routing matrix locked (docs/app/DB/mixed/infra classification with explicit behavior)

---

**END OF PHASE 4B.0 CONTRACT**

**Status:** ✅ APPROVED — READY FOR 4B.1  
**Next:** Phase 4B.1 (Change Detection) — implementation authorized
