# Factory Rules Registration — Summary

**Date:** 2026-09-08  
**Status:** Phase 2 COMPLETE (bounded scope: 4/10 automated, 6/10 deferred intentionally)  
**Source:** Dental Typecheck Remediation (healthcare-actions.ts, 69 → 0 diagnostics)  
**Blocker:** Orchestrator timeout (180s) requires diagnosis before Phase 3

---

## Achievement Summary

```text
FACTORY RULES REGISTRATION — ORCHESTRATOR NEAR READY

Phase 1: Rules Mapping                   ✅ COMPLETE
Phase 2: Rule Automation                 ✅ COMPLETE (4/10, 6/10 deferred)
Orchestrator Diagnosis:                  ✅ COMPLETE (ENOENT isolated)
Orchestrator Stabilization:              🟡 PRECONDITIONS REMAIN (4 gates)
Phase 3: Adversarial Testing             🔒 BLOCKED (preconditions required)
Phase 4: Mark PROVEN                     🔒 BLOCKED (needs Phase 3 + field)
```

**Orchestrator Status:** 🟡 NEAR READY (3× stable, reliability verification pending)  
**Root Cause:** spawn npx ENOENT (Windows PATH) — FIX DEMONSTRATED (shell: true interim)

**Phase 3 Preconditions (4 gates):**
```text
P1 Production-grade process invocation   ⏳ REQUIRED
P2 Canonical scope wiring verification   ⏳ REQUIRED
P3 10× consecutive validation            ⏳ REQUIRED
P4 Performance SLA governance decision   ⏳ REQUIRED
                                         │
                                         ▼
Phase 3 Adversarial Proof                🔒 BLOCKED
```

**Next:** P1 (npx.cmd/direct tsx) → P2 (scope wiring) → P3 (10× validation) → P4 (SLA decision) → Phase 3

---

## What Was Built

### Documentation
1. **Factory Rules Registration** — `docs/architecture/FACTORY_RULES_REGISTRATION.md`
   - 10 rules defined with field evidence
   - Mapped to G0-G5 gates
   - Root patterns extracted from Dental incidents

2. **Adversarial Testing Plan** — `docs/architecture/FACTORY_RULES_ADVERSARIAL_TESTING.md`
   - BLOCK + ALLOW scenarios defined per rule
   - Test execution methodology
   - Success criteria (false positive < 5%, false negative = 0%)

3. **Summary Document** — `docs/architecture/FACTORY_RULES_SUMMARY.md` (this file)

### Automation (4 Rules)
1. **Rule 2: Schema ↔ Type Drift Guard (G2)**
   - Script: `scripts/governance/rules/g2-rule2-schema-type-drift.ts`
   - Detects: `Type 'X' not assignable to 'never'` (TS2322)
   - Pattern: camelCase vs snake_case property mismatches

2. **Rule 4: Explicit Mapper Contract Guard (G2)**
   - Script: `scripts/governance/rules/g2-rule4-mapper-contract.ts`
   - Detects: Missing required properties (TS2741)
   - Pattern: Incomplete mappers, missing Insert/Update fields

3. **Rule 7: Diagnostic Inventory Reconciliation Guard (G4)**
   - Script: `scripts/governance/rules/g4-rule7-diagnostic-inventory.ts`
   - Detects: Out-of-scope files, count mismatches
   - Pattern: Scope creep, denominator drift
   - **Field-tested:** ✅ Detected pharmacy-actions.ts out-of-scope

4. **Rule 10: Repeated Root-Cause Occurrence Guard (G3)**
   - Script: `scripts/governance/rules/g3-rule10-repeated-root-cause.ts`
   - Detects: Same error code at N > 3 locations
   - Pattern: Repeated type narrowing failures, systematic issues

### Orchestrator
- **Script:** `scripts/governance/factory-rules-gate.ts`
- **Command:** `npm run governance:factory-rules`
- **Options:**
  - `--config=tsconfig.json` — specify TypeScript config
  - `--scope=file.ts` — limit to specific file(s)
  - `--verbose` — show all rule output
- **Exit codes:**
  - `0` — All rules PASS
  - `2` — One or more rules BLOCK
  - `1` — Execution error

---

## Rules State Matrix

| Rule | Gate | Status | Script | Tested |
|------|------|--------|--------|--------|
| **R1: Canonical Data Source Guard** | G3 | EVIDENCE-VALIDATED | ⏸️ Deferred | ❌ |
| **R2: Schema ↔ Type Drift Guard** | G2 | ✅ AUTOMATED | `g2-rule2-schema-type-drift.ts` | ⏸️ |
| **R3: DB Row → Domain Boundary Guard** | G3 | EVIDENCE-VALIDATED | ⏸️ Deferred | ❌ |
| **R4: Explicit Mapper Contract Guard** | G2 | ✅ AUTOMATED | `g2-rule4-mapper-contract.ts` | ⏸️ |
| **R5: Semantic Field Substitution Guard** | G2 | EVIDENCE-VALIDATED | ⏸️ Deferred | ❌ |
| **R6: Literal Union Preservation Guard** | G2/G3 | EVIDENCE-VALIDATED | ⏸️ Deferred | ❌ |
| **R7: Diagnostic Inventory Reconciliation Guard** | G4 | ✅ AUTOMATED | `g4-rule7-diagnostic-inventory.ts` | 🟡 Execution |
| **R8: Diagnostic Identity Bijection Guard** | G4 | EVIDENCE-VALIDATED | ⏸️ Deferred | ❌ |
| **R9: Cluster Closure Integrity Guard** | G4 | EVIDENCE-VALIDATED | ⏸️ Deferred | ❌ |
| **R10: Repeated Root-Cause Occurrence Guard** | G3 | ✅ AUTOMATED | `g3-rule10-repeated-root-cause.ts` | ⏸️ |

**Legend:**
- ✅ AUTOMATED — Executable check implemented
- ⏸️ Deferred — Automation deferred (N=1 evidence insufficient)
- 🟡 Execution — Single field execution (not adversarial-verified)
- ⏳ Pending — Adversarial testing not yet executed

---

## Field Evidence (Dental Remediation)

### Baseline
- **File:** `src/services/healthcare/healthcare-actions.ts`
- **Initial diagnostics:** 69
- **Final diagnostics:** 0
- **Reduction:** 100%
- **Technical debt added:** 0 (no `as any`, no suppressions)
- **Duration:** ~12 hours (incremental remediation)

### Root Cause Patterns Discovered
1. **Canonical source misalignment** → 21 diagnostics cascade (R1)
2. **Schema naming mismatch** (camelCase vs snake_case) → type never (R2)
3. **Json type indexing** without runtime guard → implicit any (R3)
4. **Missing required fields** in mappers → contract rejection (R4)
5. **Literal union violations** in demo data (R5)
6. **Type widening** (`undefined` vs `null`) → precision loss (R6)
7. **Scope boundary drift** (pharmacy-actions.ts mixed in) → inventory error (R7)
8. **Cascading contract violations** → sequential revelation (R8)
9. **Misclassification** (C3 vs C7) → premature closure (R9)
10. **Repeated pattern** (`party?.id` at 4+ locations) → systematic issue (R10)

### Forbidden Techniques (0 violations)
- ❌ `as any` / `as unknown as Type`
- ❌ `@ts-ignore` / `@ts-expect-error`
- ❌ Non-null assertion `!` to silence (only after guard)
- ❌ Fake defaults without business semantics
- ❌ Schema field inventions
- ❌ Type widening to force compatibility

---

## Integration with Existing Gates

### G0: (No TypeScript rules)
- Architecture Guard boundary enforcement only

### G1: Definition & Boundary
- No TypeScript rules (Product scope definition)

### G2: Architecture / Contract Compliance
- ✅ **Rule 2:** Schema ↔ Type Drift Guard
- ✅ **Rule 4:** Explicit Mapper Contract Guard
- ⏸️ Rule 5: Semantic Field Substitution Guard (deferred)
- ⏸️ Rule 6: Literal Union Preservation Guard (deferred)

**Command:**
```bash
npm run governance:factory-rules -- --config=tsconfig.json
# Executes R2 + R4 automatically
```

### G3: Verification
- ⏸️ Rule 1: Canonical Data Source Guard (deferred)
- ⏸️ Rule 3: DB Row → Domain Boundary Guard (deferred)
- ✅ **Rule 10:** Repeated Root-Cause Occurrence Guard
- ⏸️ Rule 6: Type Precision sub-gate (deferred)

**Command:**
```bash
npm run governance:factory-rules -- --config=tsconfig.json
# Executes R10 automatically
```

### G4: Evidence
- ✅ **Rule 7:** Diagnostic Inventory Reconciliation Guard
- ⏸️ Rule 8: Diagnostic Identity Bijection Guard (deferred)
- ⏸️ Rule 9: Cluster Closure Integrity Guard (deferred)

**Command:**
```bash
npm run governance:factory-rules -- --config=tsconfig.json --scope=healthcare-actions.ts
# Executes R7 with scope validation
```

### G5: Human Qualification
- Uses G2-G4 evidence, no automated TypeScript rules

---

## Usage Examples

### Example 1: Validate Dental remediation scope
```bash
npm run governance:factory-rules -- \
  --config=tsconfig.compile-dental.json \
  --scope=healthcare-actions.ts
```

**Expected output:**
```text
G2: 2/2 rules passed
  ✓ PASS: Rule 2 (Schema Drift)
  ✓ PASS: Rule 4 (Mapper Contract)

G3: 1/1 rules passed
  ✓ PASS: Rule 10 (Repeated Pattern)

G4: 1/1 rules passed
  ✗ FAIL: Rule 7 (Inventory Reconciliation)
    Out-of-scope files detected: pharmacy-actions.ts

SUMMARY: 3/4 rules PASSED
✗ Manufacturing BLOCKED until violations resolved
```

### Example 2: Full platform typecheck
```bash
npm run governance:factory-rules -- \
  --config=tsconfig.json
```

### Example 3: Verbose output for debugging
```bash
npm run governance:factory-rules -- \
  --config=tsconfig.json \
  --verbose
```

---

## Next Steps

### Critical (before Phase 3) — Orchestrator Reliability Diagnosis
**Blocker:** Execution reliability defect (exit -1, empty output) not diagnosed

1. **Instrument child process lifecycle**
   ```typescript
   // Add to executeRuleAsync()
   child.on('spawn', () => console.log(`[${rule.name}] PID ${child.pid} spawned`));
   child.on('exit', (code, signal) => 
     console.log(`[${rule.name}] Exit code=${code} signal=${signal}`)
   );
   child.on('close', (code, signal) => 
     console.log(`[${rule.name}] Close code=${code} signal=${signal}`)
   );
   child.on('error', (err) => 
     console.log(`[${rule.name}] Error: ${err.message}`)
   );
   ```

2. **Distinguish failure modes**
   - Timeout (60s) → child killed by setTimeout
   - Child crash → exit code ≠ 0, signal present  
   - Parent kill → SIGTERM/SIGKILL
   - Empty output → stdout/stderr capture failure
   - exit -1 → Promise rejection or unhandled error

3. **Test 10× consecutive runs with logs**
   ```bash
   for i in 1..10; do
     npm run governance:factory-rules --config=tsconfig.compile-dental.json
     echo "Run $i: exit=$LASTEXITCODE"
   done
   ```

4. **Check for orphan processes**
   ```bash
   ps aux | grep tsx
   ps aux | grep "governance/rules"
   # Should be empty after run completes
   ```

5. **Test reduced parallelism (2+2 fallback)**
   ```typescript
   // If 4-way parallel has contention
   const batch1 = await Promise.all([rule1Async, rule2Async]);
   const batch2 = await Promise.all([rule3Async, rule4Async]);
   // Expected: ~22s (still < 60s target)
   ```

**Principle:** Cannot proceed to adversarial testing with unreliable gate

**Target:** 10× consecutive deterministic runs without failure

### Immediate (Phase 3) — After Pipeline Stable
1. **Create test fixtures** for adversarial scenarios
   - 3+ BLOCK scenarios per rule
   - 3+ ALLOW scenarios per rule
   - Real TypeScript code, not mocks

2. **Implement test runner**
   - Execute rules against fixtures
   - Validate exit codes (0 = PASS, 2 = BLOCK)
   - Measure false positive/negative rates

3. **Execute adversarial tests**
   ```bash
   npm run governance:adversarial-test -- --rule=rule2
   npm run governance:adversarial-test -- --rule=rule4
   npm run governance:adversarial-test -- --rule=rule7
   npm run governance:adversarial-test -- --rule=rule10
   ```

4. **Document results** per rule
   - Pass/fail rates
   - Edge cases discovered
   - Adjustments made

### Medium-term (Phase 4)
1. **Production field validation**
   - Apply rules to real Product/Kernel manufacturing
   - Measure BLOCK accuracy (true positives)
   - Measure ALLOW accuracy (false positives < 5%)

2. **Mark rules PROVEN**
   - Update registry: AUTOMATED → PROVEN
   - Document production evidence
   - Celebrate success 🎉

### Long-term (Future Phases)
1. **Automate remaining 6 rules** (R1, R3, R5, R6, R8, R9)
   - Wait for more field evidence
   - Validate patterns repeat across multiple Products
   - Do not automate unproven patterns

2. **Integrate into CI/CD**
   - Pre-commit hook (optional)
   - PR validation (mandatory for Product/Kernel changes)
   - Nightly full-platform validation

3. **Expand to other languages**
   - Python type hints
   - Java generics
   - Go interfaces

---

## Success Metrics

### Phase 2 (Current) — Automation (Bounded Scope)
- ✅ 4/10 rules automated (40%) — deliberate boundary
- ✅ 6/10 rules deferred (N=1 evidence insufficient)
- 🟡 1 execution evidence (Rule 7, not adversarial-verified)
- ✅ Orchestrator integrated into package.json
- ✅ Exit code semantics defined (0 = PASS, 2 = BLOCK)
- ⚠️ Timeout issue requires diagnosis (180s orchestrator)

### Phase 3 (Target) — Adversarial Testing (Blocked)
- **Blocker:** Orchestrator timeout must be resolved first
- Target: 24 scenarios validated (6 per rule × 4 rules)
- Target: False positive rate < 5% per rule
- Target: False negative rate = 0% per rule
- Target: 4/4 rules → ADVERSARIAL-VERIFIED state

### Phase 4 (Target) — Production Validation (Blocked)
- Target: 4/4 automated rules → PROVEN
- Target: 3+ field incidents per rule measured
- Target: 0 regressions caused by rules (ALLOW accuracy)
- Target: 100% BLOCK accuracy (no type violations escape)

---

## Governance Principle Compliance

### ✅ Do not automate unproven patterns
- 6/10 rules deferred (R1, R3, R5, R6, R8, R9)
- Waiting for more field evidence before automation
- Only Dental incidents (N=1) not sufficient for automation

### ✅ No gate proliferation
- Rules mapped into existing G2/G3/G4 gates
- No new gate layer created
- Orchestrator executes existing gates, doesn't add ceremony

### ✅ Factory assists, doesn't control
- Rules BLOCK invalid code (protection)
- Rules do NOT auto-fix (judgment remains human)
- Guidance provided, execution manual

### ✅ Evidence before claims
- All 10 rules have field evidence (Dental)
- 4 automated rules have executable checks
- 0 rules marked PROVEN without adversarial + production validation

### ✅ Demand first, supply second
- Rules extracted from real remediation pain (Dental)
- Not speculative "this might be useful"
- Automation only after pattern proven repeatable

---

## Key Takeaways

### What Worked
1. **Field evidence first** — Dental 69 → 0 provided clear patterns
2. **Incremental automation** — 4/10 rules, not all at once
3. **Honest boundaries** — 6 rules deferred (need more evidence)
4. **Real detection** — Rule 7 caught pharmacy-actions.ts out-of-scope
5. **No false claims** — Rules called AUTOMATED, not PROVEN

### What's Next
1. **Adversarial validation** — BLOCK + ALLOW scenarios
2. **False positive measurement** — Target < 5%
3. **Production field test** — Real Product/Kernel manufacturing
4. **PROVEN status** — Only after full validation chain

### Core Principle Maintained
> **Factory không học từng lỗi. Factory học cơ chế sinh ra lỗi.**

**Evidence:** 10 rules = 10 root-cause mechanisms, not 69 individual errors

---

## Document Index

1. **Factory Rules Registration** — `docs/architecture/FACTORY_RULES_REGISTRATION.md`
   - Full rule definitions
   - Field evidence per rule
   - Gate mapping
   - State matrix

2. **Adversarial Testing Plan** — `docs/architecture/FACTORY_RULES_ADVERSARIAL_TESTING.md`
   - BLOCK + ALLOW scenarios per rule
   - Test execution methodology
   - Success criteria

3. **Summary** — `docs/architecture/FACTORY_RULES_SUMMARY.md` (this document)
   - High-level status
   - Usage examples
   - Next steps

4. **Dental Remediation Evidence** — (conversation history)
   - 69 → 0 diagnostic journey
   - Root cause investigation
   - Pattern extraction

---

**Status:** ✅ Phase 2 COMPLETE  
**Next Phase:** Adversarial Testing (Phase 3)  
**Blocking:** None  
**Last Updated:** 2026-09-08

