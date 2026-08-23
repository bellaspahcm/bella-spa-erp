# STEP ② BDGF P1 UNIVERSAL — PREPARATION

**Status:** 📋 **PREPARED (NOT STARTED)**  
**Start Condition:** Step ① = 100%  
**Duration:** 2 weeks  
**Current Blocker:** Step ① validation pending

---

## ⚠️ DO NOT START

**This document is preparation ONLY.**

**Do NOT begin any work until:**
- ✅ Step ① GitHub validation complete (7/7 tests)
- ✅ Step ① evidence captured
- ✅ Step ① completion certificate issued
- ✅ Step ① status = 100%

**Starting prematurely violates execution discipline.**

---

## 🎯 STEP ② OBJECTIVE

**Goal:**

Prove BDGF can serve as **universal governance framework** for ALL Bella domains, not just Logistics.

**Success Criteria:**

A Finance domain instance can use BDGF P1 WITHOUT importing anything from Logistics.

**Why This Matters:**

If BDGF is tightly coupled to Logistics, Finance cannot safely use it. This would require:
- Duplicating BDGF for Finance (maintenance nightmare)
- Finance importing Logistics (architectural violation)
- Building different governance per domain (no consistency)

**What We're Proving:**

```
              BDGF P1 Core
              (Universal)
                   │
         Universal Contract
                   │
      ┌────────────┼────────────┐
      ↓            ↓            ↓
  Logistics     Finance     Education
      │            │            │
  (isolated)  (isolated)   (isolated)
      └────────────┼────────────┘
              Same BDGF
         (Zero cross-imports)
```

---

## 📋 STEP ② STRUCTURE

### Phase 1: Universal Boundary Audit (3-5 days)

**Deliverable:** BDGF Universal Boundary Audit Report

**NOT code. NOT implementation. ANALYSIS ONLY.**

### Phase 2: Universal Contract Lock (2 days)

**Deliverable:** BDGF Universal Contract Definition

**Lock contract BEFORE implementation.**

### Phase 3: BDGF P1 Implementation (1 week)

**Deliverable:** BDGF P1 refactored for universal use

**Constraint:** Break Logistics coupling.

### Phase 4: Mock Domain Verification (2 days)

**Deliverable:** Proof that mock Finance uses BDGF without Logistics imports

**This is the acceptance test.**

---

## 🔍 PHASE 1: UNIVERSAL BOUNDARY AUDIT

**Start Date:** Day 1 of Step ②  
**Duration:** 3-5 days  
**Activity:** Analysis and documentation ONLY

### Five Critical Questions

#### Question 1: Where does BDGF currently depend on Logistics?

**Investigation Areas:**

1. **Import Analysis**
   - Grep for `import.*logistics` in BDGF code
   - Check for direct Logistics entity imports
   - Identify `hc_*` table references
   - Find domain-specific logic

2. **Type Dependencies**
   - Find Logistics-specific types in BDGF
   - Identify domain entities used by BDGF
   - Check for hardcoded Logistics assumptions

3. **Configuration Coupling**
   - Look for Logistics-specific config
   - Find hardcoded Logistics paths
   - Identify domain-specific settings

**Deliverable:** Dependency map (Logistics → BDGF coupling points)

---

#### Question 2: Which capabilities are truly universal?

**Analysis:**

For each BDGF capability, ask:

- Can this be used by ANY domain? (Logistics, Finance, Education, etc.)
- Does this assume Logistics-specific concepts?
- Is this platform infrastructure or domain logic?

**Example Universal Capabilities:**

✅ Gate execution engine (run ordered gates)  
✅ Evidence collection (capture gate results)  
✅ Contract validation (verify preconditions)  
✅ Rollback coordination (undo on failure)  
✅ Event publishing (domain-agnostic events)  

**Example Domain-Specific (Should NOT be in universal BDGF):**

❌ Inventory-specific validation  
❌ Movement traceability logic  
❌ Logistics entity validation  

**Deliverable:** Universal vs. Domain capability classification

---

#### Question 3: Which capabilities must belong to domain?

**Analysis:**

Some capabilities LOOK universal but actually embed domain knowledge.

**Example:**

```typescript
// Looks universal, but is it?
function validateEntityIntegrity(entity: any): boolean {
  // If this checks Logistics-specific rules, it's NOT universal
  // If this checks generic data integrity, it IS universal
}
```

**Red Flags:**

- References to Logistics entities (Patient, Inventory, Movement)
- Domain-specific validation rules
- Hardcoded Logistics table names
- Logistics-specific event types

**Deliverable:** List of capabilities that MUST move to Logistics layer

---

#### Question 4: What is the minimal contract for a domain to use BDGF?

**Analysis:**

Define the **interface** a domain must implement to use BDGF.

**Example Contract:**

```typescript
interface DomainBDGFContract {
  // Domain must provide entity types
  EntityTypes: Record<string, Type>;
  
  // Domain must provide validation rules
  ValidationRules: Record<string, Rule>;
  
  // Domain must provide persistence layer
  Persistence: PersistenceAdapter;
  
  // Domain must provide event publisher
  Events: EventPublisher;
  
  // Domain provides gate definitions
  Gates: GateDefinition[];
}
```

**Key Principle:**

> **BDGF provides orchestration. Domain provides implementation.**

**Deliverable:** BDGF Universal Contract specification (draft)

---

#### Question 5: How to prove a new domain can use BDGF without importing Logistics?

**Verification Protocol:**

1. **Create Mock Finance Domain**
   - Minimal Finance entities (Account, Transaction, etc.)
   - Implements BDGF Universal Contract
   - Zero Logistics imports

2. **Instantiate BDGF for Finance**
   - Pass Finance contract to BDGF
   - Configure Finance-specific gates
   - Run verification workflow

3. **Verify Isolation**
   - Check imports: Finance → BDGF ✅, Finance → Logistics ❌
   - Check tables: Only Finance + BDGF tables accessed
   - Check events: Only Finance events published

4. **Run Smoke Test**
   - Execute simple Finance workflow through BDGF
   - Verify gates run in order
   - Verify evidence captured
   - Verify Finance logic executed (not Logistics)

**Deliverable:** BDGF Isolation Verification Protocol

---

### Phase 1 Deliverable: Audit Report

**Document:** `docs/architecture/BDGF_UNIVERSAL_BOUNDARY_AUDIT.md`

**Contents:**

1. Executive Summary
2. Current BDGF-Logistics Coupling Analysis
3. Universal vs. Domain Capability Classification
4. Capabilities Requiring Domain Migration
5. BDGF Universal Contract (Draft)
6. Isolation Verification Protocol
7. Refactoring Recommendations
8. Risk Assessment

**Acceptance Criteria:**

- [ ] All 5 questions answered with evidence
- [ ] Coupling points documented
- [ ] Universal contract drafted
- [ ] Verification protocol defined
- [ ] Team review complete

**After Phase 1 complete:** Proceed to Phase 2 (Contract Lock)

---

## 🔒 PHASE 2: UNIVERSAL CONTRACT LOCK

**Start:** After Phase 1 audit complete  
**Duration:** 2 days

### Objective

Lock the **BDGF Universal Contract** before implementation.

### Activities

1. **Review Phase 1 Audit**
   - Validate coupling analysis
   - Confirm universal capabilities
   - Verify contract completeness

2. **Refine Contract Definition**
   - Finalize interface signatures
   - Document all extension points
   - Define required vs. optional implementations

3. **Document Contract**
   - Create `docs/architecture/BDGF_UNIVERSAL_CONTRACT.md`
   - Include TypeScript interfaces
   - Provide implementation examples
   - Define validation criteria

4. **Lock Contract**
   - Mark contract as FROZEN
   - Implementation cannot change contract
   - Contract changes require architecture review

### Contract Structure (Example)

```typescript
// BDGF Universal Contract v1.0

interface BDGFDomainContract<TEntity, TEvent> {
  // Required: Domain entities
  entities: {
    getById(id: string): Promise<TEntity | null>;
    save(entity: TEntity): Promise<void>;
    validate(entity: TEntity): ValidationResult;
  };
  
  // Required: Event publishing
  events: {
    publish(event: TEvent): Promise<void>;
    subscribe(handler: EventHandler<TEvent>): void;
  };
  
  // Required: Gate definitions
  gates: {
    getGates(): GateDefinition[];
    executeGate(gate: string, context: any): Promise<GateResult>;
  };
  
  // Optional: Rollback support
  rollback?: {
    canRollback(entity: TEntity): boolean;
    performRollback(entity: TEntity): Promise<void>;
  };
}

interface BDGFConfiguration {
  domain: string; // "logistics", "finance", "education"
  contract: BDGFDomainContract<any, any>;
  options?: {
    maxRetries?: number;
    timeout?: number;
    // ... universal options
  };
}
```

### Acceptance Criteria

- [ ] Contract reviewed by architecture team
- [ ] All extension points documented
- [ ] Implementation examples provided
- [ ] Contract marked as FROZEN
- [ ] `BDGF_UNIVERSAL_CONTRACT.md` complete

**After Phase 2 complete:** Proceed to Phase 3 (Implementation)

---

## 🛠️ PHASE 3: BDGF P1 IMPLEMENTATION

**Start:** After contract locked  
**Duration:** 1 week  
**Constraint:** Follow locked contract, no changes

### Objective

Refactor BDGF to be domain-agnostic, accepting contract at runtime.

### High-Level Tasks

1. **Extract Logistics-Specific Code**
   - Move Logistics validation to Logistics layer
   - Remove hardcoded Logistics entities
   - Extract domain logic to domain layer

2. **Parameterize BDGF Core**
   - Accept domain contract at initialization
   - Use contract for entity operations
   - Use contract for validation
   - Use contract for events

3. **Create BDGF P1 API**
   ```typescript
   // Before (Logistics-coupled)
   const bdgf = new BDGF(); // Assumes Logistics
   
   // After (Universal)
   const bdgf = new BDGF(logisticsContract); // Explicit domain
   const bdgfFinance = new BDGF(financeContract); // Different domain
   ```

4. **Migrate Logistics Instance**
   - Create `LogisticsBDGFContract` implementation
   - Pass to BDGF P1
   - Verify existing functionality works
   - Run full Logistics regression (547 tests)

5. **Update Documentation**
   - Document BDGF P1 API
   - Provide integration examples
   - Document breaking changes (if any)

### Acceptance Criteria

- [ ] BDGF accepts domain contract at runtime
- [ ] No hardcoded Logistics dependencies
- [ ] Logistics instance using BDGF P1 works
- [ ] All 547 Logistics tests pass
- [ ] Zero Logistics imports in BDGF core

**After Phase 3 complete:** Proceed to Phase 4 (Verification)

---

## ✅ PHASE 4: MOCK DOMAIN VERIFICATION

**Start:** After BDGF P1 implementation complete  
**Duration:** 2 days  
**Purpose:** PROVE universal claim

### Objective

Create mock Finance domain that uses BDGF P1 WITHOUT importing Logistics.

### Implementation

1. **Create Mock Finance Domain**
   ```
   src/platform/finance-mock/
   ├── entities/
   │   ├── account.ts
   │   └── transaction.ts
   ├── contract/
   │   └── finance-bdgf-contract.ts
   └── __tests__/
       └── finance-bdgf-integration.test.ts
   ```

2. **Implement Finance Contract**
   ```typescript
   const financeContract: BDGFDomainContract<FinanceEntity, FinanceEvent> = {
     entities: {
       getById: async (id) => { /* Finance logic */ },
       save: async (entity) => { /* Finance logic */ },
       validate: (entity) => { /* Finance validation */ },
     },
     events: {
       publish: async (event) => { /* Finance events */ },
       subscribe: (handler) => { /* Finance subscriptions */ },
     },
     gates: {
       getGates: () => [/* Finance gates */],
       executeGate: async (gate, ctx) => { /* Finance gate logic */ },
     },
   };
   ```

3. **Verify Isolation**
   ```typescript
   // This test MUST pass
   test('Finance uses BDGF without Logistics imports', () => {
     // Check: Finance contract imports BDGF only
     // Check: No Logistics imports in Finance
     // Check: BDGF instantiation succeeds
     // Check: Finance workflow executes
   });
   ```

4. **Run Verification Protocol**
   - Static analysis: No Logistics imports
   - Runtime test: Finance workflow through BDGF
   - Evidence: Screenshots, logs, test output

### Acceptance Criteria

- [ ] Mock Finance domain created
- [ ] Finance contract implements BDGF contract
- [ ] Zero Logistics imports in Finance
- [ ] Finance workflow executes through BDGF P1
- [ ] Isolation verification test passes
- [ ] Evidence captured

**After Phase 4 complete:** Step ② = 100%

---

## 🏁 STEP ② COMPLETION CRITERIA

**BDGF P1 Universal is COMPLETE when:**

1. ✅ Phase 1: Boundary audit complete
2. ✅ Phase 2: Universal contract locked
3. ✅ Phase 3: BDGF P1 implementation complete
4. ✅ Phase 4: Mock Finance proves isolation
5. ✅ All 547 Logistics tests still pass
6. ✅ Mock Finance test passes
7. ✅ Evidence captured
8. ✅ Documentation complete

**Then proceed to Step ③: Kernel Capability Map**

---

## 🚀 AFTER STEP ② COMPLETE

### Step ③: Kernel Capability Map (1 week)

**Goal:** Document E7.1/E7.2/E7.3 public APIs and consumption patterns.

**Why:** Finance needs to know what Logistics capabilities exist and how to consume them.

**Deliverables:**
- E7.1/E7.2/E7.3 capability catalog
- Public API documentation
- Consumption patterns
- Forbidden vs. allowed usage

### Step ④: E7.4 Design Lock (1 week)

**Goal:** Lock Finance architecture before implementation.

**Constraint:** No kernel modifications allowed.

**Deliverables:**
- Finance OS architecture design
- Capability consumption plan
- Contract definitions
- Design approval

### Step ⑤: E7.4 Implementation (2 weeks)

**Goal:** Build Finance OS using locked design.

**Pattern:** Consume E7.1/E7.2/E7.3 + BDGF P1, don't modify kernel.

### Step ⑥: E7.4 Freeze + Evidence (1 week)

**Goal:** Add Finance to Architecture Guard.

**Deliverables:**
- Finance artifacts frozen
- Full regression suite
- Evidence of no kernel modifications

---

## 📊 EXECUTION DISCIPLINE

### Why Boundary Audit Comes First

**Wrong Approach:**
```
Start coding BDGF P1 → Discover coupling midway → Refactor → Discover more coupling → ...
```

**Right Approach:**
```
Analyze coupling completely → Lock contract → Implement once → Verify
```

### Why Contract Lock Matters

**Without lock:**
- Implementation changes contract
- Mock domain must adapt
- Verification moves goalpost
- Never finishes

**With lock:**
- Contract cannot change
- Implementation conforms to contract
- Verification criteria clear
- Definite completion

### Why Mock Domain Verification

**Claim without proof:**
> "BDGF is universal" (unverified)

**Claim with proof:**
> "Finance uses BDGF without Logistics imports" (verified by test)

**The proof IS the deliverable.**

---

## 📋 PREPARATION CHECKLIST

**Before starting Step ②:**

- [ ] Step ① = 100% (GitHub validation complete)
- [ ] Step ① certificate issued
- [ ] This preparation document reviewed
- [ ] Team understands 4-phase structure
- [ ] Audit questions understood
- [ ] Contract lock process understood
- [ ] Mock domain verification understood

**Do NOT start until ALL checked.**

---

## 🏁 PREPARATION SUMMARY

```
╔══════════════════════════════════════════════════════════════╗
║  STEP ② BDGF P1 UNIVERSAL                                   ║
║                                                              ║
║  Status: 📋 PREPARED (NOT STARTED)                          ║
║                                                              ║
║  Start Condition: Step ① = 100%                             ║
║  Duration: 2 weeks                                          ║
║                                                              ║
║  Phase 1: Boundary Audit (3-5 days) — ANALYSIS ONLY        ║
║  Phase 2: Contract Lock (2 days)                            ║
║  Phase 3: Implementation (1 week)                           ║
║  Phase 4: Mock Verification (2 days)                        ║
║                                                              ║
║  Success Proof: Finance uses BDGF without Logistics         ║
║                                                              ║
║  Next Action: WAIT for Step ① = 100%                        ║
╚══════════════════════════════════════════════════════════════╝
```

**Prepared By:** Platform Architecture Team  
**Preparation Date:** 2026-08-22  
**Start Date:** TBD (after Step ① closes)  
**Ready Status:** ✅ PREPARED (do not start yet)
