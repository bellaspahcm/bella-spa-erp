# P0.3-PHASE 4B.1.a: TEST HARNESS SEPARATION

**Phase:** Phase 4B.1.a — Test Harness Separation  
**Status:** IMPLEMENTATION COMPLETE ✅  
**Date:** 2026-08-25

---

## 🎯 OBJECTIVE

Create separate test harness for change detection verification WITHOUT weakening production security.

**Principle:** Testability ≠ Weakening production security

---

## 🔍 PROBLEM IDENTIFIED

**Initial Test Attempt:**
- Ran `deploy-production.yml` on feature branch `p0.3-phase4b.1-change-detection`
- Change detection worked correctly (✅ infra classification)
- Workflow failed at "Require main branch" guard (by design, not a bug)
- **Result:** Classification verified, but routing matrix unverified

**Why Not Remove Branch Guard?**
- Branch guard protects production from accidental feature branch deployment
- Removing/weakening it would compromise Golden Path security
- Test needs should NOT weaken production controls

---

## ✅ SOLUTION: SEPARATE TEST HARNESS

### Production Workflow (deploy-production.yml)

**Purpose:** Production deployment Golden Path  
**Branch:** `main` ONLY  
**Trigger:** `workflow_dispatch` (manual, protected)  
**Guards:** Branch check, credential validation, immutable config  
**Scope:** FULL deployment (validation → migration → app → verification)

### Test Harness (test-change-detection.yml)

**Purpose:** Change detection verification ONLY  
**Branch:** Feature branches (`p0.3-*`)  
**Trigger:** `workflow_dispatch` (test scenarios)  
**Guards:** None (test environment)  
**Scope:** Classification + routing logic ONLY

**Critical constraints:**
- ❌ NO production credentials
- ❌ NO database mutations
- ❌ NO application deployment
- ❌ NO Vercel promotion
- ✅ ONLY classification logic testing

---

## 📋 TEST HARNESS ARCHITECTURE

```
test-change-detection.yml
      │
      ├── detect-changes (SAME logic as production)
      │   ↓
      │   outputs: app_changed, db_changed, infra_changed, docs_only,
      │            needs_migration, needs_app_deploy, risk_class
      │
      ├── test-routing-docs-only (if docs_only=true)
      │   └── ✅ PASS: Verify skip behavior
      │
      ├── test-routing-app-only (if needs_app_deploy=true, needs_migration=false)
      │   └── ✅ PASS: Verify app-only path
      │
      ├── test-routing-db-only (if needs_migration=true, needs_app_deploy=false)
      │   └── ✅ PASS: Verify DB-only path
      │
      ├── test-routing-mixed (if needs_migration=true, needs_app_deploy=true)
      │   └── ✅ PASS: Verify DB→App path
      │
      ├── test-routing-infra (if infra_changed=true)
      │   └── ✅ PASS: Verify CRITICAL classification
      │
      └── test-summary (always runs, reports results)
          └── 📊 Routing matrix verification summary
```

---

## 🧪 TEST SCENARIOS

### Scenario 1: Docs-Only Change (LOW Risk)

**Commit:** Modify `docs/architecture/*.md`

**Expected Classification:**
- `docs_only=true`
- `app_changed=false`
- `db_changed=false`
- `infra_changed=false`
- `needs_migration=false`
- `needs_app_deploy=false`
- `risk_class=LOW`

**Expected Routing:**
- `test-routing-docs-only` job runs
- All other routing jobs skip
- Summary shows `docs-only: success`

---

### Scenario 2: App-Only Change (MEDIUM Risk)

**Commit:** Modify `src/components/Button.tsx` OR `src/lib/utils.ts`

**Expected Classification:**
- `docs_only=false`
- `app_changed=true`
- `db_changed=false`
- `infra_changed=false`
- `needs_migration=false`
- `needs_app_deploy=true`
- `risk_class=MEDIUM`

**Expected Routing:**
- `test-routing-app-only` job runs
- All other routing jobs skip
- Summary shows `app-only: success`

---

### Scenario 3: DB-Only Change (HIGH Risk)

**Commit:** Add `supabase/migrations/20260825000000_test_db_only.sql`

**Expected Classification:**
- `docs_only=false`
- `app_changed=false`
- `db_changed=true`
- `infra_changed=false`
- `needs_migration=true`
- `needs_app_deploy=false`
- `risk_class=HIGH`

**Expected Routing:**
- `test-routing-db-only` job runs
- All other routing jobs skip
- Summary shows `db-only: success`

---

### Scenario 4: Mixed Change (HIGH Risk)

**Commit:** Modify `src/lib/db.ts` + `supabase/migrations/20260825000001_test_mixed.sql`

**Expected Classification:**
- `docs_only=false`
- `app_changed=true`
- `db_changed=true`
- `infra_changed=false`
- `needs_migration=true`
- `needs_app_deploy=true`
- `risk_class=HIGH`

**Expected Routing:**
- `test-routing-mixed` job runs
- All other routing jobs skip
- Summary shows `mixed: success`

---

### Scenario 5: Infra Change (CRITICAL Risk)

**Commit:** Modify `.github/workflows/test-change-detection.yml` OR `scripts/bdgf/migration-executor.mjs`

**Expected Classification:**
- `docs_only=false`
- `app_changed=false` (unless infra is also app)
- `db_changed=false`
- `infra_changed=true`
- `needs_migration=false`
- `needs_app_deploy=false` (unless infra is also app)
- `risk_class=CRITICAL`

**Expected Routing:**
- `test-routing-infra` job runs
- All other routing jobs skip (or mixed if infra+app)
- Summary shows `infra: success`

---

## 📊 DEFINITION OF DONE (4B.1.a)

Phase 4B.1.a is **COMPLETE** when:

- [x] Test harness workflow created (`.github/workflows/test-change-detection.yml`)
- [x] Test harness uses SAME classification logic as production
- [x] Test harness has NO production credentials
- [x] Test harness has NO deployment execution
- [x] 5 routing test jobs created (docs/app/DB/mixed/infra)
- [x] Test summary job created
- [ ] Test harness pushed to feature branch
- [ ] Test harness executed with 5 scenarios
- [ ] All 5 scenarios PASS
- [ ] Evidence saved

---

## 🚀 NEXT STEPS

### Step 1: Commit Test Harness

```bash
git add .github/workflows/test-change-detection.yml
git add docs/architecture/P0_3_PHASE4B_1a_TEST_HARNESS.md
git commit -m "feat(p0.3): add Phase 4B.1.a test harness (separate from production)

- Create test-change-detection.yml (no credentials, no deployment)
- Reuse classification logic from deploy-production.yml
- Add 5 routing test jobs (docs/app/DB/mixed/infra)
- Principle: Testability ≠ weakening production security"
git push
```

### Step 2: Run Test Harness

```bash
gh workflow run test-change-detection.yml --ref p0.3-phase4b.1-change-detection
gh run list --workflow=test-change-detection.yml --branch=p0.3-phase4b.1-change-detection --limit 1
gh run view <run-id> --log
```

### Step 3: Create Remaining Test Scenarios

After initial infra test passes, create commits for:
- Docs-only: Modify `docs/test-scenarios/scenario1.md`
- App-only: Modify `src/test-scenarios/scenario2.tsx`
- DB-only: Add `supabase/migrations/20260825000000_test_scenario3.sql`
- Mixed: Modify both `src/` and `supabase/migrations/`

### Step 4: Verify All Scenarios

Run test harness after each commit, verify correct routing.

### Step 5: Save Evidence

Document all test runs in `P0_3_PHASE4B_1_EVIDENCE.md`.

---

## ✅ SUCCESS CRITERIA

**Phase 4B.1 is COMPLETE when:**

- ✅ Test harness created (separate from production)
- ✅ Classification logic verified on GitHub Actions
- ✅ 5/5 routing scenarios PASS
- ✅ Evidence documented
- ✅ No production security weakened
- ✅ No production credentials exposed
- ✅ No production mutation during testing

---

**END OF PHASE 4B.1.a PLAN**

**Status:** Implementation complete, ready for execution  
**Next:** Execute test harness with 5 scenarios
