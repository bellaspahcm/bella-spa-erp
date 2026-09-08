# INDUSTRY DISCOVERY GOVERNANCE — IMPLEMENTATION DESIGN

**Date:** 2026-09-06  
**Checkpoint:** Implementation Design (ID-1 through ID-6)  
**Status:** 🔴 **ID-1 INCOMPLETE — EVIDENCE AUDIT IN PROGRESS**

**Purpose:** Design implementation for approved Industry Discovery Governance based on evidence collection

**Approval:** [Human Decision Record](INDUSTRY_DISCOVERY_GOVERNANCE_DECISION.md)

**⚠️ CRITICAL:** Initial "3 genuine gaps" claim requires semantic analysis before acceptance. Factory Orchestrator may already provide lifecycle tracking with different naming.

---

[Jump to Audit Findings](#audit-findings--critical-evidence-gaps)

---

## ID-1: Evidence Completion — EXISTING MECHANISMS

### Mechanism 1: Architecture Guard

**File:** `scripts/architecture/architecture-guard.ts`

**Current Capabilities (Evidence-Based):**

| Capability | Lines | Evidence |
|-----------|-------|----------|
| Frozen layer definition | 85-156 | `FROZEN_LAYERS` array with Logistics E7.1, E7.3 |
| Frozen file existence check | 290-312 | `checkFrozenFiles()` function |
| File hash verification | 314-351 | `checkFileHashes()` with SHA256 |
| Dependency boundary enforcement | 353-384 | `checkDependencyBoundaries()` checks imports |
| Pattern matching | 267-282 | `matchesPattern()`, `isAllowedImport()`, `isForbiddenImport()` |
| Violation reporting | 462-507 | `printViolations()` with exit codes |

**Extension Points:**
```typescript
// Line 85-156: FROZEN_LAYERS array
// Can add new layers for Industry OS and Product boundaries

const FROZEN_LAYERS: FrozenLayer[] = [
  // Existing: Logistics E7.1, E7.3
  // Can add: Retail OS (after qualified)
  // Can add: Product layer boundaries
];
```

**Current Usage:**
- Protects Logistics E7.1 Domain Kernel (SEALED)
- Protects Logistics E7.3 Rules & Traceability (SEALED)
- Enforces import boundaries for frozen artifacts
- Exit codes: 0 (pass), 1 (frozen violation), 2 (dependency violation), 3 (hash fail)

**Canonical Owner:** Architecture boundaries, frozen artifact protection, import boundaries

---

### Mechanism 2: BDGF (Bella Database Governance Framework)

**Files:** `scripts/bdgf/*.mjs` (80+ files discovered)

**Key Components (Evidence-Based):**

| Component | File | Purpose |
|-----------|------|---------|
| Gate Contract | `gate-contract.mjs` | Base class for all gates, standard interface |
| Gate Token | `gate-token.mjs` | Cryptographically signed approval tokens |
| Migration Executor | `migration-executor.mjs` | Security boundary for DB mutations |
| Gate Runner | `gate-runner.mjs` | Config-driven gate execution |
| Evidence Collector | `evidence-collector.mjs` | BDGF evidence collection (separate from governance/evidence-collector.ts) |

**Approval Workflow (Evidence from gate-token.mjs):**

```typescript
// Lines 1-100 (gate-token.mjs)
// Token structure: {payload, signature}
// Payload binds: approval_id, migration_hash, environment, schema, executor, nonce
// Signature: HMAC-SHA256 with signing key
// Properties: Single-use, short-lived (60s), cryptographically signed
```

**Migration Executor Pattern (Evidence from migration-executor.mjs lines 1-100):**

```text
1. Check token exists → Block if missing
2. Validate token (crypto + binding) → Block if invalid
3. Consume token (atomic single-use) → Block if already used
4. ONLY THEN: Execute mutation
```

**Extension Points:**
- Gate Contract can be extended for non-DB approvals
- Gate Token mechanism can be adapted for Kernel promotion, Scope approval
- Approval workflow pattern is reusable

**Canonical Owner:** Human approval gates, approval token mechanism, audit trail

---

### Mechanism 3: Evidence Collector

**File:** `scripts/governance/evidence-collector.ts`

**Current Capabilities (Evidence-Based):**

| Capability | Function | Lines | Purpose |
|-----------|----------|-------|---------|
| Scope prefix discovery | `discoverScopePrefix()` | 104-132 | Auto-discover Industry OS prefix |
| Migration evidence | `checkMigrationEvidence()` | 305-337 | Verify migration files exist |
| Type evidence | `checkGeneratedTypeEvidence()` | 339-376 | Verify generated types |
| RLS evidence | `checkRLSEvidence()` | 378-433 | Verify RLS policies |
| Domain evidence | `checkDomainEvidence()` | 435-457 | Verify domain entities |
| Test evidence | `checkTestEvidence()` | 459-495 | Verify test files |
| Industry collection | `collectIndustryEvidence()` | 547-574 | Collect all evidence for Industry OS |

**Evidence Types Supported:**
- Migration files
- Generated database types
- RLS policies
- Domain entities
- Tests

**Extension Points:**
```typescript
// Can add new evidence types for:
// - Discovery phase tracking
// - Reference Product counting
// - Qualified OS verification
// - Manufacturing transition evidence
```

**Canonical Owner:** Evidence collection, verification evidence

---

### Mechanism 4: Regression Gate

**File:** `scripts/governance/check-regression.ts`

**Current Capabilities (Evidence-Based):**

| Capability | Function | Lines | Purpose |
|-----------|----------|-------|---------|
| Baseline loading | `loadBaseline()` | 42-68 | Load diagnostic baseline |
| Gate B execution | `runGateB()` | 70-97 | Run TypeScript checks |
| Scope analysis | `analyzeScope()` | 99-175 | Analyze diagnostic changes per scope |
| Regression check | `performRegressionCheck()` | 177-217 | Detect diagnostic regression |
| Report printing | `printRegressionReport()` | 219-314 | Format regression report |

**Exit Codes:**
- `0` = ALLOW (no regression or within known pattern)
- `1` = BLOCK (regression detected)

**Current Usage:**
- Protects against TypeScript diagnostic regression
- Baseline capture mechanism
- Known Pattern Rule support

**Extension Points:**
- Can be integrated with Industry Discovery lifecycle
- Can verify no regressions during Discovery → Manufacturing transition

**Canonical Owner:** Regression protection, baseline comparison

---

### Mechanism 5: Freeze Check

**Part of:** Architecture Guard (covered in Mechanism 1)

**Current Capabilities:**
- FROZEN status (cannot modify without ACR)
- SEALED status (stricter than FROZEN)
- Hash verification for frozen artifacts

**Extension Points:**
- Apply to Qualified Industry OS
- Protect Qualified OS from unauthorized modifications

**Canonical Owner:** Frozen artifact protection (part of Architecture Guard)

---

## ID-2: Gap Analysis — POLICY SEMANTICS CLASSIFICATION

**Based on ID-1 evidence with policy-level semantic analysis**

---

### EXISTING — REUSE (No Changes)

| Concern | Owner | Action | Evidence |
|---------|-------|--------|----------|
| Regression protection | Regression Gate | **REUSE** as-is | check-regression.ts functional |
| Frozen artifact protection | Architecture Guard + Kernel Registry | **REUSE** as-is | Logistics E7.1, Healthcare H1-H12 protected |
| Human approval workflow | BDGF | **REUSE** pattern | Gate token mechanism proven |

---

### EXISTING — EXTEND (Configuration/Patterns)

| Concern | Owner | Action | Extension Type | Evidence |
|---------|-------|--------|----------------|----------|
| Product → Contract boundary | Architecture Guard | **EXTEND** | Add Product layer to FROZEN_LAYERS | architecture-guard.ts:85-156 supports layers |
| Product ↛ Kernel internal | Architecture Guard | **EXTEND** | Add forbiddenImports patterns | architecture-guard.ts:282 `isForbiddenImport()` |
| Product ↛ DB direct | Architecture Guard | **EXTEND** | Add import detection patterns | architecture-guard.ts:267-282 pattern matching |
| Evidence for stages | Evidence Collector | **EXTEND** | Add Discovery/Manufacturing evidence types | evidence-collector.ts:497-574 extensible |
| Kernel promotion approval | BDGF | **ADAPT** | Adapt gate token for non-DB approval | gate-token.mjs:1-100 reusable pattern |
| Scope approval | BDGF | **ADAPT** | Adapt approval workflow | gate-contract.mjs base class |

---

### GENUINE GAP — NEW POLICY (No Existing Mechanism)

**Critical finding:** Evidence confirms **2 policy gaps**, not 3 components.

#### Gap 1: Discovery Lifecycle

**Policy requirement:** Track Industry OS phase (FOUNDATION → DISCOVERY → MANUFACTURING)

**Evidence of absence:**
- Factory `mode` = test fixture context (`controlled-fixture` vs `new-industry`)
- Factory does NOT track Industry OS lifecycle
- NO lifecycle state representation found

**Why genuine gap:**
```text
Factory mode ≠ Industry lifecycle

controlled-fixture = test with baseline
new-industry      = test without baseline

≠ DISCOVERY → QUALIFICATION → MANUFACTURING
```

**Classification:** ✅ **GENUINE GAP** — requires state representation

---

#### Gap 2: Reference Product Governance

**Policy requirement:** Enforce max 2 Reference Products during Discovery phase

**Evidence of absence:**
- Products exist as manual directories (`src/products/bella-*`)
- NO Product registry
- NO Product creation workflow
- NO limit enforcement
- NO Reference Product classification

**Why genuine gap:**
```text
No mechanism represents:

Industry
  ├── Reference Product #1
  ├── Reference Product #2
  └── Discovery limit / exception
```

**Classification:** ✅ **GENUINE GAP** — requires policy enforcement

---

### POLICY COMPOSITION (Not Separate Gap)

#### Discovery → Manufacturing Transition

**Initial classification:** Listed as separate gap

**Refined analysis:** This is **part of Discovery Lifecycle**, not independent gap

**Rationale:**

If Discovery Lifecycle exists, transition validation is a **requirement of that mechanism**:

```text
Industry Lifecycle
│
├── DISCOVERY
│     └── rules: max 2 Reference Products
│
├── QUALIFICATION DECISION ← transition checkpoint
│     └── validation: Kernel approved, evidence complete
│
└── MANUFACTURING
      └── rules: unlimited Products via Factory
```

**Should NOT become:**
```text
Gap #1: Lifecycle
Gap #2: Reference Product  
Gap #3: Transition Gate  ← unnecessary duplication
```

**Classification:** ⚠️ **PART OF LIFECYCLE** — not separate component

**Lean governance principle:** Do not create separate component for transition when lifecycle mechanism already owns state transitions.

---

### NOT NEEDED (Policy Concept Only)

| Concern | Reason |
|---------|--------|
| Business priority decision | Human judgment, no automation |

---

### DEFERRED (Per Human Decision)

| Concern | Decision | Reason |
|---------|----------|--------|
| Semantic duplicate detection | Option B - DEFER | Capability Identity Model not defined |
| Capability Identity Model | DEFER | Learn from Retail OS first |

---

## REFINED GAP SUMMARY

```text
┌──────────────────────────────────────────────┐
│ GOVERNANCE CONCERN CLASSIFICATION             │
├──────────────────────────────────────────────┤
│ Existing Architecture boundaries → REUSE     │
│ Existing Evidence             → REUSE/EXTEND │
│ Existing Regression           → REUSE        │
│ Existing Freeze              → REUSE         │
│ Human approval               → REUSE PATTERN │
│                                              │
│ Industry Discovery Lifecycle → GENUINE GAP   │
│ Reference Product Governance → GENUINE GAP   │
│                                              │
│ Transition enforcement       → PART OF       │
│                                 lifecycle    │
│                                              │
│ Semantic duplication         → DEFERRED      │
└──────────────────────────────────────────────┘
```

**Status:** 2 genuine policy gaps confirmed (not 3 components)

---

## KEY INSIGHT

**Evidence transformed:**
- **Before investigation:** "3 genuine gaps" (proposal-based)
- **After ID-1 + ID-2:** **2 policy gaps** (evidence-based)

**Transition validation** absorbed into Discovery Lifecycle as a transition requirement, not separate gap.

This is the value of evidence-before-design: **proposal refinement based on semantic analysis.**

---

## ID-3: Design Genuine Gaps — MINIMAL MECHANISM

**Approach:** Design ONLY for 2 confirmed policy gaps using existing mechanisms where possible

**Principle:** 
> **Thiết kế tối thiểu nào có thể biểu diễn và enforce hai policy gaps này bằng cách tận dụng tối đa cơ chế hiện có?**

---

### Design Question Framework

For each gap, answer:
1. **Canonical state representation:** Where is state stored?
2. **Canonical owner:** Which mechanism owns enforcement?
3. **Factory integration:** Where does Factory check?
4. **Exception path:** How are exceptions handled?
5. **Evidence storage:** Where is evidence saved?
6. **Validation scenarios:** What behaviors must be proven?

---

### Gap 1: Discovery Lifecycle

**Policy requirement:** Track Industry OS phase (FOUNDATION → DISCOVERY → MANUFACTURING)

**Design approach:** Extend existing mechanisms, not create parallel system

#### State Representation

**Option A: Extend Factory Config**
```typescript
// .factory/industry-config.json
{
  "retail": {
    "phase": "DISCOVERY",
    "phaseStarted": "2026-09-06",
    "transitions": [
      { "from": "FOUNDATION", "to": "DISCOVERY", "date": "2026-09-06" }
    ]
  }
}
```

**Option B: Industry OS Manifest**
```typescript
// src/platform/retail/manifest.ts
export const retailOSManifest = {
  id: 'retail',
  version: '1.0.0',
  phase: 'DISCOVERY',  // ← lifecycle tracking
  phaseHistory: [...]
};
```

**Recommendation:** Option A (`.factory/industry-config.json`)
- **Why:** Factory already orchestrates Industry OS workflows
- **Canonical owner:** Factory
- **Integration:** Factory checks phase before Product creation
- **No new system:** Extends existing Factory config pattern

#### Lifecycle States

```text
FOUNDATION
    ↓ (manual transition, human approval)
DISCOVERY
    ↓ (Kernel Decision Gate)
MANUFACTURING
```

**Transitions:**
- FOUNDATION → DISCOVERY: Manual (human decision to start discovery)
- DISCOVERY → MANUFACTURING: Gated (requires Kernel Decision + evidence)

**State enforcement:**
- Factory checks `.factory/industry-config.json` phase
- Reference Product limit enforced ONLY during DISCOVERY
- Transition validation checks evidence before allowing MANUFACTURING

#### Integration with Factory

**Extend Factory Orchestrator:**
```typescript
// scripts/factory/orchestrator.ts

async function checkIndustryPhase(industry: string): Promise<IndustryPhase> {
  const config = loadIndustryConfig(industry);
  return config.phase;  // 'DISCOVERY' | 'MANUFACTURING'
}

async function validateReferenceProductLimit(industry: string): Promise<void> {
  const config = loadIndustryConfig(industry);
  
  if (config.phase === 'DISCOVERY') {
    const productCount = config.referenceProducts?.length || 0;
    if (productCount >= 2) {
      throw new DiscoveryLimitError(
        `Industry ${industry} in DISCOVERY phase has ${productCount} products. Max 2 allowed.`
      );
    }
  }
  // No limit during MANUFACTURING
}
```

**No separate lifecycle manager component** — Factory owns lifecycle checks.

---

### Gap 2: Reference Product Governance

**Policy requirement:** Enforce max 2 Reference Products during Discovery

**Design approach:** Minimal enforcement, reuse Factory

#### Product Classification

**Extend Factory config:**
```json
{
  "retail": {
    "phase": "DISCOVERY",
    "referenceProducts": [
      "bella-retail-pos",
      "bella-retail-inventory"
    ],
    "discoveryStarted": "2026-09-06"
  }
}
```

**Classification rule:**
- Product created during DISCOVERY → Reference Product
- Product created during MANUFACTURING → Standard Product (no limit)

**No separate Product registry** — Factory config tracks Reference Products.

#### Enforcement Point

**Where:** Factory Product creation workflow (to be added)

**How:**
```typescript
async function validateProductCreation(
  industry: string,
  productId: string
): Promise<ValidationResult> {
  const config = loadIndustryConfig(industry);
  
  if (config.phase !== 'DISCOVERY') {
    return { allowed: true, reason: 'Manufacturing phase' };
  }
  
  const referenceProductCount = config.referenceProducts?.length || 0;
  
  if (referenceProductCount >= 2) {
    return {
      allowed: false,
      violation: 'REFERENCE_PRODUCT_LIMIT_EXCEEDED',
      message: `Cannot create Product #${referenceProductCount + 1} during Discovery. Max 2 allowed.`,
      requiresHumanException: true
    };
  }
  
  return { allowed: true };
}
```

**Exception mechanism:** Reuse BDGF approval pattern
- Human can approve exception via approval record
- Exception recorded in config transitions
- Evidence captured

---

### Transition Validation (Part of Lifecycle)

**NOT a separate component** — integrated into lifecycle mechanism

**DISCOVERY → MANUFACTURING transition requires:**

```typescript
async function validateManufacturingTransition(
  industry: string
): Promise<TransitionValidation> {
  const checks = [
    checkKernelDecisionApproved(industry),
    checkReferenceProductsComplete(industry),
    checkCapabilityEvidenceExists(industry)
  ];
  
  const results = await Promise.all(checks);
  
  if (results.some(r => !r.passed)) {
    return {
      allowed: false,
      violations: results.filter(r => !r.passed),
      requiresHumanReview: true
    };
  }
  
  return { allowed: true };
}
```

**Integration:** Factory transition command checks validation before updating phase.

---

### Design Questions Answered

| Question | Answer |
|----------|--------|
| **Canonical state representation** | `.factory/industry-config.json` |
| **Canonical owner** | Factory Orchestrator |
| **Factory integration** | Product creation checks phase + count |
| **Exception path** | BDGF approval pattern (reused) |
| **Evidence storage** | `.factory/evidence/` (existing) |
| **Product #3 during Discovery** | BLOCK or require human exception |
| **Product #3 after Manufacturing** | ALLOW (no limit) |

---

### What We Are NOT Building

❌ **Separate lifecycle manager** — Factory owns lifecycle  
❌ **Separate Product registry** — Factory config tracks Reference Products  
❌ **Separate transition gate** — Part of lifecycle validation  
❌ **Capability Identity Model** — Deferred  
❌ **Semantic duplication detector** — Deferred  
❌ **Parallel Architecture Guard** — Extending existing  
❌ **Parallel BDGF** — Adapting existing approval pattern  
❌ **Parallel Evidence system** — Extending existing

---

### Minimal Components Required (Provisional)

**⚠️ Pending architectural validation**

**Proposed approach (requires validation):**

1. Industry lifecycle state storage
2. Factory lifecycle validation module
3. Product creation integration
4. Evidence Collector extensions
5. Architecture Guard configuration

**LOC estimates removed** — cannot estimate without validated design.

**Next:** Validate Factory integration assumptions before finalizing component list.

---

### Validation Scenarios (from ID-5)

**Must prove:**

1. ✅ Product #3 during Discovery → BLOCKED
2. ✅ Product #3 after Manufacturing → ALLOWED
3. ✅ Discovery → Manufacturing without Kernel Decision → BLOCKED
4. ✅ Discovery → Manufacturing with evidence → ALLOWED
5. ✅ Human exception during Discovery → ALLOWED with approval record

---

## Status

⚠️ **ID-3 PROVISIONAL — REQUIRES ARCHITECTURAL VALIDATION**

**Design proposed but NOT validated:**
- Proposed: Factory integration approach
- Unvalidated: Factory ownership, state persistence, Product creation flow, transition semantics

**Validation required before proceeding.**

**Next:** ID-4 Enforcement Boundaries, ID-5 Validation Design review

---

## ID-4: Enforcement Boundary Definition

### Enforcement Boundary Map

| Policy | Canonical Owner | Enforcement Point | When Evaluated | Violation Action | Evidence |
|--------|----------------|-------------------|----------------|------------------|----------|
| **Product → Contract** | Architecture Guard | `checkDependencyBoundaries()` | Pre-commit / CI | BLOCK (exit 2) | Import analysis |
| **Product ↛ Kernel internal** | Architecture Guard | `checkDependencyBoundaries()` | Pre-commit / CI | BLOCK (exit 2) | `forbiddenImports` check |
| **Product ↛ DB** | Architecture Guard | `checkDependencyBoundaries()` | Pre-commit / CI | BLOCK (exit 2) | Import pattern detection |
| **Reference Product limit** | NEW Guard | `checkReferenceProductLimit()` | Product creation | BLOCK (exit 2), require exception | Config file count |
| **Discovery lifecycle** | NEW Guard | Lifecycle state file | State transitions | BLOCK invalid transitions | `.kiro/governance/industry-discovery.json` |
| **Kernel promotion** | BDGF (adapted) | Gate token workflow | Human approval | REQUIRE human approval | Approval record + token |
| **Scope approval** | BDGF (adapted) | Gate token workflow | Before implementation | REQUIRE human approval | Approval record |
| **Regression** | Regression Gate | `performRegressionCheck()` | Pre-commit / CI | BLOCK (exit 1) | Baseline comparison |
| **Frozen OS** | Architecture Guard | `checkFrozenFiles()` | Pre-commit / CI | BLOCK (exit 1) | File existence + hash |

**Key principle:** Each policy has ONE canonical owner, ONE enforcement point

---

## ID-5: Validation Design

### Validation Scenarios

#### Scenario 1: Reference Product Limit

**Test:** Attempt to create Product #3 during Discovery

```text
Given: Industry OS in DISCOVERY phase
  And: 2 Reference Products already exist
When: Attempt to create Product #3
Then: Guard returns exit code 2 (BLOCK)
  And: Message: "Max 2 reference products during Discovery"
  And: Requires human exception approval
```

**Test:** Create Product #3 after Manufacturing

```text
Given: Industry OS in MANUFACTURING phase
When: Attempt to create Product #3
Then: Guard returns exit code 0 (ALLOW)
  And: No limit enforcement (Factory manufacturing)
```

**Evidence:** Exit codes, guard output, state file

---

#### Scenario 2: Product Boundary Enforcement

**Test:** Product imports Kernel internal

```text
Given: Product file imports from `src/platform/retail/services/`
When: Architecture Guard runs
Then: Violation detected
  And: Exit code 2 (BLOCK)
  And: Message: "Product must use Public Contract"
```

**Test:** Product uses Contract

```text
Given: Product imports from `src/platform/retail/contracts/`
When: Architecture Guard runs
Then: No violation
  And: Exit code 0 (PASS)
```

**Evidence:** Architecture Guard violation reports

---

#### Scenario 3: Discovery → Manufacturing Transition

**Test:** Transition without Kernel Decision

```text
Given: Industry OS in DISCOVERY phase
  And: NO Kernel Decision approved
When: Attempt transition to MANUFACTURING
Then: Transition BLOCKED
  And: Message: "Requires Kernel Decision approval"
```

**Test:** Valid transition

```text
Given: Industry OS in DISCOVERY phase
  And: Kernel Decision approved
  And: Reference Products complete
  And: Capability evidence collected
When: Attempt transition to MANUFACTURING
Then: Transition ALLOWED
  And: State file updated
```

**Evidence:** Lifecycle state file, Kernel Decision record

---

### Validation Success Criteria

**Implementation considered validated when:**

1. ✅ Reference Product limit enforced during Discovery
2. ✅ Reference Product limit NOT enforced during Manufacturing
3. ✅ Product boundary violations detected and blocked
4. ✅ Product using Contract allowed
5. ✅ Discovery → Manufacturing transition requires evidence
6. ✅ Kernel promotion requires human approval
7. ✅ Scope approval requires human approval
8. ✅ All guards produce verifiable evidence

---

## ID-6: Evidence-Based Estimate

**⚠️ INCOMPLETE** — Awaiting completion of ID-1 through ID-5 before providing estimate

**Estimation approach (after design complete):**

1. Count actual extension points discovered
2. Measure complexity of existing patterns
3. Compare with similar extensions in codebase
4. Provide range (optimistic / realistic / pessimistic)
5. Note: Estimates for planning only, not commitments

**To be completed after:** Evidence collection finalized, all designs reviewed

---

## Open Questions

1. **Configuration location:** Use `.kiro/governance/industry-discovery.json` or different structure?
2. **Integration with Factory:** How should Factory check lifecycle state before Product creation?
3. **Exception approval mechanism:** Reuse BDGF gate token for Reference Product exceptions?
4. **Evidence format:** What evidence format for Kernel Decision record?

---

## Recommendations

### 1. **Extend Architecture Guard First**

Priority: **HIGH**  
Rationale: Reuse existing enforcement, minimal new code

**Actions:**
- Add Product layer to `FROZEN_LAYERS`
- Define `forbiddenImports` patterns for Product → Kernel internal
- Add DB access detection patterns

**Estimated effort:** ~2-3 hours (config changes, validation)

---

### 2. **Implement Minimal Lifecycle Management**

Priority: **HIGH**  
Rationale: Foundation for all other governance

**Actions:**
- Define lifecycle state schema
- Create `.kiro/governance/industry-discovery.json` structure
- Implement state transition validation

**Estimated effort:** ~3-4 hours (schema + validation + tests)

---

### 3. **Implement Reference Product Limit Guard**

Priority: **MEDIUM**  
Rationale: Genuine gap, but only enforced during Discovery

**Actions:**
- Create `reference-product-limit-guard.ts`
- Integrate with lifecycle state
- Add exception approval mechanism

**Estimated effort:** ~2-3 hours (guard + integration + tests)

---

### 4. **Adapt BDGF for Non-DB Approvals**

Priority: **MEDIUM**  
Rationale: Reuse proven approval workflow

**Actions:**
- Extract gate token pattern for generic approvals
- Create Kernel Promotion approval workflow
- Create Scope Approval workflow

**Estimated effort:** ~4-5 hours (workflow adaptation + documentation)

---

### 5. **Defer Semantic Duplication**

Priority: **DEFERRED** (per human decision)  
Rationale: No Capability Identity Model, learn from Retail first

**Actions:**
- Use human review during Retail OS
- Collect duplication evidence
- Revisit after patterns proven

**Estimated effort:** N/A (deferred)

---

## AUDIT FINDINGS — ID-1 EVIDENCE COMPLETION

**Date:** 2026-09-06  
**Status:** ✅ **ID-1 COMPLETE**

---

### Track A: Factory Lifecycle Semantics

**Investigated:** `scripts/factory/orchestrator.ts` (full file, 525 lines)

**Finding:**

```typescript
interface FactoryRunConfig {
  industry: string;
  mode: 'controlled-fixture' | 'new-industry';  // ← TEST MODE, NOT lifecycle
  fixtureBaseline?: FactoryFixtureBaseline;     // ← Expected test results
}
```

**Evidence (lines 485-498):**
```typescript
// E10 Controlled Fixture: E8 Education Retrospective
const config: FactoryRunConfig = {
  industry: 'education',
  mode: 'controlled-fixture',  // Testing against known baseline
  fixtureBaseline: {
    expectedScope: { ... },    // Expected test results
    expectedTests: 46,
    expectedTypecheck: 'pass',
  }
}
```

**Semantic Analysis:**
- `controlled-fixture` = **Test mode with baseline** (validating Education against known results)
- `new-industry` = **Test mode for new Industry** (no baseline)
- **NOT** Discovery vs Manufacturing lifecycle
- Factory tracks `industry` string but NO lifecycle phase

**Conclusion:** ❌ **Factory does NOT track Discovery/Manufacturing lifecycle**

---

### Track B: Product Creation/Registration

**Investigated:**
- `src/products/` directory structure
- Product plugin interface (`ProductPluginContract`)
- Product registry search

**Finding:**

**Products exist as directories:**
- `bella-dental` (Healthcare Product)
- `bella-education` (Education Product)
- `bella-hospital` (Healthcare Product)
- `bella-land` (Real Estate Product)
- `bella-medical` (Healthcare Product)

**Product Plugin Pattern (src/products/bella-medical/index.ts):**
```typescript
export class BellaMedicalPlugin implements ProductPluginContract<unknown> {
  readonly manifest = medicalProductManifest;
  // ...
}
```

**Product Manifest (src/products/bella-medical/manifest.ts):**
```typescript
export const medicalProductManifest: ProductManifest = {
  id: 'bella-medical',
  name: 'Bella Medical Clinic',
  // ...
}
```

**Search Results:**
- ❌ NO Product registry file
- ❌ NO Product creation workflow
- ❌ NO Product limit enforcement
- ❌ NO Reference Product classification

**Conclusion:** Products exist as manual directory creation, NO automated governance

---

### Track C: Industry OS Metadata/State

**Investigated:**
- `.kiro/` directory (`governance-index.md`, `hooks/`, `settings/`, `specs/`)
- Kernel registry (`src/platform/deployment/kernel-registry.ts`)
- Industry configuration searches

**Finding 1: `.kiro/` Structure**
```
.kiro/
  ├── governance-index.md
  ├── hooks/
  ├── settings/
  └── specs/
```
- ❌ NO `.kiro/governance/` subdirectory
- ❌ NO Industry state files
- ❌ NO Discovery configuration

**Finding 2: Kernel Registry**

**File:** `src/platform/deployment/kernel-registry.ts`

**Purpose:** Protects **Kernel artifacts** (Healthcare H1-H12, Logistics E7.1), NOT Industry OS lifecycle

```typescript
export type KernelType = 'logistics' | 'healthcare' | 'finance';
export type LifecycleState = 'active' | 'frozen' | 'deprecated' | 'sunset';

export interface KernelArtifact {
  table: string;              // DB table
  kernel: KernelType;
  contractVersion: string;    // H1, E7.1, etc.
  lifecycle: LifecycleState;  // Artifact lifecycle, NOT Industry OS
  frozenDate?: string;
}
```

**Semantic distinction:**
- Kernel Registry tracks: **Artifact-level** protection (Healthcare H1, Logistics E7.1)
- NOT tracked: **Industry OS-level** lifecycle (Discovery → Manufacturing)

**Evidence:**
```typescript
{
  table: 'hc_patients',
  kernel: 'healthcare',
  contractVersion: 'H1',
  lifecycle: 'frozen',  // ← Artifact frozen, NOT Industry phase
}
```

**Conclusion:** Kernel Registry is **artifact protection**, NOT Industry Discovery governance

---

### Track D: Architecture Guard Extension Model

**Investigated:** `scripts/architecture/architecture-guard.ts` (reviewed in ID-1 initial pass)

**Extension Pattern:**

```typescript
// Lines 85-156: FROZEN_LAYERS array
const FROZEN_LAYERS: FrozenLayer[] = [
  {
    name: 'Logistics E7.1 Domain Kernel',
    version: 'E7.1.0',
    status: 'SEALED',
    frozenDate: '2026-08-24',
    paths: [
      'src/platform/logistics/domain/**/*.ts',
      // ...
    ],
    allowedImports: [...],
    forbiddenImports: [...],
  },
  // More layers...
];
```

**Capabilities:**
- ✅ Can enforce import boundaries (Product ↛ Kernel internal)
- ✅ Can check forbidden imports (Product ↛ DB direct)
- ✅ Can freeze artifacts (hash verification)
- ❌ Does NOT enforce Product creation limits
- ❌ Does NOT track Industry OS lifecycle

**Extension Point:** Architecture Guard can be extended with Product boundary rules, but does NOT provide lifecycle tracking

---

## EVIDENCE-BACKED GAP CLASSIFICATION

| Concern | Existing Mechanism | Actual Capability | Evidence | Classification |
|---------|-------------------|-------------------|----------|----------------|
| **Discovery lifecycle tracking** | Factory `mode` field | Test fixture mode ONLY | orchestrator.ts:32-35, 487-498 | ❌ **GENUINE GAP** |
| **Reference Product limit** | NO mechanism found | None | grep search + manual Product creation | ❌ **GENUINE GAP** |
| **Discovery → Manufacturing transition** | NO mechanism found | None | Depends on lifecycle tracking | ❌ **GENUINE GAP** |
| **Product → Contract boundary** | Architecture Guard | Import boundary enforcement | architecture-guard.ts:353-384 | ✅ **EXTEND EXISTING** |
| **Product ↛ Kernel internal** | Architecture Guard | `forbiddenImports` pattern | architecture-guard.ts:282 | ✅ **EXTEND EXISTING** |
| **Product ↛ DB direct** | Architecture Guard | Import pattern detection | architecture-guard.ts:267-282 | ✅ **EXTEND EXISTING** |
| **Evidence collection** | Evidence Collector | Industry evidence gathering | evidence-collector.ts:497-574 | ✅ **EXTEND EXISTING** |
| **Kernel promotion** | BDGF | Gate token workflow | gate-token.mjs, migration-executor.mjs | ✅ **ADAPT EXISTING** |
| **Frozen artifact protection** | Architecture Guard + Kernel Registry | Artifact-level freeze | kernel-registry.ts, architecture-guard.ts | ✅ **REUSE EXISTING** |

---

## KEY FINDINGS

### 1. Factory `mode` ≠ Discovery Lifecycle

**Initial Hypothesis:** `controlled-fixture` might be Discovery, `new-industry` might be Manufacturing

**Evidence Verdict:** ❌ **INCORRECT**

Factory `mode` is **test fixture classification**, NOT Industry OS lifecycle. It distinguishes:
- `controlled-fixture` = Testing with known baseline (E8 Education)
- `new-industry` = Testing without baseline

**No lifecycle tracking exists in Factory.**

---

### 2. Product Creation is Manual, Not Governed

**Finding:**
- Products exist as directories (`src/products/bella-*`)
- No Product registry
- No Product creation workflow
- No Reference Product classification
- **No limit enforcement**

**Implication:** Reference Product limit is **genuine gap** requiring new component

---

### 3. Kernel Registry ≠ Industry OS Registry

**Distinction:**
- **Kernel Registry:** Protects Kernel **artifacts** (Healthcare H1, Logistics E7.1)
- **Industry Discovery Governance:** Would protect Industry OS **lifecycle** (Discovery → Manufacturing)

**Different concerns, different granularity.**

---

### 4. Three Confirmed Genuine Gaps

Based on evidence:

| Gap | Evidence | Justification |
|-----|----------|---------------|
| **Discovery lifecycle** | Factory has NO lifecycle tracking | `mode` is test fixture, not lifecycle |
| **Reference Product limit** | NO Product registry/creation workflow | Manual directory creation, no governance |
| **Transition validation** | Depends on lifecycle tracking | No mechanism to validate transition readiness |

---

## REVISED STATUS

```text
IMPLEMENTATION DESIGN
────────────────────────────────────
ID-1 Evidence       ✅ COMPLETE (4 tracks investigated with file/line evidence)
ID-2 Gap Analysis   🟢 READY (3 genuine gaps confirmed, 6 extensions identified)
ID-3 Design         🟡 PENDING (design only confirmed gaps)
ID-4 Boundaries     🟡 PENDING (review after ID-3)
ID-5 Validation     🟡 PENDING (review after ID-3)
ID-6 Estimate       🔒 BLOCKED (after ID-3-5 approved)
Production Code     🔒 BLOCKED
```

---

## NEXT: ID-2 GAP ANALYSIS

With evidence complete, proceed to ID-2 to formally classify each concern and design only genuine gaps.

---

## Status

✅ **ID-1 COMPLETE** — Evidence-backed investigation (4 tracks)  
✅ **ID-2 COMPLETE** — Policy semantics classification (2 gaps confirmed)  
🛑 **ID-3 STOPPED** — Design validation halted

**Decision:** STOP governance framework development

**Rationale:** 
> **Đừng xây Industry Discovery Governance Framework để chứng minh Factory có thể tự động hóa Product Manufacturing. Hãy dùng Retail để chứng minh điều đó trước. Nếu governance pattern thực sự lặp lại, lúc đó mới biến nó thành framework.**

---

## Checkpoint Closure

**What we learned:**
1. ✅ Factory Orchestrator exists (verification pipeline)
2. ✅ 2 genuine policy gaps identified (Discovery lifecycle, Reference Product limit)
3. ✅ Gap evidence collection methodology proven
4. ⚠️ **Jumped to framework design before proving pattern repeats**

**What we should NOT do:**
- ❌ Build Discovery lifecycle engine
- ❌ Build Reference Product Guard
- ❌ Build Capability Identity Model
- ❌ Build governance workflow
- ❌ Build Product registry

**What we SHOULD do instead:**

### Return to Retail OS Development

**Simple path:**

```text
RETAIL OS
    ↓
Design 2 Reference Products
    ↓
Build Products
    ↓
Discover real capabilities
    ↓
Extract Retail OS
    ↓
Qualify OS
    ↓
Factory creates Product #3
    ↓
MEASURE: How much faster? How much less code? How much less intervention?
```

**Governance as needed (manual):**
- 2 Reference Product limit: **Human judgment** (roadmap rule, not automated enforcement)
- Discovery lifecycle: **Human tracking** (document phases, don't build engine)
- Capability extraction: **Evidence-based** (after Products built, not before)

**Automate only what's proven repeatable:**
- Architecture Guard ✅ (already exists)
- Tests/regression ✅ (already exists)
- RLS/tenant checks ✅ (already exists)
- Evidence collection ✅ (already exists)
- Factory schema generation ✅ (already proven)

---

## Key Learning

**Governance spiral occurred because:**
1. Identified gaps (correct)
2. Immediately designed framework (premature)
3. Didn't validate against actual Retail need
4. **Built governance to prove Factory automation, instead of using Retail to prove it**

**Correct approach:**

> **Build Retail → Measure Factory leverage → Extract proven patterns → THEN automate governance**

---

## Next Steps

**NOT:** Continue ID-4, ID-5, ID-6, implementation

**YES:** Return to Retail OS

**Recommended:**
1. Design 2 Reference Products for Retail OS
2. Define what capabilities they should validate
3. Build Products using Platform
4. Extract Retail OS from Product patterns
5. Qualify Retail OS
6. Use Factory to create Product #3
7. **Measure actual evidence:**
   - Product #3 development time vs Product #1/2
   - Lines of code (Product-specific vs reused OS)
   - Human decisions required
   - Factory automation effectiveness

**Then and only then:** If pattern repeats across multiple Industries → Extract governance automation

---

## Documents Created

**Evidence of investigation:**
- `docs/governance/INDUSTRY_DISCOVERY_GOVERNANCE_DECISION.md` ✅ Preserved (decision record)
- `docs/governance/GOVERNANCE_RECONCILIATION.md` ✅ Preserved (existing mechanisms)
- `docs/governance/INDUSTRY_DISCOVERY_GOVERNANCE_IMPLEMENTATION_DESIGN.md` ⚠️ Marked as STOPPED

**Value:**
- Investigation methodology proven
- Gap identification process validated
- **Learned to stop before building unproven automation**

---

## Principle Reinforced

**6th Governance Principle (now validated by experience):**

> **Do not automate unproven patterns.**

**Applied:**
- Discovery lifecycle pattern: **UNPROVEN** (only 1 Industry OS so far)
- Reference Product limit: **UNPROVEN** (no second Industry to validate pattern)
- Governance framework: **UNPROVEN** (would be first application)

**Therefore:** Build Retail, prove pattern, THEN automate.

---

**Status:** 🛑 CHECKPOINT STOPPED — RETURN TO RETAIL OS DEVELOPMENT

**No production code created. No governance framework built. Investigation methodology preserved for future use when patterns proven.**

## Key Outcomes

**Evidence transformation:**
- Proposal: "3 genuine gaps" → "3 new components"
- Evidence: **2 policy gaps** → **minimal extensions to existing mechanisms**

**Design approach refined:**
- Original: Separate governance components
- Proposed: Factory integration (requires validation)

**Critical principle proven:**

> **Không phải chứng minh rằng proposal ban đầu đúng. Mà phải sẵn sàng loại bỏ proposal ban đầu nếu evidence cho thấy nó sai.**

Evidence investigation transformed "3 components" into "2 policy gaps with proposed Factory integration."

**⚠️ Factory integration design requires architectural validation before approval.**

---

## Next Steps

**For human review:**
1. ID-4: Verify enforcement boundaries (canonical owners correct?)
2. ID-5: Verify validation scenarios (test coverage sufficient?)
3. Open questions resolution
4. Then: ID-6 evidence-based estimate

**After approval:**
- Implementation checkpoint
- Validation against scenarios
- Evidence collection
- Human qualification

---

**⚠️ NO PRODUCTION CODE until ID-4/ID-5 approved and ID-6 estimated.**
