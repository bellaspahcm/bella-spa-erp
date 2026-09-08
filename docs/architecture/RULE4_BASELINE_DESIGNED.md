# Rule 4: Mapper Contract Guard — Baseline Designed

**Date:** 2026-09-08  
**Status:** ⏸️ FIXTURES READY, VALIDATION PENDING

---

## Rule 4 Detector Analysis

**Target diagnostic:** TS2741 (Property 'X' is missing in type 'Y' but required in type 'Z')

**Intent:** Detect incomplete mapper contracts where required properties are missing

**Evidence:** Dental incident (encounter missing encounter_type, period_start)

**Implementation:**
```typescript
// scripts/governance/rules/g2-rule4-mapper-contract.ts
function extractMissingProperties(diagnostics):
  for diagnostic in diagnostics:
    if diagnostic.code === 2741:
      extract property, providedBy, requiredIn
      → BLOCK
```

---

## Baseline Fixtures Designed

### BLOCK1: Incomplete Mapper

**File:** `scripts/governance/fixtures/rule4-mapper-contract/block1-incomplete-mapper.ts`

```typescript
type AppointmentInsert = {
  patient_id: string;
  service_id: string;
  appointment_date: string;
  status: 'scheduled' | 'completed' | 'cancelled'; // Required
  created_by: string;
};

function mapToAppointmentInsert(raw: {
  patientId: string;
  serviceId: string;
  date: string;
  createdBy: string;
}): AppointmentInsert {
  // ❌ TS2741: Property 'status' is missing
  return {
    patient_id: raw.patientId,
    service_id: raw.serviceId,
    appointment_date: raw.date,
    created_by: raw.createdBy,
    // status missing — incomplete mapper contract
  };
}
```

**Expected diagnostic:** TS2741 at return statement  
**Expected Rule 4 verdict:** BLOCK (exit 2)

---

### ALLOW1: Complete Mapper

**File:** `scripts/governance/fixtures/rule4-mapper-contract/allow1-complete-mapper.ts`

```typescript
type ServiceInsert = {
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};

function mapToServiceInsert(raw: {
  serviceName: string;
  duration: number;
  cost: number;
}): ServiceInsert {
  // ✓ All required properties provided
  return {
    name: raw.serviceName,
    duration_minutes: raw.duration,
    price: raw.cost,
    is_active: true, // Explicit default
  };
}
```

**Expected diagnostic:** None (clean)  
**Expected Rule 4 verdict:** ALLOW (exit 0)

---

## Validation Status

**Fixtures created:** ✅  
**Preflight validation:** ❓ NOT VERIFIED (execution timeout)  
**Rule 4 baseline test:** ⏸️ PENDING  
**Timeout root cause:** ❓ UNKNOWN (requires RCA)

---

## Execution Blocker

**Symptom:** `npm run`, `npx tsc` commands timeout consistently

**NOT conclusively attributed to:**
- PowerShell environment
- Terminal state
- System resources

**Evidence:** Commands hang without output or error, eventually timeout.

**Required:** Clean execution context retry OR timeout RCA before proceeding.

---

## Next Steps

**Critical path (when execution stable):**

1. BLOCK1 preflight → MUST produce TS2741
2. ALLOW1 preflight → MUST be clean
3. BLOCK1 → orchestrator → extract [Rule 4] verdict → MUST be BLOCK
4. ALLOW1 → orchestrator → extract [Rule 4] verdict → MUST be ALLOW
5. If both correct → expand to 3 BLOCK + 3 ALLOW
6. If incorrect → investigate detector/fixture semantic mismatch

**If commands still timeout:**
- Switch to execution RCA (not retry loop)
- Do NOT create additional fixtures until baseline proven
- Do NOT modify detector without baseline evidence

---

## Principle Applied

**Same as Rule 2:** Prove baseline pair (1 BLOCK + 1 ALLOW) before expanding to full 6-fixture adversarial set.

**Do NOT:**
- Create all 6 fixtures immediately
- Assume detector and fixtures align semantically
- Skip preflight validation

---

**Status:** Fixtures designed, ready for validation when execution environment stable.  
**Next:** Preflight validation → baseline pair test → 6-fixture expansion
