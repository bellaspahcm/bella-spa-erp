# Factory Rules — Adversarial Testing Plan

**Status:** 🟡 READY FOR EXECUTION  
**Phase:** Phase 3 — Adversarial Validation  
**Date:** 2026-09-08  
**Prerequisites:** Phase 2 COMPLETE (4 rules automated)

---

## Purpose

Validate automated Factory Rules with **adversarial test cases** to ensure:
1. **BLOCK invalid code** (false negative prevention)
2. **ALLOW valid code** (false positive prevention)
3. **Correct failure modes** (diagnostic quality)

**NOT:** Unit tests for rule logic  
**YES:** End-to-end validation with real TypeScript code

---

## Adversarial Testing Methodology

```text
For each automated rule:
    ↓
Create 3+ BLOCK scenarios (should fail gate)
    ↓
Create 3+ ALLOW scenarios (should pass gate)
    ↓
Execute rule against test fixtures
    ↓
Validate exit codes (0 = PASS, 2 = BLOCK)
    ↓
Measure false positive/negative rates
    ↓
Document edge cases
```

**Success criteria per rule:**
- ✅ All BLOCK scenarios → exit 2
- ✅ All ALLOW scenarios → exit 0
- ✅ False positive rate < 5%
- ✅ False negative rate = 0% (security boundary)

---

## Rule 2: Schema ↔ Type Drift Guard

**Detection:** `Type 'X' not assignable to 'never'` (TS2322)

### BLOCK Scenarios (should fail gate)

#### B1: camelCase property in snake_case schema
```typescript
// Test fixture: adversarial/rule2-b1-camelcase.ts
const labOrder = {
  test_code: '001',
  test_name: 'CBC',
  sample_type: 'blood',
  tubeColor: 'lavender', // ❌ BLOCK: should be tube_color
};

supabase.from('hc_lab_orders').insert(labOrder);
```

**Expected:** Exit 2, diagnostic detected

#### B2: Non-existent schema property
```typescript
// Test fixture: adversarial/rule2-b2-nonexistent.ts
const patient = {
  person_id: '123',
  medical_record_number: 'MRN001',
  bloodType: 'O+', // ❌ BLOCK: field not in schema
};

supabase.from('hc_patients').insert(patient);
```

**Expected:** Exit 2, diagnostic detected

#### B3: Mixed naming conventions
```typescript
// Test fixture: adversarial/rule2-b3-mixed.ts
const encounter = {
  patient_id: '456',
  encounterType: 'outpatient', // ❌ BLOCK: should be encounter_type
  period_start: new Date().toISOString(),
};

supabase.from('hc_encounters').insert(encounter);
```

**Expected:** Exit 2, diagnostic detected

### ALLOW Scenarios (should pass gate)

#### A1: Correct snake_case properties
```typescript
// Test fixture: adversarial/rule2-a1-correct-snake.ts
const labOrder = {
  test_code: '001',
  test_name: 'CBC',
  sample_type: 'blood',
  tube_color: 'lavender', // ✅ ALLOW: correct property name
};

supabase.from('hc_lab_orders').insert(labOrder);
```

**Expected:** Exit 0, no diagnostics

#### A2: camelCase in ViewModel (not DB insert)
```typescript
// Test fixture: adversarial/rule2-a2-viewmodel.ts
interface LabOrderViewModel {
  testCode: string; // ✅ ALLOW: ViewModel can use camelCase
  testName: string;
  sampleType: string;
  tubeColor: string;
}

function mapToViewModel(dbRow: any): LabOrderViewModel {
  return {
    testCode: dbRow.test_code,
    testName: dbRow.test_name,
    sampleType: dbRow.sample_type,
    tubeColor: dbRow.tube_color,
  };
}
```

**Expected:** Exit 0, no diagnostics

#### A3: Optional properties correctly omitted
```typescript
// Test fixture: adversarial/rule2-a3-optional.ts
const encounter = {
  patient_id: '456',
  encounter_type: 'outpatient',
  period_start: new Date().toISOString(),
  // chief_complaint is optional, can be omitted
};

supabase.from('hc_encounters').insert(encounter);
```

**Expected:** Exit 0, no diagnostics

---

## Rule 4: Explicit Mapper Contract Guard

**Detection:** `Property 'X' is missing` (TS2741)

### BLOCK Scenarios

#### B1: Missing required field in mapper
```typescript
// Test fixture: adversarial/rule4-b1-missing-required.ts
const encounter = {
  patient_id: '123',
  // ❌ BLOCK: encounter_type required but missing
  period_start: new Date().toISOString(),
};

supabase.from('hc_encounters').insert(encounter);
```

**Expected:** Exit 2, missing property detected

#### B2: Incomplete spread operator usage
```typescript
// Test fixture: adversarial/rule4-b2-incomplete-spread.ts
function createPatient(input: PatientInput) {
  const patient = {
    ...input,
    // ❌ BLOCK: person_id required but not in spread
  };

  return supabase.from('hc_patients').insert(patient);
}
```

**Expected:** Exit 2, missing property detected

#### B3: Partial mapper for Insert type
```typescript
// Test fixture: adversarial/rule4-b3-partial-mapper.ts
const labOrder: Partial<LabOrderInsert> = {
  test_code: '001',
  // ❌ BLOCK: test_name, sample_type required
};

supabase.from('hc_lab_orders').insert(labOrder as LabOrderInsert);
```

**Expected:** Exit 2, cast hiding missing properties

### ALLOW Scenarios

#### A1: Complete mapper with all required fields
```typescript
// Test fixture: adversarial/rule4-a1-complete-mapper.ts
const encounter = {
  patient_id: '123',
  encounter_type: 'outpatient',
  period_start: new Date().toISOString(),
  // ✅ ALLOW: all required fields present
};

supabase.from('hc_encounters').insert(encounter);
```

**Expected:** Exit 0, no missing properties

#### A2: Optional fields correctly omitted
```typescript
// Test fixture: adversarial/rule4-a2-optional-omitted.ts
const encounter = {
  patient_id: '123',
  encounter_type: 'outpatient',
  period_start: new Date().toISOString(),
  // period_end is optional, can be null or omitted
};

supabase.from('hc_encounters').insert(encounter);
```

**Expected:** Exit 0, optional fields allowed

#### A3: Update operation (subset of fields)
```typescript
// Test fixture: adversarial/rule4-a3-update-subset.ts
const updateData = {
  chief_complaint: 'Updated complaint',
  // ✅ ALLOW: Update doesn't require all fields
};

supabase.from('hc_encounters').update(updateData).eq('id', '123');
```

**Expected:** Exit 0, updates allow subset

---

## Rule 7: Diagnostic Inventory Reconciliation Guard

**Detection:** Out-of-scope files, count mismatch

### BLOCK Scenarios

#### B1: Out-of-scope file mixed in inventory
```typescript
// Setup:
// - Scope: healthcare-actions.ts
// - pharmacy-actions.ts has diagnostics
// - Both in same tsconfig

// Command: npm run rule7 --scope=healthcare-actions.ts
```

**Expected:** Exit 2, out-of-scope files detected

#### B2: Expected count mismatch
```typescript
// Setup:
// - Expected: 10 diagnostics
// - Actual: 15 diagnostics
// - Claim doesn't match reality

// Command: npm run rule7 --expected=10
```

**Expected:** Exit 2, count mismatch violation

#### B3: Scope creep (denominator changed)
```typescript
// Setup:
// - Initial scope: file-a.ts (10 errors)
// - Added file-b.ts mid-remediation (5 errors)
// - Denominator changed from 10 to 15

// Command: npm run rule7 --scope=file-a.ts
```

**Expected:** Exit 2, file-b.ts out of scope

### ALLOW Scenarios

#### A1: Exact scope match, no out-of-scope files
```typescript
// Setup:
// - Scope: healthcare-actions.ts
// - Only healthcare-actions.ts has diagnostics
// - No other files

// Command: npm run rule7 --scope=healthcare-actions.ts
```

**Expected:** Exit 0, inventory reconciled

#### A2: Expected count matches actual
```typescript
// Setup:
// - Expected: 15 diagnostics
// - Actual: 15 diagnostics (exact match)

// Command: npm run rule7 --expected=15
```

**Expected:** Exit 0, count validated

#### A3: Zero diagnostics (clean state)
```typescript
// Setup:
// - Scope: healthcare-actions.ts
// - 0 diagnostics (remediation complete)

// Command: npm run rule7 --scope=healthcare-actions.ts --expected=0
```

**Expected:** Exit 0, clean inventory

---

## Rule 10: Repeated Root-Cause Occurrence Guard

**Detection:** Same error code at N > 3 locations

### BLOCK Scenarios

#### B1: Same nullability error at 5 locations
```typescript
// Test fixture: adversarial/rule10-b1-repeated-nullability.ts
function fn1() { const x = party?.id; /* used without guard */ }
function fn2() { const x = party?.id; /* used without guard */ }
function fn3() { const x = party?.id; /* used without guard */ }
function fn4() { const x = party?.id; /* used without guard */ }
function fn5() { const x = party?.id; /* used without guard */ }
// ❌ BLOCK: pattern repeated 5 times
```

**Expected:** Exit 2, repeated pattern detected

#### B2: Type mismatch across multiple mappers
```typescript
// Test fixture: adversarial/rule10-b2-mapper-pattern.ts
function mapper1() { return { encounterType: 'x' }; } // camelCase
function mapper2() { return { encounterType: 'y' }; } // camelCase
function mapper3() { return { encounterType: 'z' }; } // camelCase
function mapper4() { return { encounterType: 'a' }; } // camelCase
// ❌ BLOCK: schema naming violation × 4
```

**Expected:** Exit 2, repeated contract violation

#### B3: Missing property pattern
```typescript
// Test fixture: adversarial/rule10-b3-missing-property.ts
function create1() { return { patient_id: '1' }; } // missing encounter_type
function create2() { return { patient_id: '2' }; } // missing encounter_type
function create3() { return { patient_id: '3' }; } // missing encounter_type
function create4() { return { patient_id: '4' }; } // missing encounter_type
// ❌ BLOCK: incomplete mapper × 4
```

**Expected:** Exit 2, repeated incomplete mapper

### ALLOW Scenarios

#### A1: Same error type but ≤3 occurrences
```typescript
// Test fixture: adversarial/rule10-a1-below-threshold.ts
function fn1() { const x = party?.id; /* guard missing */ }
function fn2() { const x = party?.id; /* guard missing */ }
function fn3() { const x = party?.id; /* guard missing */ }
// ✅ ALLOW: only 3 occurrences (threshold not exceeded)
```

**Expected:** Exit 0, below threshold

#### A2: Different root causes (not a pattern)
```typescript
// Test fixture: adversarial/rule10-a2-different-causes.ts
function fn1() { const x = party?.id; /* nullability */ }
function fn2() { return { tubeColor: 'x' }; /* schema naming */ }
function fn3() { return { patient_id: '1' }; /* missing field */ }
function fn4() { return drugsList[0]; /* Json indexing */ }
// ✅ ALLOW: 4 different error types, no pattern
```

**Expected:** Exit 0, no repeated pattern

#### A3: Already fixed pattern (post-remediation)
```typescript
// Test fixture: adversarial/rule10-a3-fixed-pattern.ts
function fn1() { 
  if (!party?.id) throw new Error('Required');
  const x = party.id; // ✅ properly guarded
}
function fn2() { 
  if (!party?.id) throw new Error('Required');
  const x = party.id; // ✅ properly guarded
}
// ✅ ALLOW: pattern was repeated, now fixed systematically
```

**Expected:** Exit 0, pattern eliminated

---

## Execution Plan

### Step 1: Create Test Fixtures (⏸️ PENDING)
```bash
mkdir -p tests/adversarial/rule2
mkdir -p tests/adversarial/rule4
mkdir -p tests/adversarial/rule7
mkdir -p tests/adversarial/rule10

# Create all BLOCK/ALLOW fixtures per rule
```

### Step 2: Create Test Runner (⏸️ PENDING)
```typescript
// tests/adversarial/run-adversarial-tests.ts
// Execute each rule against fixtures
// Validate exit codes
// Generate pass/fail report
```

### Step 3: Execute Tests (⏸️ PENDING)
```bash
npm run governance:adversarial-test -- --rule=rule2
npm run governance:adversarial-test -- --rule=rule4
npm run governance:adversarial-test -- --rule=rule7
npm run governance:adversarial-test -- --rule=rule10
npm run governance:adversarial-test -- --all
```

### Step 4: Measure Metrics (⏸️ PENDING)
```text
Per rule:
- BLOCK scenarios executed: N
- BLOCK scenarios passed (exit 2): M
- ALLOW scenarios executed: P
- ALLOW scenarios passed (exit 0): Q
- False positive rate: (P - Q) / P × 100%
- False negative rate: (N - M) / N × 100%
```

### Step 5: Document Results (⏸️ PENDING)
```markdown
# Rule X Adversarial Test Results

## Summary
- BLOCK scenarios: 3/3 ✅
- ALLOW scenarios: 3/3 ✅
- False positive rate: 0%
- False negative rate: 0%
- Status: PROVEN ✅

## Edge Cases Discovered
1. ...
2. ...

## Adjustments Made
1. ...
2. ...
```

---

## Success Criteria

### Rule = ADVERSARIAL TESTED when:
- [x] 3+ BLOCK scenarios created
- [x] 3+ ALLOW scenarios created
- [x] Test runner implemented
- [x] All scenarios executed
- [x] Exit codes validated (0 = PASS, 2 = BLOCK)
- [x] Metrics measured

### Rule = PROVEN when:
- [x] Adversarial tested ✓
- [x] False positive rate < 5% measured ✓
- [x] False negative rate = 0% measured ✓
- [x] Edge cases documented ✓
- [x] Production field validation (1+ real incident) ✓

---

## Current Status

### Automated Rules (4/10)
- Rule 2: Schema ↔ Type Drift Guard — ⏸️ PENDING adversarial test
- Rule 4: Explicit Mapper Contract Guard — ⏸️ PENDING adversarial test
- Rule 7: Diagnostic Inventory Reconciliation Guard — 🟡 PARTIAL (1 field test)
- Rule 10: Repeated Root-Cause Occurrence Guard — ⏸️ PENDING adversarial test

### Not Yet Automated (6/10)
- Rule 1: Canonical Data Source Guard — ⏸️ DEFERRED
- Rule 3: DB Row → Domain Boundary Guard — ⏸️ DEFERRED
- Rule 5: Semantic Field Substitution Guard — ⏸️ DEFERRED
- Rule 6: Literal Union Preservation Guard — ⏸️ DEFERRED
- Rule 8: Diagnostic Identity Bijection Guard — ⏸️ DEFERRED
- Rule 9: Cluster Closure Integrity Guard — ⏸️ DEFERRED

---

**Document Status:** Phase 3 PLANNED  
**Next:** Create test fixtures + runner  
**Blocked:** None  
**Last Updated:** 2026-09-08

