# STEP ① ARCHITECTURE GUARD — DEFINITION OF DONE

**Priority:** 🔴 CRITICAL  
**Duration:** 1 week (5 working days)  
**Status:** IN PROGRESS

---

## 🎯 Goal

Transform architecture protection from **"documented convention"** to **"repository-enforced contract"**.

**Before:**
```
"Developer, please don't modify frozen files"
→ Relies on discipline
→ Can be bypassed
→ No machine verification
```

**After:**
```
Developer → PreToolUse → Code → Git Hook → Push → CI Gate → Merge
                ✅         ✅      ✅        ✅       ✅
        5/5 layers ACTIVE, repository-level enforcement
```

---

## 📋 Definition of Done

**DO NOT proceed to Step ② until ALL criteria met:**

### Layer Status

| Layer | Component | Status | Evidence Required |
|-------|-----------|--------|-------------------|
| 1 | Architecture Guard Script | ✅ ACTIVE | Command output captured |
| 2 | PreToolUse Hook | ✅ ACTIVE | Hook file exists + tested |
| 3 | Git Pre-Commit Hook | ⏳ PENDING | Negative test PASS |
| 4 | CI Architecture Gate | ⏳ PENDING | PR test evidence |
| 5 | Regression Tests | ✅ ACTIVE | 547/547 PASS captured |

**Target:** 5/5 layers ACTIVE

### Test Evidence

| Test | Expected | Status | Evidence |
|------|----------|--------|----------|
| Frozen file commit (local) | BLOCKED | ⏳ | Screenshot + log |
| Non-frozen file commit | ALLOWED | ⏳ | Screenshot + log |
| `git commit --no-verify` | BYPASSES local | ⏳ | Documented behavior |
| PR with frozen file change | BLOCKED BY CI | ⏳ | PR link + CI log |
| PR with forbidden import | BLOCKED BY CI | ⏳ | PR link + CI log |
| PR with architecture violation | BLOCKED BY CI | ⏳ | PR link + CI log |
| Legitimate PR | PASSES CI | ⏳ | PR link + CI log |

**Target:** All tests executed with evidence captured

### Repository Configuration

| Configuration | Status | Verified |
|---------------|--------|----------|
| Branch protection rules enabled | ⏳ | Screenshot |
| Required status checks configured | ⏳ | Screenshot |
| `frozen-files` job required | ⏳ | ✅ |
| `guard` job required | ⏳ | ✅ |
| `dependency` job required | ⏳ | ✅ |
| `regression` job required | ⏳ | ✅ |
| Direct merge blocked | ⏳ | ✅ |
| Admin bypass disabled | ⏳ | ✅ |

**Target:** Repository-level enforcement active

### Documentation

| Document | Status | Reviewed |
|----------|--------|----------|
| `FREEZE_POLICY.md` updated | ⏳ | ✅ |
| `ARCHITECTURE_GUARD_IMPLEMENTATION.md` → 5/5 | ⏳ | ✅ |
| `AGENTS.md` enforcement section | ⏳ | ✅ |
| `README.md` CI badge | ⏳ | ✅ |
| `DEVELOPER_WORKFLOW.md` created | ⏳ | ✅ |
| Layer 3 implementation doc | ⏳ | ✅ |
| Layer 4 implementation doc | ⏳ | ✅ |

**Target:** All documentation updated and reviewed

### Code Deliverables

| File | Status | Tested |
|------|--------|--------|
| `.husky/pre-commit` | ⏳ | ⏳ |
| `scripts/architecture/git-pre-commit-guard.js` | ⏳ | ⏳ |
| `.github/workflows/architecture-gate.yml` | ⏳ | ⏳ |
| `scripts/architecture/ci-frozen-check.js` | ⏳ | ⏳ |
| `scripts/architecture/ci-dependency-check.js` | ⏳ | ⏳ |
| Tests for Layer 3 | ⏳ | ⏳ |
| Tests for Layer 4 | ⏳ | ⏳ |

**Target:** All code implemented and tested

---

## 🔐 Layer 3: Git Pre-Commit Hook

**Duration:** 2 days  
**Priority:** 🔴 HIGH

### Implementation Checklist

- [ ] Install husky: `npm install --save-dev husky`
- [ ] Initialize husky: `npx husky install`
- [ ] Add install script to package.json: `"prepare": "husky install"`
- [ ] Create `.husky/pre-commit` hook file
- [ ] Create `scripts/architecture/git-pre-commit-guard.js`
- [ ] Define frozen files list (22 files)
- [ ] Implement detection logic
- [ ] Add error messaging
- [ ] Test: Commit frozen file → BLOCKED
- [ ] Test: Commit non-frozen file → ALLOWED
- [ ] Test: `--no-verify` bypass → Document behavior
- [ ] Create test suite for hook
- [ ] Document in `docs/architecture/LAYER_3_GIT_HOOK.md`
- [ ] Update `FREEZE_POLICY.md`

### Expected Behavior

**Test 1: Modify frozen file**
```bash
$ echo "// test" >> src/platform/logistics/domain/inventory.types.ts
$ git add .
$ git commit -m "test frozen file"

❌ FROZEN BOUNDARY VIOLATION

Layer: E7.1 Domain Kernel
File:  src/platform/logistics/domain/inventory.types.ts
Status: BLOCKED

Cannot commit modifications to frozen kernel files.

Required: Create ACR (Architecture Change Request)
Template: docs/architecture/templates/ACR_TEMPLATE.md

Commit blocked.
```

**Test 2: Modify non-frozen file**
```bash
$ echo "// test" >> src/products/warehouse/test.ts
$ git add .
$ git commit -m "test non-frozen file"

[feature/test abc123] test non-frozen file
 1 file changed, 1 insertion(+)
```

**Test 3: Bypass with --no-verify**
```bash
$ echo "// test" >> src/platform/logistics/domain/inventory.types.ts
$ git add .
$ git commit --no-verify -m "bypass hook"

[feature/test def456] bypass hook
 1 file changed, 1 insertion(+)
 
# ⚠️ Local hook bypassed
# ✅ CI Gate will catch this
```

### Negative Test Requirements

**CRITICAL:** Layer 3 is NOT complete until negative tests prove it blocks violations.

**Required tests:**
1. ✅ Attempt to commit each of 22 frozen files → All BLOCKED
2. ✅ Attempt to commit non-frozen file → ALLOWED
3. ✅ Test `--no-verify` → Documents that CI is required
4. ✅ Hook error messages are clear and actionable
5. ✅ Hook does not false-positive on legitimate commits

### Evidence Capture

Create: `docs/evidence/LAYER_3_TEST_EVIDENCE.md`

**Include:**
- Screenshot of blocked commit
- Terminal output logs
- Test results
- `--no-verify` behavior documented

---

## 🔐 Layer 4: CI Architecture Gate

**Duration:** 3 days  
**Priority:** 🔴 CRITICAL

### Implementation Checklist

- [ ] Create `.github/workflows/architecture-gate.yml`
- [ ] Implement Job 1: `frozen-files` check
- [ ] Implement Job 2: `guard` verification
- [ ] Implement Job 3: `dependency` check
- [ ] Implement Job 4: `regression` tests
- [ ] Create `scripts/architecture/ci-frozen-check.js`
- [ ] Create `scripts/architecture/ci-dependency-check.js`
- [ ] Configure branch protection rules
- [ ] Set required status checks
- [ ] Disable admin bypass
- [ ] Test: Create PR with frozen file → BLOCKED
- [ ] Test: Create PR with forbidden import → BLOCKED
- [ ] Test: Create PR with valid changes → PASSES
- [ ] Add CI badge to README
- [ ] Document in `docs/architecture/LAYER_4_CI_GATE.md`
- [ ] Update `FREEZE_POLICY.md`

### Workflow Structure

```yaml
name: Architecture Gate

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  frozen-files:
    name: Frozen File Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Need history for diff
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Check for frozen file modifications
        run: node scripts/architecture/ci-frozen-check.js

  guard:
    name: Architecture Guard Verification
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Run architecture guard
        run: npm run arch:guard

  dependency:
    name: Dependency Boundary Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Check forbidden imports
        run: node scripts/architecture/ci-dependency-check.js

  regression:
    name: Logistics Kernel Regression
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Run regression tests
        run: npm run logistics:verify
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Branch Protection Rules

**Settings → Branches → Branch protection rules → main**

Required configuration:
```
✅ Require a pull request before merging
✅ Require approvals: 1
✅ Dismiss stale pull request approvals when new commits are pushed
✅ Require status checks to pass before merging
    ✅ frozen-files
    ✅ guard
    ✅ dependency
    ✅ regression
✅ Require branches to be up to date before merging
✅ Do not allow bypassing the above settings
❌ Allow force pushes (disabled)
❌ Allow deletions (disabled)
```

### Test Protocol

**Test 1: PR with frozen file change**
```bash
# Create test branch
git checkout -b test/frozen-violation

# Modify frozen file
echo "// violation" >> src/platform/logistics/domain/inventory.types.ts
git add .
git commit -m "test: violate frozen boundary"
git push origin test/frozen-violation

# Create PR
# Expected: CI job "frozen-files" FAILS
# Expected: PR cannot be merged
```

**Test 2: PR with forbidden import**
```bash
# Create test branch
git checkout -b test/dependency-violation

# Add forbidden import in E7.1
echo "import { WarehouseService } from '@/products/warehouse';" >> src/platform/logistics/domain/test.ts
git add .
git commit -m "test: violate dependency boundary"
git push origin test/dependency-violation

# Create PR
# Expected: CI job "dependency" FAILS
# Expected: PR cannot be merged
```

**Test 3: Legitimate PR**
```bash
# Create test branch
git checkout -b feature/valid-change

# Add new non-frozen file
echo "// valid" > src/products/warehouse/new-feature.ts
git add .
git commit -m "feat: add warehouse feature"
git push origin feature/valid-change

# Create PR
# Expected: All CI jobs PASS
# Expected: PR can be merged
```

### Negative Test Requirements

**CRITICAL:** Layer 4 is NOT complete until negative tests prove CI blocks violations.

**Required tests:**
1. ✅ PR modifying E7.1 frozen file → BLOCKED
2. ✅ PR modifying E7.2 frozen file → BLOCKED
3. ✅ PR modifying E7.3 frozen file → BLOCKED
4. ✅ PR with E7.1 → Product import → BLOCKED
5. ✅ PR with E7.3 → Product import → BLOCKED
6. ✅ PR with architecture guard disabled → BLOCKED
7. ✅ PR with legitimate changes → PASSES
8. ✅ Cannot bypass with admin privileges → Verified

### Evidence Capture

Create: `docs/evidence/LAYER_4_TEST_EVIDENCE.md`

**Include:**
- PR links for each test
- CI job logs (success and failure)
- Screenshots of blocked PRs
- Branch protection configuration screenshot
- Evidence that `--no-verify` local bypass is caught by CI

---

## 🎯 Final Verification

**Before declaring Step ① complete:**

### Verification Checklist

- [ ] All 5 layers are ACTIVE
- [ ] All test evidence captured
- [ ] All documentation updated
- [ ] Repository configuration verified
- [ ] Team walkthrough completed
- [ ] Negative tests all PASS (blocks work as expected)

### Protection Flow Verified

```
Developer
    ↓
PreToolUse Hook (Layer 2) ← AI blocked ✅
    ↓
Code
    ↓
Git Pre-Commit (Layer 3) ← Local commit blocked ✅
    ↓
Push / PR
    ↓
CI Gate (Layer 4) ← PR merge blocked ✅
    ↓
Regression (Layer 5) ← Tests verify integrity ✅
    ↓
MERGE ALLOWED ✅
```

### Key Assertion

**Must prove:**

> "A developer OR AI cannot merge frozen file modifications into main, even with `git commit --no-verify`."

**Evidence required:**
- Local hook blocks commit ✅
- `--no-verify` bypasses local hook (documented) ✅
- CI detects violation after push ✅
- PR cannot merge (branch protection) ✅

### Sign-Off Criteria

**Step ① is COMPLETE when:**

1. ✅ 5/5 layers verified ACTIVE
2. ✅ All negative tests PASS
3. ✅ Repository enforcement proven
4. ✅ Documentation complete
5. ✅ Evidence package created
6. ✅ Team trained

**Sign-off document:** `docs/evidence/STEP_1_COMPLETION_CERTIFICATE.md`

---

## 🚫 DO NOT Proceed to Step ② Until

- [ ] All checklist items above are ✅
- [ ] Evidence package is complete
- [ ] Architecture team has reviewed
- [ ] Sign-off certificate is created

**Why this matters:**

> "Cannot bypass via `git commit --no-verify` + PR."

This is the **core value proposition** of Step ①. If CI doesn't catch violations, the repository-level enforcement is incomplete.

---

## 📊 Success Metrics

### Quantitative

- 5/5 layers ACTIVE
- 8/8 tests PASS with evidence
- 0 bypass scenarios found
- 100% frozen files protected

### Qualitative

- Architecture is repository-enforced
- Not dependent on developer discipline
- Not dependent on AI tool behavior
- Machine-verifiable boundaries

---

## 📅 Timeline

**Day 1-2: Layer 3 (Git Hook)**
- Implement hook
- Write tests
- Execute negative tests
- Capture evidence
- Document

**Day 3-5: Layer 4 (CI Gate)**
- Implement workflow
- Configure branch protection
- Create test PRs
- Execute negative tests
- Capture evidence
- Document

**Day 5: Final Verification**
- Review all evidence
- Create completion certificate
- Team walkthrough
- Sign-off

---

## 🎓 Exit Criteria

**Step ① is complete when we can confidently state:**

> "Bella's kernel architecture (E7.1, E7.2, E7.3) is protected by repository-level enforcement. No developer or AI can accidentally or intentionally merge frozen file modifications without following the ACR process. This has been proven through comprehensive negative testing."

**NOT complete when:**
- Code is written but not tested
- Tests are written but not executed
- Evidence is partial or incomplete
- CI jobs exist but branch protection is not configured
- `--no-verify` bypass scenario is not verified

---

**Status:** 🎯 READY TO EXECUTE  
**Next Action:** Begin Layer 3 implementation  
**Owner:** Development Team  
**Review:** Daily progress check  
**Completion Target:** 5 working days from start
