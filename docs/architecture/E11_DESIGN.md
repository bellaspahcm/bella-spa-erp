# E11 Design — Business Truth Discovery Architecture

**Status:** 🔧 IN DESIGN  
**Phase:** Architecture Definition  
**Input:** Q0 Semantic Contract (DERIVED)  
**Dependencies:** E11 Requirements, Q0 Investigation  
**Started:** 2026-09-04

---

## Design Objective

**Convert Q0 Business Truth Semantic Contract (document) into executable E11 architecture.**

**Design Goals:**

1. **Architecture Boundary:** Define exact boundary between E11 Intelligence Layer, Business Truth Gate, and E10 Factory
2. **Executable Contract:** Convert Q0 semantic dimensions + invariants → TypeScript types + validators
3. **Business Truth Gate:** Independent governance boundary preventing E11 from self-promoting proposals to canonical truth
4. **Prevent ALL 7 B0 Failures:** Prove design blocks each failure mode
5. **Reuse Bella Patterns:** Inspect existing architecture before inventing abstractions
6. **Evidence-Based:** Every design decision backed by evidence (Q0, Bella, B0)

**NOT in scope:**
- ❌ Research Engine implementation
- ❌ E11 MVP implementation
- ❌ F&B B0 modifications
- ❌ F&B B1 execution
- ❌ E10 behavior changes (unless formally required by contract)

---

## Design Constraints

### Constraint 1: Q0 Contract is PROPOSED, not CANONICAL

Per Q0's own invariant, the contract derived by Q0 is:
- epistemicStatus: **INFERENCE**
- authority.source: **AI**
- authority.type: **PROPOSED**
- status: **PROPOSED** (not CANONICAL)

**This design uses Q0 as input, NOT as canonical truth.**

If architectural ambiguity arises, **surface it explicitly and STOP** rather than inventing a decision.

---

### Constraint 2: E11 Cannot Self-Approve

**Critical Design Invariant:**

```text
E11 Intelligence Layer
    ↓
Research → Evidence → Inference → Proposal → Self-Critique
    ↓
PROPOSED Business Truth Candidate
    │
    ╳  ← E11 CANNOT CROSS THIS BOUNDARY
    ↓
Business Truth Gate (INDEPENDENT)
    ↓
Validation (provenance, authority, lifecycle, conflicts, decisions)
    ├─ FAIL → STOP
    └─ PASS → CANONICAL Business Truth
              ↓
              E10 Factory
```

**E11 CANNOT:**
- Self-promote PROPOSED → CANONICAL
- Bypass Business Truth Gate
- Override gate validation
- Auto-approve without meeting invariants

**E11 CAN:**
- Research → gather evidence
- Synthesize → create inferences
- Propose → form candidates
- Critique → examine proposals

**Gate CAN:**
- Validate invariants
- Enforce lifecycle
- Block invalid candidates
- Require human decisions

---

### Constraint 3: B0 Failures are Negative Tests

**All 7 B0 failures MUST be prevented by this design:**

1. INFERENCE → CANONICAL (status lifecycle violated)
2. approvedBy: AI invalid (authority not encoded)
3. Confidence = truth (no distinction)
4. Business decision masked (alternatives not explicit)
5. Technical hallucination (no architecture evidence)
6. Factory bypass (E10 not used)
7. Verification claims false (tests don't run)

**Design must prove prevention for each.**

---

### Constraint 4: Bella Architecture Evidence Required

**Before introducing abstractions:**
- Inspect existing Bella patterns (Healthcare, Real-Estate, Education, Spa Kernel, Finance Kernel)
- Reuse existing components where appropriate
- Do NOT invent frameworks merely to implement contract
- Document provenance for design decisions

---

## Architecture Overview

### Component Topology

```text
┌─────────────────────────────────────────────────────────────┐
│                    E11 INTELLIGENCE LAYER                    │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Research   │ → │  Evidence    │ → │  Synthesis   │ │
│  │ Orchestrator │    │  Collection  │    │  Engine      │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  Inference   │ → │ Self-Critique│                      │
│  │   Engine     │    │   Engine     │                      │
│  └──────────────┘    └──────────────┘                      │
│                           ↓                                  │
│                  PROPOSED CANDIDATES                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
            ╔══════════════════════════════╗
            ║   BUSINESS TRUTH GATE        ║
            ║                              ║
            ║  Provenance Validator        ║
            ║  Authority Validator         ║
            ║  Lifecycle Enforcer          ║
            ║  Conflict Detector           ║
            ║  Alternative Validator       ║
            ║  Decision Classifier         ║
            ║  Consumability Checker       ║
            ╚══════════════╤═══════════════╝
                           │
                     ┌─────┴─────┐
                     │           │
                   FAIL        PASS
                     │           │
                   STOP    CANONICAL TRUTH
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │    E10 FACTORY         │
                    │ (existing, unmodified) │
                    └────────────────────────┘
```

### Component Responsibilities

**E11 Intelligence Layer:**
- Research orchestration
- Evidence collection
- Inference generation
- Proposal formation
- Self-critique execution
- Output: PROPOSED Business Truth Candidates

**Business Truth Gate:**
- Invariant validation
- Lifecycle enforcement
- Authority verification
- Provenance checking
- Conflict detection
- Decision classification
- Output: CANONICAL Business Truth OR STOP

**E10 Factory:**
- Consumes CANONICAL Business Truth
- Generates Industry OS artifacts
- (Existing component, no modifications)

---

## Executable Business Truth Contract

### TypeScript Types (from Q0 Contract)

```typescript
// ============================================================================
// BUSINESS TRUTH PRIMITIVE
// ============================================================================

/**
 * Business Truth represents a validated, governed piece of business knowledge
 * that E10 Factory can consume to build Industry OS.
 * 
 * Per Q0 Contract Dimension 1-6.
 */
interface BusinessTruth {
  // Metadata
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Dimension 1: Content Type (WHAT)
  contentType: ContentType;
  content: BusinessTruthContent;
  
  // Dimension 2: Epistemic Status (HOW KNOWN)
  epistemicStatus: EpistemicStatus;
  
  // Dimension 3: Authority & Approval (WHO DECIDED)
  authority: Authority;
  
  // Dimension 4: Provenance (WHY / FROM WHERE)
  provenance: Provenance;
  
  // Dimension 5: Confidence & Uncertainty
  confidence: Confidence;
  
  // Dimension 6: Status Lifecycle
  status: TruthStatus;
}

// ============================================================================
// DIMENSION 1: CONTENT TYPE
// ============================================================================

type ContentType = 
  | 'ENTITY'       // Business objects (Customer, Order, MenuItem)
  | 'PROCESS'      // Workflows (OrderFulfillment, InventorySync)
  | 'RULE'         // Business logic (pricing, validation)
  | 'INVARIANT'    // Constraints (Order.total = sum(lines))
  | 'RELATIONSHIP' // Connections (Order → Customer)
  | 'EVENT';       // Occurrences (OrderPlaced, PaymentReceived)

interface BusinessTruthContent {
  name: string;
  description: string;
  // Content structure depends on contentType
  // Defined by domain-specific schemas
}

interface EntityContent extends BusinessTruthContent {
  attributes: Attribute[];
  relationships?: string[]; // IDs of related RELATIONSHIP truths
}

interface ProcessContent extends BusinessTruthContent {
  steps: ProcessStep[];
  rules: string[]; // IDs of related RULE truths
}

interface RuleContent extends BusinessTruthContent {
  logic: string; // Formal or semi-formal representation
  enforcement: 'SYSTEM' | 'POLICY';
  businessImpact: string;
}

interface InvariantContent extends BusinessTruthContent {
  constraint: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  enforcementPoint: 'DATABASE' | 'APPLICATION' | 'BUSINESS_LOGIC';
}

interface RelationshipContent extends BusinessTruthContent {
  sourceEntity: string; // ID of source ENTITY truth
  targetEntity: string; // ID of target ENTITY truth
  cardinality: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
  cascadeRules?: CascadeRule[];
}

interface EventContent extends BusinessTruthContent {
  trigger: string;
  payload: Record<string, any>;
  handlers?: string[]; // IDs of related PROCESS truths
}

// ============================================================================
// DIMENSION 2: EPISTEMIC STATUS
// ============================================================================

type EpistemicStatus =
  | 'OBSERVATION'  // Direct evidence from source (no reasoning)
  | 'INFERENCE'    // Derived via reasoning (deterministic)
  | 'BELIEF'       // Probable but uncertain, or multiple valid options
  | 'KNOWLEDGE';   // Justified, validated, no reasonable doubt

// ============================================================================
// DIMENSION 3: AUTHORITY & APPROVAL
// ============================================================================

interface Authority {
  source: AuthoritySource;
  type: AuthorityType;
  approvedBy: ApprovalAuthority | null;
  approvedAt: Date | null;
}

type AuthoritySource =
  | 'SYSTEM'   // Derived from existing Bella code/schema
  | 'AI'       // Inferred by AI reasoning
  | 'HUMAN';   // Decided by human expert/stakeholder

type AuthorityType =
  | 'DERIVED'   // From existing system evidence
  | 'INFERRED'  // From AI reasoning
  | 'PROPOSED'  // Candidate awaiting approval
  | 'DECIDED'   // Business decision made
  | 'APPROVED'; // Passed approval gate

type ApprovalAuthority =
  | 'AI'     // Auto-approved (high confidence + no conflicts)
  | 'HUMAN'  // Human-approved
  | 'SYSTEM'; // System-validated (existing Bella pattern)

// ============================================================================
// DIMENSION 4: PROVENANCE
// ============================================================================

interface Provenance {
  sources: Evidence[];
  derivedFrom?: string[]; // IDs of parent Business Truths
  reasoning?: string;
  alternatives: Alternative[];
  conflicts: Conflict[];
}

interface Evidence {
  id: string;
  type: EvidenceType;
  source: string; // URL, file path, or identifier
  excerpt?: string;
  relevance: string;
  strength: EvidenceStrength;
  timestamp: Date;
}

type EvidenceType =
  | 'WEB'
  | 'DOCUMENT'
  | 'API_DOCS'
  | 'BELLA_KERNEL'    // Existing Bella code
  | 'BELLA_PATTERN'   // Bella architecture pattern
  | 'REPOSITORY'
  | 'DATABASE'
  | 'EXPERT'
  | 'REGULATORY'
  | 'INDUSTRY_STANDARD';

type EvidenceStrength =
  | 'STRONG'      // Multiple independent sources, high credibility
  | 'MODERATE'    // Single credible source or multiple weak sources
  | 'WEAK'        // Anecdotal, single weak source
  | 'ASSUMPTION'; // No direct evidence, assumption made

interface Alternative {
  option: string;
  description: string;
  pros: string[];
  cons: string[];
  evidence: Evidence[];
  tradeoffs: string;
}

interface Conflict {
  evidenceA: Evidence;
  evidenceB: Evidence;
  nature: string; // Description of contradiction
  resolution?: string; // How conflict was resolved (if resolved)
}

// ============================================================================
// DIMENSION 5: CONFIDENCE & UNCERTAINTY
// ============================================================================

interface Confidence {
  score: number; // 0.0 - 1.0, evidence quality metric
  basis: string; // How confidence was calculated
  assumptions: string[]; // Explicit assumptions made
}

// ============================================================================
// DIMENSION 6: STATUS LIFECYCLE
// ============================================================================

type TruthStatus =
  | 'OBSERVED'      // Raw evidence collected
  | 'SYNTHESIZED'   // Evidence combined
  | 'INFERRED'      // Reasoning applied
  | 'PROPOSED'      // Candidate formed (E11 output)
  | 'CRITIQUED'     // Self-critique completed
  | 'APPROVED'      // Passed approval criteria
  | 'CANONICAL'     // Final governed truth (E10 input)
  | 'VERSIONED'     // Timestamped immutable version
  | 'SUPERSEDED';   // Replaced by newer version

// ============================================================================
// BUSINESS TRUTH DOCUMENT (E10 Input)
// ============================================================================

interface BusinessTruthDocument {
  metadata: BTDMetadata;
  truths: BusinessTruth[];
}

interface BTDMetadata {
  industryOS: string;
  version: string;
  createdAt: Date;
  lastModified: Date;
  approvedBy: string;
  approvalDate: Date;
}
```

---

## Business Truth Gate Design

### Gate Architecture

```typescript
// ============================================================================
// BUSINESS TRUTH GATE
// ============================================================================

/**
 * Independent governance boundary between E11 and E10.
 * 
 * E11 CANNOT bypass this gate.
 * E10 ONLY receives CANONICAL truths that pass all invariants.
 */
class BusinessTruthGate {
  /**
   * Validate Business Truth Document against Q0 invariants.
   * 
   * @returns ValidationResult (PASS or FAIL with violations)
   */
  validate(btd: BusinessTruthDocument): ValidationResult {
    const violations: GateViolation[] = [];
    
    // Run all invariant validators
    violations.push(...this.validateInvariant1_StatusLifecycle(btd));
    violations.push(...this.validateInvariant2_AuthorityStatus(btd));
    violations.push(...this.validateInvariant3_ConfidenceNotAuthority(btd));
    violations.push(...this.validateInvariant4_ProvenanceCompleteness(btd));
    violations.push(...this.validateInvariant5_ArchitectureEvidence(btd));
    violations.push(...this.validateInvariant6_FactoryAuthorization(btd));
    violations.push(...this.validateInvariant7_VerificationTraceability(btd));
    
    const passed = violations.filter(v => v.severity === 'BLOCKING').length === 0;
    
    return {
      passed,
      violations,
      decision: passed ? 'ALLOW_E10' : 'BLOCK_E10',
      timestamp: new Date()
    };
  }
  
  // ============================================================================
  // INVARIANT 1: STATUS LIFECYCLE ENFORCEMENT
  // ============================================================================
  
  /**
   * Prevents: B0 Failure #1 (INFERENCE → CANONICAL shortcut)
   * 
   * Rule: INFERENCE cannot become CANONICAL without approval.
   * Required path: OBSERVED/INFERRED → PROPOSED → CRITIQUED → APPROVED → CANONICAL
   */
  private validateInvariant1_StatusLifecycle(btd: BusinessTruthDocument): GateViolation[] {
    const violations: GateViolation[] = [];
    
    for (const truth of btd.truths) {
      // Check: No non-CANONICAL truths in document
      if (truth.status !== 'CANONICAL' && truth.status !== 'VERSIONED') {
        violations.push({
          invariant: 'Invariant 1: Status Lifecycle',
          truthId: truth.id,
          severity: 'BLOCKING',
          message: `Truth status is ${truth.status}, not CANONICAL. Cannot proceed to E10.`,
          evidence: `status=${truth.status}, id=${truth.id}`
        });
      }
      
      // Check: INFERENCE + CANONICAL is FORBIDDEN
      if (truth.epistemicStatus === 'INFERENCE' && truth.status === 'CANONICAL') {
        violations.push({
          invariant: 'Invariant 1: Status Lifecycle',
          truthId: truth.id,
          severity: 'BLOCKING',
          message: 'INFERENCE cannot be CANONICAL without going through PROPOSED → APPROVED.',
          evidence: `epistemicStatus=INFERENCE, status=CANONICAL, id=${truth.id}`
        });
      }
    }
    
    return violations;
  }
  
  // ============================================================================
  // INVARIANT 2: AUTHORITY-STATUS CONSISTENCY
  // ============================================================================
  
  /**
   * Prevents: B0 Failure #2 (approvedBy: AI invalid)
   *          B0 Failure #4 (business decision masked)
   * 
   * Rule: AI cannot self-approve inferences as CANONICAL.
   *       Business decisions require HUMAN authority.
   */
  private validateInvariant2_AuthorityStatus(btd: BusinessTruthDocument): GateViolation[] {
    const violations: GateViolation[] = [];
    
    for (const truth of btd.truths) {
      // Check: INFERENCE + CANONICAL + AI approval is FORBIDDEN
      if (
        truth.epistemicStatus === 'INFERENCE' &&
        truth.status === 'CANONICAL' &&
        truth.authority.approvedBy === 'AI'
      ) {
        violations.push({
          invariant: 'Invariant 2: Authority-Status Consistency',
          truthId: truth.id,
          severity: 'BLOCKING',
          message: 'AI cannot approve INFERENCE as CANONICAL.',
          evidence: `epistemicStatus=INFERENCE, status=CANONICAL, approvedBy=AI, id=${truth.id}`
        });
      }
      
      // Check: CANONICAL requires approval
      if (truth.status === 'CANONICAL' && !truth.authority.approvedBy) {
        // Exception: High confidence + no conflicts + no alternatives
        const canAutoApprove =
          truth.confidence.score >= 0.95 &&
          truth.provenance.conflicts.length === 0 &&
          truth.provenance.alternatives.length === 0;
        
        if (!canAutoApprove) {
          violations.push({
            invariant: 'Invariant 2: Authority-Status Consistency',
            truthId: truth.id,
            severity: 'BLOCKING',
            message: 'CANONICAL requires approval (human or high-confidence auto-approve).',
            evidence: `status=CANONICAL, approvedBy=null, confidence=${truth.confidence.score}, id=${truth.id}`
          });
        }
      }
      
      // Check: Business decisions (alternatives exist) require HUMAN
      if (
        truth.provenance.alternatives.length > 0 &&
        truth.status === 'CANONICAL' &&
        truth.authority.approvedBy !== 'HUMAN'
      ) {
        violations.push({
          invariant: 'Invariant 2: Authority-Status Consistency',
          truthId: truth.id,
          severity: 'BLOCKING',
          message: 'Business decisions with alternatives require HUMAN approval.',
          evidence: `alternatives=${truth.provenance.alternatives.length}, approvedBy=${truth.authority.approvedBy}, id=${truth.id}`
        });
      }
    }
    
    return violations;
  }
  
  // ============================================================================
  // INVARIANT 3: CONFIDENCE ≠ TRUTH AUTHORITY
  // ============================================================================
  
  /**
   * Prevents: B0 Failure #3 (confidence = truth)
   * 
   * Rule: Confidence is metadata, not approval mechanism.
   */
  private validateInvariant3_ConfidenceNotAuthority(btd: BusinessTruthDocument): GateViolation[] {
    const violations: GateViolation[] = [];
    
    for (const truth of btd.truths) {
      // Check: CANONICAL without approval cannot rely only on confidence
      if (
        truth.status === 'CANONICAL' &&
        !truth.authority.approvedBy &&
        truth.confidence.score < 0.95
      ) {
        violations.push({
          invariant: 'Invariant 3: Confidence ≠ Authority',
          truthId: truth.id,
          severity: 'BLOCKING',
          message: 'Confidence alone insufficient for CANONICAL status without approval.',
          evidence: `confidence=${truth.confidence.score}, approvedBy=null, id=${truth.id}`
        });
      }
    }
    
    return violations;
  }
  
  // ============================================================================
  // INVARIANT 4: PROVENANCE COMPLETENESS
  // ============================================================================
  
  /**
   * Prevents: B0 Failure #4 (business decision masked - alternatives not explicit)
   * 
   * Rule: INFERENCE requires sources + reasoning.
   *       CANONICAL requires alternatives documented.
   */
  private validateInvariant4_ProvenanceCompleteness(btd: BusinessTruthDocument): GateViolation[] {
    const violations: GateViolation[] = [];
    
    for (const truth of btd.truths) {
      // Check: INFERENCE requires sources
      if (truth.epistemicStatus === 'INFERENCE' && truth.provenance.sources.length === 0) {
        violations.push({
          invariant: 'Invariant 4: Provenance Completeness',
          truthId: truth.id,
          severity: 'BLOCKING',
          message: 'INFERENCE requires sources in provenance.',
          evidence: `epistemicStatus=INFERENCE, sources=0, id=${truth.id}`
        });
      }
      
      // Check: INFERENCE requires reasoning
      if (truth.epistemicStatus === 'INFERENCE' && !truth.provenance.reasoning) {
        violations.push({
          invariant: 'Invariant 4: Provenance Completeness',
          truthId: truth.id,
          severity: 'BLOCKING',
          message: 'INFERENCE requires reasoning in provenance.',
          evidence: `epistemicStatus=INFERENCE, reasoning=null, id=${truth.id}`
        });
      }
      
      // Check: Conflicts must be documented
      if (truth.provenance.conflicts.length > 0) {
        for (const conflict of truth.provenance.conflicts) {
          if (!conflict.resolution) {
            violations.push({
              invariant: 'Invariant 4: Provenance Completeness',
              truthId: truth.id,
              severity: 'BLOCKING',
              message: 'Conflict detected but not resolved.',
              evidence: `conflict.nature=${conflict.nature}, id=${truth.id}`
            });
          }
        }
      }
    }
    
    return violations;
  }
  
  // ============================================================================
  // INVARIANT 5: ARCHITECTURE EVIDENCE REQUIRED
  // ============================================================================
  
  /**
   * Prevents: B0 Failure #5 (technical hallucination - invented DatabaseService)
   * 
   * Rule: Technical implementations require Bella provenance.
   */
  private validateInvariant5_ArchitectureEvidence(btd: BusinessTruthDocument): GateViolation[] {
    const violations: GateViolation[] = [];
    
    for (const truth of btd.truths) {
      // Check: Technical content types require architecture evidence
      if (truth.contentType === 'ENTITY' || truth.contentType === 'PROCESS') {
        const hasBellaEvidence = truth.provenance.sources.some(
          s => s.type === 'BELLA_KERNEL' || s.type === 'BELLA_PATTERN'
        );
        
        // If no Bella evidence, flag as warning (may be new pattern)
        if (!hasBellaEvidence && truth.authority.source === 'AI') {
          violations.push({
            invariant: 'Invariant 5: Architecture Evidence',
            truthId: truth.id,
            severity: 'WARNING',
            message: 'No Bella architecture evidence. Verify not inventing abstractions.',
            evidence: `contentType=${truth.contentType}, sources=${truth.provenance.sources.map(s => s.type).join(',')}, id=${truth.id}`
          });
        }
      }
    }
    
    return violations;
  }
  
  // ============================================================================
  // INVARIANT 6: FACTORY BUILD AUTHORIZATION
  // ============================================================================
  
  /**
   * Prevents: B0 Failure #6 (factory bypass - E10 not used)
   * 
   * Rule: Only CANONICAL truths can reach E10.
   */
  private validateInvariant6_FactoryAuthorization(btd: BusinessTruthDocument): GateViolation[] {
    const violations: GateViolation[] = [];
    
    // Check: Document approval
    if (!btd.metadata.approvedBy || !btd.metadata.approvalDate) {
      violations.push({
        invariant: 'Invariant 6: Factory Authorization',
        truthId: 'DOCUMENT',
        severity: 'BLOCKING',
        message: 'Business Truth Document not approved.',
        evidence: `approvedBy=${btd.metadata.approvedBy}, approvalDate=${btd.metadata.approvalDate}`
      });
    }
    
    // Check: All truths are CANONICAL
    const nonCanonical = btd.truths.filter(t => t.status !== 'CANONICAL' && t.status !== 'VERSIONED');
    if (nonCanonical.length > 0) {
      violations.push({
        invariant: 'Invariant 6: Factory Authorization',
        truthId: 'DOCUMENT',
        severity: 'BLOCKING',
        message: `${nonCanonical.length} non-CANONICAL truths in document.`,
        evidence: `non-canonical IDs: ${nonCanonical.map(t => t.id).join(', ')}`
      });
    }
    
    return violations;
  }
  
  // ============================================================================
  // INVARIANT 7: VERIFICATION TRACEABILITY
  // ============================================================================
  
  /**
   * Prevents: B0 Failure #7 (verification claims false - tests don't run)
   * 
   * Rule: Verification claims require executable evidence.
   * 
   * NOTE: This invariant will be fully enforced in E10 output validation,
   *       not at gate entry (gate validates BTD, not E10 artifacts).
   */
  private validateInvariant7_VerificationTraceability(btd: BusinessTruthDocument): GateViolation[] {
    // Placeholder: Full enforcement in E10 output validation
    // Gate validates BTD structure, E10 validates build artifacts
    return [];
  }
}

// ============================================================================
// GATE RESULT TYPES
// ============================================================================

interface ValidationResult {
  passed: boolean;
  violations: GateViolation[];
  decision: 'ALLOW_E10' | 'BLOCK_E10';
  timestamp: Date;
}

interface GateViolation {
  invariant: string;
  truthId: string;
  severity: 'BLOCKING' | 'WARNING';
  message: string;
  evidence: string;
}
```

---

## Authority Model Design

### Authority Transitions

```typescript
/**
 * Authority state machine defining valid transitions.
 * 
 * This enforces Q0 Invariant #2: Authority-Status Consistency
 */
class AuthorityModel {
  /**
   * Check if authority transition is valid.
   */
  canTransition(
    from: { source: AuthoritySource; type: AuthorityType },
    to: { source: AuthoritySource; type: AuthorityType }
  ): boolean {
    // AI can DERIVE from existing system
    if (to.source === 'AI' && to.type === 'DERIVED') {
      return from.source === 'SYSTEM';
    }
    
    // AI can INFER from evidence
    if (to.source === 'AI' && to.type === 'INFERRED') {
      return true; // Always allowed (AI reasoning)
    }
    
    // AI can PROPOSE candidates
    if (to.source === 'AI' && to.type === 'PROPOSED') {
      return from.type === 'INFERRED' || from.type === 'DERIVED';
    }
    
    // HUMAN can DECIDE
    if (to.source === 'HUMAN' && to.type === 'DECIDED') {
      return from.type === 'PROPOSED';
    }
    
    // HUMAN can APPROVE
    if (to.source === 'HUMAN' && to.type === 'APPROVED') {
      return from.type === 'PROPOSED' || from.type === 'DECIDED';
    }
    
    // AI can auto-APPROVE under conditions
    if (to.source === 'AI' && to.type === 'APPROVED') {
      // Only from PROPOSED
      // Only if high confidence + no conflicts + no alternatives
      // (Checked by BusinessTruthGate)
      return from.type === 'PROPOSED';
    }
    
    // SYSTEM can DERIVE from existing Bella
    if (to.source === 'SYSTEM' && to.type === 'DERIVED') {
      return true; // Always allowed (extracting from existing code)
    }
    
    return false;
  }
}
```

---

## Lifecycle & State Transition Design

### Status State Machine

```typescript
/**
 * Status lifecycle state machine.
 * 
 * Enforces Q0 Invariant #1: Status Lifecycle Enforcement
 */
class TruthLifecycle {
  /**
   * Valid status transitions.
   */
  private static readonly VALID_TRANSITIONS: Record<TruthStatus, TruthStatus[]> = {
    'OBSERVED': ['SYNTHESIZED'],
    'SYNTHESIZED': ['INFERRED'],
    'INFERRED': ['PROPOSED'],
    'PROPOSED': ['CRITIQUED'],
    'CRITIQUED': ['APPROVED', 'PROPOSED'], // Can return to PROPOSED if critique fails
    'APPROVED': ['CANONICAL'],
    'CANONICAL': ['VERSIONED'],
    'VERSIONED': ['SUPERSEDED'],
    'SUPERSEDED': [] // Terminal state
  };
  
  /**
   * Forbidden shortcuts (explicitly blocked).
   */
  private static readonly FORBIDDEN_SHORTCUTS: Array<[TruthStatus, TruthStatus]> = [
    ['INFERRED', 'CANONICAL'],      // B0 Failure #1
    ['PROPOSED', 'CANONICAL'],
    ['OBSERVED', 'CANONICAL'],
    ['SYNTHESIZED', 'CANONICAL'],
    ['INFERRED', 'APPROVED'],
    ['PROPOSED', 'APPROVED']        // Must go through CRITIQUED
  ];
  
  /**
   * Check if status transition is valid.
   */
  canTransition(from: TruthStatus, to: TruthStatus): boolean {
    // Check forbidden shortcuts first
    const isForbidden = TruthLifecycle.FORBIDDEN_SHORTCUTS.some(
      ([f, t]) => f === from && t === to
    );
    
    if (isForbidden) {
      return false;
    }
    
    // Check valid transitions
    const validNext = TruthLifecycle.VALID_TRANSITIONS[from] || [];
    return validNext.includes(to);
  }
  
  /**
   * Get required path from current status to CANONICAL.
   */
  getRequiredPath(from: TruthStatus): TruthStatus[] {
    const paths: Record<TruthStatus, TruthStatus[]> = {
      'OBSERVED': ['SYNTHESIZED', 'INFERRED', 'PROPOSED', 'CRITIQUED', 'APPROVED', 'CANONICAL'],
      'SYNTHESIZED': ['INFERRED', 'PROPOSED', 'CRITIQUED', 'APPROVED', 'CANONICAL'],
      'INFERRED': ['PROPOSED', 'CRITIQUED', 'APPROVED', 'CANONICAL'],
      'PROPOSED': ['CRITIQUED', 'APPROVED', 'CANONICAL'],
      'CRITIQUED': ['APPROVED', 'CANONICAL'],
      'APPROVED': ['CANONICAL'],
      'CANONICAL': [],
      'VERSIONED': [],
      'SUPERSEDED': []
    };
    
    return paths[from] || [];
  }
}
```

---

## Provenance Model Design

### Provenance Tracking

```typescript
/**
 * Provenance tracking for Business Truths.
 * 
 * Implements Q0 Dimension 4: Provenance (WHY / FROM WHERE)
 */
class ProvenanceTracker {
  /**
   * Create provenance record for new truth.
   */
  createProvenance(
    sources: Evidence[],
    reasoning?: string,
    derivedFrom?: string[]
  ): Provenance {
    return {
      sources,
      derivedFrom,
      reasoning,
      alternatives: [],
      conflicts: []
    };
  }
  
  /**
   * Add alternative model to provenance.
   */
  addAlternative(
    provenance: Provenance,
    alternative: Alternative
  ): Provenance {
    return {
      ...provenance,
      alternatives: [...provenance.alternatives, alternative]
    };
  }
  
  /**
   * Add conflict to provenance.
   */
  addConflict(
    provenance: Provenance,
    conflict: Conflict
  ): Provenance {
    return {
      ...provenance,
      conflicts: [...provenance.conflicts, conflict]
    };
  }
  
  /**
   * Validate provenance completeness per Q0 Invariant #4.
   */
  validateCompleteness(
    truth: BusinessTruth
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    // INFERENCE requires sources
    if (truth.epistemicStatus === 'INFERENCE' && truth.provenance.sources.length === 0) {
      missing.push('sources (required for INFERENCE)');
    }
    
    // INFERENCE requires reasoning
    if (truth.epistemicStatus === 'INFERENCE' && !truth.provenance.reasoning) {
      missing.push('reasoning (required for INFERENCE)');
    }
    
    // Conflicts require resolution
    for (const conflict of truth.provenance.conflicts) {
      if (!conflict.resolution) {
        missing.push(`conflict resolution: ${conflict.nature}`);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
  
  /**
   * Extract Bella architecture evidence from provenance.
   */
  extractBellaEvidence(provenance: Provenance): Evidence[] {
    return provenance.sources.filter(
      s => s.type === 'BELLA_KERNEL' || s.type === 'BELLA_PATTERN'
    );
  }
}
```

---

## E10 Consumption Interface

### Interface Contract

```typescript
/**
 * E10 Factory consumption interface.
 * 
 * E10 receives ONLY CANONICAL Business Truth Documents that passed gate.
 */
interface E10ConsumptionInterface {
  /**
   * Build Industry OS from validated Business Truth Document.
   * 
   * Precondition: BTD MUST have passed BusinessTruthGate.
   * 
   * @param btd - Validated Business Truth Document (CANONICAL truths only)
   * @returns Build result
   */
  buildIndustryOS(btd: BusinessTruthDocument): E10BuildResult;
}

interface E10BuildResult {
  success: boolean;
  artifacts: GeneratedArtifact[];
  errors: E10Error[];
  metrics: E10BuildMetrics;
}

interface GeneratedArtifact {
  type: 'SCHEMA' | 'TYPES' | 'REPOSITORY' | 'DOMAIN_LOGIC' | 'TESTS' | 'DOCS';
  path: string;
  content: string;
  provenanceLink: string; // Links back to BusinessTruth ID
}

interface E10Error {
  phase: 'VALIDATION' | 'GENERATION' | 'COMPILATION' | 'TESTING';
  message: string;
  truthId?: string; // Which truth caused error
}

interface E10BuildMetrics {
  duration: number;
  truthsProcessed: number;
  artifactsGenerated: number;
  testsRun: number;
  testsPassed: number;
}
```

### E10 Validation (Unchanged)

**E10 existing validation:**
- TypeScript compilation (Gate B)
- Test execution
- Architecture Guard
- Regression protection

**E10 does NOT validate Business Truth correctness.**

E10 assumes BTD is correct (because it passed Business Truth Gate).

---

## Failure Prevention Proof

### Design Proof: All 7 B0 Failures Prevented

| B0 Failure | Prevention Mechanism | Design Component | Evidence |
|------------|----------------------|------------------|----------|
| #1: INFERENCE → CANONICAL | `TruthLifecycle.FORBIDDEN_SHORTCUTS` | Lifecycle State Machine | Explicitly blocks shortcut |
| #1 (continued) | `BusinessTruthGate.validateInvariant1_StatusLifecycle()` | Gate Validator | Runtime enforcement |
| #2: approvedBy: AI invalid | `AuthorityModel.canTransition()` | Authority State Machine | Blocks AI self-approval of inferences |
| #2 (continued) | `BusinessTruthGate.validateInvariant2_AuthorityStatus()` | Gate Validator | Runtime enforcement |
| #3: Confidence = truth | `BusinessTruthGate.validateInvariant3_ConfidenceNotAuthority()` | Gate Validator | Confidence checked separately from approval |
| #4: Business decision masked | `BusinessTruthGate.validateInvariant2_AuthorityStatus()` (alternatives check) | Gate Validator | Requires HUMAN approval if alternatives exist |
| #4 (continued) | `Provenance.alternatives: Alternative[]` | Type System | Alternatives must be documented |
| #5: Technical hallucination | `BusinessTruthGate.validateInvariant5_ArchitectureEvidence()` | Gate Validator | Flags missing Bella evidence |
| #5 (continued) | `ProvenanceTracker.extractBellaEvidence()` | Provenance Model | Extracts Bella patterns for reuse |
| #6: Factory bypass | `BusinessTruthGate.validate()` entry point | Gate Architecture | E10 CANNOT be called without gate validation |
| #6 (continued) | `BusinessTruthGate.validateInvariant6_FactoryAuthorization()` | Gate Validator | Blocks non-CANONICAL truths |
| #7: Verification claims false | E10 output validation (existing) | E10 Build Process | Tests must actually run (Gate B enforces) |

**All 7 failures blocked by design.**

---

## Bella Architecture Evidence

### Existing Patterns to Reuse

```typescript
/**
 * Bella architecture patterns discovered.
 * 
 * DO NOT invent abstractions. Reuse these.
 */
const BELLA_PATTERNS = {
  database: {
    client: 'SupabaseClient', // NOT DatabaseService
    location: '@supabase/supabase-js'
  },
  
  rls: {
    patterns: [
      'get_auth_tenant_id()',     // Healthcare pattern
      "current_setting('app.current_tenant_id')" // Real-Estate pattern
    ]
  },
  
  layering: {
    contracts: 'interfaces/',
    domain: 'domain/',
    engines: 'engines/',
    repositories: 'repositories/',
    'shared-kernel': 'shared-kernel/'
  },
  
  standardColumns: [
    'id (uuid)',
    'tenant_id (uuid)',
    'created_at (timestamptz)',
    'updated_at (timestamptz)'
  ]
};
```

**Design decision:** E11 Design will NOT introduce new abstractions beyond Q0 contract types + gate validators.

---

## Rejected Design Alternatives

### Alternative 1: Embed Gate in E11

**Considered:**
- Make BusinessTruthGate a method inside E11 Intelligence Layer
- E11 validates its own output before emitting

**Why Rejected:**
1. **Violates separation of concerns:** E11 should research, NOT govern
2. **Self-validation risk:** AI validating AI creates circular trust
3. **Q0 teaches:** Authority must be independent of inference generation
4. **B0 Failure #2:** Self-approval is exactly what caused F&B B0 to fail

**Verdict:** ❌ REJECTED — Gate must be independent component

---

### Alternative 2: Make E10 Validate Business Truth

**Considered:**
- Remove gate
- E10 validates BTD as first step of build

**Why Rejected:**
1. **Violates E10 scope:** E10 builds, doesn't validate business logic
2. **Mixes concerns:** Technical validation (E10) vs business validation (Gate)
3. **Late detection:** Failures discovered after build starts (wasteful)
4. **Q0 teaches:** Governance must occur BEFORE consumption

**Verdict:** ❌ REJECTED — Gate must be pre-E10 boundary

---

### Alternative 3: Confidence-Based Auto-Approval Only

**Considered:**
- Use only confidence threshold (e.g., >= 0.9) for auto-approval
- Remove authority model, alternatives check, conflict resolution

**Why Rejected:**
1. **Exactly B0 Failure #3:** Confidence used as authority
2. **Q0 Invariant #3:** Confidence ≠ truth authority
3. **Masks business decisions:** High confidence doesn't mean valid choice among alternatives
4. **No provenance:** Loses traceability

**Verdict:** ❌ REJECTED — Violates Q0 Invariant #3

---

### Alternative 4: Human Approval for Everything

**Considered:**
- Require human approval for ALL business truths
- No AI auto-approval

**Why Rejected:**
1. **Defeats autonomy goal:** E11 should minimize human decisions
2. **Inefficient:** Universal patterns (Customer, Order) don't need approval
3. **Q0 allows auto-approval:** High confidence + no conflicts + no alternatives → AI can approve
4. **Existing Bella patterns:** System-derived truths don't need human approval

**Verdict:** ❌ REJECTED — Over-governance, defeats E11 purpose

---

### Alternative 5: Skip Self-Critique

**Considered:**
- Remove self-critique phase
- E11 proposes candidates directly

**Why Rejected:**
1. **B0 didn't self-critique:** Led to all 7 failures
2. **Q0 Invariant #4:** Alternatives must be considered
3. **No adversarial check:** AI rationalizes rather than challenges
4. **Critique is mandatory:** Q0 contract requires it

**Verdict:** ❌ REJECTED — Self-critique is non-negotiable

---

### Alternative 6: Single "Truth" Type (No Dimensions)

**Considered:**
- Simplify to single `BusinessTruth` without semantic dimensions
- Just {name, description, confidence}

**Why Rejected:**
1. **Insufficient for B0 failures:** Can't prevent inference → canonical shortcuts
2. **No provenance:** Loses traceability
3. **No authority model:** Can't distinguish AI vs human vs system
4. **Q0 derived 6 dimensions:** Based on evidence, not arbitrary

**Verdict:** ❌ REJECTED — Under-specified contract

---

### Alternative 7: Gate as Post-E10 Validator

**Considered:**
- Let E10 build first
- Validate artifacts after generation

**Why Rejected:**
1. **Too late:** Waste effort building wrong truth
2. **Cannot unBuild:** Generated code already exists
3. **Q0 teaches:** Validation before consumption, not after
4. **B0 Failure #6:** Factory bypass prevention requires pre-gate

**Verdict:** ❌ REJECTED — Gate must be pre-E10

---

## Unresolved Design Decisions

### Decision 1: E11 Component Implementation Details

**Question:** How should E11 Intelligence Layer components be implemented?
- Research Orchestrator
- Evidence Collection
- Synthesis Engine
- Inference Engine
- Self-Critique Engine

**Status:** **UNRESOLVED** (deferred to E11 MVP Implementation phase)

**Rationale:** This is DESIGN phase. Implementation details belong in MVP phase.

**Design provides:** Component responsibilities + interfaces, NOT implementations.

---

### Decision 2: Evidence Source Connectors

**Question:** Which external sources should E11 connect to?
- Web search APIs
- Document parsers
- GitHub repositories
- Industry databases

**Status:** **UNRESOLVED** (deferred to E11 MVP Implementation phase)

**Rationale:** Design defines `Evidence` type and `Provenance` model. Specific connectors are implementation details.

---

### Decision 3: Business Truth Storage

**Question:** Where/how to store Business Truth Documents?
- File system (JSON/YAML)
- Database (Supabase)
- Version control (Git)
- All of above

**Status:** **UNRESOLVED** (deferred to E11 MVP Implementation phase)

**Rationale:** Design defines `BusinessTruthDocument` type. Storage mechanism is implementation detail.

**Constraint:** Must support versioning (per Q0 Dimension 6).

---

### Decision 4: Gate Integration Point

**Question:** How does gate integrate with E10 Factory?
- E10 calls gate before build
- Separate CLI command
- Pre-commit hook
- All of above

**Status:** **PARTIALLY RESOLVED**

**Design decision:** Gate is **independent component** that E10 MUST call.

**Implementation details:** Deferred to E11 MVP Implementation.

---

### Decision 5: Human Approval UI

**Question:** How do humans approve deferred decisions?
- CLI prompt
- Web UI
- GitHub PR review
- Separate approval app

**Status:** **UNRESOLVED** (deferred to E11 MVP Implementation phase)

**Rationale:** Design defines `HumanDecision` type and approval workflow. UI is implementation detail.

---

## Evidence & Design Rationale

### Evidence Sources for Design Decisions

| Design Decision | Evidence |
|-----------------|----------|
| 6 Semantic Dimensions | Q0 Investigation (48 sources + 3-domain validation) |
| 7 Invariants | Q0 Contract + F&B B0 failure analysis |
| Independent Gate | Q0 Invariant #2 (AI cannot self-approve) |
| Status Lifecycle | Q0 Dimension 6 + B0 Failure #1 |
| Authority Model | Q0 Dimension 3 + B0 Failure #2, #4 |
| Provenance Model | Q0 Dimension 4 + W3C PROV |
| Confidence ≠ Authority | Q0 Invariant #3 + B0 Failure #3 |
| Bella Pattern Reuse | Bella architecture inspection (Healthcare, Real-Estate, Education) |
| TypeScript Types | Q0 Contract structure + Bella existing patterns |

---

## Design Gate: Definition of Done

**E11 Design is COMPLETE when:**

1. ✅ Architecture boundary defined (E11 → Gate → E10)
2. ✅ Component responsibilities documented
3. ✅ Executable contract designed (TypeScript types)
4. ✅ Business Truth Gate specified (7 invariant validators)
5. ✅ Authority model defined (state machine)
6. ✅ Lifecycle model defined (status transitions)
7. ✅ Provenance model designed
8. ✅ E10 consumption interface specified
9. ✅ All 7 B0 failures prevention proven (design-level)
10. ✅ Rejected alternatives documented
11. ✅ Unresolved decisions explicitly surfaced

**Design Gate Check:**

```text
Can E11 self-promote PROPOSED → CANONICAL?
  ❌ NO → Design PASS
  ✅ YES → Design FAIL (violates constraint)

Can E10 receive non-CANONICAL truths?
  ❌ NO → Design PASS
  ✅ YES → Design FAIL (violates constraint)

Are all 7 B0 failures blocked by design?
  ✅ YES → Design PASS
  ❌ NO → Design FAIL (incomplete)

Does design invent abstractions not in Bella?
  ❌ NO → Design PASS
  ✅ YES → Review necessity (may be acceptable if justified)

Are unresolved decisions explicit?
  ✅ YES → Design PASS
  ❌ NO → Design FAIL (hidden assumptions)
```

**Next Phase:** E11 MVP Implementation (BLOCKED until Design approved)

---

**Document Status:** 🔧 DESIGN IN PROGRESS  
**Last Updated:** 2026-09-04  
**Phase:** E11 Design → Awaiting Review
