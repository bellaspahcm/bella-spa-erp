# Retail OS R1 + R2 Extraction - Implementation Plan

**Date:** 2026-09-06  
**Scope:** Extract Product Catalog (R1) and Inventory Movement (R2) engines only  
**Objective:** Validate architecture decision with runtime evidence  
**Status:** 🟡 PLANNED

---

## Extraction Scope

### ✅ IN SCOPE

**R1: Product Catalog Engine**
- Product CRUD operations
- SKU-based identity
- Status lifecycle management
- Pricing attributes (base_price, cost_price)

**R2: Inventory Movement Engine**
- Stock movement recording
- Audit trail (previous → new stock)
- Reorder detection
- Movement history

### ❌ OUT OF SCOPE

- Sale Transaction (deferred)
- Customer Management (keep in Product)
- Pricing Management (keep in Product)
- Stock Availability (keep in Product)
- Payment processing
- Loyalty programs
- Any new capabilities

---

## Implementation Phases

### Phase 1: Contract Definition ✅ FROZEN

**Objective:** Define frozen public contracts for R1 + R2

**Deliverables:**
1. `src/platform/retail/contracts/product-catalog.contract.ts`
2. `src/platform/retail/contracts/inventory-movement.contract.ts`

**Constraints:**
- Minimal surface (only proven operations from Product #1)
- No generic abstractions
- No future-proofing
- Strict input/output types

**Verification:**
- Contract review (semantic clarity)
- No Product-specific leakage
- Ownership clear (Retail OS)

---

### Phase 2: Engine Implementation 🏗️ MINIMAL

**Objective:** Implement minimal engines that satisfy contracts

**Deliverables:**
1. `src/platform/retail/engines/product-catalog/`
   - Domain entities (if needed)
   - Repository
   - Engine implementation
2. `src/platform/retail/engines/inventory-movement/`
   - Domain entities (if needed)
   - Repository
   - Engine implementation

**Constraints:**
- Reuse Platform primitives (BaseSupabaseRepositoryPrimitive, ExceptionMapper)
- No orchestration logic (pure domain operations)
- Minimal LOC (only contract operations)
- No speculative features

**Verification:**
- Unit tests for domain logic
- Repository tests with DB
- Contract conformance

---

### Phase 3: Product Refactor 🔄 CONSUMER

**Objective:** Refactor bella-retail-store to consume R1 + R2 contracts

**Deliverables:**
1. Update `bella-retail-store` services to inject contracts
2. Remove direct Supabase access for product/inventory operations
3. Product orchestrates, Retail OS executes

**Constraints:**
- NO semantic duplication (Product uses contracts, not reimplements)
- Orchestration stays in Product (checkout flow, business rules)
- Integration tests unchanged (verify behavior preserved)

**Verification:**
- All existing tests pass (19/19)
- No regression in functionality
- Clear boundary (Product → Contract → Engine)

---

### Phase 4: Architecture Verification ✅ GATES

**Objective:** Verify extraction preserves architecture invariants

**Deliverables:**
1. Architecture Guard verification
2. TypeScript compliance
3. Regression tests
4. Contract conformance tests

**Gates:**
- ✅ Architecture Guard PASS
- ✅ TypeScript check PASS
- ✅ All Product tests PASS
- ✅ No boundary violations

---

### Phase 5: Evidence & Seal 📋 CLOSURE

**Objective:** Document extraction evidence and seal engines

**Deliverables:**
1. Extraction evidence document
2. LOC analysis (before/after)
3. Boundary validation report
4. R1 + R2 SEAL decision

**Evidence Required:**
- Contracts proven stable
- Product successfully consumes contracts
- No semantic leakage
- Architecture Guard GREEN
- Regression tests GREEN

---

## Locked Principles

### 1. ❌ No Factory Infrastructure Expansion

**Rule:** Do NOT build automation for extraction

**Rationale:** Factory Test #1 proved autonomy; no gaps discovered

---

### 2. ❌ No Product #2

**Rule:** Do NOT build second Reference Product during extraction

**Rationale:** R1 + R2 HIGH confidence; Product #2 unnecessary for validation

---

### 3. ❌ No Additional Capability Extraction

**Rule:** Do NOT extract Sale Transaction, Customer, Pricing, Stock Availability

**Rationale:** Evidence insufficient; decision deferred

---

### 4. ❌ No Generic Abstractions

**Rule:** Do NOT create abstract base classes "for future reuse"

**Rationale:** Build only what R1 + R2 contracts require

---

### 5. ✅ Canonical Semantic Ownership is Goal

**Rule:** Code reuse is secondary; semantic ownership is primary

**Rationale:** Retail OS owns Product/Inventory semantics, not implementation patterns

---

### 6. 🛑 STOP if Boundary Wrong

**Rule:** If extraction reveals incorrect boundary → STOP and reopen decision

**Do NOT:** Self-expand scope to "fix" boundary issues

**Do:** Document issue, revert if needed, reassess decision

---

## Success Criteria

### Minimum Viable Extraction

✅ **Contracts frozen** (R1 + R2 public interfaces defined)  
✅ **Engines minimal** (only contract operations implemented)  
✅ **Product refactored** (bella-retail-store consumes contracts)  
✅ **Tests GREEN** (all 19/19 Product tests pass)  
✅ **Architecture Guard PASS** (no boundary violations)  
✅ **Evidence documented** (extraction validated)

### Extraction Quality

✅ **No semantic duplication** (Product uses contracts, not duplicates)  
✅ **Clear ownership** (Retail OS owns Product/Inventory semantics)  
✅ **Stable boundary** (Product → Contract → Engine separation clear)  
✅ **Minimal LOC** (no speculative features)

### Validation Evidence

✅ **Boundary validation** (Product-Contract-Engine separation works)  
✅ **Regression protection** (no functionality lost)  
✅ **Contract stability** (interfaces satisfy Product needs)  
✅ **Architecture compliance** (Guard + TypeScript GREEN)

---

## Risk Management

### Risk #1: Contract Incompleteness

**Risk:** Contract missing operations Product needs

**Mitigation:**
- Review Product #1 usage before contract definition
- Ensure contract covers all observed Product operations
- If gap found → assess if Product-specific or Retail-wide

**Response:** If Retail-wide operation missing → Add to contract (acceptable)

---

### Risk #2: Boundary Leakage

**Risk:** Product-specific logic leaks into Retail OS

**Mitigation:**
- Contract review before implementation
- Keep orchestration in Product layer
- Engine implements ONLY domain primitives

**Response:** If leakage detected → Refactor or revert

---

### Risk #3: Over-Engineering

**Risk:** Building generic abstractions beyond R1 + R2 needs

**Mitigation:**
- Minimal implementation (only contract operations)
- No "future-proofing"
- Review against "simplest design" principle

**Response:** If over-engineering detected → Simplify or remove

---

### Risk #4: Regression

**Risk:** Extraction breaks Product #1 functionality

**Mitigation:**
- Refactor incrementally
- Run tests after each change
- Keep integration tests as regression protection

**Response:** If regression detected → Revert and reassess

---

## Blocked Scenarios

### Scenario #1: Contract Cannot Cover Product Needs

**If:** Contract missing operation Product requires

**Assessment:**
1. Is operation Product-specific or Retail-wide?
2. Was operation observed in Product #1 evidence?

**Response:**
- If Retail-wide AND observed → Add to contract
- If Product-specific → Keep in Product layer
- If NOT observed → Product-specific, keep in Product

---

### Scenario #2: Engine Implementation Reveals Incorrect Boundary

**If:** Implementing engine reveals semantic unclear or Product-specific

**DO NOT:** Expand scope or create workarounds

**DO:**
1. Document boundary issue
2. STOP extraction
3. Reopen boundary decision
4. Reassess evidence

**Example:**
```text
Implementing Product Catalog reveals:
- Category taxonomy is business-specific (not Retail-wide)

Response:
- STOP R1 extraction
- Reassess Product Management semantic
- Possibly revert to Product-only implementation
```

---

### Scenario #3: Product Refactor Requires Significant Changes

**If:** Refactoring Product to use contracts requires major redesign

**Assessment:** Indicates potential boundary mismatch

**Response:**
1. Assess if contracts match Product needs
2. If mismatch → Review contract design
3. If contract correct but Product complex → Proceed (Product debt)
4. If contract incorrect → Revise contract

---

## Implementation Timeline

**Not time-boxed** - quality over speed

**Estimated phases:**
- Phase 1 (Contracts): ~2-3 hours
- Phase 2 (Engines): ~6-8 hours
- Phase 3 (Refactor): ~4-6 hours
- Phase 4 (Verification): ~2-3 hours
- Phase 5 (Evidence): ~2-3 hours

**Total estimate:** ~16-23 hours for complete extraction

**Checkpoint:** After Phase 1, review contracts before proceeding

---

## Verification Gates

### Gate 1: Contract Definition ✅

**Check:**
- [ ] R1 contract complete (covers Product #1 usage)
- [ ] R2 contract complete (covers Product #1 usage)
- [ ] No Product-specific leakage
- [ ] Semantic ownership clear
- [ ] Minimal surface (no speculation)

**Approval:** Human architect review

---

### Gate 2: Engine Implementation ✅

**Check:**
- [ ] R1 engine implements contract
- [ ] R2 engine implements contract
- [ ] Reuses Platform primitives
- [ ] Minimal LOC (no extra features)
- [ ] Unit tests PASS

**Approval:** Technical review

---

### Gate 3: Product Refactor ✅

**Check:**
- [ ] bella-retail-store uses R1 contract
- [ ] bella-retail-store uses R2 contract
- [ ] No direct Supabase access for product/inventory
- [ ] Integration tests PASS (19/19)
- [ ] No functionality regression

**Approval:** Regression verification

---

### Gate 4: Architecture Verification ✅

**Check:**
- [ ] Architecture Guard PASS
- [ ] TypeScript check PASS
- [ ] No boundary violations detected
- [ ] Contract conformance verified

**Approval:** Architecture compliance

---

### Gate 5: Evidence & Seal 📋

**Check:**
- [ ] Extraction evidence documented
- [ ] Boundary validation complete
- [ ] LOC analysis complete
- [ ] Decision: SEAL R1 + R2

**Approval:** Human architect sign-off

---

## Next Immediate Action

**Phase 1: Contract Definition**

Create frozen contracts:
1. `IProductCatalogContract` (R1)
2. `IInventoryMovementContract` (R2)

Based on Product #1 evidence, define minimal contract surface.

**Proceed?** Yes

---

**Plan Status:** ✅ READY  
**Phase:** Phase 1 (Contract Definition) next  
**Blocking:** None  
**Date:** 2026-09-06
