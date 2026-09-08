# E11 M4 Design - End-to-End Intelligence Pipeline

**Date:** 2026-09-04  
**Status:** DESIGN APPROVED  
**Scope:** M4 - Governed Intelligence Lifecycle Orchestration

---

## Architectural Inspection Results

### Existing Components (M1-M3)

**M2 Research Orchestrator:**
```typescript
ResearchOrchestrator
  ├─ collect evidence (Bella + Web)
  ├─ synthesize evidence
  ├─ infer Business Truths
  └─ validate structure (M2 phase validation)
     → Output: PROPOSED truths
```

**M3 Critique Orchestrator:**
```typescript
CritiqueOrchestrator
  ├─ accept PROPOSED truths
  ├─ run critique engine (9 tests)
  └─ produce CRITIQUED truths
     → Output: CRITIQUED truths (cannot authorize)
```

**M1 Gate + Authorization:**
```typescript
BusinessTruthGate
  ├─ validate 7 invariants
  └─ determine authorization status
     → Output: GateResult with authorizationStatus

AuthorizationBoundary
  ├─ check gate result
  ├─ apply policy (AUTO_APPROVED / REQUIRES_HUMAN / BLOCKED)
  └─ produce authorization decision
     → Output: AuthorizationDecision with authority
```

---

## M4 Design Decision: Minimal Orchestration

### Key Insight from Inspection

**Existing machinery is SUFFICIENT:**
- M2 orchestrates Research → PROPOSED
- M3 orchestrates PROPOSED → CRITIQUED
- M1 has Gate + Authorization ready

**M4 should NOT:**
- Duplicate lifecycle management
- Replace M2/M3 orchestrators
- Create parallel governance
- Rewrite authorization

**M4 SHOULD:**
- Connect M2 → M3 → M1 with governed transitions
- Enforce: No shortcuts (PROPOSED → CANONICAL blocked)
- Provide: End-to-end traceability
- Prove: Authorization uses actual M1 machinery

---

## M4 Architecture

### Intelligence Pipeline Orchestrator

```typescript
IntelligencePipelineOrchestrator
  │
  ├─ execute research (M2)
  │    ↓
  │  PROPOSED truths
  │
  ├─ execute critique (M3)
  │    ↓
  │  CRITIQUED truths
  │
  ├─ execute authorization (M1)
  │    ├─ validate through gate
  │    ├─ apply authorization policy
  │    └─ produce decision
  │         ↓
  │  AUTHORIZED truths (if approved)
  │
  └─ canonicalize (if authorized)
       ↓
     CANONICAL truths
```

### Critical Governance Enforcements

**1. No Shortcuts**
```typescript
// BLOCKED transitions:
PROPOSED → CANONICAL (without critique + authorization)
CRITIQUED → CANONICAL (without authorization)
HIGH_CONFIDENCE → CANONICAL (without authorization)
CRITIQUE_PASS → CANONICAL (without authorization)
```

**2. Authorization Uses M1 Machinery**
```typescript
// Must use:
BusinessTruthGate.validate()  // NOT fake gate
AuthorizationBoundary.authorize()  // NOT fixture approvedBy

// Must NOT:
truth.authority = { approvedBy: 'AI' }  // Bypass
truth.status = 'CANONICAL'  // Direct set
```

**3. Failure Propagation**
```typescript
// Any failure stops pipeline:
if (researchFails) throw PipelineError('RESEARCH_FAILED')
if (critiqueFails) throw PipelineError('CRITIQUE_FAILED')
if (!authorized) throw PipelineError('AUTHORIZATION_DENIED')

// No silent fallback
// No silent downgrade
// No implicit approval
```

---

## M4 Test Strategy

### Test Class A: Happy Path

```typescript
describe('Happy Path: Evidence → CANONICAL', () => {
  it('should traverse complete governed lifecycle', async () => {
    // Given: Research intent
    const intent = createIntent('TEST_INDUSTRY');
    
    // When: Execute pipeline
    const result = await pipeline.execute(intent);
    
    // Then: Complete lifecycle
    expect(result.truths[0].status).toBe('CANONICAL');
    expect(result.lifecycle).toContain('PROPOSED');
    expect(result.lifecycle).toContain('CRITIQUED');
    expect(result.lifecycle).toContain('AUTHORIZED');
    expect(result.truths[0].authority.approvedBy).toBeDefined();
    
    // And: Provenance preserved
    expect(result.truths[0].provenance.sources).toBeDefined();
  });
});
```

### Test Class B: Failure Propagation

```typescript
describe('Failure Propagation', () => {
  it('should stop on research failure', async () => {
    // Given: Invalid intent
    const intent = { industry: '' };
    
    // When: Execute pipeline
    // Then: Throws and stops
    await expect(pipeline.execute(intent))
      .rejects.toThrow('RESEARCH_FAILED');
  });
  
  it('should stop on critique block', async () => {
    // Given: Proposal with no evidence
    const intent = createIntent('NO_EVIDENCE');
    
    // When: Execute
    // Then: Critique blocks, pipeline stops
    await expect(pipeline.execute(intent))
      .rejects.toThrow('CRITIQUE_BLOCKED');
  });
  
  it('should stop on authorization denial', async () => {
    // Given: Proposal requiring human approval
    const intent = createIntent('REQUIRES_HUMAN');
    
    // When: Execute without human approval
    // Then: Authorization denies, pipeline stops
    await expect(pipeline.execute(intent))
      .rejects.toThrow('AUTHORIZATION_DENIED');
  });
});
```

### Test Class C: Governance Attacks

```typescript
describe('Governance Attacks', () => {
  it('should block PROPOSED with fake approval', async () => {
    // Given: Proposal with fake approvedBy
    const fakeProposal = createTruth({
      status: 'PROPOSED',
      authority: { approvedBy: 'AI', type: 'APPROVED' }
    });
    
    // When: Try to bypass
    // Then: Blocked
    await expect(pipeline.bypassToCanonical(fakeProposal))
      .rejects.toThrow('GOVERNANCE_VIOLATION');
  });
  
  it('should block CRITIQUED with high confidence bypass', async () => {
    // Given: CRITIQUED with 0.99 confidence
    const critiqued = createTruth({
      status: 'CRITIQUED',
      confidence: { score: 0.99 }
    });
    
    // When: Try confidence bypass
    // Then: Blocked
    await expect(pipeline.autoApproveByConfidence(critiqued))
      .rejects.toThrow('CONFIDENCE_NOT_AUTHORITY');
  });
  
  it('should block AI identity as approvedBy', async () => {
    // Given: Proposal
    const proposal = createTruth({ status: 'PROPOSED' });
    
    // When: Try AI self-approval
    // Then: Blocked
    await expect(pipeline.selfApprove(proposal, 'AI'))
      .rejects.toThrow('AI_CANNOT_SELF_APPROVE');
  });
  
  it('should block forged CANONICAL', async () => {
    // Given: Truth with status set to CANONICAL
    const forged = createTruth({ status: 'CANONICAL' });
    
    // When: Validate
    // Then: Rejected (missing proper lifecycle)
    const valid = pipeline.validateCanonical(forged);
    expect(valid).toBe(false);
  });
});
```

---

## M4 Acceptance Criteria

### 1. Architecture

- ✅ Reuses M2 research orchestrator
- ✅ Reuses M3 critique orchestrator
- ✅ Reuses M1 gate + authorization
- ✅ No duplicate lifecycle management
- ✅ Minimal new code (orchestration only)

### 2. Governance

- ✅ No PROPOSED → CANONICAL shortcut
- ✅ No CRITIQUED → CANONICAL shortcut
- ✅ No confidence bypass
- ✅ No AI self-approval
- ✅ Authorization uses actual M1 machinery

### 3. Tests

**Happy Path:**
- ✅ Evidence → CANONICAL with complete provenance
- ✅ Lifecycle trace: PROPOSED → CRITIQUED → AUTHORIZED → CANONICAL

**Failure Propagation:**
- ✅ Research failure stops pipeline
- ✅ Critique block stops pipeline
- ✅ Authorization denial stops pipeline
- ✅ No silent fallback

**Governance Attacks:**
- ✅ Fake approval blocked
- ✅ Confidence bypass blocked
- ✅ AI self-approval blocked
- ✅ Forged CANONICAL rejected
- ✅ Missing provenance rejected

### 4. Regression

- ✅ M1 tests: 26/26 PASS
- ✅ M2 tests: 21/21 PASS
- ✅ M3 tests: 37/37 PASS
- ✅ Gate B: 44/44 PASS
- ✅ Regression Gate: ALLOW

### 5. Limitations

- ⚠️ Live web research still placeholder (M2 limitation preserved)
- ⚠️ E10 integration not yet tested (M5 scope)
- ⚠️ B1 empirical test not run (awaiting E11 MVP)

---

## Implementation Plan

### Phase 1: Create Pipeline Orchestrator (Core)
- Create `IntelligencePipelineOrchestrator`
- Connect M2 → M3 → M1
- Enforce lifecycle transitions
- Add traceability

### Phase 2: Happy Path Tests
- Evidence → CANONICAL flow
- Provenance preservation
- Lifecycle trace verification

### Phase 3: Failure Propagation Tests
- Research failure
- Critique block
- Authorization denial

### Phase 4: Governance Attack Tests
- Fake approval
- Confidence bypass
- AI self-approval
- Forged CANONICAL
- Missing provenance

### Phase 5: Regression + Gates
- Run M1/M2/M3 tests
- Run Gate B
- Run Regression Gate
- Report Architecture Guard truthfully

---

## Success Metrics

**M4 is VERIFIED when:**

1. Executable tests prove complete governed lifecycle
2. Authorization uses actual M1 machinery (not fixture)
3. All governance attacks are blocked
4. Failures propagate correctly (no silent fallback)
5. M1/M2/M3 regression: PASS
6. Gate B: PASS
7. Regression Gate: ALLOW

**M4 is NOT VERIFIED if:**

- Authorization bypassed (even in tests)
- Shortcuts allowed (PROPOSED → CANONICAL)
- AI can self-approve
- Failures silently handled
- Regressions introduced

---

## Design Decision: Why Minimal Orchestration?

### Option A: Rewrite Everything (REJECTED)
- Replace M2/M3 orchestrators
- Create new lifecycle management
- Risk: Breaks existing tests
- Risk: Duplicates governance

### Option B: Minimal Orchestration (CHOSEN)
- Reuse M2 research orchestrator
- Reuse M3 critique orchestrator
- Reuse M1 gate + authorization
- Add only: Pipeline coordination
- Benefit: Preserves existing tests
- Benefit: No duplicate governance
- Benefit: Proves architecture composability

### Rationale

**Human defines invariants. Factory chooses implementation.**

Existing M1/M2/M3 already provide:
- Research machinery
- Critique machinery
- Authorization machinery

M4 should prove these compose into governed pipeline, NOT replace them.

---

**Design Status:** APPROVED  
**Next:** Implementation  
**Token Budget:** 95K remaining (47% available)
