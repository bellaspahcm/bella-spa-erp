# E11 — Business Truth Discovery & Validation

**Status:** 📋 REQUIREMENTS DEFINITION  
**Phase:** Pre-Implementation  
**Dependencies:** E9 (Scope Derivation), E9.1 (Evidence Collection), E10 (Factory Orchestration)  
**Last Updated:** 2026-09-04

---

## The Gap E11 Closes

**Current State (E7-E10):** Bella protects code from **technical canonical drift**.

```text
✅ Code ↔ Schema protection (strong)
✅ Code ↔ TypeScript contracts (Gate B)
✅ Code ↔ Canonical scope (E9)
✅ Code ↔ Architecture boundaries (Arch Guard)
✅ Code ↔ Regression (Governance)
```

**Missing Layer:** Bella does NOT yet protect code from **business logic drift**.

```text
⏳ Schema exists, but business rules wrong
⏳ Types correct, but process flow incorrect
⏳ Tests pass, but violates business logic
```

**Why Schema ≠ Business Truth:**

Schema says:
```sql
CREATE TABLE orders (id, customer_id, total, status);
CREATE TABLE inventory (id, product_id, quantity);
```

Schema does NOT say:
- When does inventory.quantity decrease?
- When does order.status transition?
- Must payment succeed before fulfillment?
- How are returns handled?

**These are Business Truth. Schema cannot encode them.**

**E11 closes this gap by:**
1. Researching industry → Business Truth
2. Validating truth with evidence + critique + provenance
3. Deriving canonical schema FROM validated Business Truth
4. Enabling Factory to build code that is **technically correct + businesswise correct**

---

## Vision

**E11 enables AI to autonomously transform Industry Intent into governed Business Truth.**

```text
Industry Intent
    ↓
Research (multi-source, multi-method)
    ↓
Evidence Synthesis
    ↓
Self-Critique (alternatives, conflicts, gaps)
    ↓
Business Truth Proposal
    ↓
Human Decision (ambiguity/conflict resolution only)
    ↓
Governed Business Truth
    ↓
[E10 Factory] → Industry OS
```

**E11 is NOT:**
- ❌ "AI research assistant" (just finds information)
- ❌ Industry taxonomy engine (hardcoded patterns)
- ❌ Prompt engineering ("how to research F&B")
- ❌ Part of E10 Factory (separate intelligence layer)

**E11 IS:**
- ✅ Intelligence layer ABOVE Factory
- ✅ Evidence → Inference → Critique → Truth pipeline
- ✅ Self-aware: knows when evidence is insufficient
- ✅ Domain-agnostic: works for any industry
- ✅ Provenance-first: every truth traceable to sources

---

## Core Invariants

### Invariant 1: No Direct Inference-to-Truth

```text
E11 MUST NEVER promote an AI-generated inference directly to Business Truth.

Every Business Truth candidate MUST have:
  - Evidence (sources + facts)
  - Reasoning (how inference was made)
  - Alternatives/Contradictions (what conflicts?)
  - Critique (self-examination)
  - Decision status (approved/deferred/conflict)
  - Provenance (full lineage)
```

**Violation examples:**
- ❌ "AI thinks inventory should decrease on order creation" → Business Truth
- ❌ "Common pattern found on 3 websites" → Business Truth
- ❌ "Similar to Healthcare Kernel pattern" → Business Truth

**Correct flow:**
- ✅ Evidence → Inference → Alternatives → Critique → Proposal → Decision → Truth

---

### Invariant 2: Insufficient Evidence is Valid Success

```text
INSUFFICIENT_EVIDENCE is a valid successful outcome.

E11 is NOT considered failed when it reports:
  - "Not enough evidence to form Business Truth"
  - "Conflicting evidence, requires human decision"
  - "Multiple valid models detected"
```

**Success measurement:**
- NOT: "Did E11 produce Business Truth?"
- BUT: "Did E11 correctly identify evidence sufficiency?"

**Example valid outcomes:**
- ✅ "F&B inventory: 3 models found, no consensus, requires business decision"
- ✅ "Reservation patterns: insufficient industry evidence, need domain expert"
- ✅ "Payment timing: conflicting evidence (A says X, B says Y), defer"

---

### Invariant 3: No Shortcuts in Pipeline

```text
FORBIDDEN SHORTCUTS:

Research → Business Truth          ❌
Evidence → Business Truth          ❌
Inference → Business Truth         ❌
Synthesis → Business Truth         ❌

REQUIRED PATH:

Evidence → Inference → Proposal → Critique → Decision → Truth ✅
```

**Every stage MUST have artifacts.**

If AI skips Critique or Decision, pipeline MUST reject the candidate.

---

### Invariant 4: Provenance is Mandatory

```text
Every Business Truth MUST answer:
  - What sources support this?
  - What reasoning led to this conclusion?
  - What alternatives were considered?
  - What conflicts were found?
  - What assumptions were made?
  - Who/what approved this?
  - When was this determined?
```

**If provenance is incomplete → NOT Business Truth.**

---

### Invariant 5: AI Self-Awareness

```text
E11 MUST demonstrate:
  - "I have sufficient evidence for X"
  - "I do NOT have sufficient evidence for Y"
  - "I found conflicting evidence for Z"
  - "I am making assumption A (flagged)"
```

**Failure mode:**
- AI proceeds confidently without acknowledging uncertainty
- AI treats assumptions as facts
- AI ignores contradictions

**Success mode:**
- AI explicitly flags uncertainty
- AI reports conflicting evidence
- AI defers when appropriate

---

## Objective

**E11 transforms Industry Intent into governed Business Truth that can be consumed by E10 Factory.**

**Input:** Industry Intent (e.g., "Create F&B OS")

**Output:** Business Truth Manifest
- Entities (Customer, Order, MenuItem, etc.)
- Processes (Order → Payment → Fulfillment)
- Rules (Inventory decreases when X happens)
- Invariants (Order total = sum of line items)
- Relationships (Order belongs to Customer)
- Confidence (per truth candidate)
- Provenance (sources + reasoning)
- Unresolved ambiguities (require human decision)

**Success criteria:**
1. Business Truth has provenance
2. Alternatives were considered
3. Conflicts were identified
4. Insufficient evidence flagged
5. Human decisions minimized (only real ambiguity)
6. Downstream E10 can consume manifest without additional research

---

## Requirements

### R1. Business Truth Model

**Requirement:** E11 MUST define structured representation of Business Truth.

**Components:**

#### Business Truth Candidate

```typescript
{
  id: string
  category: 'ENTITY' | 'PROCESS' | 'RULE' | 'INVARIANT' | 'RELATIONSHIP'
  name: string
  description: string
  
  evidence: Evidence[]
  reasoning: Reasoning
  alternatives: Alternative[]
  critique: Critique
  
  confidence: number (0.0-1.0)
  status: 'PROPOSED' | 'APPROVED' | 'DEFERRED' | 'CONFLICT' | 'INSUFFICIENT'
  
  provenance: Provenance
  requiredDecision?: HumanDecision
  
  createdAt: timestamp
  approvedAt?: timestamp
  approvedBy?: 'AI' | 'HUMAN' | 'SYSTEM'
}
```

#### Category Definitions

**ENTITY:** Business objects (Customer, Order, Product, Payment)
- Must have: attributes, lifecycle, relationships
- Example: `Customer {id, name, email, status, createdAt}`

**PROCESS:** Workflows (OrderFulfillment, InventorySync, PaymentCapture)
- Must have: steps, transitions, triggers, outcomes
- Example: `Order → Payment → Kitchen → Delivery → Complete`

**RULE:** Business logic (pricing, validation, computation)
- Must have: condition, action, scope
- Example: `IF order.total > 1000 THEN apply discount`

**INVARIANT:** Constraints that must hold (correctness/compliance)
- Must have: constraint, enforcement point, violation consequence
- Example: `Order.total = SUM(OrderLine.subtotal) + taxes - discounts`

**RELATIONSHIP:** Connections between entities
- Must have: source, target, cardinality, cascade rules
- Example: `Order belongsTo Customer (many-to-one)`

---

### R2. Evidence & Provenance

**Requirement:** Every truth candidate MUST have traceable evidence.

**Evidence Structure:**

```typescript
{
  sourceId: string
  sourceType: 'WEB' | 'DOCUMENT' | 'API_DOCS' | 'REPOSITORY' | 'DATABASE' | 'EXPERT' | 'REGULATORY'
  sourceURL?: string
  sourceName: string
  
  excerpt: string  // actual text/data from source
  fact: string     // extracted fact
  relevance: string // why this matters
  
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'ASSUMPTION'
  timestamp: timestamp
  
  retrievalMethod: string // how was this obtained?
}
```

**Provenance Structure:**

```typescript
{
  sources: Evidence[]
  reasoning: {
    synthesis: string      // how evidence was combined
    inferences: string[]   // what was inferred
    assumptions: string[]  // what was assumed
  }
  alternatives: {
    model: string
    sources: Evidence[]
    tradeoffs: string
  }[]
  conflicts: {
    evidenceA: Evidence
    evidenceB: Evidence
    nature: string
  }[]
  
  critiqueFindings: Critique
  decisionRationale?: string
  
  lineage: {
    researched: timestamp
    synthesized: timestamp
    critiqued: timestamp
    decided: timestamp
  }
}
```

**Requirements:**
- ✅ Every truth candidate has ≥1 evidence
- ✅ Assumptions explicitly flagged
- ✅ Conflicts recorded (not hidden)
- ✅ Alternative models captured
- ✅ Reasoning traceable

---

### R3. Reasoning State & Status Lifecycle

**Requirement:** E11 MUST separate reasoning stages. NO mixing. Status transitions MUST be explicit and governed.

#### Reasoning States

```text
EVIDENCE
  ├─ Raw facts from sources
  └─ NO interpretation allowed

INFERENCE
  ├─ Derived conclusions from evidence
  └─ MUST reference evidence

PROPOSAL
  ├─ Business Truth candidate
  └─ MUST include alternatives + critique

CRITIQUED
  ├─ Proposal after self-examination
  └─ MUST have critique findings

APPROVED
  ├─ Met approval conditions
  └─ Ready for canonicalization

CANONICAL_BUSINESS_TRUTH
  ├─ Final governed truth
  └─ Consumable by E10 Factory

VERSIONED
  ├─ Timestamped canonical version
  └─ Immutable once E10 consumes

SUPERSEDED
  ├─ Replaced by newer version
  └─ Retained for provenance
```

#### Critical Invariant: AI Cannot Self-Canonicalize

```text
AI AUTHORITY:
  ✅ Create EVIDENCE (from sources)
  ✅ Generate INFERENCE (from evidence)
  ✅ Propose PROPOSAL (with alternatives)
  ✅ Perform CRITIQUE (self-examination)

AI CANNOT:
  ❌ Self-promote PROPOSAL → CANONICAL_BUSINESS_TRUTH
     (without meeting approval conditions)
  ❌ Skip critique
  ❌ Bypass Business Truth Gate
  ❌ Override human decisions
```

**This prevents hallucination-to-code pipeline.**

#### Status Transition Rules

**EVIDENCE → INFERENCE:**
- Condition: Evidence has strength ≥ WEAK
- Action: Apply reasoning
- Output: Inference with evidence references

**INFERENCE → PROPOSAL:**
- Condition: Inference complete
- Action: Form truth candidate with alternatives
- Output: Proposal (not yet truth)

**PROPOSAL → CRITIQUED:**
- Condition: Proposal formed
- Action: Mandatory self-critique (6 questions)
- Output: Critique findings + updated proposal

**CRITIQUED → APPROVED:**
- Condition: Approval criteria met
  - Confidence ≥ threshold
  - Contradictions resolved
  - Evidence sufficient
  - Impact assessed
- Action: Classification (auto-approve / defer / insufficient)
- Output: Approved candidate OR deferred decision

**APPROVED → CANONICAL_BUSINESS_TRUTH:**
- Condition: All approvals complete (AI + human if required)
- Action: Canonicalization
- Output: Canonical truth ready for E10

**CANONICAL_BUSINESS_TRUTH → VERSIONED:**
- Condition: E10 consumption begins
- Action: Lock version, assign timestamp
- Output: Immutable versioned truth

**VERSIONED → SUPERSEDED:**
- Condition: New research produces updated truth
- Action: Mark as superseded, retain for provenance
- Output: Historical version

#### Forbidden Transitions

```text
EVIDENCE → CANONICAL_BUSINESS_TRUTH     ❌ (skips inference + critique)
INFERENCE → CANONICAL_BUSINESS_TRUTH    ❌ (skips critique + approval)
PROPOSAL → CANONICAL_BUSINESS_TRUTH     ❌ (skips critique + approval)
CRITIQUED → CANONICAL_BUSINESS_TRUTH    ❌ (skips approval gate)
```

**Every shortcut is a violation.**

#### Required Artifacts

- ✅ Clear status field in every candidate
- ✅ Transition timestamps
- ✅ Transition reasons
- ✅ Audit trail (who/what changed status)
- ✅ Rollback capability (if critique fails)

---

### R4. Research Lifecycle

**Requirement:** E11 MUST follow structured research process.

**Phases:**

#### Phase 1: DISCOVER
- **Input:** Industry Intent
- **Action:** Identify research questions, potential sources
- **Output:** Research plan
- **Transition:** When sufficient sources identified

#### Phase 2: INVESTIGATE
- **Input:** Research plan
- **Action:** Gather evidence from sources (web, docs, repos, APIs)
- **Output:** Evidence collection
- **Transition:** When research questions answered OR insufficient evidence detected

#### Phase 3: SYNTHESIZE
- **Input:** Evidence collection
- **Action:** Combine evidence → inferences → truth candidates
- **Output:** Initial truth candidates
- **Transition:** When candidates formed

#### Phase 4: CHALLENGE
- **Input:** Truth candidates
- **Action:** Self-critique, find alternatives, detect conflicts
- **Output:** Critique findings + updated candidates
- **Transition:** When critique complete

#### Phase 5: PROPOSE
- **Input:** Critiqued candidates
- **Action:** Classify candidates by confidence + decision requirement
- **Output:** Proposals (auto-approve / defer / conflict)
- **Transition:** When all candidates classified

#### Phase 6: RESOLVE
- **Input:** Deferred/conflict candidates
- **Action:** Human decision OR additional research
- **Output:** Decisions
- **Transition:** When ambiguities resolved

#### Phase 7: CANONICALIZE
- **Input:** Approved candidates
- **Action:** Format as Business Truth Manifest
- **Output:** Manifest ready for E10 Factory
- **Transition:** Complete

**Lifecycle Rules:**
- Cannot skip phases
- Can return to earlier phase if new evidence found
- INSUFFICIENT_EVIDENCE can end at any phase (valid outcome)
- Each phase produces artifacts

---

### R5. Self-Critique Contract

**Requirement:** E11 MUST perform mandatory self-examination before proposing truth.

**Critique Questions (MUST answer ALL):**

#### Q1: Supporting Evidence
- What evidence supports this candidate?
- Is evidence STRONG, MODERATE, or WEAK?
- Are there ≥2 independent sources?

#### Q2: Contradictions
- Is there evidence AGAINST this candidate?
- Are there conflicting sources?
- How significant is the contradiction?

#### Q3: Assumptions
- What assumptions were made?
- Are assumptions explicitly flagged?
- What happens if assumptions are wrong?

#### Q4: Alternatives
- Are there other valid models?
- What are their tradeoffs?
- Why was this model chosen over alternatives?

#### Q5: Evidence Gaps
- What is NOT known?
- What evidence is missing?
- Can gaps be filled with additional research?

#### Q6: Impact if Wrong
- What downstream consequences if this is incorrect?
- Which E10 components would be affected?
- Is this a critical or non-critical truth?

**Critique Output:**

```typescript
{
  supportStrength: 'STRONG' | 'MODERATE' | 'WEAK'
  contradictions: {found: boolean, details?: string}
  assumptions: string[]
  alternatives: Alternative[]
  evidenceGaps: string[]
  impactIfWrong: 'CRITICAL' | 'MODERATE' | 'LOW'
  
  recommendation: 'APPROVE' | 'DEFER' | 'RESEARCH_MORE' | 'HUMAN_DECISION'
  reasoning: string
}
```

**Rules:**
- If supportStrength = WEAK → cannot auto-approve
- If contradictions.found = true → must defer or resolve
- If assumptions.length > 0 → must flag in provenance
- If impactIfWrong = CRITICAL → higher approval threshold
- If evidenceGaps significant → may need more research

**Critique MUST be adversarial:**
- AI critiques its own conclusions
- Actively looks for contradictions
- Does NOT rationalize away conflicts
- Flags uncertainty honestly

---

### R6. Confidence & Ambiguity

**Requirement:** E11 MUST quantify confidence and handle ambiguity explicitly.

#### Confidence Calculation

**Confidence is NOT authority. It is evidence quality metric.**

```typescript
confidence = f(
  evidenceStrength,      // STRONG=1.0, MODERATE=0.6, WEAK=0.3
  sourceCount,           // more independent sources → higher
  contradictionPresence, // contradictions → lower
  assumptionCount,       // more assumptions → lower
  alternativeCount       // many alternatives → lower (ambiguity)
)
```

**Thresholds:**

```text
confidence >= 0.8 + no contradictions + ≤1 assumption
  → AUTO_APPROVE (AI can approve)

0.5 <= confidence < 0.8 OR contradictions OR >1 assumptions
  → DEFER (requires human decision)

confidence < 0.5
  → INSUFFICIENT_EVIDENCE (do not proceed)
```

#### Ambiguity Detection

**Explicit conditions:**

**DEFER if:**
- Multiple valid models with similar evidence strength
- Business-critical decision without strong evidence
- Regulatory/compliance implications unclear
- Conflicting industry practices

**CONFLICT if:**
- Sources contradict each other (Source A says X, Source B says NOT X)
- Internal inconsistency detected
- Evidence supports incompatible models

**INSUFFICIENT_EVIDENCE if:**
- Research questions unanswered
- No credible sources found
- Evidence too weak for any conclusion
- Domain requires expert knowledge not available

**Human Decision Required:**
```typescript
{
  reason: 'AMBIGUITY' | 'CONFLICT' | 'CRITICAL_IMPACT' | 'COMPLIANCE'
  details: string
  options: Alternative[]
  recommendation?: string
  aiConfidence: number
}
```

**Rules:**
- Confidence is transparent (shown to human)
- Confidence does NOT mean "AI certainty" (means evidence quality)
- Low confidence does NOT block research (may proceed to gather more evidence)
- High confidence does NOT bypass critique (still must challenge)

---

### R7. Human Decision Boundary

**Requirement:** Clearly separate AI autonomy from human governance.

#### AI AUTONOMOUS (No human approval needed)

**Technical Decisions:**
- ✅ Framework choice (React, Vue, Angular)
- ✅ Database schema design
- ✅ API patterns
- ✅ Code architecture
- ✅ Testing strategy
- ✅ Naming conventions

**High-Evidence Business Patterns:**
- ✅ Common industry entity (Customer, Order, Product)
- ✅ Standard process (Login, Checkout, Search)
- ✅ Well-documented regulation (public compliance rules)
- ✅ Existing Bella Kernel pattern (reuse)

**Conditions:**
- confidence >= 0.8
- ≥2 strong independent sources
- No contradictions
- Impact if wrong: LOW or MODERATE

#### REQUIRES HUMAN APPROVAL

**Business Model Ambiguity:**
- ❌ Multiple valid workflows (no consensus)
- ❌ Industry-specific customization
- ❌ Revenue model choice
- ❌ Pricing strategy
- ❌ Business rule exceptions

**Conflicting Evidence:**
- ❌ Source A contradicts Source B
- ❌ Industry practice varies widely
- ❌ No clear best practice

**Low Confidence + Critical Impact:**
- ❌ confidence < 0.8 AND impactIfWrong = CRITICAL
- ❌ Compliance/regulatory uncertainty
- ❌ Data privacy implications
- ❌ Financial calculation rules

**Strategic Decisions:**
- ❌ Which industries to support
- ❌ Feature prioritization
- ❌ Market positioning
- ❌ Customer segmentation

**Approval Format:**
```typescript
{
  decisionId: string
  question: string
  context: string
  options: {
    label: string
    tradeoffs: string
    evidence: Evidence[]
  }[]
  aiRecommendation?: string
  urgency: 'BLOCKING' | 'NON_BLOCKING'
}
```

**Rules:**
- When in doubt → defer to human
- AI MUST NOT rationalize to avoid human decision
- "Low evidence + proceed anyway" is FORBIDDEN
- Human can override AI recommendation (always)

---

### R8. Acceptance & Measurement

**Requirement:** E11 success MUST be measurable.

#### Acceptance Criteria

**E11 is considered SUCCESSFUL if it demonstrates:**

1. **Evidence-First:**
   - Every truth candidate has evidence
   - Evidence has provenance
   - No unsupported inferences

2. **Critique Effectiveness:**
   - Alternatives identified
   - Contradictions detected
   - Assumptions flagged
   - Evidence gaps reported

3. **Self-Awareness:**
   - Correctly identifies insufficient evidence
   - Defers when appropriate
   - Does not proceed with low confidence + critical impact

4. **Provenance Completeness:**
   - Sources traceable
   - Reasoning transparent
   - Decisions justified

5. **Human Decision Minimization:**
   - Only real ambiguity/conflict escalated
   - Technical decisions autonomous
   - High-evidence patterns auto-approved

6. **Downstream Consumability:**
   - E10 Factory can consume manifest
   - No additional research needed
   - Truth candidates actionable

#### Measurement Metrics

**Research Coverage:**
```typescript
{
  researchQuestionsTotal: number
  researchQuestionsAnswered: number
  sourcesConsulted: number
  sourceTypesUsed: string[]
  evidenceCollected: number
}
```

**Critique Findings:**
```typescript
{
  candidatesProposed: number
  alternativesIdentified: number
  contradictionsFound: number
  assumptionsFlagged: number
  evidenceGapsReported: number
}
```

**Confidence Distribution:**
```typescript
{
  high: number        // confidence >= 0.8
  moderate: number    // 0.5 <= confidence < 0.8
  low: number         // confidence < 0.5
  avgConfidence: number
}
```

**Decision Outcomes:**
```typescript
{
  autoApproved: number
  deferredToHuman: number
  insufficientEvidence: number
  conflicts: number
  humanDecisionsRequired: number
}
```

**Downstream Correctness:**
```typescript
{
  e10BuildSuccess: boolean
  e10TestSuccess: boolean
  regressionIntroduced: boolean
  architectureViolations: number
}
```

#### Test Scenarios (Minimum Required)

**Test 1: High-Evidence Pattern**
- Input: "F&B Order entity"
- Expected: AUTO_APPROVE (common pattern, strong evidence)

**Test 2: Low-Evidence Pattern**
- Input: "F&B-specific workflow with no clear industry standard"
- Expected: INSUFFICIENT_EVIDENCE or DEFER

**Test 3: Conflicting Evidence**
- Input: "Inventory decrease timing" (multiple models exist)
- Expected: CONFLICT → DEFER with alternatives

**Test 4: Critical + Low Confidence**
- Input: "Payment processing rule" (low evidence, high impact)
- Expected: DEFER (cannot auto-approve critical with low confidence)

**Test 5: Self-Critique Detects Assumption**
- Input: Any candidate with hidden assumption
- Expected: Critique flags assumption, confidence reduced

**Test 6: Alternative Models**
- Input: Process with multiple valid implementations
- Expected: Critique identifies alternatives, presents options

**Test 7: Evidence Gap Detection**
- Input: Domain with insufficient public information
- Expected: Reports gaps, does NOT fabricate evidence

**Test 8: Provenance Traceability**
- Input: Any approved truth
- Expected: Can trace to sources, reasoning, critique, decision

#### Success Threshold

**E11 passes acceptance if:**
- All 8 test scenarios achieve expected outcomes
- No truth candidate approved without evidence
- No critique skipped
- No hidden assumptions
- No fabricated evidence
- Provenance complete for all approved truths
- Human decisions ≤ 30% of candidates (70% autonomous)
- Downstream E10 build succeeds

**E11 fails if:**
- Any inference-to-truth shortcut detected
- Critique ineffective (misses contradictions/alternatives)
- Low confidence + critical impact auto-approved
- Evidence fabricated or unsupported
- Provenance incomplete
- Human decisions > 50% (insufficient autonomy)

---

## Business Truth Gate (Pre-E10)

**Critical gate between E11 and E10 to prevent unvalidated truth from reaching Factory.**

### Gate Requirements

```text
E11 Output (Business Truth Manifest)
        ↓
   BUSINESS TRUTH GATE
        ├─ Provenance complete? ✓
        ├─ Evidence sufficient? ✓
        ├─ Contradictions resolved? ✓
        ├─ Alternatives recorded? ✓
        ├─ Critique completed? ✓
        ├─ Required human decisions done? ✓
        ├─ All candidates have canonical status? ✓
        └─ No PROPOSAL/INFERENCE in manifest? ✓
              │
              ▼ ALL PASS
         E10 Factory
              
              ▼ ANY FAIL
            STOP
        (Block E10 execution)
```

### Gate Checks

**1. Provenance Complete**
- Every truth candidate has ≥1 evidence source
- Reasoning documented
- Sources traceable

**2. Evidence Sufficient**
- No candidates with status = INSUFFICIENT_EVIDENCE
- Confidence meets minimum threshold
- Evidence strength documented

**3. Contradictions Resolved**
- No unresolved CONFLICT status
- Contradicting evidence explained
- Resolution decision recorded

**4. Alternatives Recorded**
- For multi-model cases, alternatives captured
- Tradeoffs documented
- Choice rationale provided

**5. Critique Completed**
- All 6 critique questions answered
- Critique findings recorded
- No skipped critique

**6. Required Human Decisions Done**
- All DEFER status resolved
- Human approvals recorded
- No blocking decisions pending

**7. Canonical Status Verified**
- All candidates have status = CANONICAL_BUSINESS_TRUTH
- No PROPOSAL or INFERENCE status in manifest
- Versioning applied

**8. No Unvalidated Content**
- Manifest contains only approved truth
- No "AI guesses" or assumptions without flags
- No evidence-free inferences

### Violation Consequences

**If gate FAILS:**
```text
BLOCK E10 execution
REPORT violations
REQUIRE E11 completion
DO NOT BUILD
```

**Gate does NOT:**
- ❌ Auto-fix violations (would hide problems)
- ❌ Downgrade unvalidated to "lower confidence" (still wrong)
- ❌ Proceed with warnings (prevents hallucination-to-code)

**Gate output:**
```typescript
{
  passed: boolean
  violations: {
    check: string
    candidateId: string
    reason: string
    severity: 'BLOCKING' | 'WARNING'
  }[]
  decision: 'ALLOW_E10' | 'BLOCK_E10'
}
```

### Purpose

**Business Truth Gate prevents:**
1. ❌ Hallucination-to-code pipeline
2. ❌ E10 consuming unvalidated proposals
3. ❌ "Build anyway" with weak evidence
4. ❌ Skipped critique reaching production
5. ❌ Unresolved conflicts becoming implementation

**This is the firewall between research and manufacturing.**

---

## Relationship to E10 Factory

**E11 and E10 are SEPARATE concerns.**

### Boundary

```text
E11: Industry Intent → Business Truth Manifest
        ↓
   BUSINESS TRUTH GATE (NEW)
        ↓
E10: Validated Manifest → Industry OS

E11 OUTPUT → GATE → E10 INPUT
```

### Interface Contract

**E11 produces:**
```typescript
{
  industry: string
  entities: Entity[]
  processes: Process[]
  rules: Rule[]
  invariants: Invariant[]
  relationships: Relationship[]
  
  provenance: {
    researched: timestamp
    sources: Evidence[]
    critiquedAt: timestamp
    approvedAt: timestamp
  }
  
  confidence: {
    overall: number
    perCategory: Record<string, number>
  }
  
  unresolvedAmbiguities: HumanDecision[]
  
  metadata: {
    researchDuration: number
    sourcesConsulted: number
    alternativesConsidered: number
    humanDecisions: number
  }
}
```

**E10 consumes:**
- Entities → Database schema
- Processes → API endpoints + logic
- Rules → Business logic implementation
- Invariants → Validation + constraints
- Relationships → Foreign keys + cascades

### E10 Does NOT Research

**E10 assumes Business Truth is correct.**

- E10 does NOT validate business rules
- E10 does NOT question entity definitions
- E10 does NOT research alternatives

**E10 validates TECHNICAL correctness:**
- TypeScript compiles
- Tests pass
- Architecture Guard passes
- Regression protection passes

**If Business Truth is wrong → E10 builds wrong software correctly.**

### E11 Does NOT Implement

**E11 produces Business Truth, NOT code.**

- E11 does NOT generate TypeScript
- E11 does NOT design database schemas
- E11 does NOT write tests

**E11 validates BUSINESS correctness:**
- Evidence supports truth
- Alternatives considered
- Conflicts resolved
- Assumptions flagged

**If E11 skips critique → E10 builds unvalidated truth.**

### Failure Modes

**E11 fails → E10 cannot start**
- Insufficient evidence → no manifest
- Unresolved conflicts → blocked
- Low confidence + critical → deferred

**E10 fails → E11 unaffected**
- Build error → E10 problem
- Test failure → E10 problem
- Architecture violation → E10 problem

**Both can fail independently.**

### Success Coupling

**E11 + E10 success = Industry OS with provenance**

```text
Industry Intent
    ↓
E11 Research → Business Truth (provenance ✅)
    ↓
E10 Factory → Industry OS (verified ✅)
    ↓
Industry OS (correct ✅ + traceable ✅)
```

**This is the complete AI Industry OS Manufacturing pipeline.**

---

## Example Scenario: F&B OS

### Input (Industry Intent)

```text
"Create F&B (Food & Beverage) Industry OS"
```

### E11 Process

#### Phase 1: DISCOVER

**Research questions:**
- What are core entities in F&B industry?
- What processes are common (ordering, inventory, payments)?
- What regulations apply?
- What are critical business rules?

**Potential sources:**
- F&B industry websites
- POS system documentation
- Restaurant management articles
- Existing Bella patterns (Spa, Healthcare)
- Regulatory databases

#### Phase 2: INVESTIGATE

**Evidence collected:**

**Entity: MenuItem**
- Source: 5 F&B websites, 2 POS docs
- Evidence: Menu items have name, price, category, availability
- Strength: STRONG

**Entity: Order**
- Source: 3 POS systems, industry standard
- Evidence: Orders track items, quantities, customer, status
- Strength: STRONG

**Process: Inventory Decrease**
- Source A: "Inventory decreases when order created" (2 sources)
- Source B: "Inventory decreases when kitchen confirms" (2 sources)
- Source C: "Inventory reconciled end-of-day" (1 source)
- Strength: CONFLICT

**Rule: Order Total Calculation**
- Source: Industry standard, existing Bella pattern
- Evidence: total = sum(lineItems) + tax - discounts
- Strength: STRONG

#### Phase 3: SYNTHESIZE

**Truth candidates:**

**Candidate 1: MenuItem entity**
- Category: ENTITY
- Evidence: 7 sources
- Confidence: 0.95
- Status: PROPOSED

**Candidate 2: Order entity**
- Category: ENTITY
- Evidence: 5 sources
- Confidence: 0.92
- Status: PROPOSED

**Candidate 3: Inventory Decrease Process**
- Category: PROCESS
- Evidence: 5 sources (conflicting)
- Confidence: 0.45
- Status: PROPOSED

**Candidate 4: Order Total Rule**
- Category: RULE
- Evidence: Industry standard + Bella pattern
- Confidence: 0.98
- Status: PROPOSED

#### Phase 4: CHALLENGE

**Critique: MenuItem**
- Supporting: 7 strong sources
- Contradictions: None
- Assumptions: None
- Alternatives: None significant
- Evidence gaps: None
- Impact if wrong: LOW
- Recommendation: APPROVE

**Critique: Order**
- Supporting: 5 strong sources
- Contradictions: None
- Assumptions: None
- Alternatives: Minor variations (delivery vs dine-in)
- Evidence gaps: None
- Impact if wrong: MODERATE
- Recommendation: APPROVE

**Critique: Inventory Decrease**
- Supporting: 5 sources (conflicting)
- Contradictions: YES (3 different models)
- Assumptions: None
- Alternatives: 3 models (order creation, kitchen confirm, reconcile)
- Evidence gaps: Business model not specified
- Impact if wrong: CRITICAL (inventory accuracy)
- Recommendation: DEFER (requires business decision)

**Critique: Order Total**
- Supporting: Industry standard + proven Bella pattern
- Contradictions: None
- Assumptions: Tax calculation handled elsewhere
- Alternatives: None
- Evidence gaps: None
- Impact if wrong: CRITICAL (financial correctness)
- Recommendation: APPROVE (high confidence + proven pattern)

#### Phase 5: PROPOSE

**Auto-approved:**
- MenuItem entity (confidence 0.95, no conflicts)
- Order entity (confidence 0.92, no conflicts)
- Order Total rule (confidence 0.98, proven pattern)

**Deferred:**
- Inventory Decrease process (conflict detected, critical impact)

**Human decision required:**
```text
Decision: Inventory Decrease Timing

Context:
F&B industry uses multiple inventory models.

Options:
A. Decrease on Order Creation
   - Tradeoffs: Simple, but may over-reserve
   - Evidence: 2 sources
   
B. Decrease on Kitchen Confirm
   - Tradeoffs: Accurate, but complex workflow
   - Evidence: 2 sources
   
C. Reconcile End-of-Day
   - Tradeoffs: Simple, but delayed accuracy
   - Evidence: 1 source

AI Recommendation: Option B (Kitchen Confirm)
Reasoning: Balances accuracy with workflow complexity

Urgency: BLOCKING (affects order processing design)
```

#### Phase 6: RESOLVE

**Human selects: Option B (Kitchen Confirm)**

**Rationale:** Accuracy more important than simplicity for this business.

#### Phase 7: CANONICALIZE

**Business Truth Manifest:**

```typescript
{
  industry: "F&B",
  entities: [
    {
      name: "MenuItem",
      confidence: 0.95,
      provenance: {sources: [...], critique: {...}},
      status: "APPROVED",
      approvedBy: "AI"
    },
    {
      name: "Order",
      confidence: 0.92,
      provenance: {sources: [...], critique: {...}},
      status: "APPROVED",
      approvedBy: "AI"
    }
  ],
  processes: [
    {
      name: "InventoryDecrease",
      trigger: "KitchenConfirm",
      confidence: 0.45,
      provenance: {
        sources: [...],
        alternatives: [optionA, optionB, optionC],
        critique: {...},
        decision: "Human selected Option B"
      },
      status: "APPROVED",
      approvedBy: "HUMAN"
    }
  ],
  rules: [
    {
      name: "OrderTotalCalculation",
      formula: "sum(lineItems) + tax - discounts",
      confidence: 0.98,
      provenance: {sources: [...], critique: {...}},
      status: "APPROVED",
      approvedBy: "AI"
    }
  ],
  metadata: {
    researchDuration: 180,  // seconds
    sourcesConsulted: 12,
    alternativesConsidered: 3,
    humanDecisions: 1
  }
}
```

### E10 Consumes Manifest

**E10 Factory receives manifest → builds F&B OS:**
- MenuItem entity → database table + API
- Order entity → database table + API
- InventoryDecrease process → business logic (trigger: kitchen confirm)
- OrderTotalCalculation rule → validation + computation

**E10 does NOT question:** "Should inventory decrease on kitchen confirm?"

**E11 already validated that decision with provenance.**

---

## Non-Goals

**E11 is NOT responsible for:**

### ❌ Technical Implementation

- Database schema design
- API endpoint design
- Frontend UI
- Framework selection
- Code architecture

**Reason:** These are E10 Factory concerns.

### ❌ Industry Taxonomy

- Pre-defined entity lists per industry
- Hardcoded process templates
- Industry-specific rule engines

**Reason:** E11 discovers patterns, does not embed them.

### ❌ Universal Industry Model

- One schema for all industries
- Cross-industry abstraction layer
- Industry ontology

**Reason:** Each industry has unique patterns. E11 researches each independently.

### ❌ AI Training

- Learning from past industries
- Improving research over time
- Building industry knowledge base

**Reason:** Out of scope for E11. Each research session is independent.

### ❌ Regulatory Compliance Engine

- Legal interpretation
- Compliance validation
- Regulatory updates

**Reason:** E11 gathers regulatory evidence, but does NOT interpret law. Human approval required for compliance.

### ❌ Business Strategy

- Market analysis
- Competitive positioning
- Feature prioritization
- ROI calculation

**Reason:** E11 researches industry patterns, NOT business strategy.

### ❌ Data Collection

- Web scraping infrastructure
- API integrations
- Database connectors

**Reason:** E11 uses available tools, does NOT build collection infrastructure.

---

## Open Questions

**Questions requiring research/experimentation:**

### Q0: Business Truth Semantic Primitives (PRIORITY)

**Question:** What semantic primitives must Business Truth contain so E10 can build without human reinterpretation?

**This is THE architecture research question E11 must answer first.**

**This is NOT:**
- ❌ "Should we use JSON or database?" (implementation detail)
- ❌ "What format should we pick?" (premature)
- ❌ "Let's design Entity + Rule + Process because we think that's enough" (assumption without evidence)

**This IS:**
- ✅ "What minimal semantic primitives are necessary and sufficient?"
- ✅ "What can represent F&B, Manufacturing, Healthcare equally?"
- ✅ "What can E10 consume deterministically?"

**Q0 Investigation must follow E11's own philosophy:**

```text
Research domain modeling standards
  ↓
Compare candidate models (DDD, BPMN, Ontology, UML, etc.)
  ↓
Identify common semantic primitives
  ↓
Challenge proposed model
  ↓
Find missing primitives
  ↓
Validate machine consumability
  ↓
Derive MINIMAL universal model
  ↓
PROPOSAL (not yet truth)
  ↓
Approval
```

**Acceptance Test (Q0 is CLOSED only when ALL met):**

1. ✅ **Universal Capability:** Can represent multiple business semantic types without industry hardcoding
2. ✅ **Provenance Traceability:** Every primitive traceable to evidence, reasoning, alternatives
3. ✅ **Status Distinction:** Can distinguish EVIDENCE / INFERENCE / PROPOSAL / CANONICAL_TRUTH
4. ✅ **Conflict Representation:** Can encode contradictions, alternatives, ambiguities
5. ✅ **Behavioral Semantics:** Can represent state, process, rule, invariant
6. ✅ **Governance:** Has versioning, supersession, approval, confidence
7. ✅ **Machine Consumability (CRITICAL):** E10 can parse and execute deterministically without human reinterpretation

**If #7 fails → Q0 not solved.**

**Hypothesis (NOT design, requires validation):**

```text
CANONICAL_BUSINESS_TRUTH
│
├── Domain Concepts (Entity, Relationship, Attribute)
├── Behavior (Business Rule, Invariant, Constraint)
├── Process (Trigger, Transition, Actor, Outcome)
├── Evidence (Source, Observation, Provenance)
├── Reasoning (Inference, Alternatives, Contradictions)
└── Governance (Confidence, Approval, Version, Supersession)
```

**Investigation Plan:**
1. Research domain modeling standards (DDD, BPMN, Ontology, UML, Archimate, Bella Kernels)
2. Identify common semantic primitives
3. Challenge proposed model with 3-domain test (F&B, Manufacturing, Healthcare)
4. Validate E10 consumability (can Factory parse and execute?)
5. Propose minimal contract (evidence-based)

**3-Domain Challenge Test:**

**Domain 1: F&B (Food & Beverage)**
- Order/Service, Inventory, Recipe, Reservation
- Service timing, Ingredient tracking

**Domain 2: Manufacturing**
- BOM (Bill of Materials), Production, Work Order, Material transformation
- Multi-level BOM, Production scheduling, Yield variance

**Domain 3: Healthcare**
- Patient, Encounter, Clinical workflow, Regulated actions
- Regulatory requirements, Clinical protocols, Audit trails

**Acceptance:** Model can represent ALL 3 domains WITHOUT adding industry-specific primitives.

**Failure:** If F&B needs `FoodMenuItem` primitive OR Manufacturing needs `BOMComponent` primitive → model NOT generic.

**Critical Principles:**
- ❌ **Confidence ≠ Truth Authority:** `confidence=0.97` does NOT automatically → `CANONICAL_BUSINESS_TRUTH`. Must still meet evidence + critique + approval conditions.
- ❌ **Many sources ≠ Truth:** High source count does NOT bypass governance.
- ✅ **Governance mandatory:** Even high-confidence proposals must satisfy all approval conditions.

**Status:** Q0 is architecture research, NOT implementation.

**This MUST be resolved before E11 Design begins.**

---

### Q1: Evidence Synthesis Algorithm

**Question:** How to combine evidence from multiple sources with different strengths?

**Options:**
- Weighted voting
- Consensus detection
- Source authority ranking
- Statistical confidence

**Research needed:** Test different algorithms on real industries.

---

### Q2: Critique Effectiveness Measurement

**Question:** How to measure if critique actually finds problems?

**Challenges:**
- Ground truth unavailable (no "correct" Business Truth)
- False negatives hard to detect (missed alternatives)
- Subjective quality assessment

**Research needed:** Design evaluation framework.

---

### Q3: Confidence Calculation

**Question:** What formula produces reliable confidence scores?

**Inputs:**
- Evidence strength
- Source count
- Contradiction presence
- Assumption count

**Research needed:** Calibrate thresholds with real scenarios.

---

### Q4: Human Decision Frequency

**Question:** What percentage of decisions should require human approval?

**Tradeoff:**
- Too high → not autonomous
- Too low → risky auto-approvals

**Research needed:** Establish acceptable range (target: <30%?).

---

### Q5: Provenance Granularity

**Question:** How detailed should provenance be?

**Options:**
- High: Every inference traceable to sentence-level excerpts
- Medium: Per-candidate source list + reasoning
- Low: Aggregate source count

**Research needed:** Balance completeness vs. overhead.

---

### Q6: Multi-Industry Reuse

**Question:** Should E11 reuse Business Truth across industries?

**Example:** "Customer" entity common in F&B, Retail, Healthcare.

**Options:**
- Yes: Build cross-industry kernel
- No: Research each industry independently

**Research needed:** Test both approaches.

---

### Q7: Research Tool Selection

**Question:** Which tools should E11 use for research?

**Available:**
- Web search
- Document fetch
- Repository analysis
- Database inspection
- API exploration

**Research needed:** Determine tool effectiveness per industry type.

---

### Q8: Failure Recovery

**Question:** What happens if research gets stuck?

**Scenarios:**
- No credible sources found
- All evidence weak
- Contradictions unresolvable

**Options:**
- Abort (report INSUFFICIENT_EVIDENCE)
- Expand research scope
- Lower confidence threshold

**Research needed:** Define fallback strategy.

---

## Implementation Guidance (Non-Prescriptive)

**These are suggestions, NOT requirements.**

E11 can be implemented in many ways. The only constraint: **satisfy the invariants and acceptance criteria**.

### Possible Approaches

**Approach 1: Pipeline Architecture**
- Separate tools for each phase (Discover, Investigate, Synthesize, etc.)
- Each phase produces artifacts
- Artifacts passed to next phase

**Approach 2: Agent-Based**
- Multiple agents (Researcher, Critic, Synthesizer)
- Agents collaborate via shared context
- Iterative refinement

**Approach 3: Workflow Engine**
- Structured workflow definition
- States + transitions
- Decision points

**Approach 4: Hybrid**
- Combine multiple approaches
- Use best tool for each phase

### Technology Considerations

**Research Tools:**
- `remote_web_search` for internet research
- `web_fetch` for documentation
- `read_file` / `grep_search` for repository analysis
- `execute_pwsh` for database inspection

**Storage:**
- JSON files for evidence + provenance
- TypeScript types for Business Truth model
- Markdown for human-readable reports

**Validation:**
- TypeScript for type safety
- Tests for critique effectiveness
- Metrics collection

---

## Success Vision

**When E11 succeeds, this becomes possible:**

```text
User: "Create F&B OS"

AI:
[Researches F&B industry]
[Gathers evidence]
[Synthesizes Business Truth]
[Self-critiques]
[Identifies 1 ambiguity requiring decision]

"I've researched the F&B industry.

Auto-approved (high evidence):
- MenuItem, Order, Customer entities
- Order → Payment → Fulfillment process
- Order total calculation rule

Requires your decision:
- Inventory decrease timing (3 models, all valid)

Once you decide, I can build the OS."

User: [Chooses Option B]

AI:
[Canonicalizes Business Truth]
[Invokes E10 Factory]
[Builds F&B OS]
[Verifies]

"F&B OS complete. 
Provenance available for all business rules.
0 architecture violations.
46 tests passing."
```

**This is AI Industry OS Manufacturing.**

---

## Next Steps

**E11 Requirements: ✅ COMPLETE**

**Before Design Phase:**

### Critical Question to Answer

> **"Business Truth is a governed artifact of what specific structure, such that E10 can consume it without human interpretation?"**

**This determines:**
- Canonical schema format
- Entity/Process/Rule representation
- Provenance encoding
- Status lifecycle encoding
- Versioning strategy
- E10 consumption contract
- Business Truth Gate implementation

**See:** Open Questions → Q0 (priority question)

**Design CANNOT proceed without answering Q0.**

---

### After Q0 Resolved:

1. **Design E11 machinery**
   - Choose implementation approach (pipeline/agent/workflow/hybrid)
   - Define tool usage (research, fetch, analyze)
   - Design artifact schema (answer Q0)
   - Define gate checks (Business Truth Gate)

2. **Build E11 MVP**
   - Minimal implementation satisfying invariants
   - Focus on proving critique effectiveness
   - Measure against acceptance criteria

3. **Test with F&B**
   - Real industry research
   - Measure human decisions
   - Validate provenance

4. **Integrate with E10**
   - Define manifest contract
   - Test end-to-end pipeline
   - Measure complete flow

5. **Field test Industry #5**
   - New domain (not F&B)
   - Prove generalization
   - Compare to E10-only baseline

---

**E11 Requirements: COMPLETE**

**Status:** 📋 Ready for Q0 Investigation  
**Next Phase:** Q0 (architecture research)  
**Implementation:** Blocked until Q0 → Design → Approval

---

## Bella Checkpoint

| Milestone | Status | Evidence |
|-----------|--------|----------|
| **E7 — Build** | 🔒 CLOSED | Proven: Education, Healthcare, Real-Estate |
| **E8 — Decide** | 🔒 CLOSED | Proven: Host, multiple cases |
| **E9 — Scope Derivation** | 🔒 CLOSED | 10 tests PASS (c0d2c50b) |
| **E9.1 — Evidence Collection** | 🔒 CLOSED | 37 tests PASS (3184a297) |
| **E10 — Factory Orchestration** | 🔒 CLOSED | 109s autonomous, 0 human decisions (9637e94e) |
| **E11 Requirements** | 🔒 CLOSED | 8 requirement groups, invariants, gate |
| **Q0 Investigation** | 🟡 READY | Methodology defined, 3-domain test |
| **E11 Design** | 🔒 BLOCKED | Waiting: Q0 closure |
| **E11 Implementation** | 🔒 BLOCKED | Waiting: Design approval |
| **Industry #5 Field Test** | 🔒 WAITING | Waiting: E11 MVP |

---

## Strategic Shift

**Before:** "Write more code to prove Factory works"  
**After:** "Prove semantic model before converting it to code"

**Boundary:**
- Lower Manufacturing (code ← technical truth): ✅ Complete (E7-E10)
- Upper Manufacturing (truth ← industry intent): ⏳ Requirements complete, model research next (E11)

---

## Locked Sequence

```text
Q0 Research → Q0 Proposal → Approval → Q0 CLOSED
    ↓
E11 Design → E11 MVP → Industry #5 Field Test
    ↓
AI Industry OS Manufacturing PROVEN
```

**NO shortcuts allowed.**

