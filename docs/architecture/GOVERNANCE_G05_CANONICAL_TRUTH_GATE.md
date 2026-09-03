# G0.5: Canonical Truth Gate Proposal

**Status:** 📋 PROPOSED  
**Date:** 2026-09-03  
**Origin:** Logistics 613-diagnostic root cause analysis

---

## Problem Statement

**Observed pattern in Logistics remediation:**
```
Implementation
    ↓
TypeCheck (613 diagnostics)
    ↓
Fix errors reactively
    ↓
Discover schema drift
    ↓
Discover vocabulary drift (PL vs PLT)
    ↓
Discover architectural boundaries
```

**Root cause:** AI coded before verifying canonical truth alignment

**Evidence:**
- Contract: `UnitOfMeasure.PALLET = 'PL'`
- E7 Schema: `CHECK ... IN ('PLT', ...)`
- Domain: `StandardUOM = 'PLT'`
- Generated DB types: Reflected old schema (pre-E7)
- Result: **Contract ↔ Domain ↔ Schema vocabulary drift**

**613 diagnostics were not "bugs in code"**  
**613 diagnostics were downstream evidence of a system whose canonical surfaces (Contract, Schema, Domain, Generated Types) had not been fully verified before implementation**

---

## Core Principle

> **AI MUST NOT IMPLEMENT AGAINST AN UNVERIFIED CANONICAL SURFACE.**

**Translation:**
> AI không được phép code dựa trên một contract, schema, type hoặc architecture surface chưa được xác minh là canonical và nhất quán.

---

## Proposed Gate: G0.5 Canonical Truth Gate

**Purpose:** Pre-implementation verification that canonical surfaces are aligned

**Trigger:** Before AI begins implementation of new capability or modification of existing capability

**Scope:** Contract, Schema, Generated Types, Domain Types, Dependency Rules

### Gate Flow

```
                CANONICAL TRUTH
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
   Contract         Schema        Domain
       │              │              │
       └──────────────┼──────────────┘
                      ↓
             Generated Types
                      ↓
             Dependency Rules
                      ↓
             CONFORMANCE CHECK
                      │
             ┌────────┴────────┐
             ↓                 ↓
           GREEN              AMBIGUOUS
             │                   │
             ↓                   ↓
        ALLOW CODE             STOP
```

### Check Sequence

#### Check 1: Schema Presence
```
Code expects: Database['logistics']['Tables']['inventory']
       ↓
Does logistics.inventory exist in DB migrations?
       ↓
YES → Proceed to Check 2
NO  → BLOCK: Schema not present
```

#### Check 2: Generated Types Alignment
```
Does generated database.types.ts contain expected table/columns?
       ↓
YES → Proceed to Check 3
NO  → BLOCK: Regenerate types or reconcile schema
```

#### Check 3: Vocabulary Conformance
```
Contract enum values == Schema CHECK constraint values == Domain type values?
       ↓
YES → Proceed to Check 4
NO  → BLOCK: Vocabulary drift detected

Example failure (Logistics):
  Contract: PALLET = 'PL'
  Schema:   CHECK ... IN ('PLT', ...)
  Domain:   'PLT'
  → CONFLICT
```

#### Check 4: Dependency Direction
```
Implementation requires: Domain → Contract import?
       ↓
Is this dependency direction allowed?
       ↓
YES → Proceed to Check 5
NO  → BLOCK: Architectural boundary violation

Evidence source: Zero cross-layer imports in Healthcare, Finance, Logistics
```

#### Check 5: Type Ownership
```
Type requested by consumer exists at canonical owner?
       ↓
YES → GREEN (allow implementation)
NO  → AMBIGUOUS (investigate before coding)
```

### Exit Codes

**🟢 GREEN:** All checks passed → AI may implement

**🟡 AMBIGUOUS:** Canonical owner unclear → AI must investigate, not guess

**🔴 BLOCKED:** Inconsistency detected → AI must reconcile canonical surfaces before coding

---

## Logistics Case: How G0.5 Would Have Prevented 613 Diagnostics

### Pre-Implementation Gate Check (Hypothetical)

**Implementation intent:** Code Logistics Warehouse operations

**G0.5 execution:**

#### Check 1: Schema Presence
```
✅ PASS: logistics.* tables exist in migrations/logistics/20260822_logistics_os_domain_kernel.sql
```

#### Check 2: Generated Types Alignment
```
❌ FAIL: database.types.ts does NOT contain logistics.* tables
Reason: Generated from old warehouse.* schema
Action Required: Regenerate types after E7 migration
```

**Result:** **BLOCKED at Check 2**

**AI response (correct):**
> "Implementation blocked: Generated database types do not reflect E7 canonical schema. Run `npm run db:types` after applying logistics migrations."

#### Check 3: Vocabulary Conformance (if reached)
```
❌ FAIL: Contract/Schema vocabulary mismatch detected

Contract UnitOfMeasure:
  PALLET = 'PL'

E7 Schema:
  CHECK (base_uom IN ('PLT', ...))

Domain StandardUOM:
  'PLT'

Conflict: 'PL' vs 'PLT'
```

**Result:** **BLOCKED at Check 3**

**AI response (correct):**
> "Vocabulary drift detected: Contract uses 'PL', schema/domain use 'PLT'. Canonical value must be determined before implementation."

#### Check 4: Dependency Direction (if reached)
```
❌ FAIL: Domain consumers expect UnitOfMeasure from Contract

Evidence: Zero domain → contracts imports in Healthcare, Finance, Logistics
Status: Architectural boundary violation
```

**Result:** **BLOCKED at Check 4**

**AI response (correct):**
> "Domain cannot import from Contract layer. Type ownership and naming strategy must be resolved before implementation."

### Outcome with G0.5

**Without G0.5 (actual):**
- Implementation proceeded
- 613 diagnostics appeared
- Reactive remediation (Phases 1K, 1L, 1M)
- Vocabulary drift discovered late

**With G0.5 (hypothetical):**
- Implementation blocked at Check 2
- Canonical surfaces reconciled first
- Types regenerated
- Vocabulary aligned
- Implementation against verified surface
- **Expected outcome:** Systemic drift detected before implementation, substantially reducing the likelihood of a large reactive diagnostic cascade. Exact diagnostic reduction cannot be established without a controlled comparison.

---

## Proposed Integration with Existing Gates

### Current Gate Sequence (Post-Implementation)

```
Implementation
    ↓
Gate B (TypeScript Check)
    ↓
Architecture Guard
    ↓
Regression Protection
    ↓
Contract-Schema Conformance Gate (in progress)
```

### Proposed Gate Sequence (Pre + Post Implementation)

```
G0.5 Canonical Truth Gate ← NEW (pre-implementation)
    ↓ (if GREEN)
Implementation
    ↓
Gate B (TypeScript Check)
    ↓
Architecture Guard
    ↓
Regression Protection
    ↓
Contract-Schema Conformance Gate (verification)
```

**Key change:** G0.5 runs **before** implementation, not after

---

## G0.5 Trigger Classification

**Not all changes require full G0.5 verification.**

### Mandatory G0.5 (Full Check Sequence)
- ✅ New capability implementation
- ✅ New module/domain/schema creation
- ✅ Schema or contract changes
- ✅ Cross-layer changes (Contract ↔ Domain ↔ Schema)
- ✅ Type/vocabulary/ownership changes
- ✅ Architectural boundary changes

### Lightweight Verification
- 🟡 Known-pattern mechanical fixes (import corrections, export additions)
- 🟡 Small isolated bug fixes within verified canonical surface

### G0.5 Not Required
- 🟢 Documentation updates
- 🟢 Test additions (no production code change)
- 🟢 Configuration changes (non-schema)

**Principle:** G0.5 protects against systemic drift, not every code change

---

## Implementation Requirements

### Minimal MVP (Manual)

**Before AI codes new capability or cross-layer change, agent must verify:**

1. **Schema present?**
   ```bash
   grep -r "CREATE TABLE <expected_table>" migrations/
   ```

2. **Types generated?**
   ```typescript
   Database['<schema>']['Tables']['<table>'] // exists in database.types.ts?
   ```

3. **Vocabulary aligned?**
   ```bash
   # Contract enum values
   grep "enum.*UnitOfMeasure" contracts/
   
   # Schema CHECK constraint
   grep "CHECK.*uom" migrations/
   
   # Compare values
   ```

4. **Dependency allowed?**
   ```bash
   # Check if import exists in other Platform examples
   grep -r "from.*contracts" platform/*/domain/
   ```

**If any check fails:** STOP, report inconsistency, do not implement

---

### Automated Tool (Future)

**Command:** `npm run governance:canonical-check`

**Input:** Implementation intent (e.g., "Implement Logistics Warehouse receipt")

**Output:**
```
🔍 Canonical Truth Gate (G0.5)

Schema Presence:        ✅ PASS
Generated Types:        ❌ FAIL (logistics.* not found)
Vocabulary Conformance: ⏸️  SKIP (blocked by previous check)
Dependency Direction:   ⏸️  SKIP (blocked by previous check)
Type Ownership:         ⏸️  SKIP (blocked by previous check)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Result: 🔴 BLOCKED

Action Required:
  1. Regenerate database types: npm run db:types
  2. Re-run canonical check
  3. Only implement after GREEN status

Do not proceed with implementation.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## AI Coding Contract Update

**Current principle:**
> Before implementing, read relevant code to understand patterns

**Proposed addition:**
> **Before implementing, verify canonical surfaces are aligned:**
> 1. Schema present in migrations?
> 2. Generated types reflect schema?
> 3. Contract/Schema/Domain vocabulary aligned?
> 4. Dependency direction allowed?
> 5. Type ownership clear?
>
> **If any check fails: STOP. Report inconsistency. Do NOT guess or implement.**

---

## Success Criteria

**G0.5 is successful if:**

1. **AI stops before coding when canonical drift exists**
   - Not: "I'll implement and fix errors later"
   - But: "Canonical surfaces misaligned, implementation blocked"

2. **Vocabulary drift detected pre-implementation**
   - Not: Discovered after 613 diagnostics
   - But: Discovered at Check 3, before any code written

3. **Architectural boundaries respected**
   - Not: Import from contracts, then discover prohibition
   - But: Check dependency direction before coding

4. **Type ownership clarified before implementation**
   - Not: Create types to silence errors
   - But: Verify canonical owner exists before referencing

---

## Relationship to Contract-Schema Conformance Gate

**Contract-Schema Gate (in progress):** Post-implementation verification

**G0.5 Canonical Truth Gate (proposed):** Pre-implementation verification

**Complementary roles:**

| Gate | Timing | Purpose | Example |
|------|--------|---------|---------|
| **G0.5** | Before code | Prevent coding against unverified surface | Block Logistics implementation until types regenerated |
| **Contract-Schema** | After code | Verify implementation conforms to canonical | Detect if code uses `'PL'` when schema requires `'PLT'` |

**Together:** Pre-implementation blocking + post-implementation verification = **Evidence-driven development**

---

## Proposed Workflow

### Evidence-Driven Coding (Bella Standard)

```
DISCOVER → RECONCILE → CONFORM → IMPLEMENT → VERIFY
   ↓          ↓          ↓          ↓          ↓
Architecture Canonical  G0.5      Code      Gate B
Intent      Alignment   GREEN               Contract-Schema
                                            Arch Guard
```

**Not:**
```
IMPLEMENT → COMPILE → REPAIR → DISCOVER
   ↓          ↓         ↓         ↓
Code      Errors    Fix      Find drift
         (613)     reactively
```

---

## Governance Learning

**What Logistics revealed:**

1. **Compiler errors are late feedback**
   - 613 diagnostics appeared after implementation
   - Should have been caught pre-implementation

2. **Reactive fixing is expensive**
   - Phase 1K: Compiler bottleneck investigation
   - Phase 1L: Batch remediation
   - Phase 1M: Cluster ownership analysis
   - Could have been prevented with pre-implementation check

3. **Vocabulary drift compounds**
   - Contract `'PL'` persisted unchallenged
   - Domain `'PLT'` developed independently
   - Generated types reflected neither
   - Discovered only after 613 diagnostics

4. **Architectural boundaries discovered reactively**
   - Domain → Contracts import attempted
   - Discovered prohibition through evidence search
   - Should have been checked before import

**Core principle reinforced:**
> **Governance helps AI: Detect early (gates), Fix fast when known (patterns), Stop immediately when unknown (STOP conditions).**

**G0.5 extends "detect early":**
> Detect **before implementation**, not after compilation

---

## Next Steps

### Immediate (Manual Process) - APPROVED

**Update AI Coding Contract:**
- ✅ Add lean G0.5 principle: "Before implementation, verify canonical surface. If inconsistent or ambiguous, STOP."
- ✅ Document manual check sequence for mandatory triggers
- ✅ Require STOP on any check failure

**Apply to current work:**
- ✅ UOM Investigation: Contract consumer boundary analysis (investigation only, no code changes)
- ✅ Before new Logistics features: Run manual G0.5 checks
- ❌ NO retroactive Platform-wide enforcement (field validation first)

### Short-term (Tooling)

**Implement `governance:canonical-check` script:**
- Schema presence verification
- Generated types alignment check
- Vocabulary conformance validation
- Dependency direction verification
- Type ownership analysis

**Integrate with AI workflow:**
- Agent automatically runs check before implementation
- Reports findings to user
- Blocks coding if not GREEN

### Long-term (Platform-wide) - DEFERRED

**Field validation first, then expand:**
- ✅ Logistics/UOM: First field case for G0.5 MVP
- 🔜 New Industry OS: G0.5 mandatory before first line of code
- ⏸️ Healthcare, Finance: Retrospective verification (after Logistics field validation)
- ⏸️ Education, Real-Estate: Post-RESET canonical baseline

**Future enhancement (after field validation):**
- Contract-Schema-Domain vocabulary synchronization tool
- Canonical surface version control
- Pre-commit hook for canonical drift detection

**Principle:** Mechanism → Field validation → Freeze/Expand (consistent with Bella governance evolution)

---

## Open Questions

1. **Should G0.5 be enforced for all code, or only "new capability" implementation?**
   - Small bug fixes likely don't need full check
   - Threshold: More than 3 files touched?

2. **How to handle "intentional drift" (public API vs internal domain)?**
   - Needs explicit documentation
   - Contract as external vocabulary, domain as internal?

3. **Should G0.5 block on WARNING, or only ERROR?**
   - Vocabulary mismatch: ERROR (must reconcile)
   - Type ownership unclear: WARNING (investigate first)

4. **Integration with spec workflow?**
   - Should spec design phase include G0.5 check?
   - Or only at implementation step?

---

## Summary

**Problem:** AI coded Logistics before verifying canonical surfaces → 613 diagnostics (downstream evidence of unverified canonical surfaces)

**Root cause:** No pre-implementation gate to verify Contract ↔ Schema ↔ Domain alignment

**Approved solution:** G0.5 Canonical Truth Gate (lean MVP)

**Core principle:** **AI MUST NOT IMPLEMENT AGAINST AN UNVERIFIED CANONICAL SURFACE**

**Workflow change:**
- Before: IMPLEMENT → COMPILE → REPAIR (reactive)
- After: DISCOVER → RECONCILE → CONFORM → IMPLEMENT → VERIFY (evidence-driven)

**Key distinction:**
> **AI is allowed to investigate when it doesn't know.**  
> **AI is NOT allowed to implement when it doesn't know.**

**Expected impact:**
- Prevent vocabulary drift before it enters code
- Detect architectural boundary violations pre-implementation
- Reduce reactive remediation work (Phase 1K, 1L, 1M pattern)
- Shift AI behavior: Evidence-driven vs Compiler-driven

**Trigger classification:**
- Mandatory: New capability, schema/contract changes, cross-layer changes
- Lightweight: Known-pattern mechanical fixes
- Not required: Documentation, tests, non-schema config

**Relationship to other gates:**
- G0.5: Pre-implementation (prevent)
- Contract-Schema Conformance: Post-implementation (verify)
- Together: Prevent before → Verify after

**Status:** ✅ APPROVED (lean MVP), field validation in progress (Logistics/UOM)

---

**Last Updated:** 2026-09-03  
**Next Action:** 
1. ✅ Incorporate lean principle into AI Coding Contract
2. ✅ Execute UOM contract consumer investigation (no code changes)
3. ⏸️ Platform-wide adoption deferred pending field validation
