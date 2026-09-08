# GOVERNANCE RECONCILIATION — INDUSTRY DISCOVERY vs. EXISTING MECHANISMS

**Date:** 2026-09-06  
**Purpose:** Map proposed Industry Discovery governance rules against existing Bella governance mechanisms  
**Principle:** Investigate → Reconcile → Decide → Implement → Verify

**Status:** 🔄 **IN PROGRESS** — No implementation until reconciliation complete

---

## Executive Summary

## Executive Summary

**Finding:** Bella already has substantial governance infrastructure. Proposed "Industry Discovery Governance" overlaps significantly with existing mechanisms.

**Conclusion:** Significant opportunity to **extend existing mechanisms** instead of creating parallel frameworks.

**⚠️ STATUS:** Conceptual reconciliation complete. Raw evidence collection incomplete. 

**Critical blocker:** Capability Identity Model not defined — **blocks semantic duplicate detection only**, not entire framework.

**Next steps:** 
1. Human decision on policy boundaries (4 key decisions required)
2. Complete raw evidence collection for approved components
3. Define Capability Identity Model (if semantic detection approved)
4. Implementation design (ONLY after decisions above)

---

## Existing Governance Mechanisms Inventory

### 1. **Architecture Guard** (`scripts/architecture/architecture-guard.ts`)

**Capabilities:**
- ✅ Frozen layer protection (SEALED/FROZEN status)
- ✅ Dependency boundary enforcement (allowedImports, forbiddenImports)
- ✅ File integrity verification (hash checking)
- ✅ Invariant documentation
- ✅ Violation reporting with exit codes

**Current usage:**
- Logistics E7.1 Domain Kernel (SEALED)
- Logistics E7.3 Rules & Traceability (SEALED)
- Healthcare Kernel (mentioned in docs, not yet in guard)

**Pattern:**
```typescript
const FROZEN_LAYERS: FrozenLayer[] = [
  {
    id: 'E7.1',
    name: 'E7.1 Domain Kernel',
    status: 'SEALED',
    artifacts: [ /* paths */ ],
    allowedImports: [ /* patterns */ ],
    forbiddenImports: [ /* patterns */ ],
    invariants: [ /* descriptions */ ]
  }
];
```

**Exit codes:**
- `0` = All checks passed
- `1` = Frozen boundary violation
- `2` = Dependency boundary violation
- `3` = Hash verification failed

---

### 2. **BDGF (Bella Database Governance Framework)** (`scripts/bdgf/`)

**Capabilities:**
- ✅ Human approval gates for DB changes
- ✅ Gate token mechanism (cryptographic approval)
- ✅ Migration execution with approval enforcement
- ✅ Audit trail for approved changes
- ✅ RLS policy protection
- ✅ Evidence collection

**Key components:**
- `gate-runner.mjs` — Unified execution engine
- `gate-contract.mjs` — Contract interface
- `migration-executor.mjs` — Approved migration execution
- `evidence-collector.mjs` — Automated evidence collection

**Pattern:**
```text
Database Change Proposal
    ↓
Human Approval (gate token)
    ↓
Execution (with token validation)
    ↓
Evidence Collection
    ↓
Audit Trail
```

---

### 3. **Evidence Collector** (`scripts/governance/evidence-collector.ts`)

**Capabilities:**
- ✅ Automated evidence discovery
- ✅ Migration evidence checking
- ✅ Generated type evidence checking
- ✅ RLS evidence checking
- ✅ Domain evidence checking
- ✅ Test evidence checking
- ✅ Industry-scoped evidence collection

**Evidence types collected:**
- Migration files existence
- Database schema types
- RLS policies
- Domain entities
- Test files

**Current usage:**
- Factory P2 Evidence Collection
- Manufacturing Phase 3.5

---

### 4. **Regression Protection** (`scripts/governance/check-regression.ts`)

**Capabilities:**
- ✅ Baseline capture
- ✅ Diagnostic regression detection
- ✅ Automated blocking on regression
- ✅ Known Pattern Rule support

**Exit codes:**
- `0` = ALLOW (no regression or within known pattern)
- `1` = BLOCK (regression detected)

---

### 5. **Conformance Testing** (Manufacturing Phase 3.5)

**Capabilities:**
- ✅ P1 Schema Generation verification (21/21 tests)
- ✅ P2 Evidence Collection verification (23/23 tests)
- ✅ Contract schema conformance
- ✅ Scope derivation
- ✅ Factory build automation

---

## Proposed Industry Discovery Rules → Existing Mechanism Mapping

**⚠️ Dependency Analysis:** Not all items blocked by Capability Identity Model

| Proposed Rule | Existing Mechanism | Reuse? | New Implementation? | Blocked By |
|--------------|-------------------|--------|---------------------|------------|
| **Reference Product Limit (Discovery)** | ❌ None | ❌ | ⚪ Minimal guard | None (independent) |
| **Scope Boundary Enforcement** | ❌ None | ❌ | ⚪ Minimal guard | None (independent) |
| **Product → Contract Boundary** | ✅ Architecture Guard | ✅ | ⚪ Extend config | None (can extend) |
| **Product ↛ Kernel Internal** | ✅ Architecture Guard | ✅ | ⚪ Extend patterns | None (can extend) |
| **Product ↛ Kernel DB** | ✅ Architecture Guard | ✅ | ⚪ Extend patterns | None (can extend) |
| **Evidence for Stage Transition** | ✅ Evidence Collector | ✅ | ⚪ Extend | None (can extend) |
| **Human Approval (Kernel Promotion)** | ✅ BDGF Pattern | ✅ | ⚪ Adapt workflow | None (can adapt) |
| **Human Decision (Business Priority)** | ❌ None | ❌ | ⚪ Process definition | None (no automation) |
| **Human Approval (Scope Definition)** | ❌ None | ❌ | ⚪ Process definition | None (no automation) |
| **Semantic Duplicate Detection** | ❌ None | ❌ | 🔴 NEW | 🔴 Capability Identity Model |

**Key finding:** **9/10 components can proceed independently.** Only semantic detection blocked by Identity Model.

---

## Critical Corrections to Proposed Rules

### 1. **Max 2 Reference Products**

**❌ Previous proposal:**
```typescript
private readonly MAX_REFERENCE_PRODUCTS = 2; // Hard limit everywhere
```

**✅ Corrected scope:**
```typescript
// Applies to DISCOVERY phase only, not manufacturing
const INDUSTRY_DISCOVERY_LIMITS = {
  maxReferenceProductsForDiscovery: 2,
  exceptionRequires: 'HUMAN_APPROVAL'
};

// After Kernel qualified, Product #3+ use Factory manufacturing
```

**Reasoning:** Limit protects discovery scope creep, not total Product count.

---

### 2. **Qualified Capability Reuse**

**❌ Previous proposal:**
```typescript
// Detect by code similarity
const isDuplicate = this.detectDuplicateImplementation(productId, capability);
```

**✅ Corrected approach:**
```typescript
// Detect by semantic identity violation
const isDuplicateSemantic = this.detectSemanticIdentityViolation(
  productCapability,
  qualifiedOSCapabilities
);

// Check: Does Product bypass Public Contract?
const bypassesContract = this.checkContractBypass(productId, capability);
```

**Reasoning:** Semantic identity matters, not code patterns. Product can implement differently if using Contract.

---

### 3. **Kernel Promotion Evidence**

**❌ Previous proposal:**
```json
{
  "minEvidence": {
    "productUsage": 2,  // Mechanical rule
    "reusabilityScore": 0.7  // Arbitrary threshold
  }
}
```

**✅ Corrected approach:**
```json
{
  "kernelPromotionEvidence": {
    "required": [
      "PRODUCT_USAGE_DOCUMENTATION",
      "REUSABILITY_ANALYSIS",
      "SEMANTIC_IDENTITY_DEFINITION"
    ],
    "humanApprovalRequired": true,
    "aiProposal": "ENCOURAGED"
  }
}
```

**Reasoning:** Evidence informs human decision, does not replace it. No mechanical threshold.

---

### 4. **Contract Boundary Enforcement**

**Current:** Architecture Guard has `forbiddenImports` pattern

**Gap:** Not configured for Product → Kernel internal access

**Solution:** **Extend existing guard**, don't create new one

```typescript
// In architecture-guard.ts FROZEN_LAYERS
{
  id: 'RETAIL_OS',
  name: 'Retail OS Kernel',
  status: 'FROZEN',  // After qualified
  artifacts: [
    { path: 'src/platform/retail/contracts/**/*.ts', publicAPI: true },
    { path: 'src/platform/retail/domain/**/*.ts', publicAPI: false },
    { path: 'src/platform/retail/repositories/**/*.ts', publicAPI: false },
    { path: 'src/platform/retail/services/**/*.ts', publicAPI: false }
  ],
  allowedImports: [
    'src/platform/core/**',
    'src/platform/host/**'
  ],
  forbiddenImports: [
    'src/products/**'  // Kernel cannot import Products
  ]
}

// Add Product layer rules
{
  id: 'RETAIL_PRODUCTS',
  name: 'Retail Products',
  artifacts: [
    { path: 'src/products/bella-retail/**/*.ts' }
  ],
  allowedImports: [
    'src/platform/retail/contracts/**',  // ONLY Public Contracts
    'src/platform/core/**',
    'src/platform/host/**'
  ],
  forbiddenImports: [
    'src/platform/retail/domain/**',       // FORBIDDEN
    'src/platform/retail/repositories/**',  // FORBIDDEN
    'src/platform/retail/services/**'       // FORBIDDEN
  ]
}
```

**Result:** Existing guard enforces boundary, no new framework needed.

---

---

## Critical Missing Foundation: Capability Identity Model

**⚠️ BLOCKER:** Semantic duplication detection requires canonical Capability Identity Model.

**Current state:** Bella has NO canonical definition of "Capability Identity"

**Problem:** Cannot detect "semantic identity violation" without defining "semantic identity"

**Risk:** AI heuristic disguised as Guard → dangerous governance

---

### What is "Capability Identity"?

**Undefined in Bella currently. Potential components:**

| Component | Current State | Required for Semantic Detection |
|-----------|--------------|--------------------------------|
| Capability semantic ID | ❌ Not defined | ✅ Required |
| Capability ownership | ⚠️ Partial (Kernel vs Product) | ✅ Required |
| Capability interface contract | ⚠️ Partial (Public Contracts exist) | ✅ Required |
| Capability input/output semantics | ❌ Not formalized | ✅ Required |
| Capability lifecycle | ❌ Not defined | ⚠️ Helpful |
| Capability versioning | ❌ Not defined | ⚠️ Helpful |

**Example ambiguity:**

```text
Scenario: Product implements "Sale Processing"

Question: Is this semantic duplication of Retail OS "Sale" capability?

Cannot answer without:
  1. Canonical definition of "Sale" capability identity
  2. Semantic boundaries (what makes it "Sale" vs "Transaction" vs "Order")
  3. Contract interface (does Product use Retail Contract or reimplement?)
  4. Ownership model (is "Sale" Retail-only or cross-Industry?)
```

---

### Decision Required Before Implementation

**Option A: Define Capability Identity Model First**
```text
1. Define canonical Capability Identity schema
2. Apply to existing Kernels (Healthcare, Spa, Retail)
3. Create capability registry
4. Then implement semantic duplication detection
```

**Option B: Defer Semantic Duplication Detection**
```text
1. Implement other governance (boundaries, evidence, approvals)
2. Use manual human review for duplication
3. Learn from Retail OS experience
4. Design Capability Identity Model based on evidence
5. Then implement automated detection
```

**Option C: Simple Contract-Based Detection**
```text
1. Define: "Duplication = Product bypasses Public Contract"
2. Use Architecture Guard for enforcement
3. No semantic analysis needed
4. Simple, enforceable, clear
```

**Recommendation:** **Option B** — Defer semantic detection, learn from Retail experience

**Rationale:**
```text
No Capability Identity Model yet
    ↓
Don't build detector without definition
    ↓
Retail OS provides real duplication cases
    ↓
Observe patterns, collect evidence
    ↓
Define Identity Model if patterns clear
    ↓
Then automate
```

**Bella principle:** **Automate repetition, not judgment.**

If repetition not proven, don't automate it.

**Result:** Semantic duplication → Human review during Retail discovery → Evidence collection → Model definition → Then automation (if needed)

**Status:** 🔴 **BLOCKED** — Capability Identity Model required for automated detection

**Decision required:** Approve Option B (defer) or require Option A/C

---

## Reconciliation Table (Final)

| Governance Need | Existing Mechanism | Action Required | Blocked? |
|----------------|-------------------|-----------------|----------|
| **Invariants (Can Automate)** | | | |
| Product → Contract only | Architecture Guard | **EXTEND** config | ⚪ No |
| Product ↛ Kernel internal | Architecture Guard | **EXTEND** forbiddenImports | ⚪ No |
| Product ↛ DB direct | Architecture Guard | **EXTEND** patterns | ⚪ No |
| Evidence for stage transition | Evidence Collector | **EXTEND** requirements | ⚪ No |
| Regression protection | Regression Gate | **REUSE** as-is | ⚪ No |
| Frozen Kernel protection | Architecture Guard | **REUSE** (add Retail after qualified) | ⚪ No |
| **New Invariants (Independent)** | | | |
| Max 2 Reference Products (discovery) | None | **NEW GUARD** (minimal) | ⚪ No |
| Approved scope enforcement | None | **NEW GUARD** (scope check) | ⚪ No |
| Semantic duplicate detection | None | **DEFER** | 🔴 Yes (Identity Model) |
| **Judgments (Human Process)** | | | |
| Kernel boundary decision | BDGF pattern | **ADAPT** approval flow | ⚪ No |
| Business priority | None | **NEW PROCESS** (human-only) | ⚪ No |
| Scope definition | None | **NEW PROCESS** (AI propose, human approve) | ⚪ No |
| Exception approvals | BDGF pattern | **REUSE** gate token | ⚪ No |
| **Assistance (AI Analysis)** | | | |
| Capability discovery | Evidence Collector | **EXTEND** with pattern analysis | ⚪ No |
| Duplication detection | None | **MANUAL REVIEW** (during Retail) | ⚪ No |

**Critical finding:** **9/10 components independent.** Only semantic detection blocked.

---

## Implementation Strategy (DEFERRED — Requires Human Decision First)

**⚠️ CRITICAL:** All quantitative estimates removed. Implementation strategy designed AFTER human decision.

**Reconciliation identifies:** What exists, what overlaps, what gaps  
**Reconciliation does NOT:** Design implementation, estimate LOC, define phases

---

### Human Decision Required (4 Key Questions)

**Decision A: Is Industry Discovery Governance needed?**
```
Should Bella create Platform-level governance for Industry OS discovery?
├─ YES → Continue to Decision B/C/D
└─ NO → DEFER, keep existing governance only
```

**Decision B: Canonical Ownership**

For each concern, decide:
```
Reference Product Discovery → Who owns? (New or existing)
Scope Governance → Who owns?
Evidence/Stage → Who owns?
Architecture Boundary → Who owns?
Human Approval → Who owns?
Capability Identity → Who owns?
```

**Decision C: Capability Identity Approach**
```
Option A: Define model first, then implement detection
Option B: Defer detection, learn from Retail, then define model ✅ RECOMMENDED
Option C: Simple contract-based detection only
```

**Decision D: Implementation Authorization**
```
After A/B/C decided:
  - Which components to implement?
  - What priority?
  - What success criteria?
```

---

### After Human Decisions Approved

**Then (and only then):**
1. Complete raw evidence collection for approved components
2. Design implementation for approved scope
3. Estimate effort (at that time, not before)
4. Implement
5. Verify

**Current status:** ⏸️ **Awaiting human decision on A/B/C/D**

---

## Critical Principles Locked

### 1. **One enforcement mechanism, multiple policies**

```text
✅ Extend Architecture Guard for Product boundaries
❌ Create new ContractBoundaryGuard

✅ Extend Evidence Collector for stage requirements
❌ Create new EvidenceGate

✅ Adapt BDGF approval for Kernel decisions
❌ Create new KernelApprovalFramework
```

### 2. **Semantic identity, not code similarity**

```text
✅ Detect: Product reimplements "Sale" capability (semantic)
❌ Detect: Product has similar function names (syntactic)
```

### 3. **Discovery limit, not manufacturing limit**

```text
✅ Max 2 Products during Industry DISCOVERY
✅ Product #3+ use Factory MANUFACTURING (no limit)
❌ Retail can only have 2 Products total
```

### 4. **Human judgment gates, not automation**

```text
✅ AI proposes Kernel capability → Human decides
❌ AI auto-promotes if reusabilityScore > 0.7

✅ Human approves scope → Guard enforces
❌ Guard calculates optimal scope
```

---

## Next Steps

### **Immediate:**

1. ✅ **This reconciliation document** (current)
2. ⏸️ **Review & approval** (human decision)
3. ⏸️ **Create INDUSTRY_DISCOVERY_POLICY.md** (policy only, no code)

### **After approval:**

4. Extend Architecture Guard (Product boundary rules)
5. Extend Evidence Collector (stage requirements)
6. Implement minimal new guards (Reference Product limit, Scope boundary)
7. Implement AI assistants (Capability discovery, Duplicate detection)
8. Adapt BDGF workflow (Kernel approval)
9. Validate with Retail OS

### **Validation criteria:**

```text
✅ No duplicate enforcement mechanisms
✅ Reuse existing infrastructure where possible
✅ Clear separation: Invariants (automated) vs. Judgment (human)
✅ Policy-driven configuration, not hard-coded rules
✅ Evidence-based, not assumption-based
```

---

## Conclusion

**Reconciliation Status:** 🟡 **CONDITIONALLY ACCEPTED**

**Achievements:**
- ✅ Existing governance mechanisms inventoried
- ✅ Duplicate framework avoidance identified
- ✅ Conceptual overlaps mapped
- ✅ Human vs machine boundaries defined
- ✅ Key distinctions clarified (semantic vs syntactic, discovery vs manufacturing)

**Incomplete:**
- ⚠️ Raw evidence collection (partial, needs completion)
- ⚠️ Quantitative claims (estimates only, not measurements)
- ❌ Capability Identity Model (not defined, blocks semantic detection)
- ❌ Implementation design (premature, requires decision first)

**Corrected Understanding:**
- "80% reuse" = Conceptual observation, not quantified measurement
- "~930 LOC" = Planning estimate, not evidence-based requirement
- "50% savings" = Comparison of two estimates, not actual measurement
- Reconciliation identifies gaps, does NOT design implementation

**Blocked Items:**
- 🔴 Semantic duplication detection (requires Capability Identity Model)
- 🔴 Implementation (requires human decision on policy boundaries)
- 🔴 LOC commitments (estimates are planning guidance only)

**Ready for Human Decision:**
1. Review reconciliation findings (conceptual overlaps and gaps)
2. Decide on policy boundaries (what governance is actually needed?)
3. Decide on Capability Identity approach (Options A/B/C)
4. Authorize specific implementation scope (after decisions above)

**NOT Ready:**
- ❌ Implementation authorization (decision required first)
- ❌ LOC commitments (estimates only)
- ❌ Phase definitions (implementation design premature)

---

**Status:** ⏸️ **PENDING HUMAN DECISION** — Reconciliation conceptually sound, requires decision before implementation

**Core principle validated:** **Investigate → Reconcile → Decide → Implement → Verify**

**Next checkpoint:** Human decision on policy boundaries and Capability Identity approach


---

**Status:** ⏸️ **PENDING HUMAN DECISION (4 simple questions)** 

**Next:** Human decision → Implementation design → Implementation → Verification

**Governance itself obeys Bella's governance: Investigate → Reconcile → Decide → Implement → Verify**
