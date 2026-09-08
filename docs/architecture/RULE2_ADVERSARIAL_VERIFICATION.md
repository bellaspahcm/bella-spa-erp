# Rule 2: Schema ↔ Type Drift Guard — Adversarial Verification

**Date:** 2026-09-08  
**Status:** ✅ ADVERSARIAL-VERIFIED

---

## Verification Results

**6 fixtures tested, 6 correct Rule 2 verdicts (target-rule attribution):**

```text
✓ BLOCK1-camelcase:  R2=BLOCK (exit 2) — TS2561 excess property
✓ BLOCK2-missing:    R2=BLOCK (exit 2) — TS2741 missing required
✓ BLOCK3-mismatch:   R2=BLOCK (exit 2) — TS2322 type incompatibility
✓ ALLOW1-snake:      R2=ALLOW (exit 0) — correct snake_case schema
✓ ALLOW2-viewmodel:  R2=ALLOW (exit 0) — ViewModel not schema boundary
✓ ALLOW3-optional:   R2=ALLOW (exit 0) — optional field omitted
```

**Target-rule attribution:** Per-rule verdicts extracted from orchestrator, NOT aggregate verdict. Cross-rule masking eliminated.

---

## False Negative / False Positive Rates

### Definitions

**False Negative (FN):** Rule 2 ALLOWS schema drift that should BLOCK  
**False Positive (FP):** Rule 2 BLOCKS valid code that should ALLOW  
**True Positive (TP):** Rule 2 correctly BLOCKS schema drift  
**True Negative (TN):** Rule 2 correctly ALLOWS valid code

### Measurements

```text
Ground Truth BLOCK: 3 fixtures (BLOCK1/2/3)
Ground Truth ALLOW: 3 fixtures (ALLOW1/2/3)

Rule 2 Verdicts (target-rule attribution):
  TP (correct BLOCK): 3/3
  TN (correct ALLOW): 3/3
  FP (incorrect BLOCK): 0/3
  FN (incorrect ALLOW): 0/3

False Positive Rate:  FP / (FP + TN) = 0 / 3 = 0%      ✅ TARGET: <5%
False Negative Rate:  FN / (FN + TP) = 0 / 3 = 0%      ✅ TARGET: 0%
Accuracy:            (TP + TN) / Total = 6/6 = 100%    ✅
```

**Both targets met:**
- FP rate: 0% < 5% ✅
- FN rate: 0% = 0% ✅

---

## Target-Rule Attribution Method

**Problem:** When multiple rules BLOCK same fixture (e.g., BLOCK2 triggers both Rule 2 AND Rule 4), orchestrator exit code alone cannot attribute verdict to specific rule.

**Solution:** Orchestrator emits per-rule verdicts:

```text
PER-RULE VERDICTS (for adversarial metric attribution):
  [Rule 2] exitCode=2 verdict=BLOCK
  [Rule 4] exitCode=2 verdict=BLOCK
  [Rule 7] exitCode=0 verdict=ALLOW
  [Rule 10] exitCode=0 verdict=ALLOW
```

**FN/FP calculation:** Extract `[Rule 2]` verdict ONLY, ignore other rules.

**Example:** BLOCK2 fixture
- Orchestrator: exit 2 (BLOCK)
- Rule 2: exitCode=2 verdict=BLOCK ✅
- Rule 4: exitCode=2 verdict=BLOCK (also blocks, but doesn't affect Rule 2 metric)

**Principle preserved:**

> **Do not claim 0% false negative when cross-rule masking prevents target-rule attribution.**

With per-rule verdicts, attribution is unambiguous.

---

## Fixture Details

### BLOCK Fixtures (Ground Truth: should BLOCK)

#### BLOCK1: Excess Property (TS2561)

**File:** `block1-camelcase-field.ts`

```typescript
type TreatmentInsert = {
  tooth_number: number;
  tube_color: string;
  treatment_date: string;
};

const treatment: TreatmentInsert = {
  tooth_number: 12,
  tubeColor: "blue",  // ❌ TS2561: unknown property
  treatment_date: "2024-01-01",
};
```

**Diagnostic:** TS2561 at line 14  
**Boundary:** `TreatmentInsert` (suffix match)  
**Rule 2 verdict:** BLOCK (exit 2) ✅  
**Classification:** schema-drift

---

#### BLOCK2: Missing Required Property (TS2741)

**File:** `block2-missing-required.ts`

```typescript
type AppointmentInsert = {
  patient_id: string;
  service_id: string;
  appointment_date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_by: string;
};

const appointment: AppointmentInsert = {
  patient_id: "P123",
  service_id: "S456",
  appointment_date: "2024-09-10T10:00:00Z",
  status: "scheduled",
  // ❌ created_by missing
};
```

**Diagnostic:** TS2741 at line 14  
**Boundary:** `AppointmentInsert` (suffix match)  
**Rule 2 verdict:** BLOCK (exit 2) ✅  
**Classification:** schema-drift

---

#### BLOCK3: Type Incompatibility (TS2322)

**File:** `block3-type-mismatch.ts`

```typescript
type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};

const service: ServiceRow = {
  id: "SVC001",
  name: "Massage Therapy",
  duration_minutes: "60",  // ❌ TS2322: string not assignable to number
  price: 100,
  is_active: true,
};
```

**Diagnostic:** TS2322 at line 14  
**Boundary:** `ServiceRow` (suffix match)  
**Rule 2 verdict:** BLOCK (exit 2) ✅  
**Classification:** schema-drift

---

### ALLOW Fixtures (Ground Truth: should ALLOW)

#### ALLOW1: Correct Snake Case

**File:** `allow1-correct-snake-case.ts`

```typescript
type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  created_at: string;
};

const patient: PatientRow = {
  id: "P001",
  first_name: "John",
  last_name: "Doe",
  date_of_birth: "1990-01-01",
  created_at: new Date().toISOString(),
};
```

**Diagnostic:** None (tsc exit 0)  
**Rule 2 verdict:** ALLOW (exit 0) ✅  
**Classification:** clean

---

#### ALLOW2: ViewModel CamelCase (Not Schema Boundary)

**File:** `allow2-viewmodel-camelcase.ts`

```typescript
// ViewModel for UI, NOT a database schema type
type AppointmentViewModel = {
  patientName: string;
  serviceName: string;
  appointmentTime: string;
  status: string;
};

const viewModel: AppointmentViewModel = {
  patientName: "John Doe",
  serviceName: "Massage",
  appointmentTime: "10:00 AM",
  status: "Scheduled",
};
```

**Diagnostic:** None (tsc exit 0)  
**Boundary:** No schema boundary (no Row/Insert/Update suffix)  
**Rule 2 verdict:** ALLOW (exit 0) ✅  
**Classification:** Not schema-related

---

#### ALLOW3: Optional Field Omitted

**File:** `allow3-optional-omitted.ts`

```typescript
type StaffInsert = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string; // Optional
  role: 'therapist' | 'receptionist' | 'manager';
};

const staff: StaffInsert = {
  first_name: "Jane",
  last_name: "Smith",
  email: "jane@spa.com",
  role: "therapist",
  // phone omitted - valid
};
```

**Diagnostic:** None (tsc exit 0)  
**Rule 2 verdict:** ALLOW (exit 0) ✅  
**Classification:** Valid schema usage

---

## Rule 2 Implementation

**Detector coverage:**
- TS2561: Object literal excess property
- TS2741: Missing required property  
- TS2322: Type not assignable
- TS2352: Conversion incompatibility

**Boundary classifier:**
```typescript
Evidence hierarchy:
1. Database[...]...Row/Insert/Update reference
2. XxxRow / XxxInsert / XxxUpdate suffix
3. Typed mutation/query payload boundary
4. File path heuristic (supporting signal only)

Classification model:
  High-confidence boundary + drift → BLOCK
  Ambiguous classification → UNCLASSIFIED (not BLOCK)
  Clearly unrelated → ALLOW
```

---

## Adversarial Testing Methodology

1. **Fixture design:** 3 BLOCK cases (each targeting different TS diagnostic) + 3 ALLOW cases (edge cases that should NOT block)
2. **Preflight validation:** Verify each fixture produces expected diagnostic (or none)
3. **Isolated execution:** Unique tsconfig per fixture to prevent cross-contamination
4. **Verdict collection:** Run through full orchestrator, record exit code
5. **Metrics calculation:** Measure FN/FP rates against ground truth

**Success criteria:**
- FP rate < 5% (preferably 0%)
- FN rate = 0% (strict requirement)
- 100% accuracy on adversarial set

---

## Notes

**Cross-rule masking eliminated:** Per-rule verdict attribution ensures FN/FP rates measure Rule 2 performance specifically, not orchestrator aggregate verdict.

**Rule 4 interaction:** BLOCK fixtures also trigger Rule 4 (Unknown Diagnostic Guard) because TS2741/TS2322/TS2561 are not in canonical inventory. This is **expected and correct** — Rule 4 provides defense-in-depth. Per-rule verdicts prevent Rule 4 blocks from masking Rule 2 false negatives.

**Boundary classifier validation:** ALLOW2 specifically tests that non-schema types (ViewModel without Row/Insert/Update suffix) are NOT classified as schema boundaries, preventing false positives.

---

## Conclusion

**Rule 2: Schema ↔ Type Drift Guard is ADVERSARIAL-VERIFIED.**

✅ 0% false negative rate (target-rule attribution)  
✅ 0% false positive rate (target-rule attribution)  
✅ 100% accuracy on 6-fixture adversarial set  
✅ Detector covers 4 drift diagnostic families  
✅ Boundary classifier prevents false positives  
✅ Per-rule verdict attribution prevents cross-rule masking

**Status upgrade:** AUTOMATED → **ADVERSARIAL-VERIFIED**

**Phase 3 harness invariant established:**

> **All adversarial metrics MUST use target-rule verdict attribution, NOT orchestrator aggregate verdict.**

This prevents cross-rule masking from hiding false negatives when multiple rules can BLOCK the same fixture.

**Next:** Rules 4, 7, 10 (6 fixtures each, same attribution method)

---

**Last Updated:** 2026-09-08  
**Verification Method:** Adversarial Testing with Target-Rule Attribution (Phase 3)  
**Fixture Count:** 6 (3 BLOCK + 3 ALLOW)
