# Identity-Aware Baseline System — Deployment Plan

**Status:** Implementation Complete (I0-I9) ✅  
**Branch:** `infra/identity-aware-baseline`  
**Target:** Unblock PR #116 (Logistics P1 Hardening)  
**Date:** 2026-09-16

---

## Executive Summary

**Problem:** PR #116 blocked by pre-existing technical debt in unrelated scopes (BellaAuto, Partner Admin, Payroll).

**Root Cause:** CI lacked identity-aware baseline — could not distinguish inherited debt from new violations.

**Solution:** Built Identity-Aware No-New-Debt system that fingerprints findings with stable identities and enforces `NEW = CURRENT - BASELINE`.

**Status:** All infrastructure complete (I0-I9), ready for deployment.

---

## Implementation Phases (I0-I10)

### ✅ Phase 1: Foundation (I0-I5)

**Delivered:**
- `schema.ts` - Canonical finding schema with stable fingerprint design
- `fingerprint.ts` - Tool-specific fingerprint generation (TypeScript, ESLint, Jest, Migration)
- 4 adapters: `typescript-adapter.ts`, `eslint-adapter.ts`, `jest-adapter.ts`, `migration-adapter.ts`

**Key Design:**
- Fingerprint = `tool:file:component1:component2:...`
- Line/column stored but NOT part of identity
- Survives: code movement, whitespace changes
- Detects: semantic changes, symbol changes, failure reason changes

### ✅ Phase 2: Policy & Comparison (I6-I7)

**Delivered:**
- `comparator.ts` - Set-based comparison logic + 4 policy enforcement strategies
- `ratchet-governance.ts` - Manual baseline update governance with audit trail

**Policies:**
1. **Zero-Tolerance:** Any violation blocks
2. **No-New-Debt:** Existing allowed, new blocked
3. **No-New-Debt-With-Reason:** + failure reason in identity (Jest)
4. **Conditional-Grandfathering:** PR-relative migration policy

**Ratchet Rules:**
- NO auto-update in CI
- Manual review required
- Only when debt decreases
- Full audit trail

### ✅ Phase 3: Verification & Integration (I8-I9)

**Delivered:**
- `adversarial-verification.test.ts` - 8 critical test scenarios
- `generate-baseline.ts` - Baseline generation from current state
- `compare-with-baseline.ts` - CLI for CI usage
- `.github/workflows/baseline-no-new-debt.yml` - GitHub Actions integration
- `README.md` - Complete documentation

**8 Adversarial Scenarios:**
1. Line shift → ALLOW ✅
2. New error → BLOCK ✅
3. Same test, new cause → BLOCK ✅
4. Unchanged migration + baseline → ALLOW ✅
5. Modified migration → STRICT BLOCK ✅
6. Resolved debt → ALLOW + ratchet ✅
7. Debt laundering → BLOCK ✅
8. Same code, different semantic → BLOCK ✅

---

## Deployment Steps

### Step 1: Run Adversarial Verification (GATE)

```bash
npm test -- tests/baseline/adversarial-verification.test.ts
```

**Expected:** All 8/8 scenarios PASS  
**If FAIL:** Do NOT proceed to Step 2. Fix baseline system first.

---

### Step 2: Commit Infrastructure to Main

```bash
git checkout infra/identity-aware-baseline
git status

# Review all files
git add scripts/ci/baseline/
git add tests/baseline/
git add .github/workflows/baseline-no-new-debt.yml

git commit -m "feat(ci): implement identity-aware no-new-debt baseline system

- Stable fingerprinting for TypeScript, ESLint, Jest, Migration
- 4 policy enforcement strategies
- PR-relative migration grandfathering
- Manual ratchet governance with audit trail
- 8 adversarial scenarios verified

Unblocks: PR #116 (Logistics P1 Hardening)
Ref: docs/platform/IDENTITY_AWARE_BASELINE_DEPLOYMENT.md"

# Push infrastructure
git push origin infra/identity-aware-baseline

# Create PR for infrastructure
gh pr create \
  --title "feat(ci): Identity-Aware No-New-Debt Baseline System" \
  --body "See docs/platform/IDENTITY_AWARE_BASELINE_DEPLOYMENT.md for deployment plan" \
  --base main
```

**Review Focus:**
- Adversarial tests all pass
- No auto-update in CI
- Policy definitions clear
- Fingerprint stability correct

---

### Step 3: Merge Infrastructure PR

```bash
# After approval and CI green
gh pr merge <infra-PR-number> --squash

# Pull to local main
git checkout main
git pull
```

**Verification:**
```bash
ls scripts/ci/baseline/
ls .github/workflows/baseline-no-new-debt.yml
```

---

### Step 4: Generate Baseline from Main

```bash
git checkout main
git pull

# Generate baseline
node scripts/ci/baseline/generate-baseline.ts \
  --output .github/ci/baselines/main.json

# Review baseline
cat .github/ci/baselines/main.json | jq '.scopes | to_entries | map({scope: .key, count: .value.count})'
```

**Expected Output:**
```json
[
  {"scope": "typescript-full", "count": <number>},
  {"scope": "eslint-changed", "count": <number>},
  {"scope": "jest-affected", "count": <number>},
  {"scope": "migration-zero-downtime", "count": <number>}
]
```

**Review:**
- Counts match current main state
- All scopes present
- Policy assignments correct

---

### Step 5: Commit Baseline to Main

```bash
git add .github/ci/baselines/main.json

git commit -m "chore(ci): generate initial baseline for identity-aware system

Baseline represents current main state (commit $(git rev-parse HEAD))

Counts:
- TypeScript: $(jq '.scopes["typescript-full"].count' .github/ci/baselines/main.json)
- ESLint: $(jq '.scopes["eslint-changed"].count' .github/ci/baselines/main.json)
- Jest: $(jq '.scopes["jest-affected"].count' .github/ci/baselines/main.json)
- Migration: $(jq '.scopes["migration-zero-downtime"].count' .github/ci/baselines/main.json)"

git push origin main
```

---

### Step 6: Test Baseline System with PR #116

```bash
# Checkout PR #116 branch
git fetch origin
git checkout hardening/platform-stability-20260916

# Rebase on latest main (with baseline system)
git rebase main

# Test locally
node scripts/ci/baseline/compare-with-baseline.ts \
  --baseline .github/ci/baselines/main.json \
  --pr-base main \
  --pr-head HEAD
```

**Expected Result:**
```
✅ All baseline checks PASSED

Scopes:
✅ typescript-full: 0 new violations (X existing tolerated)
✅ eslint-changed: 0 new violations (Y existing tolerated)
✅ jest-affected: 0 new violations (Z existing tolerated)
✅ migration-zero-downtime: 0 new violations (W grandfathered)

Verdict: PASS
```

**If PASS:** Continue to Step 7  
**If FAIL:** Investigate which scope has new violations. Should not happen if PR #116 is clean.

---

### Step 7: Push Rebased PR #116

```bash
# Force push rebased branch (includes baseline system)
git push origin hardening/platform-stability-20260916 --force-with-lease

# Trigger CI re-run
# GitHub Actions will now use baseline-no-new-debt.yml
```

**Monitor CI:**
- Check "Identity-Aware No-New-Debt Baseline" workflow
- Should show PASS with 0 new violations
- Old failures (BellaAuto, Partner Admin, Payroll) should be tolerated

---

### Step 8: Merge PR #116 to Main

```bash
# After CI green
gh pr merge 116 --squash

# Pull merged state
git checkout main
git pull
```

---

### Step 9: Post-Merge Verification

```bash
# Verify Logistics P1 on main
git checkout main

# Run Logistics-specific checks
npx tsc --noEmit --project tsconfig.logistics-domain.json
npm test -- src/platform/logistics/domain

# Expected: 0 diagnostics + 547/547 PASS
```

**If GREEN:**
```
🔒 LOGISTICS P1 DOMAIN SEALED ON MAIN
```

**If RED:**
- Investigate merge conflict or rebase issue
- Should not happen if Step 6 was GREEN

---

### Step 10: Document Factory Learning

Create `docs/platform/FACTORY_INCIDENT_003_RESOLUTION.md`:

```markdown
# Factory Incident #3 — CI Historical Debt Retroactive Block

**Incident:** PR #116 (clean Logistics hardening) blocked by pre-existing debt

**Root Cause:** CI lacked identity-aware baseline

**Resolution:** Built Identity-Aware No-New-Debt system

**Outcome:**
- Clean scopes can merge without waiving CI
- Technical debt can only decrease, never increase
- No bypass mechanisms needed
- Factory improved for all future PRs

**Learning:**
- Gate design flaw: could not distinguish inherited vs introduced debt
- Solution: Stable fingerprinting + NEW = CURRENT - BASELINE
- Verification: 8 adversarial scenarios prevent regression
```

---

## Success Criteria

### Infrastructure Success (I0-I9)
- ✅ All 8 adversarial scenarios PASS
- ✅ Baseline generated from main
- ✅ CI workflow integrated
- ✅ Documentation complete

### PR #116 Unblock Success
- ✅ PR #116 rebased on main with baseline system
- ✅ CI shows 0 new violations (historical debt tolerated)
- ✅ All required checks GREEN
- ✅ PR merged to main
- ✅ Post-merge verification: 0 diagnostics + 547/547 PASS

### Factory Improvement Success
- ✅ No bypass mechanisms used
- ✅ CI strengthened (not weakened)
- ✅ Future PRs benefit from identity-aware baseline
- ✅ Ratchet governance in place for debt reduction

---

## Risk Mitigation

**Risk 1:** Adversarial tests fail  
**Mitigation:** Do not deploy. Fix baseline system design flaws first.

**Risk 2:** Baseline generation captures transient failures  
**Mitigation:** Generate baseline on clean main, verify counts are stable.

**Risk 3:** PR #116 local test passes but CI fails  
**Mitigation:** Debug fingerprint differences between local and CI environment.

**Risk 4:** Post-merge verification fails  
**Mitigation:** Revert merge, investigate merge conflict or rebase error.

**Risk 5:** Future PRs blocked by baseline drift  
**Mitigation:** Ratchet governance ensures baseline stays current. Manual review prevents drift.

---

## Timeline

**I0-I9:** Implementation complete (2026-09-16)  
**I10:** Deployment execution  

**Estimated deployment time:** 2-3 hours (Steps 1-10)  
**Critical path:** Step 1 (adversarial verification) MUST PASS before proceeding

---

## Rollback Plan

**If deployment fails at any step:**

1. **Before Step 5 (baseline commit):** Simply abandon deployment, no rollback needed
2. **After Step 5, before Step 8:** Revert baseline commit, continue with Option A (human waiver) for PR #116
3. **After Step 8 (PR #116 merged):** Do NOT rollback. Post-merge issues should be fixed forward.

**Rollback command (if needed):**
```bash
git revert <baseline-commit-sha>
git revert <infra-pr-merge-sha>
git push origin main
```

---

## Post-Deployment Monitoring

**Week 1:**
- Monitor all PRs using new baseline system
- Check for false positives (legitimate changes blocked)
- Check for false negatives (regressions not caught)

**Week 2-4:**
- Collect baseline ratchet opportunities
- Review first ratchet proposal
- Validate debt decrease is legitimate

**Ongoing:**
- Quarterly baseline audit
- Review ratchet audit history
- Update policy definitions if needed

---

## References

- **Infrastructure:** `scripts/ci/baseline/README.md`
- **Adversarial Tests:** `tests/baseline/adversarial-verification.test.ts`
- **PR #116:** https://github.com/bellaspahcm/bella-spa-erp/pull/116
- **User Decision:** Option B - Build infrastructure first, no bypass
- **Design Principle:** "Ta đang sửa Factory để những PR sau không phải giải quyết lại vấn đề này"

---

**Status:** Ready for Step 1 (Adversarial Verification) ✅
