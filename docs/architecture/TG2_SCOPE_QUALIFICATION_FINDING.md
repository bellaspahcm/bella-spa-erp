# TG-2 Scope Qualification Finding

**Date:** September 7, 2026  
**Status:** 🔴 **CRITICAL FINDING**

---

## Problem Statement

**Initial TG-2 run reported false confidence:**

```text
Coverage: 2163/2200 (98%)
Uncovered: 37 files
```

**Analysis revealed:** Root `tsconfig.json` was counted as "governed scope" despite:
- Timeout >300s (not executable)
- Not part of automated governance gates
- Scalability issues unresolved

**Impact:** Files "covered" by root tsconfig were reported as governed, creating **false confidence**.

---

## Root Cause

**TG-2 initial logic:**

```text
File included in ANY tsconfig effective program
        ↓
File considered "covered"
        ↓
WRONG: Coverage inflated by non-governed scopes
```

**Correct logic:**

```text
File included in ≥1 GOVERNED scope
        ↓
Governed scope = qualified for enforcement
        ↓
File considered "covered"
```

---

## Governed Scope Qualification Criteria

A tsconfig qualifies as **GOVERNED** only if:

1. ✅ **Executable:** Completes typecheck within reasonable time (<120s)
2. ✅ **Enforced:** Part of automated governance gates (Gate B, CI/CD)
3. ✅ **Qualified:** Successfully typechecks its intended scope

**EXCLUDED from governed status:**

- ❌ Root `tsconfig.json` — timeout >300s, not executable
- ❌ Investigation configs (`tsconfig.investigation-*.json`) — temporary
- ❌ Test-only configs (`tsconfig.test-*.json`) — not production governance
- ❌ Reference-only configs — used for IDE/tooling, not enforcement

---

## Impact: Healthcare Services Case (T5)

**Before scope qualification:**

```text
src/services/healthcare/**
        ↓
Included by root tsconfig.json
        ↓
TG-2 reports: COVERED ✅
        ↓
FALSE CONFIDENCE
```

**After scope qualification:**

```text
src/services/healthcare/**
        ↓
NOT included by any GOVERNED scope
        ↓
TG-2 reports: UNCOVERED ❌
        ↓
CORRECT DETECTION (matches Gate 2 finding)
```

---

## Coverage Reality

**Before qualification:**
```text
Reported coverage: 2163/2200 (98%)
Governed coverage: UNKNOWN (inflated)
```

**After qualification:**
```text
Reported coverage: 345/2200 (16%)
Governed coverage: 16% (canonical)
Uncovered: 1855 files require scope assignment
```

**Key insight:** 84% of production source exists outside governed typecheck scopes.

---

## Healthcare Services Detection (T5 Validation)

TG-2 now correctly detects Healthcare services-layer gap:

```text
src/services/healthcare/
  - appointments-actions.ts
  - bhyt-actions.ts
  - billing-actions.ts
  - clinical-alerts-service.ts
  - emergency-service.ts
  - healthcare-actions.ts
  - healthcare-service.ts
  - icu-service.ts
  - laboratory-service.ts
  ... (all uncovered)
```

**Status:** ✅ **T5 negative fixture reproduced** — matches Gate 2 Healthcare finding

---

## Principle Established

> **A scope that cannot successfully participate in the governance typecheck system cannot be used merely to inflate coverage metrics.**

**Corollary:**

> **Reported coverage must reflect GOVERNED coverage, not merely "included by some tsconfig" coverage.**

---

## Next Actions

### 1. Classify 1855 Uncovered Files

Each uncovered file must fall into one of three categories:

**A. True Production Source**
- Must gain canonical governed scope
- Examples: `src/services/healthcare/**`, `src/shared/**`, `src/types/**`

**B. Non-Production (Explicit Policy)**
- Add documented exclusion
- Examples: Test helpers, archived code, build artifacts

**C. Dead/Archive Source in Production Tree**
- Architectural cleanup needed
- Relocate or remove

### 2. Expand Governed Scopes

For legitimate production source clusters:
- Create or identify correct governed scope
- Ensure scope is executable (<120s)
- Add to GOVERNED_TSCONFIGS list
- Verify coverage restored

### 3. Healthcare Services Resolution (T5)

**Action required:**
```text
src/services/healthcare/** detected as uncovered
        ↓
Determine correct ownership scope:
  Option A: Create tsconfig.services-healthcare.json
  Option B: Extend existing platform-healthcare scope
  Option C: Different architectural decision
        ↓
Implement governed scope
        ↓
Verify TG-2 PASS
```

### 4. Complete T1-T6 Protocol

Only after coverage accurately reflects governed source.

---

## Acceptance Criterion Added to TG-2

**New requirement:**

> ✅ Scope qualification must prevent false confidence from non-governed configs

**Test:**
```text
Add file to root tsconfig (timeout scope)
Run TG-2
Expected: File reported as UNCOVERED (not governed)
Actual: [to be validated]
```

---

## Status Impact

```text
TG-2 Production Coverage Integrity
──────────────────────────────────

Scope qualification       ✅ IMPLEMENTED
False confidence fix      ✅ RESOLVED
Healthcare T5 detection   ✅ PROVEN
Canonical coverage        🟡 16% (not 98%)

Coverage gaps             🔴 1855 files uncovered
Classification needed     ⏸️ PENDING
T1-T6 validation          ⏸️ BLOCKED until gaps classified

TG-2 Status               🟡 IMPLEMENTED / VALIDATION BLOCKED
```

**Blocker:** Cannot claim COMPLETE with 84% production source uncovered.

**Resolution path:** Classify uncovered clusters → expand governed scopes OR document exclusions → revalidate

---

**See also:**
- [TG-2 Design](./TG2_PRODUCTION_COVERAGE_INTEGRITY.md)
- [Gate 2 Healthcare Finding](./GATE2_ROOT_CAUSE_PROOF_CLOSURE.md)
- [Gate 3 Overview](./GATE3_ARCHITECTURAL_HARDENING.md)
