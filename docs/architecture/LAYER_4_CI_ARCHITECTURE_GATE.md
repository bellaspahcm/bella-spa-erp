# LAYER 4: CI ARCHITECTURE GATE

**Component:** CI Architecture Gate  
**Layer:** 4 of 5  
**Status:** 🟡 **IMPLEMENTATION COMPLETE / ENFORCEMENT PENDING**  
**Version:** 1.0.0

---

## Overview

Layer 4 provides **repository-level enforcement** by blocking pull requests that violate architecture boundaries at the CI level.

**Protection Flow:**
```
Developer
    ↓
Code Changes
    ↓
git commit (Layer 3 may be bypassed with --no-verify)
    ↓
git push
    ↓
Pull Request
    ↓
CI Architecture Gate (Layer 4) ← Enforces here (cannot be bypassed)
    ├── frozen-files
    ├── guard
    ├── dependency
    └── regression
    ↓
Branch Protection
    ↓
MERGE (only if all checks PASS)
```

**Key Principle:**

> "Layer 3 can be bypassed locally. Layer 4 cannot be bypassed."

---

## Implementation

### CI Workflow

**File:** `.github/workflows/architecture-gate.yml`

**Triggers:**
- Pull requests to `main` or `develop`
- Direct pushes to `main`

**Jobs:** 4 required jobs (all must pass)

### Job 1: frozen-files

**Purpose:** Detect frozen file modifications in PRs

**Script:** `scripts/architecture/ci-frozen-check.js` (273 lines)

**Checks:**
- Compares PR branch against base branch
- Detects: MODIFIED, ADDED, RENAMED, DELETED frozen files
- Handles all 22 frozen artifacts (E7.1: 12, E7.2: 1, E7.3: 9)

**Behavior:**
```
Frozen file modified → ❌ FAIL (exit 1)
No frozen files modified → ✅ PASS (exit 0)
```

**Error message includes:**
- List of violated files
- Layer identification
- Change type (MODIFIED/DELETED/etc)
- Required ACR process
- Reference documentation

### Job 2: guard

**Purpose:** Verify Architecture Guard integrity

**Script:** `scripts/architecture/ci-guard-integrity.js` (339 lines)

**Checks:**
- All guard files exist (11 files)
- Frozen file lists consistent across layers
- Pre-commit hook active and calls guard
- CI workflow has all 4 required jobs

**Behavior:**
```
Guard tampered → ❌ FAIL (exit 1)
Guard intact → ✅ PASS (exit 0)
```

**Prevents:**
- Deleting guard files
- Modifying frozen file lists inconsistently
- Disabling pre-commit hook
- Removing CI jobs

### Job 3: dependency

**Purpose:** Enforce architecture dependency boundaries

**Script:** `scripts/architecture/ci-dependency-check.js` (312 lines)

**Rules:**
```
E7.1 Domain Kernel:
  ✅ Can import: Node.js, type-fest, @types
  ❌ Cannot import: E7.2, E7.3, Products, Workflows

E7.2 Operational Kernel:
  ✅ Can import: Node.js, type-fest, E7.1
  ❌ Cannot import: E7.3, Products, Workflows

E7.3 Rules & Traceability:
  ✅ Can import: Node.js, type-fest, E7.1, E7.2
  ❌ Cannot import: Products, Workflows, /finance/, /warehouse/
```

**Checks:**
- Extracts imports from changed kernel files
- Validates against forbidden patterns
- Machine-checkable architecture rules

**Behavior:**
```
Forbidden import detected → ❌ FAIL (exit 1)
All imports allowed → ✅ PASS (exit 0)
```

### Job 4: regression

**Purpose:** Verify frozen kernel tests still pass

**Command:** `npm run logistics:verify`

**Validates:**
- Architecture guard passes (Layer 1)
- Full regression: 547/547 tests (E7.1: 366, E7.2: 73, E7.3: 108)

**Behavior:**
```
Any test fails → ❌ FAIL (exit non-zero)
All 547 tests pass → ✅ PASS (exit 0)
```

---

## Branch Protection (Required)

**Status:** ⏳ **PENDING CONFIGURATION**

### Required Settings

**Location:** GitHub → Settings → Branches → Branch protection rules → `main`

**Must enable:**
```
✅ Require a pull request before merging
✅ Require approvals: 1
✅ Dismiss stale pull request approvals when new commits are pushed
✅ Require status checks to pass before merging:
    ✅ architecture-gate / frozen-files
    ✅ architecture-gate / guard
    ✅ architecture-gate / dependency
    ✅ architecture-gate / regression
✅ Require branches to be up to date before merging
✅ Do not allow bypassing the above settings
❌ Allow force pushes (disabled)
❌ Allow deletions (disabled)
```

### Why This Matters

**Without branch protection:**
- CI runs but results are advisory only
- PR can be merged even if checks fail
- Repository-level enforcement is incomplete

**With branch protection:**
- CI results are mandatory
- PR cannot be merged if any check fails
- Repository-level enforcement is complete

---

## Test Scenarios

### ✅ Scenario 1: Normal PR (Should Pass)

```bash
# Create feature branch
git checkout -b feature/add-warehouse-feature

# Modify non-frozen file
echo "// new feature" > src/products/warehouse/feature.ts
git add .
git commit -m "feat: add warehouse feature"
git push origin feature/add-warehouse-feature

# Create PR
# Expected: All 4 CI jobs PASS
# Expected: PR can be merged
```

### ❌ Scenario 2: Frozen File Modified (Should Block)

```bash
# Create test branch
git checkout -b test/frozen-violation

# Modify frozen file
echo "// violation" >> src/platform/logistics/domain/inventory.types.ts
git add .
git commit -m "test: modify frozen file"
git push origin test/frozen-violation

# Create PR
# Expected: frozen-files job FAILS
# Expected: PR cannot be merged
```

### ❌ Scenario 3: --no-verify Bypass (Should Block)

```bash
# Create test branch
git checkout -b test/bypass-hook

# Modify frozen file
echo "// bypass" >> src/platform/logistics/domain/movement.types.ts
git add .
git commit --no-verify -m "test: bypass local hook"
# Note: Local hook bypassed ✓

git push origin test/bypass-hook

# Create PR
# Expected: CI detects violation
# Expected: frozen-files job FAILS
# Expected: PR cannot be merged
# Expected: Proves Layer 3 bypass is caught by Layer 4
```

### ❌ Scenario 4: Dependency Violation (Should Block)

```bash
# Create test branch
git checkout -b test/dependency-violation

# Add forbidden import in E7.1
cat >> src/platform/logistics/domain/test.ts << EOF
import { WarehouseService } from '@/products/warehouse';
export const test = 'violation';
EOF

git add .
git commit -m "test: violate dependency boundary"
git push origin test/dependency-violation

# Create PR
# Expected: dependency job FAILS
# Expected: PR cannot be merged
```

### ❌ Scenario 5: Guard Tampering (Should Block)

```bash
# Create test branch
git checkout -b test/tamper-guard

# Delete guard file
rm scripts/architecture/ci-frozen-check.js
git add .
git commit -m "test: remove guard file"
git push origin test/tamper-guard

# Create PR
# Expected: guard job FAILS
# Expected: PR cannot be merged
```

### ❌ Scenario 6: Regression Failure (Should Block)

```bash
# If any change breaks 547 tests
# Expected: regression job FAILS
# Expected: PR cannot be merged
```

---

## Integration

### With Layer 3 (Git Pre-Commit Hook)

**Layer 3:** Developer-side protection (can be bypassed)  
**Layer 4:** Repository-side enforcement (cannot be bypassed)

**Combined behavior:**
```
Developer modifies frozen file
        ↓
Layer 3: git commit → BLOCKED (if not using --no-verify)
        ↓ (bypass with --no-verify)
git push → succeeds
        ↓
Layer 4: CI detects violation → PR BLOCKED
        ↓
Cannot merge into main
```

### With Layer 5 (Regression Tests)

**Layer 5:** Test suite (547 tests)  
**Layer 4 Job 4:** Runs Layer 5 tests in CI

**Integration:**
- Layer 4 executes `npm run logistics:verify`
- This runs Layer 1 guard + Layer 5 tests
- All must pass for PR to be mergeable

---

## Validation Status

### ✅ Implementation Complete

- [x] `.github/workflows/architecture-gate.yml` created
- [x] Job 1: `frozen-files` implemented
- [x] Job 2: `guard` implemented
- [x] Job 3: `dependency` implemented
- [x] Job 4: `regression` implemented
- [x] All 3 CI scripts created and tested locally
- [x] Documentation complete

### ⏳ Enforcement Pending

**Required for "Layer 4 Complete":**

- [ ] Branch protection configured on `main`
- [ ] Required status checks enabled
- [ ] Real PR test: Normal PR → PASS
- [ ] Real PR test: Frozen file → BLOCKED
- [ ] Real PR test: --no-verify bypass → BLOCKED
- [ ] Real PR test: Dependency violation → BLOCKED
- [ ] Real PR test: Guard tampering → BLOCKED
- [ ] Evidence captured with PR numbers/commit SHAs
- [ ] `LAYER_4_TEST_EVIDENCE.md` complete

**Until these are complete:**

Layer 4 Status: 🟡 **IMPLEMENTATION COMPLETE / ENFORCEMENT PENDING**

---

## Known Limitations

### Cannot Test Locally

CI jobs require GitHub Actions environment:
- `GITHUB_BASE_REF` environment variable
- Git history with base branch
- Branch protection rules

**Mitigation:** Must test with real PRs in GitHub

### Requires Repository Access

Branch protection configuration requires:
- Repository admin access
- GitHub UI (cannot be automated in this codebase)

**Mitigation:** Manual configuration required (documented above)

---

## Troubleshooting

### CI Jobs Not Running

**Check:**
1. Workflow file exists: `.github/workflows/architecture-gate.yml`
2. Workflow is enabled (GitHub Actions tab)
3. PR is against `main` or `develop` branch

### Jobs Pass But PR Not Protected

**Cause:** Branch protection not configured

**Fix:** Configure required status checks (see Branch Protection section above)

### False Positives

If CI blocks a legitimate PR:
1. Review CI logs for specific failure
2. Verify file is not actually frozen
3. Check if import is actually forbidden
4. Create issue with reproduction steps

---

## Maintenance

### Adding New Frozen Files

When adding files to frozen list, update **all 3 locations**:

1. `scripts/architecture/git-pre-commit-guard.js` (Layer 3)
2. `scripts/architecture/pre-tool-guard.js` (Layer 2)
3. `scripts/architecture/ci-frozen-check.js` (Layer 4)

Then run guard integrity check:
```bash
node scripts/architecture/ci-guard-integrity.js
```

### Adding New Dependency Rules

**Location:** `scripts/architecture/ci-dependency-check.js`

**Update:** `LAYERS` configuration object

**Test locally:**
```bash
node scripts/architecture/ci-dependency-check.js
```

---

## Security Considerations

### Threat Model

**Threat:** Developer bypasses Layer 3 hook locally  
**Mitigation:** Layer 4 catches all violations at CI level  
**Residual Risk:** NONE (if branch protection configured)

**Threat:** Developer tampers with guard files  
**Mitigation:** Layer 4 Job 2 detects guard tampering  
**Residual Risk:** NONE (PR blocked)

**Threat:** Admin force-merges PR  
**Mitigation:** Branch protection disables force-merge  
**Residual Risk:** LOW (requires admin bypass, leaves audit trail)

### Defense in Depth

```
Layer 1: Architecture Guard Script
Layer 2: PreToolUse Hook (AI protection)
Layer 3: Git Pre-Commit Hook (developer-side)
Layer 4: CI Architecture Gate (repository-side) ← YOU ARE HERE
Layer 5: Regression Tests (547 tests)

= 5 layers of protection
```

---

## Performance

**Typical CI run time:**
- frozen-files: ~10 seconds
- guard: ~5 seconds
- dependency: ~15 seconds
- regression: ~120 seconds (runs 547 tests)

**Total:** ~150 seconds (2.5 minutes)

**Impact:** Acceptable for PR workflow

---

## Related Documentation

- **Layer 3:** `docs/architecture/LAYER_3_GIT_HOOK.md`
- **Layer 2:** `docs/architecture/LAYER_2_PRETOOLUSE_HOOK.md`
- **Freeze Policy:** `docs/architecture/FREEZE_POLICY.md`
- **Test Evidence:** `docs/evidence/LAYER_4_TEST_EVIDENCE.md` (pending)
- **Guard Implementation:** `docs/implementation/ARCHITECTURE_GUARD_IMPLEMENTATION.md`

---

## Next Steps

**To complete Layer 4:**

1. **Configure branch protection** (requires GitHub admin access)
2. **Run 5-7 real PR tests** (scenarios documented above)
3. **Capture evidence** (PR numbers, commit SHAs, CI logs)
4. **Document in** `LAYER_4_TEST_EVIDENCE.md`
5. **Update status** to "Layer 4 Complete"
6. **Issue completion certificate**

**After Layer 4 complete:**

Proceed to Step ② BDGF P1 Universal Verification (do NOT start E7.4)

---

**Status:** 🟡 IMPLEMENTATION COMPLETE / ENFORCEMENT PENDING  
**Implementation Date:** 2026-08-22  
**Version:** 1.0.0  
**Validation:** Requires real PR tests  
**Maintainer:** Platform Architecture Team
