# Factory P0 Implementation Plan

**Date:** 2026-09-06  
**Status:** 🔄 IN PROGRESS  
**Origin:** Bella Land learning → Factory capability enhancement

---

## Objective

Convert Bella Land learning into actual Factory automation:

> **Factory validates its own validation before reporting results.**

### P0 Capabilities (Approved for Implementation)

1. **F-G1: Environment Preflight Guard** — Catch config gaps before expensive E2E runs
2. **F-G3: Evidence Integrity Guard** — Enforce "No Claim Without Evidence"

### Success Criteria

✅ F-G1 detects DB privilege gaps in ~5s (vs ~30min E2E debugging)  
✅ F-G3 prevents status substitution (TIMEOUT → PASS forbidden)  
✅ Both guards proven on next real Product construction  
✅ Evidence collected: time saved, issues caught, false claims prevented

---

## F-G1: Environment Preflight Guard

### Problem from Bella Land

```
E2E runs → 401 Unauthorized
     ↓
30 min investigation
     ↓
Screenshot → page rendered correctly
     ↓
Manual Supabase check
     ↓
Discovery: anon SELECT missing on real_estate_projects
     ↓
Fix: GRANT SELECT
     ↓
E2E passes
```

**Cost:** ~30 minutes human investigation + E2E runtime  
**Root cause:** DB configuration gap, detectable before E2E

### Solution

Factory runs preflight checks **before E2E**:

```typescript
interface PreflightCheck {
  category: 'database' | 'environment' | 'configuration';
  name: string;
  check: () => Promise<PreflightResult>;
}

interface PreflightResult {
  passed: boolean;
  message: string;
  evidence?: string;
  suggestion?: string;
}
```

### Checks Implemented

**Database Checks:**
1. Connection available
2. Required tables exist
3. Required roles exist (`anon`, `authenticated`)
4. Table privileges correct for roles
5. RLS enabled on protected tables
6. Required RLS policies exist

**Environment Checks:**
1. Required env vars present (SUPABASE_URL, ANON_KEY, etc.)
2. Next.js build config valid
3. Required npm packages installed

**Configuration Checks:**
1. Product schema matches database schema
2. Required server actions registered
3. Route configuration valid

### Example Output

```text
🔍 FACTORY PREFLIGHT — Environment Validation

Database Checks:
  ✅ Connection established
  ✅ Required tables: real_estate_projects, real_estate_apartments
  ✅ RLS enabled on protected tables
  ❌ FAIL: Table privilege missing
     Table: real_estate_projects
     Role: anon
     Required: SELECT
     Current: (none)
     
     Suggestion: Run migration or execute:
     GRANT SELECT ON TABLE public.real_estate_projects TO anon;

Environment Checks:
  ✅ SUPABASE_URL present
  ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY present
  ✅ Next.js config valid

Configuration Checks:
  ✅ Product schema matches DB schema
  ✅ Server actions registered

PREFLIGHT RESULT: FAIL (1 blocker)
E2E execution: BLOCKED (fix environment first)
Time saved: ~30 min (vs debugging after E2E failure)
```

### Implementation Scope

**Phase 1 (This implementation):**
- Database privilege checks (direct evidence from Bella Land)
- Basic environment checks
- Integration with existing test infrastructure

**Phase 2 (After field validation):**
- RLS policy content validation
- Schema migration status checks
- More sophisticated config validation

### File Structure

```
src/__tests__/
  factory-preflight-guard.test.ts         # Unit tests for preflight
  factory-preflight-integration.test.ts   # Integration with E2E suite

src/factory/
  preflight/
    PreflightGuard.ts                     # Main orchestrator
    checks/
      DatabaseChecks.ts                   # DB privilege, RLS, tables
      EnvironmentChecks.ts                # Env vars, config files
      ConfigurationChecks.ts              # Schema, routes, actions
    types.ts                              # Shared types
    index.ts                              # Public API
```

### Integration Point

```typescript
// In E2E test setup (before suite runs)
import { runPreflight } from '@/factory/preflight';

beforeAll(async () => {
  const preflightResult = await runPreflight({
    product: 'bella-land',
    checks: ['database', 'environment', 'configuration']
  });
  
  if (!preflightResult.passed) {
    console.error('PREFLIGHT FAILED:', preflightResult.summary);
    throw new Error('Environment not ready for E2E');
  }
});
```

---

## F-G3: Evidence Integrity Guard

### Problem from Bella Land

TypeScript gate **TIMEOUT** was initially considered:
- "All gates pass" (incorrect)
- "TypeScript deferred" (incorrect)
- "TypeScript pass with warnings" (incorrect)

**Correct status:** `TIMEOUT / NOT VERIFIED`

**Principle violated:** "No Claim Without Evidence"

### Solution

Factory enforces evidence integrity at closure:

```typescript
interface GateResult {
  gate: string;
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'SKIPPED' | 'NOT_RUN';
  evidence: Evidence[];
  metadata?: Record<string, unknown>;
}

interface Evidence {
  type: 'test-result' | 'command-output' | 'file-artifact' | 'screenshot';
  data: unknown;
  timestamp: string;
}

interface EvidenceMatrix {
  gates: GateResult[];
  claims: Claim[];
  violations: IntegrityViolation[];
}

interface Claim {
  statement: string;
  supportingEvidence: string[];
  confidence: 'PROVEN' | 'PARTIAL' | 'UNVERIFIED';
}

interface IntegrityViolation {
  severity: 'BLOCKER' | 'WARNING';
  violation: string;
  gate: string;
  detail: string;
}
```

### Integrity Rules

**Rule 1: Status Precision**
```typescript
// FORBIDDEN substitutions
TIMEOUT      → PASS       ❌
TIMEOUT      → DEFERRED   ❌
SKIPPED      → PASS       ❌
NOT_RUN      → VERIFIED   ❌
PARTIAL      → COMPLETE   ❌
PASS_WARNING → PASS       ❌

// ALLOWED (with evidence)
PASS         → PASS       ✅ (with test results)
FAIL         → FAIL       ✅ (with error evidence)
TIMEOUT      → TIMEOUT    ✅ (preserved as-is)
```

**Rule 2: Claim-Evidence Binding**
```typescript
// Every claim must have supporting evidence
Claim: "17/17 E2E tests pass"
Evidence: 
  - test-result: playwright report (17 passed)
  - file-artifact: test-results/
  - timestamp: 2026-09-06T10:30:00Z

// Unverified claims are BLOCKED
Claim: "TypeScript verified"
Evidence: (none - timeout)
Status: UNVERIFIED ⚠️
```

**Rule 3: Status Aggregation**
```typescript
// Product status = function of gate statuses
// Must not hide negative evidence

Gates: 5 PASS, 1 TIMEOUT
Product Status: "Partially Verified" (NOT "Verified")

Gates: 6 PASS, 0 TIMEOUT, 0 FAIL
Product Status: "Fully Verified" ✅
```

### Example Output

```text
🔍 FACTORY EVIDENCE INTEGRITY CHECK

Gate Results:
  ✅ Browser E2E: PASS (17/17 tests)
  ✅ Product Tests: PASS (23/23 tests)
  ✅ Architecture Guard: PASS
  ✅ Production Build: SUCCESS
  ✅ Tenant Isolation: VERIFIED
  ⚠️ TypeScript: TIMEOUT (NOT VERIFIED)

Evidence Matrix:
  Browser E2E:
    - test-result: 17 passed (playwright-report.json)
    - timestamp: 2026-09-06T10:25:33Z
    
  TypeScript:
    - command-output: timeout after 180s
    - status: NOT VERIFIED
    - timestamp: 2026-09-06T10:28:15Z

Claims Analysis:
  ✅ "Browser E2E fully verified" — PROVEN
     Evidence: 17/17 test results + screenshots
     
  ❌ "All gates verified" — REJECTED
     Violation: TypeScript gate NOT VERIFIED (timeout)
     Correct claim: "Browser E2E verified, TypeScript pending"
     
  ✅ "Product ready for deployment consideration" — PARTIAL
     Evidence: Functional tests pass, type safety unverified

Integrity Violations:
  ⚠️ WARNING: Gate status incomplete
     Gate: TypeScript
     Status: TIMEOUT
     Violation: Cannot claim "verified" without evidence
     Recommendation: Investigate timeout, re-run, or document as known gap

EVIDENCE INTEGRITY: ENFORCED ✅
Final Status: Partially Verified (5/6 gates with evidence)
```

### Implementation Scope

**Phase 1 (This implementation):**
- Status precision enforcement
- Claim-evidence binding validation
- Evidence matrix generation
- Integration with Factory closure workflow

**Phase 2 (After field validation):**
- Confidence scoring for claims
- Evidence quality metrics
- Automated evidence collection suggestions

### File Structure

```
src/__tests__/
  factory-evidence-guard.test.ts          # Unit tests
  factory-evidence-integration.test.ts    # Integration tests

src/factory/
  evidence/
    EvidenceGuard.ts                      # Main orchestrator
    validators/
      StatusValidator.ts                  # Status precision rules
      ClaimValidator.ts                   # Claim-evidence binding
      AggregationValidator.ts             # Status aggregation
    EvidenceMatrix.ts                     # Evidence collection
    types.ts                              # Shared types
    index.ts                              # Public API
```

### Integration Point

```typescript
// In Factory closure workflow
import { validateEvidence } from '@/factory/evidence';

async function closeProduct(productId: string, gateResults: GateResult[]) {
  const evidenceCheck = await validateEvidence({
    product: productId,
    gates: gateResults,
    claims: extractClaims(gateResults)
  });
  
  if (evidenceCheck.violations.some(v => v.severity === 'BLOCKER')) {
    throw new Error('Evidence integrity violated - cannot close');
  }
  
  return {
    status: evidenceCheck.aggregatedStatus,
    matrix: evidenceCheck.matrix,
    warnings: evidenceCheck.violations.filter(v => v.severity === 'WARNING')
  };
}
```

---

## Implementation Timeline

### Step 1: F-G1 Implementation (Current)
- [ ] Create type definitions
- [ ] Implement DatabaseChecks
- [ ] Implement EnvironmentChecks
- [ ] Implement ConfigurationChecks
- [ ] Write unit tests (target: 100% coverage for checks)
- [ ] Write integration tests
- [ ] Integrate with E2E suite setup

### Step 2: F-G3 Implementation
- [ ] Create type definitions
- [ ] Implement StatusValidator
- [ ] Implement ClaimValidator
- [ ] Implement AggregationValidator
- [ ] Implement EvidenceMatrix generator
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Integrate with Factory closure

### Step 3: Field Validation
- [ ] Run on next real Product construction
- [ ] Measure: time saved, issues caught, false claims prevented
- [ ] Collect evidence for effectiveness
- [ ] Document findings
- [ ] Iterate based on real usage

### Step 4: Documentation & Closure
- [ ] Update Factory documentation
- [ ] Create runbook for preflight failures
- [ ] Document evidence integrity requirements
- [ ] Capture ROI evidence
- [ ] Update AGENTS.md with new Factory capabilities

---

## Success Metrics (Measured on Next Product)

**F-G1 Effectiveness:**
- Environment issues caught: X (target: >0)
- Time saved per issue: X min (hypothesis: ~30 min)
- False positives: X (target: <10%)

**F-G3 Effectiveness:**
- Status violations prevented: X
- False claims blocked: X
- Evidence gaps identified: X
- Gate closure accuracy: 100% (all claims backed by evidence)

**Overall Factory Impact:**
- Total time saved: X min
- Human investigation reduced: X%
- Confidence in Factory results: subjective assessment

---

## Principle Validation

This implementation validates:

> **Evidence First → Rule Second → Automation Third**

- ✅ Evidence: Bella Land provided direct evidence for F-G1 and F-G3
- ✅ Rules: Captured in this implementation plan
- ✅ Automation: Now implementing based on proven patterns

**NOT:**
- ❌ Build all guards immediately
- ❌ Implement unproven patterns (F-G2, F-G4 deferred)
- ❌ Add ceremony without measured value

---

## Next Actions

1. **Implement F-G1** — Start with DatabaseChecks (highest evidence)
2. **Test F-G1** — Unit + integration tests
3. **Implement F-G3** — Evidence integrity enforcement
4. **Test F-G3** — Unit + integration tests
5. **Field validate** — Run on next Product construction
6. **Measure ROI** — Collect actual time savings and effectiveness data

**Status:** Ready to begin F-G1 implementation ✅

