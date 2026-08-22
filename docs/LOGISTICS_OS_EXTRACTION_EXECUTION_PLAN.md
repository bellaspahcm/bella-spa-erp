# Logistics OS Extraction — Execution Plan

**Date:** 2026-08-22  
**Status:** Ready to Execute  
**Principle:** Evidence > Hypothesis. Extract only what is provably generic.

---

## Core Principle

> **"E6 alone cannot prove cross-product reuse. Only extract primitives that are domain-agnostic. Let E7 prove domain capabilities."**

---

## Extraction Phases

### Phase 1: Generic Primitives (Extract NOW)

**Rationale:** These are provably generic, not domain-specific

#### 1.1 State Transition Primitive

**What to Extract:**
- Generic state machine: `transition(from, to, rules)`
- Transition validation: `canTransition(current, target, rules)`
- **NOT:** Warehouse-specific states (draft/submitted/completed)

**Why Safe:**
- State transitions are universal programming primitive
- Not specific to Logistics, Warehouse, or any domain
- E7 can define its own states, reuse transition logic

**Target:** `src/platform/logistics/shared-kernel/state-machine/`

**Test:** E6 receipts continue to work with their own states

---

#### 1.2 Validation Engine

**What to Extract:**
- Validator interface: `validate(input, rules) → errors[]`
- Common rules: `exists()`, `isActive()`, `belongsToTenant()`
- Rule composition: `and()`, `or()`, `not()`

**What NOT to Extract:**
- SKU-specific validators (stay in Warehouse)
- Location hierarchy validators (stay in Warehouse)

**Why Safe:**
- Validation is universal programming primitive
- Rules are generic (exists, active, tenant)
- E7 can define its own validators, reuse engine

**Target:** `src/platform/logistics/shared-kernel/validation/`

**Test:** E6 SKU/location validation continues to work

---

#### 1.3 Query/Aggregation Primitives

**What to Extract:**
- Query builder: `count()`, `sum()`, `avg()`, `groupBy()`
- Filter builder: `where()`, `equals()`, `in()`, `between()`

**What NOT to Extract:**
- Receipt-specific queries (stay in Warehouse)
- Inventory-specific queries (stay in Warehouse for now)

**Why Safe:**
- Aggregation is universal database primitive
- Not specific to any domain
- E7 can use same primitives for its own entities

**Target:** `src/platform/logistics/shared-kernel/queries/`

**Test:** E6 count/sum queries continue to work

---

### Phase 2: Domain Capabilities (Wait for E7)

**Rationale:** Need E7 evidence to prove these are cross-product

#### 2.1 Inventory Movement (WAIT)

**Why Wait:**
- E6 only proves Warehouse needs inventory movement
- Order Fulfillment might need different movement semantics
- Extract after E7 shows it needs same capability

**Decision Point:** After E7 R1-R5 complete, evaluate if Order Fulfillment reuses Warehouse inventory movement pattern

---

#### 2.2 SKU Entity (WAIT)

**Why Wait:**
- E6 only proves Warehouse references SKU
- Order Fulfillment might reference SKU differently
- Need to see if SKU is truly shared master data or Product-specific

**Decision Point:** After E7 schema design, evaluate if Order Fulfillment uses same SKU entity

---

#### 2.3 Bulk Operations (WAIT)

**Why Wait:**
- E6 only has 1 use case (R13 bulk movements)
- No evidence yet that other Products need bulk pattern
- Extract only if E7/E8 show bulk pattern

**Decision Point:** After E7/E8 complete, count bulk operation use cases

---

#### 2.4 Constraint Framework (WAIT)

**Why Wait:**
- E6 only has 1 constraint (bin capacity)
- No evidence yet that constraint framework is needed
- Extract only if E7/E8 show constraint pattern

**Decision Point:** After E7/E8 complete, count constraint use cases

---

### Phase 3: Product-Specific (Do NOT Extract)

#### 3.1 Bin Management (NEVER EXTRACT)
- Warehouse-specific location concept
- Stay in Warehouse Product

#### 3.2 Receipt Entity (NEVER EXTRACT)
- Warehouse-specific domain model
- Stay in Warehouse Product

#### 3.3 Location Hierarchy (NEVER EXTRACT)
- Warehouse-specific (warehouse → zone → aisle → bin)
- Stay in Warehouse Product

---

## Execution Protocol

### For Each Capability (Phase 1)

```
Step 1: Design
  → Define interface (types only)
  → Review: is this truly generic?
  → Document: why this is domain-agnostic
  → Commit: types only

Step 2: Implement
  → Implement core logic
  → No dependencies on Warehouse
  → No domain-specific semantics
  → Commit: implementation

Step 3: Test
  → Unit tests for capability
  → Test with generic examples
  → NO dependency on E6 data
  → Commit: tests

Step 4: E6 Regression
  → Run all E6 tests (R1-R15)
  → Verify: 60/60 PASS unchanged
  → Verify: E6 code unchanged
  → Document: E6 baseline preserved

Step 5: Lock
  → Commit: capability locked
  → Document: extraction rationale
  → Move to next capability
```

---

## Critical Rules

### ✅ DO
- Extract only generic primitives (state, validation, query)
- Test each capability independently
- Verify E6 regression after each extraction
- Document why capability is domain-agnostic

### ❌ DO NOT
- Extract domain capabilities without E7 evidence
- Refactor E6 to use extracted capabilities
- Optimize for LOC reduction target
- Rush extraction to start E7

### ⚠️ MINDSET
```
WRONG: "Extract 5 capabilities to save 580-870 LOC"
RIGHT: "Extract 3 generic primitives, let E7 test if they're useful"
```

---

## Expected Outcome

### After Phase 1 Extraction

**Code Structure:**
```
src/platform/logistics/shared-kernel/
├── state-machine/
│   ├── types.ts          (State, Transition, Rules)
│   ├── state-machine.ts  (transition logic)
│   └── index.ts
├── validation/
│   ├── types.ts          (Validator, Rule, Result)
│   ├── validator.ts      (validation engine)
│   ├── rules.ts          (exists, active, tenant)
│   └── index.ts
└── queries/
    ├── types.ts          (Query, Filter, Aggregate)
    ├── query-builder.ts  (count, sum, avg)
    └── index.ts
```

**E6 Status:**
- All R1-R15 tests: ✅ 60/60 PASS (unchanged)
- E6 code: ✅ Unchanged
- E6 LOC: ✅ ~2,700 (unchanged)
- E6 metrics: ✅ All unchanged

**Shared Kernel Status:**
- ✅ 3 generic primitives available
- ✅ Unit tested
- ✅ No domain dependencies
- ✅ Ready for E7 to import

---

## E7 Will Test

**E7 Order Fulfillment will answer:**

1. **Can E7 use state-machine primitive for order status transitions?**
   - If YES → primitive is truly generic ✅
   - If NO → primitive had hidden Warehouse assumptions ❌

2. **Can E7 use validation engine for order/customer validation?**
   - If YES → engine is truly generic ✅
   - If NO → engine had hidden Warehouse assumptions ❌

3. **Can E7 use query primitives for order metrics/reporting?**
   - If YES → primitives are truly generic ✅
   - If NO → primitives had hidden Warehouse assumptions ❌

4. **Does E7 need inventory movement from Warehouse?**
   - If YES → extract inventory movement before E8
   - If NO → inventory movement is Warehouse-specific

5. **Does E7 reference SKU the same way Warehouse does?**
   - If YES → extract SKU as shared master data before E8
   - If NO → SKU is Warehouse-specific

**E7 is the test. Not E6.**

---

## Forecast (Hypothesis Only)

**IF extraction is correct AND E7 reuses primitives:**

| Metric | E6 Baseline | E7 Hypothesis | Evidence After E7 |
|--------|-------------|---------------|-------------------|
| Total LOC | ~2,700 | ~2,200 | TBD (measure) |
| Category B | 100% | 80% | TBD (measure) |
| Category C | 0% | 20% | TBD (measure) |

**These are hypotheses, not targets.**

**Actual E7 metrics = evidence.**

---

## Success Criteria

### Phase 1 Success
- ✅ 3 capabilities extracted (state, validation, query)
- ✅ Each capability unit tested
- ✅ E6 regression: 60/60 PASS unchanged
- ✅ Extraction rationale documented

### E7 Success (Future)
- ✅ E7 imports 1+ shared-kernel capabilities
- ✅ Category C > 0% in E7
- ✅ E7 creates evidence for Phase 2 extraction

### E8 Success (Future)
- ✅ E8 reuses Phase 1 + Phase 2 capabilities
- ✅ Category C increases (E8 > E7 > E6)
- ✅ Total LOC decreases (E8 < E7 < E6)

---

## Timeline

```
NOW
 │
 ├─ Phase 1.1: State Machine Primitive (4-6 hours)
 │   └─ Design → Implement → Test → E6 Regression → Lock
 │
 ├─ Phase 1.2: Validation Engine (4-6 hours)
 │   └─ Design → Implement → Test → E6 Regression → Lock
 │
 ├─ Phase 1.3: Query Primitives (4-6 hours)
 │   └─ Design → Implement → Test → E6 Regression → Lock
 │
 ├─ Phase 1 Complete (1-2 days total)
 │
 ├─ E7 Planning (1 day)
 │   └─ Order Fulfillment requirements + contract
 │
 ├─ E7 Execution (3-5 days)
 │   └─ Implement + measure (same protocol as E6)
 │
 ├─ E7 Analysis (1 day)
 │   └─ Compare E6 vs E7, test extraction hypothesis
 │
 └─ Phase 2 Decision
     └─ Extract domain capabilities if E7 proves cross-product
```

---

## Key Quotes (User Intent)

> **"E6 chỉ là evidence cho Warehouse. Nó không thể tự chứng minh State Machine là cross-product."**

> **"Không extract vì pattern giống nhau. Chỉ extract vì evidence chứng minh cross-product."**

> **"Đừng dùng con số '580-870 LOC saved' làm target. Con số này chỉ là forecast. Hãy để code trả lời."**

> **"E7 Order Fulfillment là bài test cực kỳ quan trọng: Những thứ Bella vừa extract có thực sự trở thành OS capability hay chỉ là abstraction đẹp nhưng không tạo reuse?"**

> **"Tôi sẽ không cố làm E7 nhanh. Tôi sẽ cố làm E7 trung thực."**

---

## Next Action

Begin Phase 1.1: State Machine Primitive extraction

**Command to execute:**
```
Begin state-machine extraction
↓
Create types.ts (interfaces only)
↓
Review: is this truly generic?
↓
Implement state-machine.ts
↓
Write unit tests
↓
Run E6 regression (60/60 PASS)
↓
Lock capability
```

---

**STATUS:** Ready to execute Phase 1.1  
**Date:** 2026-08-22  
**Principle:** Evidence > Hypothesis
