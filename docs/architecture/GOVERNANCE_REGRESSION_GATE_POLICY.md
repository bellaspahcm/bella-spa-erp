# Regression Gate Policy — Baseline Comparison Protocol

**Status:** CANONICAL  
**Effective Date:** 2026-09-01  
**Derived From:** P1 Overall Closure governance lessons  
**Principle:** "No Claim Without Evidence"

---

## Core Policy

### Three-State Distinction

```text
TEST RESULT       ≠       REGRESSION RESULT       ≠       GATE RESULT

Test FAIL/PASS             Pre-existing vs.               Gate PASS/FAIL
                           New failure
                                 ↓
                     Baseline comparison required
```

**Critical Rule:**

> **A failing test may yield a passing regression gate ONLY when controlled baseline comparison demonstrates that the failure is pre-existing and not introduced by the change under verification.**

---

## Known Pattern Decision Rule

**Before investigating every issue deeply, classify it first:**

### When Pattern is Known

**Criteria for "known pattern":**
1. Root cause type documented in governance docs
2. Canonical ownership rules established
3. Fix approach mechanical and documented
4. No new semantic ambiguity

**Known patterns (as of 2026-09-03):**
- Duplicate export blocks (mechanical removal)
- Vocabulary/schema mismatch with DB enum as canonical
- Import path errors with clear module boundaries

**Action:**
- Apply minimal fix directly
- Run mandatory gates
- If gates PASS → commit
- If new ambiguity appears → STOP immediately

### When Pattern is New or Ambiguous

**Indicators of new/ambiguous pattern:**
- Canonical ownership unclear
- Semantic mapping uncertain
- Cross-Kernel boundary implications unknown
- Schema/contract change semantics undefined

**Action:**
- STOP coding
- Gather evidence
- Document findings
- Determine ownership
- Only then proceed

### Field Test Evidence

**Real-Estate remediation (commit `6e5926ac`):**
- Pattern: vocabulary/schema mismatch (documented in prior investigations)
- Evidence: migration `20260802100000` line 114 shows `completed → handed_over` mapping
- Canonical: DB enum confirmed authoritative
- Fix: align Platform Kernel to DB vocabulary
- Gates: TypeCheck PASS, Regression ALLOW (0 new), Architecture PASS, Tests 4/5 PASS
- Result: 3 → 0 diagnostics in ~30 minutes

**Key principle:** Investigation effort invested once per pattern type, reused thereafter.

This is NOT about skipping investigation. It's about:
- Not repeating investigation for same pattern type
- Documenting patterns for reuse
- Stopping immediately when new ambiguity appears

---

## Regression Gate Assessment Protocol

### When a Test Fails

**DO NOT immediately conclude:**
- ❌ "Test failed → regression detected"
- ❌ "Test failed → gate failed"
- ❌ "Test failed → changes must be reverted"

**INSTEAD, execute baseline comparison:**

```bash
# 1. Record current test failure
git status  # Note current commit
npm test -- <failing-test>
# Record: failure pattern, count, error messages

# 2. Checkout baseline (commit BEFORE changes)
git checkout <commit-before-changes>
npm test -- <failing-test>
# Record: failure pattern, count, error messages

# 3. Compare results
if [baseline FAIL == current FAIL]; then
  Classification: PRE-EXISTING
  Regression: NONE
  Gate: PASS (by non-regression)
else
  Classification: NEW FAILURE
  Regression: DETECTED
  Gate: FAIL
fi
```

---

## Evidence Requirements

### Minimum Evidence for Gate PASS (when test fails)

1. **Baseline test execution output** (full output or summary)
2. **Current test execution output** (full output or summary)
3. **Failure pattern comparison**
   - Failure count: baseline vs. current
   - Error messages: baseline vs. current
   - Test names: baseline vs. current
4. **Classification rationale**
   - Why failure is pre-existing
   - Evidence that changes did not introduce failure
5. **Git commit references**
   - Baseline commit SHA
   - Current commit SHA
   - Change commits between baseline and current

### Insufficient Evidence

❌ "Test probably failed before"  
❌ "Test is flaky anyway"  
❌ "Test failure is unrelated (by inspection)"  
❌ "Changes are small so couldn't cause failure"

**None of these constitute baseline comparison evidence.**

---

## Status Reporting

### Correct Status Reporting

When reporting regression gate status with failing tests:

✅ **CORRECT:**
```text
Runtime Regression Gate: ✅ PASS (by non-regression classification)
Test Execution Status: ⚠️ Healthcare FAIL (15/15)
Baseline Comparison: ✅ SAME FAILURE (pre-existing)
P1-Introduced Failures: ✅ NONE
```

❌ **INCORRECT:**
```text
Runtime Regression: ✅ PASS
Healthcare Tests: ✅ PASS
```

### Three-State Status Table

| Component | Test Result | Baseline | Regression | Gate |
|-----------|-------------|----------|------------|------|
| Healthcare | ⚠️ FAIL (15/15) | ✅ SAME | ✅ NONE | ✅ PASS |
| Finance | ✅ PASS | N/A | ✅ NONE | ✅ PASS |
| Runtime | ✅ PASS | N/A | ✅ NONE | ✅ PASS |

**Legend:**
- **Test Result:** Actual test execution outcome
- **Baseline:** Comparison with pre-change baseline
- **Regression:** Whether change introduced new failures
- **Gate:** Overall regression gate status

---

## Gate Pass Conditions

### Condition 1: All Tests Pass

```text
All targeted tests execute successfully
    ↓
No failures to classify
    ↓
Gate: PASS (by clean execution)
```

### Condition 2: Tests Fail but Pre-Existing

```text
Tests fail
    ↓
Baseline comparison executed
    ↓
Failures identical at baseline
    ↓
No new failures introduced
    ↓
Gate: PASS (by non-regression classification)
```

### Condition 3: Tests Fail with New Failures

```text
Tests fail
    ↓
Baseline comparison executed
    ↓
New failures detected vs. baseline
    ↓
Change introduced regression
    ↓
Gate: FAIL
```

---

## P1 Application Example

### P1 Healthcare Test Scenario

**Test:** `src/platform/healthcare/__tests__/cross-engine-integration.test.ts`

**Current Result:**
```bash
npm test -- src/platform/healthcare/__tests__/cross-engine-integration.test.ts --runInBand
# ⚠️ FAIL: 15 failed, 0 passed
# Error: Cannot read properties of undefined (reading 'cleanup')
```

**Baseline Verification:**
```bash
git checkout a060fccd  # Commit BEFORE P1 Healthcare fix
npm test -- src/platform/healthcare/__tests__/cross-engine-integration.test.ts --runInBand
# ⚠️ FAIL: 15 failed, 0 passed
# Error: Cannot read properties of undefined (reading 'cleanup')
```

**Comparison:**
- Baseline failures: 15/15
- Current failures: 15/15
- Error pattern: Identical
- Root cause: Database fixture setup (not P1 circular dependency fix)

**Classification:** PRE-EXISTING  
**Regression:** NONE  
**Gate:** ✅ PASS (by non-regression classification)

**Evidence Quality:** HIGH
- Full baseline execution performed
- Identical failure pattern confirmed
- Git commits referenced
- Root cause analyzed

---

## Anti-Patterns

### Anti-Pattern 1: Claiming "All Tests Pass" When They Don't

❌ **WRONG:**
```markdown
## Runtime Regression

✅ Healthcare: PASS
✅ Finance: PASS
✅ Runtime/Security: PASS
```

When Healthcare actually fails (even if pre-existing).

✅ **CORRECT:**
```markdown
## Runtime Regression Gate

| Component | Test Status | Baseline | Gate |
|-----------|-------------|----------|------|
| Healthcare | ⚠️ FAIL (pre-existing) | ✅ SAME | ✅ PASS |
| Finance | ✅ PASS | N/A | ✅ PASS |
| Runtime/Security | ✅ PASS | N/A | ✅ PASS |

Gate: ✅ PASS (no new regressions introduced)
```

### Anti-Pattern 2: Skipping Baseline Comparison

❌ **WRONG:**
```text
Test failed but looks unrelated to my changes.
Gate: PASS
```

Without baseline comparison evidence.

✅ **CORRECT:**
```text
Test failed.
Baseline comparison: SAME FAILURE.
Evidence: <baseline output vs. current output>
Gate: PASS (by non-regression classification)
```

### Anti-Pattern 3: Baseline Comparison Without Evidence

❌ **WRONG:**
```text
I checked the baseline and it also fails.
Gate: PASS
```

Without showing actual baseline execution output.

✅ **CORRECT:**
```bash
# Baseline execution
git checkout <SHA>
npm test -- <test>
# Output: [actual output captured]

# Current execution  
git checkout <current>
npm test -- <test>
# Output: [actual output captured]

# Comparison: [detailed comparison]
Gate: PASS (evidence: baseline identical)
```

---

## Policy Scope

### Applies To

- ✅ Runtime regression testing
- ✅ Integration testing
- ✅ End-to-end testing
- ✅ Any test suite used as gate for code changes
- ✅ All incident closure workflows (P0, P1, P2)

### Does NOT Apply To

- ❌ Exploratory testing (no baseline)
- ❌ New test development (no baseline)
- ❌ Test fixture debugging (not a gate)

---

## Governance Integration

### With Incident Closure

When closing an incident (P0/P1/P2):

**Required Evidence:**
1. Compiler verification (if applicable)
2. **Runtime regression gate with baseline comparison** (if tests exist)
3. Commit provenance
4. Architecture Guard status (if applicable)

**Closure Criteria:**
- Incident root cause resolved: ✅
- Compiler verification: ✅ PASS
- **Runtime regression gate: ✅ PASS** (may include pre-existing test failures)
- Evidence documented: ✅ COMPLETE

**NOT Required:**
- ❌ All tests passing (pre-existing failures acceptable with evidence)
- ❌ All Architecture Guard violations fixed
- ❌ All technical debt resolved

### With Architecture Guard

**Architecture Guard violations do NOT block regression gate** unless:
- Violation directly causes test failure
- Violation introduces runtime regression
- Violation is proven cause of incident

**Typical case:**
```text
Architecture Guard: ⚠️ 5 violations
Runtime Regression Gate: ✅ PASS
Relationship: INDEPENDENT

Guard violations → separate governance workstream
Gate pass → incident closure proceeds
```

---

## Exceptions

### When Baseline Comparison Not Required

**Case 1: All tests pass**
- No failures to classify
- Baseline comparison unnecessary
- Gate: PASS (by clean execution)

**Case 2: No tests exist**
- Nothing to execute
- Baseline comparison N/A
- Gate: PASS (compiler verification sufficient)

**Case 3: Tests newly added with changes**
- No baseline to compare against
- Use different verification strategy
- Document rationale

### When Baseline Comparison Required

**Any scenario where:**
- Test exists before changes
- Test fails after changes
- Need to determine if failure is new

**No exceptions.** Must execute baseline comparison.

---

## Policy Enforcement

### Before Incident Closure

**Checklist:**
- [ ] Runtime tests executed (if applicable)
- [ ] Test failures classified (if any)
- [ ] Baseline comparison performed (if test failed)
- [ ] Evidence documented with git commits
- [ ] Regression gate status determined
- [ ] Three-state status reported (test/baseline/gate)

### Review Criteria

Evidence reviewers MUST verify:
1. Baseline comparison executed (not just claimed)
2. Git commits referenced for baseline and current
3. Failure patterns compared in detail
4. Classification rationale provided
5. No "all tests PASS" claim when tests actually fail

---

## Canonical Example: P1 Overall Closure

See: `docs/architecture/P1_OVERALL_CLOSURE.md`

**Summary:**
- Healthcare test: ⚠️ FAIL (15/15)
- Baseline: ⚠️ FAIL (15/15, identical)
- Regression: ✅ NONE
- Gate: ✅ PASS (by non-regression classification)
- P1: ✅ CLOSED (with evidence integrity)

**Key Lesson:**

> **P1 closed successfully despite failing tests because baseline comparison proved failures were pre-existing, not P1-introduced.**

This is governance with evidence integrity, not dashboard decoration.

---

## Policy Rationale

### Why This Policy Exists

1. **Prevent false evidence** — Don't claim "tests pass" when they fail
2. **Enable valid closures** — Don't block closure on pre-existing failures
3. **Require real evidence** — Baseline comparison, not speculation
4. **Separate concerns** — Test result ≠ regression result ≠ gate result
5. **Support Bella principle** — "No Claim Without Evidence"

### What This Policy Prevents

❌ Claiming test success when tests fail  
❌ Blocking closure on pre-existing technical debt  
❌ Speculation about failure provenance  
❌ Regression gate based on inspection, not evidence  
❌ Mixing test status with gate status  

### What This Policy Enables

✅ Valid incident closure with pre-existing test failures  
✅ Evidence-based regression classification  
✅ Clear separation: test vs. baseline vs. gate  
✅ Baseline comparison as mandatory protocol  
✅ Governance with integrity, not cosmetic GREEN  

---

**Policy Status:** CANONICAL  
**Effective Immediately:** All incident closures must follow this protocol  
**Reference Implementation:** P1 Overall Closure (2026-09-01)  
**Next Review:** After 3 incident closures using this 
policy

---

**Bella Principle Applied:**

> **"Close when verified, not when perfect."**
>
> Verified = baseline comparison proves no new regression.
>
> Perfect = all tests GREEN (not required for closure).

