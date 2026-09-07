# TG-1 — Schema-Type Synchronization Gate

**Status:** 🟡 IN PROGRESS  
**Date:** September 7, 2026  
**Workstream:** BELLA TYPE-SYSTEM ROOT-CAUSE & HARDENING — Gate 3

---

## Objective

**Prevent Generator Drift mechanism from recurring.**

Enforce invariant: **Generated database types must remain synchronized with canonical database schema.**

---

## Scope

**IN SCOPE:**
- ✅ Detect schema/type drift
- ✅ Block construction when drift detected
- ✅ Content-based verification (NOT timestamp-based)

**OUT OF SCOPE:**
- ❌ Auto-fix (gate detects + blocks only)
- ❌ TG-2/TG-3/TG-4 (separate gates)
- ❌ Residual diagnostic fixing
- ❌ Preschool capability expansion

---

## Root Cause Being Addressed

**Mechanism A: Generator Drift (Hotspot #1 Preschool)**

```text
Database schema evolves (migration applied)
→ Generated types NOT refreshed
→ Static types diverge from runtime schema
→ Typed queries fail (missing table/column definitions)

Evidence: 24/29 diagnostics (82.8%) eliminated by type regeneration alone
```

---

## Gate Logic

### Canonical Inputs

1. **Canonical database schema** (via Supabase connection or migration set)
2. **Committed generated types** (`src/types/database.types.ts`)

### Verification Protocol

```text
1. Generate fresh types deterministically from canonical schema
2. Normalize generated output (strip timestamps, metadata)
3. Compare fresh output ↔ committed canonical types
4. Decision:
   - No difference  → PASS
   - Difference exists → BLOCK
```

**Why this approach:**
- ✅ Content-based (not timestamp-based)
- ✅ Deterministic (same schema → same types)
- ✅ Direct verification of synchronization invariant
- ✅ False-positive resistant (file touch doesn't cause failure)

---

## Acceptance Tests

### T1: ALIGNED (Positive Case)

**Setup:**
- Schema unchanged
- Committed types already synchronized

**Expected:**
```text
Fresh generation == Committed types
→ PASS
```

---

### T2: STALE TYPES (Negative Case)

**Setup:**
- Add controlled schema change (e.g., new test table)
- Do NOT regenerate committed types

**Expected:**
```text
Fresh generation ≠ Committed types
→ BLOCK

Error message identifies drift clearly
```

---

### T3: RECOVERED (Positive Case After Fix)

**Setup:**
- Same controlled schema change from T2
- Regenerate types correctly

**Expected:**
```text
Fresh generation == Committed types
→ PASS
```

---

### T4: FALSE POSITIVE RESISTANCE

**Setup:**
- Touch file timestamp only (`touch src/types/database.types.ts`)
- Schema and content unchanged

**Expected:**
```text
Fresh generation == Committed types (content unchanged)
→ PASS

Gate does NOT fail due to timestamp change
```

---

## Exit Criteria

```text
✅ T1 PASS (aligned case)
✅ T2 BLOCK (stale types detected)
✅ T3 PASS (recovered after regeneration)
✅ T4 PASS (false positive resistance)
✅ Deterministic result across repeated runs
✅ No consumer-code dependency
✅ Failure output identifies drift clearly
✅ Wired into Factory eligibility path
```

---

## Error Message Semantics

**When BLOCK:**

```text
═══════════════════════════════════════════════════
TG-1 SCHEMA-TYPE SYNC GATE: BLOCK
═══════════════════════════════════════════════════

Generated database types do not match canonical schema.

Drift detected:
  - Fresh generation from schema: [hash/summary]
  - Committed types: [hash/summary]

Required action:
1. Regenerate database types from canonical schema:
   $ supabase gen types typescript --linked > src/types/database.types.ts
2. Commit the resulting type changes
3. Rerun this gate

Do NOT proceed with stale database types.
═══════════════════════════════════════════════════
```

---

## Design Principles

### 1. Detect + Block (NOT Auto-Fix)

Gate does NOT silently regenerate types. It detects drift and blocks.

**Rationale:** Reveal lifecycle violations, don't hide them.

---

### 2. Content-Based Verification

Compare normalized semantic content, NOT timestamps.

**Rationale:** Avoid false positives from file system operations.

---

### 3. Deterministic Generation

Same schema input → same type output (excluding metadata).

**Rationale:** Repeatable verification across environments.

---

### 4. Clear Failure Output

Error message must:
- ✅ Identify WHAT failed (schema/type sync)
- ✅ Explain WHY it failed (drift detected)
- ✅ Provide HOW to fix (regeneration command)

---

## Implementation Steps

### Step 1: Fresh Type Generation Function

**File:** `scripts/governance/tg1-schema-type-sync.ts`

```typescript
async function generateFreshTypes(): Promise<string> {
  // Generate types from canonical schema
  // Normalize output (strip timestamps, metadata)
  // Return normalized content
}
```

---

### Step 2: Content Comparison

```typescript
async function compareTypes(
  freshTypes: string,
  committedTypes: string
): Promise<{ identical: boolean; diff?: string }> {
  // Normalize both inputs
  // Compare content
  // Return result + diff if exists
}
```

---

### Step 3: Gate Execution

```typescript
async function runTG1Gate(): Promise<GateResult> {
  const fresh = await generateFreshTypes();
  const committed = await readCommittedTypes();
  const comparison = await compareTypes(fresh, committed);
  
  if (comparison.identical) {
    return { pass: true, message: 'Schema and types synchronized' };
  } else {
    return {
      pass: false,
      message: formatBlockMessage(comparison.diff)
    };
  }
}
```

---

### Step 4: Test Suite

**File:** `scripts/governance/__tests__/tg1-gate.test.ts`

```typescript
describe('TG-1 Schema-Type Sync Gate', () => {
  test('T1: PASS when types aligned', async () => { ... });
  test('T2: BLOCK when types stale', async () => { ... });
  test('T3: PASS after regeneration', async () => { ... });
  test('T4: PASS despite timestamp change', async () => { ... });
});
```

---

### Step 5: Integration Point

Wire into governance typecheck or Factory eligibility check.

**Option A:** Pre-commit hook  
**Option B:** CI/CD pipeline gate  
**Option C:** Factory construction gate

---

## Success Metric

**When TG-1 complete:**

```text
FIELD-DISCOVERED FAILURE
Generator Drift (Preschool)
        ↓
GENERALIZED INVARIANT
Schema and generated types must remain synchronized
        ↓
AUTOMATED ENFORCEMENT
TG-1 Gate
        ↓
FACTORY CAN NO LONGER SILENTLY PROCEED
WITH STALE DATABASE TYPES
```

**This is the standard for COMPLETE, not just "script runs."**

---

## Current Status

**Phase:** Design complete, implementation starting

**Next action:** Implement fresh type generation function

