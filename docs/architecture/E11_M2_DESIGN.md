# E11 M2 Design - Research Engine

**Date:** 2026-09-04  
**Status:** DESIGN  
**Prerequisite:** M1 VERIFIED WITH DOCUMENTED SCOPE ✅

---

## M2 Purpose

Implement AI research capability that:
1. Takes industry intent as input
2. Conducts research (web, documents, existing Bella)
3. Collects and synthesizes evidence
4. Generates inferences with provenance
5. Produces `PROPOSED` Business Truths
6. Feeds proposals through M1 governance boundary

**Critical:** M2 outputs remain `PROPOSED`. M2 cannot self-authorize.

---

## M2 Architecture

### Flow

```text
Industry Intent (e.g., "F&B Restaurant Operations")
          ↓
   Research Orchestrator
          ↓
    ┌────┴────┐
    ↓         ↓
Evidence    Bella
Sources     Inspection
    ↓         ↓
    └────┬────┘
         ↓
  Evidence Synthesis
         ↓
    Inference Engine
         ↓
  PROPOSED Business Truth
  (with provenance, confidence, alternatives)
         ↓
   M1 Business Truth Gate
   ├── BLOCK → Research failed
   └── PASS → Authorization Policy
```

### Components

#### 1. Research Orchestrator
Location: `src/platform/business-truth/research/orchestrator.ts`

Responsibilities:
- Receives industry intent
- Plans research strategy
- Coordinates evidence collection
- Manages research state

#### 2. Evidence Collectors
Location: `src/platform/business-truth/research/collectors/`

Types:
- `web-collector.ts` - Web research (existing web search tools)
- `bella-collector.ts` - Bella kernel/pattern inspection
- `document-collector.ts` - Document analysis (if needed)

Each collector returns `Evidence` (defined in M1 types).

#### 3. Evidence Synthesizer
Location: `src/platform/business-truth/research/synthesizer.ts`

Responsibilities:
- Aggregates evidence from multiple collectors
- Identifies patterns and commonalities
- Detects conflicts between sources
- Identifies alternatives
- Calculates confidence scores

#### 4. Inference Engine
Location: `src/platform/business-truth/research/inference-engine.ts`

Responsibilities:
- Generates inferences from synthesized evidence
- Creates Business Truth proposals
- Sets `epistemicStatus = 'INFERENCE'`
- Sets `status = 'PROPOSED'`
- Sets `authority.source = 'AI'`, `authority.type = 'PROPOSED'`
- Preserves full provenance

#### 5. Research Result
Location: `src/platform/business-truth/research/types.ts`

```typescript
export interface ResearchResult {
  truths: BusinessTruth[];  // All PROPOSED
  evidence: Evidence[];
  conflicts: Conflict[];
  alternatives: Alternative[];
  confidenceSummary: {
    avgScore: number;
    lowConfidenceCount: number;
    assumptionsCount: number;
  };
  researchMetadata: {
    industryIntent: string;
    startedAt: Date;
    completedAt: Date;
    sourcesConsulted: number;
  };
}
```

---

## M2 Constraints (Hard Boundaries)

### 1. M2 Cannot Self-Authorize

```typescript
// FORBIDDEN
truth.authority.approvedBy = 'AI';
truth.status = 'APPROVED';

// REQUIRED
truth.authority.source = 'AI';
truth.authority.type = 'PROPOSED';
truth.status = 'PROPOSED';
```

### 2. M2 Must Use M1 Gate

```typescript
// Research produces truths
const researchResult = await researchEngine.research(industryIntent);

// Feed through M1
const btd: BusinessTruthDocument = {
  metadata: { ... },
  truths: researchResult.truths
};

const gateResult = businessTruthGate.validate(btd);
if (!gateResult.validated) {
  // Research failed to produce valid truths
  throw new ResearchValidationError(gateResult.violations);
}
```

### 3. M2 Cannot Weaken M1

M2 is **consumer** of M1, not **modifier**.

If M2 output is rejected by M1:
- ✅ Improve M2 evidence collection
- ✅ Improve M2 synthesis quality
- ❌ Weaken M1 validators
- ❌ Bypass M1 gate

### 4. M2 Remains Industry-Agnostic

No F&B-specific logic.
No Healthcare-specific logic.
Intent-driven, pattern-based research.

---

## M2 Implementation Phases

### Phase 1: Evidence Collection (M2.1)
- Implement Evidence Collectors (web, Bella)
- Return structured Evidence objects
- Tests: Evidence structure correctness

### Phase 2: Evidence Synthesis (M2.2)
- Aggregate evidence
- Detect conflicts/alternatives
- Calculate confidence
- Tests: Synthesis produces conflicts/alternatives when expected

### Phase 3: Inference Engine (M2.3)
- Generate Business Truth proposals from evidence
- Set correct epistemic status (INFERENCE)
- Set correct authority (AI/PROPOSED)
- Preserve provenance
- Tests: Proposals have correct structure

### Phase 4: M1 Integration (M2.4)
- Feed proposals through M1 gate
- Handle gate rejections
- Tests: Valid proposals pass, invalid blocked

### Phase 5: End-to-End (M2.5)
- Full research flow
- Industry intent → proposals
- Tests: Complete research cycle

---

## M2 Definition of Done

### Executable Tests Must Prove:

1. **Evidence Preserved**
   ```typescript
   const result = await research(intent);
   expect(result.truths[0].provenance.sources.length).toBeGreaterThan(0);
   ```

2. **Inference Distinguishable from Observation**
   ```typescript
   expect(result.truths[0].epistemicStatus).toBe('INFERENCE');
   expect(result.truths[0].authority.source).toBe('AI');
   ```

3. **Provenance Retained**
   ```typescript
   expect(result.truths[0].provenance.reasoning).toBeDefined();
   expect(result.truths[0].provenance.sources).toBeDefined();
   ```

4. **Conflicting Evidence Surfaced**
   ```typescript
   // When sources conflict
   expect(result.truths[0].provenance.conflicts.length).toBeGreaterThan(0);
   ```

5. **Alternatives Retained**
   ```typescript
   // When multiple valid approaches
   expect(result.truths[0].provenance.alternatives.length).toBeGreaterThan(0);
   ```

6. **Proposals Cannot Self-Authorize**
   ```typescript
   expect(result.truths[0].status).toBe('PROPOSED');
   expect(result.truths[0].authority.type).toBe('PROPOSED');
   expect(result.truths[0].authority.approvedBy).toBeNull();
   ```

7. **Malformed Proposals Rejected by M1**
   ```typescript
   // Missing provenance
   const malformed = createProposalWithoutProvenance();
   const gateResult = gate.validate(createBTD([malformed]));
   expect(gateResult.validated).toBe(false);
   ```

8. **Valid Proposals Can Proceed**
   ```typescript
   const valid = await research("Test Industry");
   const btd = createBTD(valid.truths);
   const gateResult = gate.validate(btd);
   expect(gateResult.validated).toBe(true);
   expect(gateResult.authorizationStatus).toBe('REQUIRES_HUMAN');
   ```

---

## M2 NOT Scope

### NOT Implementing:
- ❌ Self-Critique (M4 milestone)
- ❌ E10 Factory integration (M6 milestone)
- ❌ F&B B1 execution (blocked until E11 MVP)
- ❌ Automatic canonicalization
- ❌ Industry-specific research logic
- ❌ Authorization decision (M1 responsibility)

---

## M2 Success Criteria

```text
✅ Research Engine generates PROPOSED Business Truths
✅ Truths include evidence provenance
✅ Conflicts and alternatives preserved
✅ Proposals remain PROPOSED (no self-authorization)
✅ M1 gate accepts valid proposals
✅ M1 gate rejects malformed proposals
✅ All M2 tests PASS
✅ Gate B, Regression, Arch Guard PASS
✅ No M1 modifications
```

**Outcome:** M2 + M1 form two connected layers:
- M2 = Intelligence generation
- M1 = Governance enforcement

---

## M2 Test Strategy

### Research Cycle Tests (5)
1. Valid industry intent → proposals generated
2. Evidence collected from multiple sources
3. Synthesis produces confidence scores
4. Inference creates proposals with provenance
5. Complete cycle produces valid BusinessTruthDocument

### M1 Integration Tests (4)
1. Valid proposals pass M1 gate
2. Proposals without provenance blocked
3. Proposals without reasoning blocked
4. Proposals with conflicts require resolution

### Negative Tests (3)
1. M2 cannot set status=CANONICAL
2. M2 cannot set approvedBy=AI for CANONICAL
3. M2 cannot bypass M1 gate

**Total M2 Tests:** ~12-15

---

## M2 File Structure

```
src/platform/business-truth/research/
├── types.ts                  (ResearchResult, ResearchIntent)
├── orchestrator.ts           (Main research coordinator)
├── collectors/
│   ├── web-collector.ts      (Web research)
│   ├── bella-collector.ts    (Bella inspection)
│   └── index.ts
├── synthesizer.ts            (Evidence synthesis)
├── inference-engine.ts       (Generate proposals)
└── __tests__/
    ├── research-cycle.test.ts
    ├── m1-integration.test.ts
    └── negative.test.ts
```

---

## M2 Risks & Mitigations

### Risk 1: M2 Produces Low-Quality Truths
**Mitigation:** M1 gate will block. Iterate on M2 evidence quality.

### Risk 2: Web Research Noise
**Mitigation:** Evidence strength classification, confidence scoring.

### Risk 3: M2 Bypasses M1
**Mitigation:** Architectural tests prove M2 uses M1 gate.

### Risk 4: M2 Self-Authorizes
**Mitigation:** Explicit tests prove proposals remain PROPOSED.

---

## M2 Timeline Estimate

- M2.1 Evidence Collection: ~1-2 hours
- M2.2 Synthesis: ~1 hour
- M2.3 Inference Engine: ~1-2 hours
- M2.4 M1 Integration: ~30 min
- M2.5 Tests: ~1-2 hours
- **Total:** ~5-8 hours autonomous implementation

---

## M2 Approval Gate

**Before proceeding to M2 implementation:**
- ✅ M1 VERIFIED WITH DOCUMENTED SCOPE
- ✅ M2 design reviewed
- ✅ M2 boundaries understood (cannot self-authorize, must use M1)
- ✅ M2 success criteria clear

**User Decision Required:**
- A) Proceed M2 autonomous (agent implements M2.1-M2.5)
- B) Implement M2 incrementally (pause after each phase)
- C) Defer M2 (close E11 session)

---

**Status:** AWAITING USER DECISION  
**Recommendation:** Proceed M2 autonomous (Option A)
