# Phase 4B.1 Change Detection Test Plan

**Branch:** `p0.3-phase4b.1-change-detection`  
**Objective:** Verify 5 change detection scenarios

---

## Test Scenarios

### Scenario 1: Docs-Only Change (LOW Risk)
- **Change:** Modify `docs/architecture/README.md`
- **Expected Output:**
  - `app_changed=false`
  - `db_changed=false`
  - `infra_changed=false`
  - `docs_only=true`
  - `needs_migration=false`
  - `needs_app_deploy=false`
  - `risk_class=LOW`
- **Expected Behavior:** All deployment jobs skipped

### Scenario 2: App-Only Change (MEDIUM Risk)
- **Change:** Modify `src/components/Button.tsx` (create if not exists)
- **Expected Output:**
  - `app_changed=true`
  - `db_changed=false`
  - `infra_changed=false`
  - `docs_only=false`
  - `needs_migration=false`
  - `needs_app_deploy=true`
  - `risk_class=MEDIUM`
- **Expected Behavior:** App deployment jobs run, no migration

### Scenario 3: DB-Only Change (HIGH Risk)
- **Change:** Add `supabase/migrations/20260825000000_test_change_detection.sql`
- **Expected Output:**
  - `app_changed=false`
  - `db_changed=true`
  - `infra_changed=false`
  - `docs_only=false`
  - `needs_migration=true`
  - `needs_app_deploy=false`
  - `risk_class=HIGH`
- **Expected Behavior:** Migration job would run (4B.2), app deploy skipped

### Scenario 4: Mixed Change (HIGH Risk)
- **Change:** Modify both `src/lib/db.ts` + `supabase/migrations/20260825000001_test_mixed.sql`
- **Expected Output:**
  - `app_changed=true`
  - `db_changed=true`
  - `infra_changed=false`
  - `docs_only=false`
  - `needs_migration=true`
  - `needs_app_deploy=true`
  - `risk_class=HIGH`
- **Expected Behavior:** Migration first (4B.2), then app deploy

### Scenario 5: Infra Change (CRITICAL Risk)
- **Change:** Modify `.github/workflows/deploy-production.yml` (this file)
- **Expected Output:**
  - `app_changed=false`
  - `db_changed=false`
  - `infra_changed=true`
  - `docs_only=false`
  - `needs_migration=false`
  - `needs_app_deploy=false`
  - `risk_class=CRITICAL`
- **Expected Behavior:** Special approval gate (4B.2+)

---

## Test Execution

**Method:** Run workflow via `workflow_dispatch` on feature branch

**Command:**
```bash
gh workflow run deploy-production.yml --ref p0.3-phase4b.1-change-detection
```

**Verification:**
```bash
gh run list --workflow=deploy-production.yml --branch=p0.3-phase4b.1-change-detection --limit 1
gh run view <run-id>
```

---

## Test Results

| Scenario | Test Date | Result | Notes |
|----------|-----------|--------|-------|
| 1. Docs-only | TBD | PENDING | |
| 2. App-only | TBD | PENDING | |
| 3. DB-only | TBD | PENDING | |
| 4. Mixed | TBD | PENDING | |
| 5. Infra | TBD | PENDING | |

---

**Status:** Test plan created, awaiting execution
