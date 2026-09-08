# Factory Rules Registration into G0-G5 Gates

**Status:** 🟡 IN PROGRESS  
**Phase:** Rules Mapping → G0-G5  
**Date:** 2026-09-08  
**Source Evidence:** Dental Typecheck Remediation (healthcare-actions.ts, 69 → 0 diagnostics)

---

## Purpose

Register 10 Factory Rules extracted from Dental field evidence into existing G0-G5 gate framework. These rules **protect against TypeScript type system violations** during Product/Kernel manufacturing.

**NOT:** New gate creation  
**YES:** Strengthen existing gates with proven detection patterns

---

## Factory Rules State Classification

```text
DEFINED
   ↓
EVIDENCE-VALIDATED (field incident)
   ↓
REGISTERED (mapped to gate)
   ↓
AUTOMATED (executable check)
   ↓
ADVERSARIAL TESTED (BLOCK invalid / ALLOW valid)
   ↓
PROVEN (production protection)
```

**Current state:** 10 rules = **EVIDENCE-VALIDATED** (Dental field evidence)  
**Target state:** 10 rules = **PROVEN** (automated + adversarial tested)

---

## 10 Factory Rules — Evidence-Validated

### Rule 1: Canonical Data Source Guard

**Definition:**  
When resolving nullability/optional field diagnostics, identify **canonical data source** (upstream producer) before adding guards. Do not guard at call site if source can be fixed.

**Field Evidence (Dental):**
- **Incident:** `defaultDoctorId` used at 21 call sites, all with `!` assertion or optional chaining
- **Root Cause:** `doctorPartyMap.get()` returns `string | undefined` (Map API)
- **Fix:** Guard at source `if (!defaultDoctorId) throw new Error('Required')`
- **Result:** 21 diagnostics → 19 diagnostics (-2), cascade eliminated

**Root Pattern:**
```text
Symptom: Type 'T | undefined' not assignable to 'T' (×21 occurrences)
         ↓
Investigation: Where does T | undefined originate?
         ↓
Source: Map.get() API contract
         ↓
Decision: Guard at source (domain requirement)
         ↓
Result: Cascade eliminated without per-call-site patches
```

**Gate Mapping:** → **G3 Verification** (Type Correctness sub-gate)

---

### Rule 2: Schema ↔ Generated Type Drift Guard

**Definition:**  
When diagnostic shows `Type 'FieldA' is not assignable to type 'never'`, suspect **schema-type mismatch** (camelCase vs snake_case, field not in schema). Check `database.types.ts` against DB schema before inventing fields.

**Field Evidence (Dental):**
- **Incident:** `tubeColor: input.tubeColor` → `Type 'string' not assignable to 'never'`
- **Root Cause:** Insert type expects `tube_color` (snake_case), code used `tubeColor` (camelCase)
- **Fix:** Change property name to match schema: `tube_color: input.tubeColor`
- **Result:** 14 → 13 diagnostics (-1)

**Root Pattern:**
```text
Symptom: Type 'T' not assignable to 'never'
         ↓
Investigation: Why is canonical field 'never'?
         ↓
Source: Property name mismatch (schema uses snake_case)
         ↓
Decision: Fix property name, not cast/suppress
         ↓
Result: Schema contract respected
```

**Gate Mapping:** → **G2 Architecture/Contract Compliance** (Schema Contract sub-gate)

---

### Rule 3: DB Row → Domain Model Boundary Guard

**Definition:**  
When converting DB row (snake_case, nullable, Json type) to domain model (camelCase, required, typed), establish **explicit mapper boundary** with type guards. Do not index Json without runtime check.

**Field Evidence (Dental):**
- **Incident:** `drugsList[0]` where `drugsList: Json` → implicit any
- **Root Cause:** Json union type doesn't allow direct indexing
- **Fix:** `Array.isArray(drugsList) && drugsList[0]` then cast to `Record<string, unknown>`
- **Result:** Json indexing made explicit with runtime validation

**Root Pattern:**
```text
Symptom: Json type indexed without guard → implicit any
         ↓
Investigation: What is canonical type of drugsList?
         ↓
Source: DB column type 'Json' (union, not indexable)
         ↓
Decision: Runtime type guard before access
         ↓
Result: Type safety + null safety
```

**Gate Mapping:** → **G3 Verification** (Boundary Integrity sub-gate)

---

### Rule 4: Explicit Mapper Contract Guard

**Definition:**  
When mapping DB row to ViewModel/DTO, all required output fields must be **explicitly present** in mapper. Do not rely on spread operator or implicit defaults for required fields.

**Field Evidence (Dental):**
- **Incident:** `encounter` object missing `encounter_type` and `period_start` fields
- **Root Cause:** Schema requires these fields (lines 12936, 12945 in database.types.ts)
- **Fix:** Add explicit fields: `encounter_type: 'outpatient'`, `period_start: new Date().toISOString()`
- **Result:** Contract rejection prevented

**Root Pattern:**
```text
Symptom: Property 'X' missing in type 'T'
         ↓
Investigation: What does canonical Insert type require?
         ↓
Source: Generated type from schema
         ↓
Decision: Add all required fields explicitly
         ↓
Result: Complete contract fulfillment
```

**Gate Mapping:** → **G2 Architecture/Contract Compliance** (Contract Completeness sub-gate)

---

### Rule 5: Semantic Field Substitution Guard

**Definition:**  
When fixing literal union mismatch (`'signed' not assignable to 'released' | 'reading'`), change **data source** to match contract, not schema to match data. Enum/union is canonical.

**Field Evidence (Dental):**
- **Incident:** Demo data used `'signed'` but contract expects `'released' | 'reading'`
- **Root Cause:** Demo data doesn't respect contract union
- **Fix:** Change data: `'signed'` → `'released'`
- **Result:** Contract alignment without schema weakening

**Root Pattern:**
```text
Symptom: Literal 'X' not assignable to union 'A' | 'B'
         ↓
Investigation: Is 'X' valid business value or demo artifact?
         ↓
Source: Demo data violating contract
         ↓
Decision: Fix data, not contract (contract = canonical)
         ↓
Result: Contract integrity preserved
```

**Gate Mapping:** → **G2 Architecture/Contract Compliance** (Literal Union Integrity sub-gate)

---

### Rule 6: Literal Union Preservation Guard

**Definition:**  
Do not widen literal union types to `string` or add `| undefined` to fix type errors. If union mismatch occurs, **investigate semantic gap** before changing type.

**Field Evidence (Dental):**
- **Incident:** `radiologistReport: undefined` where type is `string | null`
- **Root Cause:** Using `undefined` instead of `null`
- **Fix:** Change to `radiologistReport: null` (exact contract type)
- **Result:** Semantic precision maintained

**Root Pattern:**
```text
Symptom: Type 'undefined' not assignable to 'string | null'
         ↓
Investigation: What is canonical nullable representation?
         ↓
Source: Interface specifies 'null' (not undefined)
         ↓
Decision: Use exact type, no widening
         ↓
Result: Type precision preserved
```

**Gate Mapping:** → **G3 Verification** (Type Precision sub-gate)

---

### Rule 7: Diagnostic Inventory Reconciliation Guard

**Definition:**  
Before claiming "Cluster X closed", **reconcile current diagnostic inventory** with claimed reductions. Do not count diagnostics from other files unless explicitly scoped.

**Field Evidence (Dental):**
- **Incident:** Compiler output showed 12 errors but 11 claimed (pharmacy-actions.ts mixed in)
- **Root Cause:** Multiple files in same scope, denominator changed mid-stream
- **Fix:** Scope = `healthcare-actions.ts` only, freeze denominator
- **Result:** 69 → 0 for scoped file, 4 in pharmacy-actions.ts tracked separately

**Root Pattern:**
```text
Symptom: Diagnostic count mismatch
         ↓
Investigation: Which files are in scope?
         ↓
Source: Multiple files in compiler output
         ↓
Decision: Fix scope boundary, count only target file
         ↓
Result: Accurate denominator
```

**Gate Mapping:** → **G4 Evidence** (Measurement Integrity sub-gate)

---

### Rule 8: Diagnostic Identity Bijection Guard

**Definition:**  
Each diagnostic has **unique identity** (error code + line + character). When diagnostic "doesn't decrease", verify whether it was **resolved and replaced** by next contract violation, not "stuck".

**Field Evidence (Dental):**
- **Incident:** Error 2299 "didn't decrease" after fix
- **Root Cause:** Fixing `customer_id` exposed next violation (`encounter_type` missing)
- **Fix:** Both fixes required, cascading contract violations
- **Result:** 12 → 11 (not stuck, sequential revelation)

**Root Pattern:**
```text
Symptom: Same error code at same location after fix
         ↓
Investigation: Did original issue resolve?
         ↓
Source: Cascade — fix revealed next contract gap
         ↓
Decision: Fix both, not assume "stuck"
         ↓
Result: Sequential contract fulfillment
```

**Gate Mapping:** → **G4 Evidence** (Diagnostic Classification sub-gate)

---

### Rule 9: Cluster Closure Integrity Guard

**Definition:**  
Do not declare "Cluster X closed" until **all diagnostics of that semantic type** are resolved. Do not reclassify remaining diagnostics to force closure.

**Field Evidence (Dental):**
- **Incident:** Error 1898 initially classified as C3 (string nullability)
- **Root Cause:** Actually C7 (schema property mismatch: `tubeColor` vs `tube_color`)
- **Fix:** Reclassify to correct cluster, resolve via schema alignment
- **Result:** Honest cluster accounting, no premature closure

**Root Pattern:**
```text
Symptom: Cluster seems "almost closed"
         ↓
Investigation: Do remaining diagnostics match cluster semantics?
         ↓
Source: Misclassification due to surface symptom
         ↓
Decision: Reclassify honestly, resolve in correct cluster
         ↓
Result: Clean cluster closure
```

**Gate Mapping:** → **G4 Evidence** (Cluster Integrity sub-gate)

---

### Rule 10: Repeated Root-Cause Occurrence Guard

**Definition:**  
When same root cause appears at **N > 3 locations**, do **scope-wide search** before closing remediation. Do not fix occurrence-by-occurrence without pattern search.

**Field Evidence (Dental):**
- **Incident:** `party?.id` → `string | undefined` at 4+ locations
- **Root Cause:** Required identifier pattern repeated across multiple functions
- **Fix:** Guard pattern applied to `createLabOrderAction`, `createImagingOrderAction`, etc.
- **Result:** Pattern-based remediation, not per-occurrence patches

**Root Pattern:**
```text
Symptom: Same type error at multiple locations
         ↓
Investigation: Is this a repeated pattern?
         ↓
Source: Common upstream producer (party resolution)
         ↓
Decision: Scope-wide search + systematic fix
         ↓
Result: Complete pattern coverage
```

**Gate Mapping:** → **G3 Verification** (Pattern Completeness sub-gate)

---

## Gate Mapping Summary

```text
G0: (No TypeScript rules — Architecture Guard boundary enforcement only)

G1: Definition & Boundary
    (No TypeScript rules — Product scope definition)

G2: Architecture / Contract Compliance
    ├─ Rule 2: Schema ↔ Generated Type Drift Guard
    ├─ Rule 4: Explicit Mapper Contract Guard
    ├─ Rule 5: Semantic Field Substitution Guard
    └─ Rule 6: Literal Union Preservation Guard

G3: Verification
    ├─ Rule 1: Canonical Data Source Guard
    ├─ Rule 3: DB Row → Domain Model Boundary Guard
    ├─ Rule 6: Type Precision sub-gate
    └─ Rule 10: Repeated Root-Cause Occurrence Guard

G4: Evidence
    ├─ Rule 7: Diagnostic Inventory Reconciliation Guard
    ├─ Rule 8: Diagnostic Identity Bijection Guard
    └─ Rule 9: Cluster Closure Integrity Guard

G5: Human Qualification
    (Uses G2-G4 evidence, no automated TypeScript rules)
```

**Pattern:**
- G2 = Contract/Schema compliance (4 rules)
- G3 = Type correctness execution (4 rules)
- G4 = Evidence integrity (3 rules)

---

## Next Steps

### Phase 1: ✅ COMPLETE
- [x] Define 10 rules with field evidence
- [x] Map rules into G0-G5 gates
- [x] Document root patterns

### Phase 2: ✅ COMPLETE — Rule Automation
- [x] G2 validators (2/4 rules automated: R2, R4)
- [x] G3 detectors (1/4 rules automated: R10)
- [x] G4 reconciliation (1/3 rules automated: R7)
- [x] Register into existing gate execution pipeline
- [x] Command: `npm run governance:factory-rules`

**Automated (4/10):**
- ✅ R2: Schema ↔ Type Drift Guard (G2) — automated
- ✅ R4: Explicit Mapper Contract Guard (G2) — automated
- ✅ R7: Diagnostic Inventory Reconciliation Guard (G4) — automated + field-tested
- ✅ R10: Repeated Root-Cause Occurrence Guard (G3) — automated

**Deferred (6/10):** R1, R3, R5, R6, R8, R9 — automation deferred pending more field evidence

### Phase 3: 🟡 PLANNED — Adversarial Testing
- [ ] Create test fixtures (BLOCK + ALLOW scenarios)
- [ ] Create test runner
- [ ] Execute adversarial tests per rule
- [ ] Measure false positive/negative rates
- [ ] Document edge cases
- [ ] **Plan:** `docs/architecture/FACTORY_RULES_ADVERSARIAL_TESTING.md` created

### Phase 4: ⏸️ BLOCKED — Mark PROVEN
- [ ] Rules automated ✓
- [ ] Adversarial tests ✓
- [ ] Production field validation ✓
- [ ] Mark rules PROVEN in registry

---

## Rules State Matrix

| Rule | State | Gate | Automation | Adversarial | Proven |
|------|-------|------|------------|-------------|--------|
| R1: Canonical Data Source Guard | 🟡 EVIDENCE-VALIDATED | G3 | ❌ | ❌ | ❌ |
| R2: Schema ↔ Type Drift Guard | 🟡 EVIDENCE-VALIDATED | G2 | ❌ | ❌ | ❌ |
| R3: DB Row → Domain Boundary Guard | 🟡 EVIDENCE-VALIDATED | G3 | ❌ | ❌ | ❌ |
| R4: Explicit Mapper Contract Guard | 🟡 EVIDENCE-VALIDATED | G2 | ❌ | ❌ | ❌ |
| R5: Semantic Field Substitution Guard | 🟡 EVIDENCE-VALIDATED | G2 | ❌ | ❌ | ❌ |
| R6: Literal Union Preservation Guard | 🟡 EVIDENCE-VALIDATED | G2/G3 | ❌ | ❌ | ❌ |
| R7: Diagnostic Inventory Reconciliation Guard | 🟡 EVIDENCE-VALIDATED | G4 | ❌ | ❌ | ❌ |
| R8: Diagnostic Identity Bijection Guard | 🟡 EVIDENCE-VALIDATED | G4 | ❌ | ❌ | ❌ |
| R9: Cluster Closure Integrity Guard | 🟡 EVIDENCE-VALIDATED | G4 | ❌ | ❌ | ❌ |
| R10: Repeated Root-Cause Occurrence Guard | 🟡 EVIDENCE-VALIDATED | G3 | ❌ | ❌ | ❌ |

**Summary:**
- 10/10 rules: EVIDENCE-VALIDATED ✅
- 4/10 rules: AUTOMATED ✅ (R2, R4, R7, R10)
- 0/10 rules: ADVERSARIAL TESTED ❌
- 0/10 rules: PROVEN ❌

**Automated Rules:**
- ✅ Rule 2: Schema ↔ Type Drift Guard (G2) — `g2-rule2-schema-type-drift.ts`
- ✅ Rule 4: Explicit Mapper Contract Guard (G2) — `g2-rule4-mapper-contract.ts`
- ✅ Rule 7: Diagnostic Inventory Reconciliation Guard (G4) — `g4-rule7-diagnostic-inventory.ts`
- ✅ Rule 10: Repeated Root-Cause Occurrence Guard (G3) — `g3-rule10-repeated-root-cause.ts`

**Orchestrator:** `scripts/governance/factory-rules-gate.ts`  
**Command:** `npm run governance:factory-rules [--config=...] [--scope=...]`

**Field-tested:**
- ✅ Rule 7 correctly detects out-of-scope files (pharmacy-actions.ts violation detected)

---

## Forbidden Techniques (Anti-Patterns)

These techniques were **explicitly rejected** during Dental remediation and should be blocked by Factory Rules:

1. ❌ `as any` / `as unknown as Type` — Type escape hatch
2. ❌ `@ts-ignore` / `@ts-expect-error` — Compiler suppression
3. ❌ Non-null assertion `!` to silence compiler (acceptable only after guard)
4. ❌ Fake defaults without business semantics (`?? 0` without evidence)
5. ❌ Schema field inventions (adding fields not in schema)
6. ❌ Type widening to `string` / `any` / `unknown` to force compatibility
7. ❌ Mass-replace without root cause investigation
8. ❌ Cluster reclassification to force closure

**Detection Strategy:**
- Static analysis (AST patterns)
- Git diff review (new `as any` occurrences)
- Diagnostic delta analysis (suppression vs resolution)

---

## Remediation Methodology (Field-Proven)

```text
Diagnostic
    ↓
Exact expression causing error
    ↓
Upstream producer / canonical source
    ↓
Canonical contract (schema, interface, API)
    ↓
Business semantics (required? nullable? default?)
    ↓
Targeted fix (guard, map, contract fix)
    ↓
Compiler verify (diagnostic eliminated or explained)
```

**Key Principle:** Fix root cause, not symptom. Each fix must have business justification.

---

## Success Criteria

### Rule Registration = COMPLETE when:
- [x] All 10 rules mapped to G2/G3/G4 gates
- [x] Field evidence documented per rule
- [x] Root patterns extracted
- [x] Anti-patterns identified

### Rule = AUTOMATED when:
- [ ] Executable check implemented
- [ ] Integrated into gate execution pipeline
- [ ] Exit code semantics defined (0 = PASS, 2 = BLOCK)

### Rule = PROVEN when:
- [ ] Automated ✓
- [ ] Adversarial tested (BLOCK + ALLOW scenarios) ✓
- [ ] Production field validation ✓
- [ ] False positive rate < 5% measured

---

**Document Status:** Phase 1 COMPLETE  
**Next Phase:** Rule Automation (G2-G4 implementation)  
**Blocked:** None  
**Last Updated:** 2026-09-08

