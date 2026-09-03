# P1 Runtime Regression Verification Plan

**Date:** 2026-09-01  
**Status:** ⏸️ PENDING EXECUTION  
**Purpose:** Verify P1 commits do not break runtime behavior  

---

## Executive Summary

P1 Compiler Investigation delivered 5 atomic commits. Before closing P1 Overall, must verify runtime semantics remain correct.

**Critical Principle:** Compiler PASS ≠ Runtime correct

Must test actual runtime behavior of changed code, not just type safety.

---

## P1 Commits to Verify

| Commit | Scope | Risk Level | Verification Required |
|--------|-------|------------|----------------------|
| `a060fccd` | Runtime/Security RLS | MEDIUM | RLS policy execution |
| `4fcc0294` | Healthcare order-engine | HIGH | Order creation/workflow |
| `5cbe2d1a` | Healthcare Guard | LOW | Guard execution only |
| `6d32a9a5` | Documentation | NONE | No runtime impact |
| `4e64b17c` | Lockfile | LOW | Dependency integrity |

---

## Verification Strategy

### Principle

Test **only changed functionality**, not full regression suite.

**Scope:**
- Healthcare order-engine (circular dependency fix)
- Runtime/Security RLS (command union fix)
- Finance (source remediation from earlier)

**NOT in scope:**
- Full test suite (would take hours)
- Unrelated features
- Migration governance (separate workstream)

### Targeted Test Selection

```
P1 changes
    ↓
Identify affected code paths
    ↓
Select relevant existing tests
    ↓
Execute targeted suite
    ↓
Evidence
```

---

## Healthcare Verification

### Changes Made

**File:** `src/platform/healthcare/engines/order-engine/events/order-events.ts`

**Change:**
- Removed: `import type { ClinicalOrder } from '../domain/clinical-order.entity'`
- Added: Import `OrderDetails` types directly from contracts
- Changed: `ClinicalOrder['orderDetails']` → `OrderDetails`

**Risk:** Type change could affect event construction/serialization

### Tests to Run

**Targeted:**
```bash
# Order engine integration tests
jest src/platform/healthcare/__tests__/cross-engine-integration.test.ts --runInBand

# Healthcare platform bootstrap
jest src/platform/healthcare/__tests__/healthcare-platform.bootstrap.test.ts --runInBand

# Order-specific tests (if exist)
jest src/platform/healthcare/engines/order-engine/**/*.test.ts --runInBand
```

**Expected:** All PASS (no behavior change intended)

### Success Criteria

✅ Order creation works  
✅ Order events construct correctly  
✅ Event bus integration intact  
✅ No type errors at runtime  

---

## Runtime/Security Verification

### Changes Made

**File:** `src/platform/migration-governance/types/rls-policy.types.ts`

**Change:**
- Added: `'ALL'` to RLS command union
- Before: `'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'`
- After: `'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'`

**Risk:** LOW (additive change, existing code unaffected)

### Tests to Run

**Targeted:**
```bash
# RLS verification tests
jest src/platform/migration-governance/**/*.test.ts --runInBand

# Migration governance if exists
jest src/__tests__/migration-governance*.test.ts --runInBand
```

**Expected:** All PASS (no existing code uses 'ALL', this enables future use)

### Success Criteria

✅ RLS policy types compile  
✅ Verification engine works  
✅ No regression in existing policies  

---

## Finance Verification

### Changes Made

**File:** `src/platform/finance/services/accounting.service.ts`

**Change:**
- Schema alignment (code/debit/credit canonical names)
- Earlier commit: `e764b030`

**Risk:** MEDIUM (schema-dependent, but already committed and compiler-verified)

### Tests to Run

**Targeted:**
```bash
# Finance integration tests
jest src/__tests__/finance*.test.ts --runInBand

# Accounting-specific
jest src/__tests__/accounting*.test.ts --runInBand
```

**Expected:** All PASS (already remediated)

### Success Criteria

✅ Accounting operations work  
✅ Ledger entries correct  
✅ Schema alignment verified  

---

## Execution Plan

### Step 1: Environment Setup

```bash
# Ensure clean build
npm run build

# Verify no compilation errors
npx tsc --noEmit

# Database state (if needed)
# NOT required for P1 - use existing test DB
```

### Step 2: Targeted Test Execution

**Healthcare:**
```bash
jest src/platform/healthcare/__tests__/cross-engine-integration.test.ts --runInBand
jest src/platform/healthcare/__tests__/healthcare-platform.bootstrap.test.ts --runInBand
```

**Runtime/Security:**
```bash
jest src/platform/migration-governance/**/*.test.ts --runInBand
```

**Finance:**
```bash
jest src/__tests__/finance*.test.ts --runInBand
jest src/__tests__/accounting*.test.ts --runInBand
```

### Step 3: Evidence Collection

For each test run:
- Exit code (0 = PASS)
- Test count (passed/failed)
- Duration
- Any warnings/errors

### Step 4: Classification

**PASS:** All targeted tests pass
- Action: Document evidence
- Conclusion: Runtime verification complete
- Next: P1 Overall closure

**FAIL:** Any test fails
- Action: Investigate root cause
- Decision: Is this P1-caused or pre-existing?
- If P1-caused: Fix and re-verify
- If pre-existing: Document and defer

**BLOCKED:** Tests cannot run (missing deps, env issues)
- Action: Resolve blockers
- Fallback: Manual verification of critical paths

---

## Success Criteria (Overall)

### Required for P1 Closure

✅ Healthcare order-engine tests: PASS  
✅ Runtime/Security RLS tests: PASS (or N/A if no tests exist)  
✅ Finance accounting tests: PASS  
✅ No new runtime errors introduced  

### NOT Required for P1 Closure

❌ Full test suite PASS (not scope)  
❌ All tests PASS (pre-existing failures not P1)  
❌ 100% coverage (not P1 requirement)  
❌ Performance regression (not P1 scope)  

---

## Governance

### Evidence Standard

**Minimum required:**
- Test execution logs (exit codes)
- Pass/fail counts
- Duration
- Any errors/warnings

**NOT required:**
- Full test output (too verbose)
- Coverage reports (not P1 scope)
- Performance metrics (not P1 scope)

### Decision Framework

**If all targeted tests PASS:**
- ✅ Runtime verification: COMPLETE
- ✅ P1 changes: Verified not to break runtime
- ✅ Ready for P1 Overall closure

**If some tests FAIL:**
- Investigate: P1-caused or pre-existing?
- P1-caused: Fix and re-verify (blocking)
- Pre-existing: Document and defer (not blocking)

**If tests BLOCKED:**
- Resolve blockers
- If cannot resolve: Manual verification of critical paths
- Document limitations

---

## Risks and Mitigation

### Risk 1: Tests Don't Exist

**Likelihood:** MEDIUM  
**Impact:** Cannot automate verification  

**Mitigation:**
- Manual verification of critical paths
- Smoke test key workflows
- Document manual verification evidence

### Risk 2: Pre-existing Test Failures

**Likelihood:** HIGH  
**Impact:** Cannot distinguish P1 vs pre-existing  

**Mitigation:**
- Run tests on clean main branch first (baseline)
- Compare P1 branch results to baseline
- Only P1-introduced failures block closure

### Risk 3: Environment Issues

**Likelihood:** MEDIUM  
**Impact:** Cannot run tests  

**Mitigation:**
- Use existing test DB (don't create new)
- Skip DB-dependent tests if blocked
- Manual verification fallback

---

## Execution Timeline

**Estimated duration:** 30-60 minutes

```
Setup (5 min)
    ↓
Healthcare tests (10-15 min)
    ↓
Runtime/Security tests (5 min)
    ↓
Finance tests (10-15 min)
    ↓
Evidence collection (5 min)
    ↓
Documentation (5-10 min)
```

**Total:** ~45 minutes (with buffer)

---

## Exit Criteria

### To proceed to P1 Overall Closure

✅ Targeted regression: Executed  
✅ Healthcare: No P1-introduced failures  
✅ Runtime/Security: No P1-introduced failures  
✅ Finance: No P1-introduced failures  
✅ Evidence: Documented  

### Does NOT require

❌ All tests pass (pre-existing failures OK)  
❌ Full regression suite (not scope)  
❌ Healthcare Guard cleanup (separate workstream)  
❌ Worktree full provenance review (provisional classification sufficient)  

---

## Next Actions

1. **Execute targeted regression** (this document)
2. **Collect evidence**
3. **Document results**
4. **Decision: P1 Overall closure** (if regression PASS)

---

**Document Status:** PLAN (PENDING EXECUTION)  
**Critical Path:** YES (blocks P1 Overall closure)  
**Estimated Effort:** 45 minutes
