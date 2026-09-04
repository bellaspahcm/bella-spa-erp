# E11 M1 — Executable Business Truth Contract Implementation Plan

**Status:** 📋 PLANNING  
**Phase:** M1 Implementation  
**Started:** 2026-09-04  
**Design Reference:** E11_DESIGN.md (c820e0d7 - APPROVED)

---

## Architecture Inspection Results

### Existing Bella Infrastructure

**E10 Factory:**
- Location: `scripts/factory/orchestrator.ts`
- Architecture: 7-step pipeline (Evidence → Scope → Build → Tests → Typecheck → G0.5 → ArchGuard)
- Current Input: Industry string + mode + fixture baseline
- **Gap:** No Business Truth Document consumption

**Platform Structure:**
- `src/platform/` — Industry OS implementations (healthcare, education, f-and-b, etc.)
- `src/platform/contracts/` — Minimal (only v1/InboxReceiver.ts)
- `src/platform/core/` — Platform core services
- Pattern: Each industry has `domain/`, `contracts/`, `engines/`, `repositories/`

**Test Infrastructure:**
- Framework: Jest
- Pattern: `src/**/__tests__/*.test.ts`
- Existing: Unit tests, integration tests, edge case tests

**TypeScript Config:**
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`
- Target: ES2017

**Governance:**
- Gate B: TypeScript compilation (`npm run governance:typecheck`)
- Regression: `npm run governance:check-regression`
- Architecture Guard: `npm run arch:guard`

---

## M1 Integration Point Decision

**Where to place Business Truth Contract:**

```
src/platform/
  ├─ business-truth/              # NEW — M1 Implementation
  │   ├─ types/                   # TypeScript types from Q0 contract
  │   │   ├─ business-truth.ts
  │   │   ├─ authority.ts
  │   │   ├─ provenance.ts
  │   │   ├─ confidence.ts
  │   │   └─ lifecycle.ts
  │   ├─ validators/              # State machines + validators
  │   │   ├─ truth-lifecycle.ts
  │   │   ├─ authority-model.ts
  │   │   ├─ epistemic-lifecycle-validator.ts
  │   │   ├─ provenance-tracker.ts
  │   │   └─ confidence-validator.ts
  │   ├─ gate/                    # Business Truth Gate
  │   │   ├─ business-truth-gate.ts
  │   │   ├─ invariants/
  │   │   │   ├─ invariant-1-lifecycle.ts
  │   │   │   ├─ invariant-2-authority.ts
  │   │   │   ├─ invariant-3-confidence.ts
  │   │   │   ├─ invariant-4-provenance.ts
  │   │   │   ├─ invariant-5-implementation.ts
  │   │   │   ├─ invariant-6-authorization.ts
  │   │   │   └─ invariant-7-verification.ts
  │   │   └─ authorization.ts     # Authorization policy (VALIDATED → AUTHORIZED)
  │   ├─ __tests__/               # M1 Tests
  │   │   ├─ contract.test.ts              # Contract unit tests
  │   │   ├─ lifecycle.test.ts             # State machine tests
  │   │   ├─ epistemic-consistency.test.ts # Cross-field invariants
  │   │   ├─ gate.test.ts                  # Gate validation tests
  │   │   ├─ authorization.test.ts         # Authorization boundary tests
  │   │   └─ b0-negative-tests.test.ts     # 7 B0 failure prevention tests
  │   └─ index.ts                 # Public API
  │
  └─ ... (existing industry OS)
```

**Rationale:**
- `src/platform/business-truth/` — New subsystem under platform (peer to industries)
- Reuses existing test infrastructure (Jest, `__tests__/` pattern)
- Integrates with existing governance (Gate B, Arch Guard)
- Clear boundary: Business Truth is a platform capability, not industry-specific

---

## M1 Implementation Sequence

### Phase 1: Types & Schema (M1.1)

**Files:**
1. `src/platform/business-truth/types/business-truth.ts` — Core types
2. `src/platform/business-truth/types/authority.ts` — Authority model types
3. `src/platform/business-truth/types/provenance.ts` — Provenance types
4. `src/platform/business-truth/types/confidence.ts` — Confidence types
5. `src/platform/business-truth/types/lifecycle.ts` — Lifecycle status types

**Success Criteria:**
- ✅ Types compile (Gate B)
- ✅ Match E11 Design specification
- ✅ No external dependencies (self-contained)

---

### Phase 2: State Machines & Validators (M1.2-M1.3)

**Files:**
1. `src/platform/business-truth/validators/truth-lifecycle.ts` — Status state machine
2. `src/platform/business-truth/validators/authority-model.ts` — Authority transitions
3. `src/platform/business-truth/validators/epistemic-lifecycle-validator.ts` — Cross-field consistency
4. `src/platform/business-truth/validators/provenance-tracker.ts` — Provenance validation
5. `src/platform/business-truth/validators/confidence-validator.ts` — Confidence validation

**Success Criteria:**
- ✅ State machines enforce valid transitions
- ✅ Cross-field invariants checked
- ✅ Unit tests pass

---

### Phase 3: Business Truth Gate (M1.4)

**Files:**
1. `src/platform/business-truth/gate/invariants/invariant-1-lifecycle.ts`
2. `src/platform/business-truth/gate/invariants/invariant-2-authority.ts`
3. `src/platform/business-truth/gate/invariants/invariant-3-confidence.ts`
4. `src/platform/business-truth/gate/invariants/invariant-4-provenance.ts`
5. `src/platform/business-truth/gate/invariants/invariant-5-implementation.ts`
6. `src/platform/business-truth/gate/invariants/invariant-6-authorization.ts`
7. `src/platform/business-truth/gate/invariants/invariant-7-verification.ts`
8. `src/platform/business-truth/gate/business-truth-gate.ts` — Gate orchestrator

**Success Criteria:**
- ✅ All 7 invariants implemented
- ✅ Gate returns `GateResult` (not auto-canonicalize)
- ✅ Integration tests pass

---

### Phase 4: Authorization Boundary (M1.5)

**Files:**
1. `src/platform/business-truth/gate/authorization.ts` — Authorization policy

**Success Criteria:**
- ✅ Validates: VALIDATED → AUTHORIZED → CANONICAL
- ✅ Blocks: VALIDATED → CANONICAL (shortcut)
- ✅ Auto-approval criteria explicit
- ✅ Human-required cases explicit

---

### Phase 5: E10 Consumption Boundary (M1.6)

**Files:**
1. `scripts/factory/business-truth-adapter.ts` — E10 adapter for BTD

**Success Criteria:**
- ✅ E10 can only receive CANONICAL truths
- ✅ Non-CANONICAL truths blocked
- ✅ Integration test with mock BTD

---

### Phase 6: Adversarial B0 Tests (M1.7)

**Files:**
1. `src/platform/business-truth/__tests__/b0-negative-tests.test.ts`

**7 Tests:**
1. **Test 1:** Inject `INFERENCE + CANONICAL` → Gate BLOCKS
2. **Test 2:** Inject `AI self-approval of inference` → Gate BLOCKS
3. **Test 3:** Inject `Confidence-only authorization` → Gate BLOCKS
4. **Test 4:** Inject `Business decision without alternatives` → Gate BLOCKS
5. **Test 5:** Inject `No Bella evidence` → Gate WARNS (not blocks)
6. **Test 6:** Attempt E10 bypass (call E10 without gate) → Integration test BLOCKS
7. **Test 7:** E10 test claims without execution → E10 output validation (existing Gate B)

**Success Criteria:**
- ✅ All 7 tests PASS
- ✅ Each test proves BLOCKING (not just validator existence)
- ✅ Adversarial (malformed input, not happy path)

---

### Phase 7: Full M1 Verification (M1.8)

**Verification Steps:**
1. Run all unit tests → PASS
2. Run all integration tests → PASS
3. Run 7 B0 negative tests → PASS
4. Run Gate B (TypeScript) → PASS
5. Run existing regression → PASS
6. Run Architecture Guard → PASS

**Success Criteria:**
```
7 B0 Negative Tests       ✅ PASS
Contract Tests            ✅ PASS
TypeScript Compilation    ✅ PASS
Existing Regression       ✅ PASS
Architecture Guard        ✅ PASS
```

---

## Critical Invariants (Per Approval)

### Gate Validation Phases

**Phase 1: Structural Validation (M2 Research Phase)**

- **Scope:** PROPOSED Business Truths
- **Purpose:** Validate structural correctness of research proposals
- **Validates:** Provenance completeness (Inv 4), Confidence validity (Inv 3), Authority consistency (Inv 2), Implementation feasibility (Inv 5 advisory)
- **Output:** Structurally valid PROPOSED truths (awaiting authorization)

**Phase 2: E10 Authorization (E10 Consumption Phase)**

- **Scope:** CANONICAL Business Truths
- **Purpose:** Validate E10 consumption readiness
- **Validates:** Full Business Truth Gate (all 7 invariants), especially Inv 1 (CANONICAL status) and Inv 6 (Factory authorization)
- **Output:** Authorized CANONICAL truths ready for E10

**Separation Rationale:** PROPOSED is valid intermediate state. E10 requires CANONICAL.

### Invariant: Authorization ≠ Validation

```typescript
// CORRECT
VALIDATED → AUTHORIZATION_POLICY → AUTHORIZED → CANONICAL

// FORBIDDEN
VALIDATED → CANONICAL
```

**Implementation:**
- Gate returns `GateResult { validated, authorizationStatus }`
- Authorization is separate layer
- AUTO_APPROVED = policy decision, not gate decision

---

## Non-Goals (M1 Scope)

**NOT in M1:**
- ❌ Research Engine
- ❌ Evidence Collection
- ❌ Synthesis Engine
- ❌ Inference Engine
- ❌ Self-Critique Engine
- ❌ F&B B0 modifications
- ❌ F&B B1 execution

**M1 Goal:**
> Prove a malformed or unauthorized Business Truth cannot reach E10, even if AI created it.

---

## Implementation Guidelines

**Reuse Existing:**
- Jest test framework
- TypeScript strict mode
- Existing governance gates
- `@/*` path aliases

**Do NOT Invent:**
- New test framework
- New database service
- Generic frameworks
- Message buses
- New abstractions

**Follow Bella Patterns:**
- Minimal abstractions
- Clear boundaries
- Evidence-based design
- Executable tests

---

## Success Definition

**M1 succeeds when:**

```text
Adversarial Input (7 B0 failure modes)
        ↓
Business Truth Contract
        ↓
Expected BLOCK
        ↓
Executable Evidence (tests PASS)
```

**M1 does NOT succeed when:**
- Validators exist but tests don't prove blocking
- Tests are happy-path only
- Shortcuts exist (VALIDATED → CANONICAL)
- Authorization is conflated with validation

---

**Document Status:** 📋 PLAN COMPLETE  
**Next:** M1.1 Implementation — Types & Schema  
**Last Updated:** 2026-09-04
