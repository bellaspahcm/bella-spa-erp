# P1-A: Clinical Mock Identity Remediation

**Date:** 2026-08-16  
**Priority:** P1 BLOCKING  
**Invariant:** INVARIANT 2 - Clinical Provenance Integrity

---

## Executive Summary

**Finding:** 12 mock clinical identity violations detected  
**Classification:** 🟡 FALLBACK / DEMO MODE (not production-first)  
**Risk:** MEDIUM - Violates HIPAA provenance principle  
**Action:** Replace mock fallbacks with empty state UI

---

## Detailed Classification

### 1. `src/app/dashboard/healthcare/patients/page.tsx`

**Mock Data:** `MOCK_MPI_PATIENTS` (5 fake patients)

**Usage:**
```typescript
// Line 284: Empty result fallback
} else {
  setPatients(MOCK_MPI_PATIENTS);
}

// Line 288: Error fallback
} catch (err: unknown) {
  setPatients(MOCK_MPI_PATIENTS);
}
```

**Intent:** Graceful degradation when database empty or RLS error

**Issue:** Users see FAKE patient data (Nguyễn Văn Hoàng, Phạm Thị Mai, etc.) instead of empty state

---

### 2. `src/app/dashboard/healthcare/encounters/page.tsx`

**Mock Data:** `MOCK_EMR_ENCOUNTERS` (encounter records)

**Usage:**
```typescript
// Line 172: Empty fallback
} else {
  setEncounters(MOCK_EMR_ENCOUNTERS);
}

// Line 176: Error fallback
} catch (err: unknown) {
  setEncounters(MOCK_EMR_ENCOUNTERS);
}
```

**Intent:** Prevent blank screen on database failure

**Issue:** Users see FAKE clinical encounters instead of "No encounters" message

---

### 3. `src/app/dashboard/healthcare/encounters/[id]/page.tsx`

**Mock Data:** `mockEncounter`, `mockPatient`

**Usage:**
```typescript
// Line 163-187: Database miss fallback
} else {
  const mockEncounter: EncounterContext = { ... };
  const mockPatient: PatientContext = { ... };
  
  setEncounter(mockEncounter);
  setPatient(mockPatient);
  
  await runRuntimeLifecycle(mockEncounter, mockPatient, isDental);
}
```

**Intent:** Support development/testing when encounter ID doesn't exist

**Issue:** 
- Fake clinical context fed into `runRuntimeLifecycle`
- Violates provenance chain: UI → mock → runtime
- Should be: UI → error state / redirect

---

## Why This Matters

### HIPAA Provenance Requirement

```
✅ CORRECT:
Real Patient (hc_master_patient_index)
     ↓
Real Encounter (hc_encounters via H2 Kernel)
     ↓
Real Clinical Event (H3 Clinical Orders)
     ↓
Real Temporal Evidence (H9 Temporal)
     ↓
Real Audit Trail (H11 Audit)
     ↓
Clinical Action

❌ CURRENT (fallback):
UI action
   ↓
Database error / empty
   ↓
MOCK_MPI_PATIENTS (fake identity)
   ↓
runRuntimeLifecycle (real clinical logic)
   ↓
"PASS" (false verification)
```

### The Problem with Mock Fallbacks

1. **False Provenance:**
   - Mock data has no authoritative source
   - No audit trail for fake patients
   - Violates "clinical evidence from Kernel" principle

2. **User Confusion:**
   - Users can't distinguish mock vs real data
   - May attempt to interact with fake patients
   - Creates misleading demo state

3. **Testing False Positive:**
   - Healthcare verification may PASS with mocks
   - Doesn't prove real Kernel contracts work
   - Two different things: "workflow runs" vs "provenance correct"

---

## Remediation Strategy

### Replace Mock Fallbacks with Empty State UI

#### Pattern 1: Empty Result

```typescript
// BEFORE
} else {
  setPatients(MOCK_MPI_PATIENTS);
}

// AFTER
} else {
  setPatients([]);
  // Empty state UI will show: "No patients found"
}
```

#### Pattern 2: Error Fallback

```typescript
// BEFORE
} catch (err: unknown) {
  setPatients(MOCK_MPI_PATIENTS);
}

// AFTER
} catch (err: unknown) {
  console.error('[Patients] Failed to load:', err);
  setPatients([]);
  toast.error('Unable to load patient data. Please check permissions.');
}
```

#### Pattern 3: Missing Record

```typescript
// BEFORE
} else {
  const mockEncounter: EncounterContext = { ... };
  await runRuntimeLifecycle(mockEncounter, mockPatient, isDental);
}

// AFTER
} else {
  toast.error(`Encounter ${encounterId} not found`);
  router.push('/dashboard/healthcare/encounters');
  return;
}
```

---

## Implementation Plan

### Step 1: Remove Mock Constants (patients/page.tsx)

```typescript
// DELETE THIS ENTIRE BLOCK:
const MOCK_MPI_PATIENTS: PatientRecordItem[] = [
  {
    id: 'pat-001',
    recordNumber: 'BN102485',
    name: 'Nguyễn Văn Hoàng',
    ...
  },
  ...
];
```

### Step 2: Replace Fallbacks with Empty State

```typescript
const loadPatients = async () => {
  try {
    setIsLoading(true);
    const res = await getAllPatientProfilesAction();
    
    if (res.success && res.data && res.data.length > 0) {
      // ... enhance logic ...
      setPatients(enhanced);
    } else {
      // ✅ NEW: Empty state instead of mock
      setPatients([]);
    }
  } catch (err: unknown) {
    console.error('[Patients] Load error:', err);
    // ✅ NEW: Show error, empty state
    setPatients([]);
    toast.error('Unable to load patients. Check database connection or permissions.');
  } finally {
    setIsLoading(false);
  }
};
```

### Step 3: Add Empty State UI Component

```typescript
{filteredPatients.length === 0 && !isLoading && (
  <div className="text-center py-16 px-4">
    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4 flex items-center justify-center">
      <UserCheck className="w-10 h-10 text-slate-400" />
    </div>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
      No Patients Found
    </h3>
    <p className="text-sm text-slate-500 mb-6">
      {searchTerm 
        ? `No patients match "${searchTerm}"`
        : 'No patient records in the system. Click "+ Create Patient" to add your first patient.'
      }
    </p>
    <button
      onClick={() => setIsCreateModalOpen(true)}
      className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
    >
      + Create First Patient
    </button>
  </div>
)}
```

### Step 4: Remove Mock from encounters/page.tsx

Same pattern:
- Delete `MOCK_EMR_ENCOUNTERS` constant
- Replace fallbacks with `setEncounters([])`
- Add empty state UI: "No encounters today"

### Step 5: Fix encounters/[id]/page.tsx

```typescript
// BEFORE
} else {
  const mockEncounter: EncounterContext = { ... };
  const mockPatient: PatientContext = { ... };
  setEncounter(mockEncounter);
  setPatient(mockPatient);
  await runRuntimeLifecycle(mockEncounter, mockPatient, isDental);
}

// AFTER
} else {
  toast.error(`Encounter ${encounterId} not found in database`);
  router.push('/dashboard/healthcare/encounters');
  return; // ← Prevent runtime execution with fake data
}
```

---

## Verification

### Before Fix: INVARIANT 2 FAIL

```bash
npm test -- production-runtime-integrity

INVARIANT 2: Clinical Provenance Integrity
  🔴 FAIL: Found 12 mock clinical identities
  
  Violations:
    - src/app/dashboard/healthcare/patients/page.tsx:108 (MOCK_MPI_PATIENTS)
    - src/app/dashboard/healthcare/patients/page.tsx:284 (setPatients)
    - src/app/dashboard/healthcare/patients/page.tsx:288 (setPatients)
    - src/app/dashboard/healthcare/encounters/page.tsx:57 (MOCK_EMR_ENCOUNTERS)
    - src/app/dashboard/healthcare/encounters/page.tsx:172 (setEncounters)
    - src/app/dashboard/healthcare/encounters/page.tsx:176 (setEncounters)
    - src/app/dashboard/healthcare/encounters/[id]/page.tsx:163 (mockEncounter)
    - src/app/dashboard/healthcare/encounters/[id]/page.tsx:174 (mockPatient)
    - src/app/dashboard/healthcare/encounters/[id]/page.tsx:186 (setEncounter)
    - src/app/dashboard/healthcare/encounters/[id]/page.tsx:187 (setPatient)
    - src/app/dashboard/healthcare/encounters/[id]/page.tsx:189 (runRuntimeLifecycle)
```

### After Fix: INVARIANT 2 PASS

```bash
npm test -- production-runtime-integrity

INVARIANT 2: Clinical Provenance Integrity
  ✅ PASS: 0 mock clinical identities
```

---

## Alternative: Demo Mode Flag (If Required)

If mock data is intentionally needed for demos:

```typescript
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const loadPatients = async () => {
  try {
    // ... real data load ...
  } catch (err) {
    if (IS_DEMO_MODE) {
      // @demo-mode approved="2026-08-16" owner="product-team" expiry="2026-12-31"
      setPatients(MOCK_MPI_PATIENTS);
      toast.info('🎭 Running in DEMO MODE with sample data');
    } else {
      setPatients([]);
      toast.error('Unable to load patients');
    }
  }
};
```

**But:** Requires `@demo-mode` annotation + exception registry.

---

## Timeline

| Task | Effort | Status |
|------|--------|--------|
| Remove MOCK_MPI_PATIENTS | 15min | ⏳ TODO |
| Remove MOCK_EMR_ENCOUNTERS | 15min | ⏳ TODO |
| Remove mockEncounter/Patient | 20min | ⏳ TODO |
| Add empty state UI (3 files) | 1-2h | ⏳ TODO |
| Test & verify | 30min | ⏳ TODO |

**Total:** 2.5-3 hours

---

## Success Criteria

```
✅ MOCK_MPI_PATIENTS deleted
✅ MOCK_EMR_ENCOUNTERS deleted
✅ mockEncounter/mockPatient deleted
✅ Empty state UI added
✅ Error toast shows helpful message
✅ No fake data fed to runRuntimeLifecycle
✅ INVARIANT 2 test PASS (0 violations)
```

---

**Next:** Execute remediation → Re-run invariant tests → Expect 0 violations
