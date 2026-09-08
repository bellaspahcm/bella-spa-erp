# Factory Validation Layer — Proposal from Bella Land Learning

**Date:** 2026-09-06  
**Status:** 📋 PROPOSAL  
**Origin:** Bella Land E2E remediation lessons

---

## Executive Summary

Bella Land E2E remediation revealed **4 critical Factory capabilities** that should be added to prevent similar issues in future Product development:

1. **Environment Preflight Guard** — Validate DB configuration before E2E
2. **E2E Assertion Quality Guard** — Detect implementation-dependent test assertions
3. **Evidence Integrity Guard** — Prevent evidence level substitution
4. **Failure Classification** — Auto-classify failure types (code/test/infra/env)

**Key Principle:**
> **Factory must validate not only "is the code correct?" but also "is the validation measuring correctly?"**

This moves Factory from **Software Factory** → **Evidence-driven Software Factory**.

---

## Problem Statement

### What Happened in Bella Land

**Issue #1: Database configuration gap**
- E2E tests failed with `permission denied for table real_estate_projects`
- Root cause: Missing table privilege for `anon` role
- RLS was configured correctly, but table-level privilege was not
- **Time lost:** ~30 minutes investigation before identifying root cause

**Issue #2: Test false positives**
- E2E test failed because assertion matched React hydration markup
- Assertion: `expect(bodyText).not.toMatch(/not-found/)`
- Actual page: Rendered successfully with all business content
- Screenshot showed fully functional dashboard
- **Time lost:** ~20 minutes verifying page actually loaded before identifying test defect

**Issue #3: TypeScript timeout**
- TypeScript standalone check timed out (>180s)
- Production build compiled successfully
- Product tests passed
- **Risk:** Could have been misclassified as "PASS" or "DEFERRED" without evidence

### Why Current Guards Didn't Catch These

**Architecture Guard** correctly focuses on:
- Dependency boundaries
- Frozen artifacts
- Circular dependencies
- Tenant isolation in code

**But it doesn't validate:**
- Database privilege configuration
- Test assertion quality
- Evidence completeness
- Failure classification

**Gap:** Factory needs a **Validation Layer** separate from Architecture Guard.

---

## Proposed Factory Validation Layer

### Layer Architecture

```
                    FACTORY
                       │
       ┌───────────────┼────────────────┐
       │               │                │
 Architecture     Validation       Evidence
    Guard            Layer            Layer
       │               │                │
   imports         preflight        evidence matrix
   freeze          E2E quality      claim validation
   circular        build            status integrity
   tenant          tests            no substitution
                   classification
```

**Separation of Concerns:**
- **Architecture Guard:** Code structure, boundaries, invariants
- **Validation Layer:** Environment, test quality, gate execution
- **Evidence Layer:** Evidence collection, integrity, claim validation

### Factory Decision Flow

```
                   BELLA FACTORY
                         │
            ┌────────────┼────────────┐
            │            │            │
      Architecture   Validation    Evidence
         Guard          Layer        Layer
            │            │            │
      boundaries     environment    claim integrity
      dependencies   test quality   evidence matrix
      freeze         failure        status integrity
      tenant         classification
            │            │            │
            └────────────┼────────────┘
                         ↓
                  FACTORY DECISION
                         │
             ┌───────────┴───────────┐
             │                       │
        AUTOMATIC                HUMAN
         ACTION                  JUDGMENT
             │                       │
      mechanical work        ambiguity / intent
      repetitive fixes       architecture choice
      evidence collection    business decision
```

**Principle:** Automate repetition, not judgment.

**Factory automates:**
- Environment checks (DB privilege, RLS, policies)
- Test quality warnings (risky assertion patterns)
- Evidence integrity validation (status substitution detection)
- Failure pattern classification (with confidence scores)

**Human decides:**
- Architecture choices when ambiguous
- Business logic intent when unclear
- Remediation strategy when judgment required
- Trade-offs between competing concerns

---

## F-G1: Environment Preflight Guard

**Purpose:** Validate runtime environment configuration before expensive E2E tests.

**Checks:**

### Database Configuration
```typescript
interface DBPreflightCheck {
  table: string;
  requiredPrivileges: {
    role: 'anon' | 'authenticated' | 'service_role';
    privileges: ('SELECT' | 'INSERT' | 'UPDATE' | 'DELETE')[];
  }[];
  rlsEnabled: boolean;
  requiredPolicies: string[];
}
```

**Example:**
```typescript
{
  table: 'real_estate_projects',
  requiredPrivileges: [
    { role: 'anon', privileges: ['SELECT'] },
    { role: 'authenticated', privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] }
  ],
  rlsEnabled: true,
  requiredPolicies: ['projects_tenant_read', 'Projects: View for authenticated users']
}
```

**Validation Flow:**
```
Before E2E
    ↓
Check DB connectivity
    ↓
Check table privileges
    ↓
Check RLS enabled
    ↓
Check policies exist
    ↓
PASS → Run E2E
FAIL → Report configuration gap (don't run E2E)
```

**Output on Failure:**
```
❌ ENVIRONMENT PREFLIGHT FAILED

Table: real_estate_projects
  ❌ anon: Missing SELECT privilege
  ✅ authenticated: Has required privileges
  ✅ RLS: Enabled
  ✅ Policies: All present

Fix required before E2E:
  GRANT SELECT ON TABLE public.real_estate_projects TO anon;
```

**Benefit:** Catch configuration gaps in ~5s instead of ~30min E2E debugging.

---

## F-G2: E2E Assertion Quality Guard

**Purpose:** Detect assertions that may match implementation artifacts instead of business semantics.

**Risky Patterns:**

### Pattern 1: Broad body text checks
```typescript
// ⚠️ RISKY
const bodyText = await page.textContent('body');
expect(bodyText).not.toMatch(/not-found/);
expect(bodyText).not.toMatch(/UNAUTHORIZED/);
```

**Why risky:** Matches framework internals (React hydration, Next.js routing)

### Pattern 2: Content() regex
```typescript
// ⚠️ RISKY
const content = await page.content();
expect(content).toMatch(/some pattern/);
```

**Why risky:** Includes HTML markup, script tags, framework artifacts

### Preferred Patterns
```typescript
// ✅ GOOD - Semantic UI assertions
await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
await expect(page.getByText(/revenue metrics/i)).toBeVisible();
await expect(page.locator('[data-testid="project-section"]')).toBeVisible();
```

**Guard Behavior:**

**Static Analysis:**
```typescript
interface AssertionRisk {
  file: string;
  line: number;
  pattern: 'body-text-not-match' | 'content-regex' | 'innerHTML-check';
  severity: 'warning' | 'error';
  suggestion: string;
}
```

**Output:**
```
⚠️ E2E ASSERTION QUALITY WARNING

File: e2e/tests/bella-land-real-estate.spec.ts:35
Pattern: expect(bodyText).not.toMatch(/not-found/)

Risk: This assertion may match framework/hydration markup.
Suggestion: Use semantic assertions:
  - page.getByRole(...)
  - page.getByText(...)
  - page.locator('[data-testid="..."]')

Business-semantic assertions are more stable and meaningful.
```

**Configuration:**
```typescript
{
  assertionQuality: {
    failOn: ['body-text-not-match'],
    warnOn: ['content-regex'],
    allowBodyText: false // Strict mode
  }
}
```

**Benefit:** Prevent false positives before they reach CI/E2E execution.

---

## F-G3: Evidence Integrity Guard

**Purpose:** Prevent evidence level substitution and ensure status claims have actual evidence.

**Core Principle:**
> **No Evidence Level Substitution**

**Evidence Matrix:**
```typescript
interface EvidenceMatrix {
  productName: string;
  gates: {
    [gateName: string]: GateEvidence;
  };
}

interface GateEvidence {
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'SKIPPED' | 'NOT_RUN';
  executedAt: string;
  duration: number;
  evidence: {
    type: 'test-results' | 'build-output' | 'screenshot' | 'logs';
    location: string;
  }[];
  canSubstituteFor: string[]; // Empty unless explicitly allowed
}
```

**Example:**
```typescript
{
  productName: 'bella-land',
  gates: {
    'unit-tests': {
      status: 'PASS',
      executedAt: '2026-09-06T10:30:00Z',
      duration: 4865,
      evidence: [{ type: 'test-results', location: 'test-results/unit.json' }],
      canSubstituteFor: [] // Unit tests don't substitute for integration
    },
    'browser-e2e': {
      status: 'PASS',
      executedAt: '2026-09-06T10:35:00Z',
      duration: 67000,
      evidence: [
        { type: 'test-results', location: 'playwright-report/index.html' },
        { type: 'screenshot', location: 'test-results/screenshots/' }
      ],
      canSubstituteFor: []
    },
    'typescript': {
      status: 'TIMEOUT',
      executedAt: '2026-09-06T10:40:00Z',
      duration: 180000,
      evidence: [{ type: 'logs', location: 'typescript-check.log' }],
      canSubstituteFor: []
    }
  }
}
```

**Validation Rules:**

### Rule 1: No Implicit Substitution
```
Unit PASS ≠ Integration PASS
Integration PASS ≠ E2E PASS
Build TypeScript ≠ Standalone TypeScript
```

### Rule 2: Status Integrity
```
TIMEOUT → must remain TIMEOUT (not auto-converted to PASS/DEFERRED)
SKIPPED → must remain SKIPPED
PARTIAL → must remain PARTIAL (not promoted to COMPLETE)
```

### Rule 3: Claim Validation
```
Claim: "FULL E2E VERIFIED"
Required Evidence:
  - browser-e2e: PASS
  - typescript: PASS (not TIMEOUT)
  - build: PASS
  
If typescript: TIMEOUT → Claim REJECTED
Suggested Claim: "Browser E2E VERIFIED (TypeScript pending)"
```

**Guard Output:**
```
❌ EVIDENCE INTEGRITY VIOLATION

Claim: "Bella Land — FULL E2E VERIFIED"

Evidence Status:
  ✅ browser-e2e: PASS (17/17)
  ✅ unit-tests: PASS (23/23)
  ✅ architecture: PASS
  ✅ build: PASS
  ⚠️ typescript: TIMEOUT (not PASS)

Violation: Claim requires TypeScript PASS, but evidence shows TIMEOUT.

Suggested Claim:
  "Bella Land — Browser E2E FULLY VERIFIED (TypeScript gate pending)"
```

**Benefit:** Prevents false claims, maintains evidence discipline.

---

## F-G4: Failure Classification

**Purpose:** Auto-classify failure types to accelerate remediation decision-making.

**Classification:**

```typescript
type FailureType =
  | 'CODE_DEFECT'           // Actual bug in Product/OS code
  | 'TEST_DEFECT'           // Test assertion or setup issue
  | 'DATABASE_CONFIG'       // DB privilege, RLS, schema mismatch
  | 'INFRASTRUCTURE'        // Timeout, network, environment
  | 'ENVIRONMENT'           // Missing env vars, credentials
  | 'UNKNOWN';              // Requires human investigation

interface FailureClassification {
  type: FailureType;
  confidence: number; // 0.0 - 1.0
  evidence: string[];
  suggestedAction: string;
  requiresHumanJudgment: boolean;
}
```

**Classification Heuristics:**

### Database Configuration
```
Error: "permission denied for table X"
  + RLS enabled: true
  + Policy exists: true
  → DATABASE_CONFIG (confidence: 0.9)
  → Suggested action: "Check table privileges for required roles"
```

### Test False Positive
```
Error: "expect(bodyText).not.toMatch(/pattern/)"
  + Screenshot shows page rendered: true
  + Other similar tests: PASS
  + Error pattern in hydration markup: true
  → TEST_DEFECT (confidence: 0.85)
  → Suggested action: "Review assertion - may be matching framework artifacts"
```

### Infrastructure Timeout
```
Error: "timeout after 180s"
  + Build compiles: PASS
  + Product tests: PASS
  + Recent similar failures: none
  → INFRASTRUCTURE (confidence: 0.7)
  → Suggested action: "Investigate gate execution environment"
```

### Code Defect
```
Error: "TypeError: Cannot read property 'x' of undefined"
  + Stack trace in Product code: true
  + Related tests: FAIL
  + No environment/config issues detected: true
  → CODE_DEFECT (confidence: 0.95)
  → Suggested action: "Fix null/undefined handling in Product code"
```

**Guard Output:**
```
🔍 FAILURE CLASSIFICATION

Test: "Real Estate Dashboard page loads"
Status: FAIL
Error: "permission denied for table real_estate_projects"

Classification: DATABASE_CONFIG (confidence: 90%)
Requires Human Judgment: NO

Evidence:
  ✅ Error mentions specific table
  ✅ Error is database permission error
  ✅ RLS is enabled on table
  ✅ RLS policies exist
  ❌ anon role missing SELECT privilege

Suggested Remediation:
  GRANT SELECT ON TABLE public.real_estate_projects TO anon;

Verification Required:
  1. Apply privilege grant
  2. Verify RLS still enforces tenant isolation
  3. Rerun E2E test
```

**Important:**
> **Factory classifies but does NOT auto-remediate when requiresHumanJudgment: true**

**Benefit:** Accelerate diagnosis from ~30min → ~5min, while preserving human judgment for critical decisions.

---

## Implementation Priority

### P0 — Implement First (Direct Evidence from Bella Land)

**F-G1: Environment Preflight Guard**
- **Evidence:** Bella Land DB privilege gap took ~30 min to diagnose
- **Preflight check:** Would catch in <5s before E2E
- **Ceremony:** Low (simple SQL checks)
- **Implementation:** 1-2 days
- **Status:** ✅ APPROVED for implementation

**F-G3: Evidence Integrity Guard**
- **Evidence:** TypeScript timeout risk of misclassification as PASS/DEFERRED
- **Purpose:** Enforce "No Claim Without Evidence" + prevent status substitution
- **Ceremony:** Low (evidence matrix + validation rules)
- **Implementation:** 2-3 days
- **Status:** ✅ APPROVED for implementation

### P1 — Implement After Evidence Collection (WARNING mode first)

**F-G2: E2E Assertion Quality Guard**
- **Evidence:** Bella Land false positive from body-text assertion
- **Initial mode:** WARNING only (not blocking)
- **Purpose:** Collect false-positive patterns before enforcing rules
- **Ceremony:** Low (static analysis)
- **Implementation:** 2-3 days
- **Status:** ⏸️ DEFERRED until P0 proven, then deploy in WARNING mode

**Rationale:** Start with warnings to collect evidence about which patterns actually cause false positives in practice. Hard enforcement only after pattern validation across multiple Products.

### P2 — Implement After Pattern Evidence (Simple classification first)

**F-G4: Failure Classification**
- **Evidence:** Bella Land had 2 distinct failure types (DB config + test quality)
- **Initial scope:** Simple classification (CODE/TEST/DATABASE/INFRA/ENV/UNKNOWN) with supporting evidence
- **NO confidence scores initially** — collect classification accuracy first
- **Ceremony:** Medium (pattern matching + heuristics)
- **Implementation:** 3-4 days
- **Status:** ⏸️ DEFERRED until enough failure cases to validate classification patterns

**Rationale:** Classification accuracy must be proven empirically before adding confidence scoring. Start simple, measure, then enhance.

### Implementation Strategy

**Phase 1 (Now):** F-G1 + F-G3 (~3-5 days)  
**Phase 2 (After 2-3 Products):** F-G2 in WARNING mode  
**Phase 3 (After 5-10 Products):** F-G4 simple classification + F-G2 evaluation for enforcement

**Total P0 Implementation:** ~1 week (not 2 weeks for all guards)

---

## Integration with Existing Architecture

### What Changes

**New:**
- `scripts/factory/validation/` — Validation Layer implementation
- `scripts/factory/evidence/` — Evidence Integrity tracking
- Factory Validation config in `.factory/validation.config.ts`

**Enhanced:**
- E2E test runner: Adds preflight + classification
- Evidence collection: Adds integrity checks
- Status reporting: Adds claim validation

### What Stays The Same

**Architecture Guard remains focused:**
- Dependency boundaries
- Frozen artifacts
- Circular dependencies
- Tenant isolation code patterns

**No changes to:**
- Product code
- OS code
- Platform Core
- Test frameworks (Jest, Playwright)

---

## Success Metrics

### ROI Hypothesis (To Be Measured Empirically)

**Bella Land case (single incident):**
- Database config gap: ~30 min to identify
- Test false positive: ~20 min to identify
- TypeScript timeout: Risk of misclassification
- Total investigation time: ~50 min

**Target with Factory Validation Layer:**
- Database config gap: <5 min (preflight catches before E2E)
- Test false positive: <10 min (assertion guard warns)
- TypeScript timeout: 0% risk (evidence guard validates status)
- Failure classification: ~5 min average diagnosis time
- **Hypothesis:** ~90-135 min saved per Product with 2-3 validation incidents

**Important:** This is a **hypothesis**, not evidence. Actual ROI must be measured across subsequent Factory runs.

### Measurement Plan

After **5-10 Products** using Factory Validation Layer, collect:

```
Factory Validation ROI Measurement
──────────────────────────────────────
Preflight prevented:           X incidents
  → Time saved:                X min
  
Assertion quality warnings:    X
  → False positives caught:    X
  → Time saved:                X min
  
Evidence errors prevented:     X
  → Status misclassifications: X
  
Failure classifications:       X
  → Diagnosis time:            X min average
  → Baseline time:             X min average
  → Time saved:                X min

Total time saved per Product:  X min (actual)
Hypothesis accuracy:           X%
```

**Only after empirical measurement can Factory claim validated ROI.**

### Breakeven Analysis

**P0 Implementation cost:** ~1 week (F-G1 + F-G3)  
**P1-P2 Implementation cost:** ~1 week (F-G2 + F-G4)  
**Total investment:** ~2 weeks

**Breakeven calculation:**
- If hypothesis holds (~90-135 min saved per Product)
- Breakeven at ~3-4 Products
- But this assumes hypothesis is correct

**Conservative approach:** Measure actual ROI after P0 deployment before investing in P1/P2.

---

## Design Principles

### 1. Lean but Effective
- Add only guards with proven ROI from real cases
- No ceremony for ceremony's sake
- Each guard must save more time than it costs

### 2. Automate Repetition, Not Judgment
- Auto-detect patterns (DB config, test quality)
- Auto-classify failures with confidence scores
- Human decides remediation when requiresHumanJudgment: true

### 3. Evidence Integrity
- No evidence level substitution
- Status must have actual evidence
- TIMEOUT ≠ PASS, SKIPPED ≠ PASS

### 4. Separation of Concerns
- Architecture Guard: Code structure
- Validation Layer: Environment + test quality
- Evidence Layer: Claim integrity

### 5. Non-Invasive
- Static analysis where possible
- Preflight checks before expensive operations
- No changes to Product/OS code

---

## Risks & Mitigations

### Risk 1: Guard False Positives

**Risk:** Assertion Quality Guard flags valid patterns as risky

**Mitigation:**
- Confidence scores, not binary FAIL
- Configurable severity (warn vs error)
- Allow-list for known-valid patterns

### Risk 2: Ceremony Creep

**Risk:** Guards become heavyweight, slow down development

**Mitigation:**
- Only implement guards with proven ROI
- Execute only at gate boundaries (not on every save)
- Fail-fast design (cheap checks first)

### Risk 3: Over-Classification

**Risk:** Failure classification auto-decides when human judgment needed

**Mitigation:**
- Always include `requiresHumanJudgment` flag
- Conservative confidence thresholds
- Suggest, don't command remediation

---

## Conclusion

Bella Land case demonstrates that **Factory needs to validate not only code correctness, but also validation measurement correctness**.

**Proposed 4 Guards:**
1. **F-G1: Environment Preflight** — Catch config gaps early (P0)
2. **F-G3: Evidence Integrity** — Prevent false claims (P0)
3. **F-G2: E2E Assertion Quality** — Prevent false positives (P1, WARNING mode)
4. **F-G4: Failure Classification** — Accelerate diagnosis (P2, simple classification)

**P0 Implementation:** ~1 week (F-G1 + F-G3)  
**ROI Hypothesis:** ~90-135 min saved per Product (to be measured empirically)  
**Principle:** Evidence-driven Software Factory

### Key Architectural Insight

**NOT:**
> Factory validates CODE correctness + Factory validates VALIDATION correctness = Proven correctness

**BUT:**
> **Factory constructs, validates, and preserves evidence about correctness.**

**Why this matters:**
- Test PASS ≠ Software is "correct" (in absolute sense)
- Test PASS = Software satisfies tested contracts under tested conditions
- Factory's job: Maintain evidence integrity, not prove absolute correctness

**This aligns with:** "No Claim Without Evidence"

### Critical Factory Evolution

Bella Land marks a **turning point** for Factory:

**Before:** Factory proves it can *construct Products*  
**After:** Factory must detect when *its own validation is flawed*

This is a higher-order capability:
- Detect configuration gaps before expensive tests
- Detect test quality issues causing false signals
- Detect evidence integrity violations
- Classify failures to accelerate remediation

**Factory that validates its own validation is more trustworthy than Factory that only validates code.**

### Next Steps

**Immediate (P0):**
1. Implement F-G1 Environment Preflight Guard
2. Implement F-G3 Evidence Integrity Guard
3. Deploy to next Product construction

**After 2-3 Products:**
- Evaluate P0 effectiveness
- Measure actual time savings
- Decide on F-G2 WARNING mode deployment

**After 5-10 Products:**
- Collect failure classification patterns
- Validate assertion quality patterns
- Measure empirical ROI
- Decide on F-G4 simple classification

**Status:** PROPOSAL APPROVED for P0 implementation, P1/P2 pending evidence collection.

