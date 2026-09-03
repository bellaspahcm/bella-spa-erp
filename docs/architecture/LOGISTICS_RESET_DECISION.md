# Logistics Controlled Reset Decision

**Status:** ✅ APPROVED IN PRINCIPLE  
**Date:** 2026-09-03  
**Scope:** Logistics implementation reset, canonical preservation

---

## Decision Summary

**RESET LOGISTICS** with controlled preservation of canonical assets

**Rationale:**
- Implementation drift across multiple layers (E6/E7, schema/types, contract/domain vocabulary)
- 609 diagnostics after compiler fix + type ownership investigation
- NO production customers (reset cost is low)
- Opportunity: First real **G0.5 field test** (rebuild from verified canonical surface)

**Goal:**
> Prove Bella can rebuild Industry OS from canonical architecture without recreating architectural drift

---

## Reset Strategy

```
              LOGISTICS RESET
                    │
        ┌───────────┴───────────┐
        │                       │
      PRESERVE                 RESET
        │                       │
   E7 Schema                Current impl
   Canonical Contracts      Broken imports
   Domain semantics         Drifted repositories
   RLS / tenant rules       Stale generated usage
   Architecture decisions  Experimental E6 code
   Migration evidence      Unnecessary abstractions
   Tests/evidence           Compiler debt (609 diagnostics)
```

---

## Preserve (Canonical Truth)

**DO NOT delete or modify these without evidence:**

### 1. E7 Canonical Schema
- ✅ `migrations/logistics/20260822_logistics_os_domain_kernel.sql`
- ✅ All `logistics.*` tables (items, locations, inventory, inventory_movements, traceability, uom)
- ✅ RLS policies (tenant isolation)
- ✅ Indexes, constraints, triggers
- ✅ Schema-level architecture decisions

**Why preserve:** This is the verified canonical data model (E7.1, E7.2, E7.3)

### 2. Domain Semantics (After Audit)
- ✅ Core domain concepts proven through forensics
- ✅ Domain types aligned with E7 schema (e.g., `StandardUOM = 'PLT'`)
- ✅ Invariants, business rules, domain logic with evidence
- ⚠️ Remove: Drift, workarounds, compiler-driven fixes

**Why preserve:** Domain knowledge is architectural asset, not implementation debt

### 3. Canonical Contracts (After Audit)
- ⚠️ Audit contracts for vocabulary drift (e.g., `'PL'` vs `'PLT'`)
- ✅ Preserve: Contracts aligned with E7 schema
- 🔄 Reconcile: Contracts with schema/domain vocabulary mismatch
- ❌ Remove: E6 contracts if E7 supersedes

**Why preserve (selectively):** Public API surface, but only if schema-aligned

### 4. Architecture Decisions
- ✅ Layer boundaries (Contract, Domain, Repository, Service)
- ✅ Dependency direction rules (domain does NOT import contracts)
- ✅ E7 kernel boundaries (frozen)
- ✅ Tenant isolation patterns

**Why preserve:** These are proven architectural principles, not implementation

### 5. Evidence & Tests (Selective)
- ✅ Tests verifying E7 semantics, RLS, invariants
- ✅ Migration verification evidence
- ❌ Tests coupling to broken implementation
- ❌ Tests written to pass despite compiler errors

**Why preserve (selectively):** Evidence of correct behavior, not drift

---

## Reset (Implementation Debt)

**Safe to delete or rebuild from canonical surface:**

### 1. Current Implementation Files (If Drifted)
- 🔄 Repository layer: Rebuild from schema + domain
- 🔄 Service layer: Rebuild from contracts + domain
- 🔄 Engine implementations: Rebuild from E7 patterns
- ❌ Workaround code: Delete (import fixes, type aliases created for compiler)

**Why reset:** Implementation drift from canonical surface

### 2. Type/Import Workarounds
- ❌ Import corrections made reactively (Batches A-D, M1.1-M1.3)
- ❌ Type aliases created to silence TS2305
- ❌ Generated types reflecting old schema
- 🔄 Regenerate: `database.types.ts` from current E7 schema

**Why reset:** These are symptoms, not architecture

### 3. E6 Legacy (If Not Canonical Path)
- ⚠️ Audit: Is E6 implementation still needed?
- ❌ If E7 supersedes: Delete E6 code
- ✅ If E6 still valid: Preserve but separate from E7

**Why reset (conditionally):** Avoid carrying forward deprecated patterns

### 4. Compiler Debt (609 Diagnostics)
- ❌ Do NOT carry 609 diagnostics into new implementation
- ❌ Do NOT fix these reactively
- ✅ Let them disappear as correct implementation emerges from canonical surface

**Why reset:** Diagnostics are downstream evidence of drift, not root problems

### 5. Unnecessary Abstractions
- ❌ Over-engineered patterns without evidence
- ❌ Premature kernel extractions
- ❌ "Future-proofing" without real use case

**Why reset:** Violates "minimal complexity" principle

---

## What NOT to Reset

**DO NOT delete the database:**
- ❌ NO `DROP SCHEMA logistics CASCADE`
- ❌ NO migration rollback
- ✅ Schema is canonical truth, keep it

**DO NOT delete architecture documentation:**
- ✅ Keep E7 architecture decisions
- ✅ Keep kernel boundaries
- ✅ Keep layer definitions

**DO NOT delete governance learning:**
- ✅ Keep Phase 1K, 1L, 1M forensics
- ✅ Keep G0.5 discovery
- ✅ Keep vocabulary drift evidence

**Why:** These are assets, not liabilities

---

## Controlled Reset Process

**NOT:**
```
Delete everything → Code from scratch → Hope it works
```

**BUT:**
```
Inventory → Classify → Preserve canonical → Reset implementation → Rebuild from verified surface
```

### Step 1: Inventory (NEXT ACTION)

**Create:** `LOGISTICS_RESET_INVENTORY.md`

**Classify every file/component:**

| Category | Action | Example |
|----------|--------|---------|
| **PRESERVE** | Keep as-is | E7 schema, RLS policies, domain semantics (verified) |
| **RESET** | Delete & rebuild | Repositories, services, drifted implementations |
| **DELETE** | Remove permanently | E6 legacy (if superseded), workarounds, compiler fixes |
| **REVIEW** | Audit before decision | Contracts (vocabulary drift), tests (coupling) |

**Output:** Complete classification of all Logistics code/schema/docs

### Step 2: Canonical Surface Verification (Before Any Rebuild)

**Run G0.5 checks on preserved assets:**

1. ✅ Schema present? (E7 migrations exist)
2. 🔄 Generated types reflect schema? (Regenerate `database.types.ts`)
3. ⚠️ Contract/Schema/Domain vocabulary aligned? (Audit `'PL'` vs `'PLT'`)
4. ✅ Dependency direction documented? (No domain → contracts)
5. ✅ Type ownership clear? (Domain canonical, contracts public API)

**If ANY check fails:** Fix canonical surface BEFORE rebuilding implementation

### Step 3: Vertical Slice Rebuild (G0.5 Field Test)

**NOT:** Rebuild entire Logistics at once

**BUT:** One vertical slice at a time

**Example: Item/SKU Management**

```
1. G0 Architecture Review
     ↓
2. Verify E7 Schema (items table)
     ↓
3. Regenerate Database Types
     ↓
4. G0.5 Canonical Check (GREEN required)
     ↓
5. Implement Domain Layer
     ↓
6. Implement Repository
     ↓
7. Implement Contract
     ↓
8. Implement Service
     ↓
9. Gate B (TypeScript)
     ↓
10. Architecture Guard
     ↓
11. Contract-Schema Conformance
     ↓
12. Tests
     ↓
13. NEXT SLICE
```

**Key:** Each slice must be GREEN before next slice starts

### Step 4: Incremental Validation

**After each vertical slice:**
- Gate B: TypeScript check
- Architecture Guard: Boundary enforcement
- Regression: Diagnostic count (should be minimal for clean rebuild)
- Contract-Schema: Vocabulary conformance

**If ANY gate fails:** STOP, fix canonical surface, do not proceed

### Step 5: Production-Candidate Criteria

**Logistics is production-candidate when:**
- ✅ All E7 capabilities implemented from canonical surface
- ✅ Gate B GREEN (zero type errors)
- ✅ Architecture Guard GREEN
- ✅ Contract-Schema conformance GREEN
- ✅ No vocabulary drift (PL/PLT resolved)
- ✅ Tests cover E7 semantics
- ✅ Documentation complete

---

## Why Controlled Reset > Incremental Remediation

### Current Path (Incremental Remediation)

**Status:**
- 609 diagnostics remain
- Vocabulary drift discovered (PL vs PLT)
- Multiple layers drifted (E6/E7, schema/types, contract/domain)
- Phase 1K, 1L, 1M required (compiler → type → ownership investigation)
- Still 599+ diagnostics after import fixes

**Projection:**
- Phase 1M.2: UOM vocabulary reconciliation (9 errors)
- Phase 1M.3: AddCustodyEventProps review (1 error)
- Phase 1N: Next cluster (remaining 599 errors)
- Phase 1O, 1P, 1Q... (unknown scope)
- Each phase risks discovering new drift

**Timeline:** Weeks of reactive remediation

**Risk:** Legacy debt accumulates, no guarantee of clean end state

### Reset Path (G0.5 Field Test)

**Status after inventory:**
- Canonical surface verified (E7 schema + regenerated types)
- Vocabulary reconciled BEFORE implementation
- Architecture boundaries documented
- G0.5 prevents drift from entering code

**Projection:**
- Inventory: 1-2 days
- Canonical verification: 1 day
- Vertical slice 1 (Item): 2-3 days (G0.5 → implementation → gates)
- Vertical slice 2 (Inventory): 2-3 days
- Vertical slice 3 (Movement): 2-3 days
- ...repeat until E7 complete

**Timeline:** ~2 weeks for clean, production-candidate implementation

**Risk:** Low (each slice verified before next, G0.5 prevents drift)

---

## Value of Reset as G0.5 Field Test

**This is the FIRST opportunity to prove:**

1. **G0.5 works in practice**
   - Can it detect vocabulary drift before coding?
   - Does it prevent 609-diagnostic cascades?
   - Is lean MVP sufficient?

2. **Bella can rebuild without recreating drift**
   - E7 schema → clean implementation
   - No E6/E7 mixing
   - No compiler-driven workarounds
   - Architecture-first, not reactive

3. **Evidence-driven development at scale**
   - Full vertical slice with all gates
   - Contract-Schema conformance from day 1
   - Type ownership clear before implementation
   - Dependency direction enforced

4. **Controlled reset is viable strategy**
   - Not "delete everything and start over"
   - Preserve canonical truth, reset implementation
   - Faster than incremental remediation when drift is systemic

**If successful:**
- Logistics becomes reference implementation for G0.5
- Reset playbook documented for future drift scenarios
- G0.5 validated, ready for Platform-wide adoption
- Bella proves it can maintain canonical discipline

**If G0.5 reveals gaps:**
- Fix G0.5 based on field evidence
- Refine before Platform-wide adoption
- Learn from real implementation, not theory

---

## Risks & Mitigations

### Risk 1: Losing valuable domain logic

**Mitigation:**
- Inventory BEFORE deletion (PRESERVE/RESET/DELETE/REVIEW classification)
- Domain semantics audited, not auto-deleted
- Tests with E7 evidence preserved
- Architecture decisions documented

### Risk 2: Reset taking longer than remediation

**Mitigation:**
- Incremental vertical slices (not big-bang rewrite)
- Each slice independently valuable
- Can stop at any slice if priority shifts
- G0.5 should prevent rework (no 609-diagnostic cascades)

### Risk 3: Repeating same mistakes

**Mitigation:**
- G0.5 gate prevents coding against unverified surface
- Vocabulary reconciled BEFORE implementation
- Architecture Guard enforces boundaries
- Contract-Schema conformance validates alignment

### Risk 4: Breaking existing consumers (if any exist)

**Mitigation:**
- Logistics has NO production customers (user confirmed)
- Contract API changes acceptable
- If internal consumers exist, audit during inventory

---

## Success Criteria

**Logistics Reset is successful if:**

1. **Faster than continued remediation**
   - Production-candidate in ~2 weeks
   - Compare to: Unknown timeline for 599+ remaining diagnostics

2. **Zero architectural drift**
   - Gate B GREEN (no type errors)
   - No vocabulary conflicts (PL/PLT resolved)
   - No E6/E7 mixing
   - Clean dependency boundaries

3. **G0.5 validated**
   - Field evidence that G0.5 prevents drift
   - Refinements identified for lean MVP
   - Ready for Platform-wide adoption

4. **Reusable playbook**
   - Controlled reset process documented
   - Inventory → Verify → Rebuild → Validate workflow proven
   - Can be applied to future drift scenarios

---

## Next Action: Create Reset Inventory

**BEFORE any deletion or coding:**

**Create:** `docs/architecture/LOGISTICS_RESET_INVENTORY.md`

**Scope:** Classify ALL Logistics assets

**Structure:**
```markdown
# PRESERVE (Canonical Truth)
- E7 schema files
- Domain semantics (audited)
- Architecture docs
- ...

# RESET (Rebuild from Canonical)
- Repository implementations
- Service layer
- Engine implementations
- ...

# DELETE (No Value)
- E6 legacy (if superseded)
- Compiler workarounds
- Type aliases for TS2305
- ...

# REVIEW (Audit Required)
- Contracts (vocabulary drift)
- Tests (coupling vs evidence)
- Generated types (regenerate?)
- ...
```

**Output:** Complete classification → User approval → Execute reset

---

## Governance Principle

**This reset demonstrates:**

> **When systemic drift exceeds remediation value, controlled reset from canonical surface is faster and cleaner than incremental repair.**

**Criteria for controlled reset:**
1. Multiple layers drifted simultaneously
2. Remediation timeline exceeds rebuild timeline
3. Canonical truth exists and is verified
4. NO production customers (reset cost is low)
5. Opportunity for governance field validation (e.g., G0.5)

**When NOT to reset:**
- Single-layer drift (targeted fix appropriate)
- Production customers (migration cost high)
- No canonical surface to build from
- Drift is well-understood and scoped

---

**Status:** ✅ APPROVED IN PRINCIPLE  
**Next Action:** Create `LOGISTICS_RESET_INVENTORY.md` (classification before execution)  
**Timeline:** Inventory 1-2 days → User approval → Vertical slice rebuild ~2 weeks  
**Goal:** Production-candidate Logistics + G0.5 field validation

**Last Updated:** 2026-09-03
