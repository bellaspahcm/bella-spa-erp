# F5.6 A.3 Evidence Taxonomy

> **Document Type:** Research Methodology — Evidence Classification  
> **Date:** 2026-08-16  
> **Status:** LOCKED (F5.6 Invariant)  
> **Purpose:** Define evidence authority and grade for semantic verification

---

## Purpose

**This taxonomy establishes the evidence hierarchy for semantic research.**

**Critical Principle:**
> "Research may infer. Architecture may provisionalize. Production may only rely on verified semantics."

**Why This Matters:**
- Prevents ASSUMED assertions from becoming production rules
- Enables provisional progress while primary verification proceeds
- Provides clear criteria for Gate 2 / production readiness

**Lesson from A3-COR-001:**
> "Secondary-source interpretation was accepted before primary semantic verification."

---

## Two-Axis Model

**Evidence quality assessed on TWO independent dimensions:**

### Axis 1: Authority Level (Source Type)

| Level | Definition | Examples | Reliability |
|-------|------------|----------|-------------|
| **PRIMARY** | Official legal/regulatory documents | TT133/2016, TT99/2025, VAS 01-03, Official MOF circulars | Authoritative |
| **SECONDARY** | Professional interpretation by recognized authorities | Big4 (Crowe, EY, PwC, Deloitte, KPMG), Legal databases (Thư Viện Pháp Luật), Grant Thornton Vietnam | High |
| **TERTIARY** | Implementation examples, blog posts, discussions | Frappe ERP discussions, Accounting blogs, Software documentation | Low |

---

### Axis 2: Evidence Grade (Verification Quality)

| Grade | Definition | Confidence | Production Use |
|-------|------------|------------|----------------|
| **CONFIRMED** | Verified from PRIMARY source with exact citation | Very High | ✅ Allowed |
| **CORROBORATED** | Multiple independent sources agree | High | ✅ Allowed (with caution) |
| **INFERRED** | Deduced from structure/practice, not explicit | Medium | ❌ Prohibited |
| **AMBIGUOUS** | Conflicting or unclear evidence | Low | ❌ Prohibited |
| **UNRESOLVED** | No evidence found yet | None | ❌ Prohibited |

---

## Combined Classification Matrix

**Authority × Grade = Production Eligibility**

| Authority | Grade | Description | Production Use | Gate 2 Status |
|-----------|-------|-------------|----------------|---------------|
| PRIMARY | CONFIRMED | Verified from official legal text with citation | ✅ **ALLOWED** | ✅ PASS |
| PRIMARY | CORROBORATED | Multiple PRIMARY sources agree | ✅ **ALLOWED** | ✅ PASS |
| SECONDARY | CONFIRMED | Single Big4/legal database confirmed | ⚠️ **CAUTION** | ⚠️ Legal review required |
| SECONDARY | CORROBORATED | 3+ independent SECONDARY sources agree | ⚠️ **CAUTION** | ⚠️ Legal review required |
| SECONDARY | INFERRED | Big4 implies but doesn't state explicitly | ❌ **PROHIBITED** | ❌ FAIL |
| TERTIARY | CORROBORATED | Multiple blogs/discussions agree | ❌ **PROHIBITED** | ❌ FAIL |
| ANY | INFERRED | Deduced from structure, not stated | ❌ **PROHIBITED** | ❌ FAIL |
| ANY | AMBIGUOUS | Conflicting evidence | ❌ **PROHIBITED** | ❌ FAIL |
| ANY | UNRESOLVED | No evidence | ❌ **PROHIBITED** | ❌ FAIL |

---

## Classification Examples

### Example 1: TK 331 Debit Balance (C-001)

**Claim:** TK 331 debit balance = vendor prepayment

**Evidence:**
- Source A: Crowe Vietnam 2016 (SECONDARY)
- Source B: F5.6 breakthrough research (SECONDARY)
- Source C: Grant Thornton Vietnam (SECONDARY)
- Source D: TT133/2016 Phụ lục 1 (PRIMARY - not yet accessed)

**Current Classification:**
- **Authority:** SECONDARY (multiple Big4)
- **Grade:** CORROBORATED (Crowe + Grant Thornton + F5.6 research)

**Production Eligibility:** ⚠️ **CAUTION** (legal review required)

**To Upgrade:** Access TT133 Phụ lục 1 → PRIMARY + CONFIRMED

---

### Example 2: TK 141 Employee Advances (C-003)

**Claim:** TK 141 = Employee/labor advances ONLY

**Evidence:**
- Source A: Frappe ERP discussion (TERTIARY)
- Source B: Account structure inference (INFERRED)
- Source C: TT133/2016 Phụ lục 1 (PRIMARY - not yet accessed)

**Current Classification:**
- **Authority:** TERTIARY (Frappe) + INFERRED (structure)
- **Grade:** INFERRED

**Production Eligibility:** ❌ **PROHIBITED**

**To Upgrade:** Access TT133 Phụ lục 1 → Verify "Tạm ứng" scope → PRIMARY + CONFIRMED

---

### Example 3: TK 142/244 → 242 (C-004)

**Claim:** TK 244 = Long-term prepaid expenses (merged to 242)

**Evidence:**
- Source A: Crowe Vietnam 2016 (SECONDARY) — claims TK 244 = long-term prepaid
- Source B: Thư Viện Pháp Luật TT133 Điều 38 (PRIMARY) — states TK 244 = deposits/pledges

**Current Classification:**
- **Authority:** SECONDARY vs PRIMARY (conflicting)
- **Grade:** AMBIGUOUS (conflicting interpretations)

**Production Eligibility:** ❌ **PROHIBITED**

**To Resolve:** Access TT133 Phụ lục 1 full text → Verify TK 244 definition → Update to CONFIRMED

---

### Example 4: Cash Recognition (A-001)

**Claim:** Cash (TK 111) recognized upon physical receipt

**Evidence:**
- Source A: Business modeling assumption (INFERRED)
- Source B: VAS 01 (PRIMARY - not yet accessed)

**Current Classification:**
- **Authority:** INFERRED (no source cited)
- **Grade:** ASSUMED

**Production Eligibility:** ❌ **PROHIBITED**

**To Upgrade:** Access VAS 01 → Verify recognition criteria → PRIMARY + CONFIRMED

---

## Authority Hierarchy

**When sources conflict, follow this hierarchy:**

```
┌─────────────────────────────────────┐
│  PRIMARY Source (TT/VAS/MOF)        │  ← HIGHEST AUTHORITY
│  Official legal/regulatory text     │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  SECONDARY - Multiple Independent   │
│  3+ Big4 firms agree                │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  SECONDARY - Single Source          │
│  One Big4 or legal database         │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  TERTIARY - Implementation          │
│  ERP examples, blog posts           │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  INFERRED - No Direct Source        │  ← LOWEST AUTHORITY
│  Deduced from structure/practice    │
└─────────────────────────────────────┘
```

**Conflict Resolution:**
- PRIMARY contradicts SECONDARY → PRIMARY prevails
- SECONDARY contradicts TERTIARY → SECONDARY prevails
- Multiple SECONDARY conflict → Obtain PRIMARY source

---

## Production Readiness Rules

### Rule 1: INFERRED/AMBIGUOUS/UNRESOLVED Prohibition

**Invariant:**
> **INFERRED, AMBIGUOUS, or UNRESOLVED evidence MUST NOT become production accounting rules, schema invariants, or posting logic.**

**Rationale:**
- INFERRED = assumption, not fact
- AMBIGUOUS = conflicting, not settled
- UNRESOLVED = no evidence

**Enforcement:**
- Gate 2 checks evidence grade for all CRITICAL assertions
- Production schema requires PRIMARY + CONFIRMED or SECONDARY + CORROBORATED (3+ sources)
- Posting rules require PRIMARY + CONFIRMED

---

### Rule 2: SECONDARY Source Corroboration

**Requirement:**
> **SECONDARY sources require 3+ independent confirmations for production use without PRIMARY verification.**

**Why 3+:**
- Single source may be incorrect (A3-COR-001 example)
- Two sources may have common origin
- Three independent sources = reasonable confidence

**Independent = Different:**
- Crowe + EY + PwC = independent ✅
- Crowe + Crowe Vietnam blog = NOT independent ❌

---

### Rule 3: PRIMARY Source Priority

**Requirement:**
> **For CRITICAL semantic assertions, PRIMARY source verification required before production.**

**Critical Assertion = Affects:**
- Posting rules (debit/credit instructions)
- Account mapping
- Financial statement classification
- Recognition/measurement timing

**Non-Critical = May Use SECONDARY:**
- Presentation formatting
- Report layouts
- Edge case handling (if documented as provisional)

---

## Gate 2 Evidence Requirements

**Gate 2 Production Unlock Criteria:**

| Question Type | Evidence Required | Status Check |
|---------------|-------------------|--------------|
| **CRITICAL** (4 questions) | PRIMARY + CONFIRMED | Must be 4/4 verified |
| **AMBIGUOUS** (12 questions) | PRIMARY + CONFIRMED or SECONDARY + CORROBORATED (3+) | Must be ≥6/12 verified |
| **UNRESOLVED** (8 questions) | Any resolution documented | Must be ≥2/8 addressed |

**CONFLICTING Evidence:**
- Must be resolved (PRIMARY source settles)
- Cannot proceed to production with active conflicts

**Provisional Lock vs Final Lock:**
- **Provisional:** SECONDARY evidence acceptable for research/A.4 progress
- **Final:** PRIMARY verification required for production unlock

---

## Evidence Upgrading Paths

### Path 1: ASSUMED → CONFIRMED

```
ASSUMED (no evidence)
    ↓
Research: Find SECONDARY source
    ↓
SECONDARY + INFERRED
    ↓
Research: Find PRIMARY source
    ↓
PRIMARY + CONFIRMED ✅
```

---

### Path 2: INFERRED → CORROBORATED

```
INFERRED (single source)
    ↓
Research: Find 2+ independent SECONDARY sources
    ↓
SECONDARY + CORROBORATED (3+ sources)
    ↓
Legal review required
    ↓
Production (with caution) ⚠️
```

---

### Path 3: AMBIGUOUS → CONFIRMED

```
AMBIGUOUS (conflicting sources)
    ↓
Research: Obtain PRIMARY source
    ↓
PRIMARY settles conflict
    ↓
PRIMARY + CONFIRMED ✅
```

---

## Application to A.3 Verification Register

**Current Status (after A3-COR-001, C-004):**

| Category | Count | PRIMARY + CONFIRMED | SECONDARY + CORROBORATED | INFERRED | AMBIGUOUS | UNRESOLVED |
|----------|-------|---------------------|--------------------------|----------|-----------|------------|
| CRITICAL | 4 | 0 | 2 (C-001, C-002) | 1 (C-003) | 1 (C-004) | 0 |
| AMBIGUOUS | 12 | 0 | 0 | 0 | 0 | 12 |
| UNRESOLVED | 8 | 0 | 0 | 0 | 0 | 8 |
| **Total** | **24** | **0** | **2** | **1** | **1** | **20** |

**Production Ready:** 0/24 (0%)  
**Provisional Research Ready:** 2/24 (8%)  
**Needs Verification:** 22/24 (92%)

---

## Tracking Evidence Evolution

**For Each Assertion:**

```
Assertion ID: C-001
Claim: TK 331 debit balance = vendor prepayment
Business Event: Vendor prepayment recorded
Account: 331

Evidence History:
v0.1 (2026-08-15):
  Authority: SECONDARY (Crowe)
  Grade: ASSUMED
  Status: Provisional

v0.2 (2026-08-16):
  Authority: SECONDARY (Crowe + Grant Thornton + F5.6)
  Grade: CORROBORATED
  Status: Provisional (legal review required)

v1.0 (target: 2026-08-23):
  Authority: PRIMARY (TT133 Phụ lục 1)
  Grade: CONFIRMED
  Status: Production ready
```

---

## Prohibition Enforcement

**Where Enforced:**

1. **Verification Register:**
   - Each assertion tagged with Authority + Grade
   - Production eligibility calculated automatically

2. **Gate 2 Review:**
   - Checks CRITICAL assertions = PRIMARY + CONFIRMED
   - Checks AMBIGUOUS ≥50% verified
   - Blocks production if INFERRED/AMBIGUOUS/UNRESOLVED in critical paths

3. **Schema Design:**
   - Schema annotations require evidence citation
   - Cannot create production table based on INFERRED semantic

4. **Posting Rules:**
   - Each rule requires evidence grade
   - INFERRED/AMBIGUOUS → cannot generate posting instruction

5. **Audit Trail:**
   - Every transaction stores evidence grade at time of recording
   - Historical audit can verify evidence quality

---

## Exception Handling

**When PRIMARY Source Unavailable:**

**Option 1: Provisional Lock** ✅
- Use SECONDARY + CORROBORATED (3+ sources)
- Mark as PROVISIONAL
- Require legal counsel review before production
- Document PRIMARY verification pending

**Option 2: Block Production** ❌
- Wait for PRIMARY source
- Delays timeline
- High confidence but slow

**Recommendation:** Option 1 (Provisional Lock) with clear documentation

---

## Lessons from A3-COR-001

**What Went Wrong:**
1. ❌ SECONDARY source (Crowe) treated as CONFIRMED
2. ❌ No PRIMARY verification before v0.1
3. ❌ Single source accepted without corroboration

**What Went Right:**
1. ✅ Error detected during A.3 research (before production)
2. ✅ PRIMARY source (Thư Viện) contradicted SECONDARY
3. ✅ Conflict documented in C-004
4. ✅ Production blocked until resolved

**Prevention Mechanism:**
- Evidence taxonomy would have flagged: SECONDARY + INFERRED
- Gate 2 would have blocked: INFERRED → production prohibited
- A.3 provisional lock would have documented: PRIMARY verification pending

---

## Constitutional Status

**Proposed F5.6 Invariant:**

> **Evidence Taxonomy Invariant**
> 
> All semantic assertions in Finance OS research must be classified by Authority Level (PRIMARY/SECONDARY/TERTIARY) and Evidence Grade (CONFIRMED/CORROBORATED/INFERRED/AMBIGUOUS/UNRESOLVED).
> 
> Production accounting rules, schema invariants, and posting logic MUST NOT be based on INFERRED, AMBIGUOUS, or UNRESOLVED evidence.
> 
> CRITICAL semantic assertions require PRIMARY + CONFIRMED or SECONDARY + CORROBORATED (3+ independent sources) with legal counsel review.

**Enforcement:**
- A.3 Verification Register (semantic research)
- Gate 2 Review (architecture approval)
- Production Schema Design (schema annotations)
- Posting Rules Engine (rule validation)

---

## Summary

**2-Axis Model:**
- **Authority Level:** PRIMARY > SECONDARY > TERTIARY
- **Evidence Grade:** CONFIRMED > CORROBORATED > INFERRED > AMBIGUOUS > UNRESOLVED

**Production Rules:**
- ✅ PRIMARY + CONFIRMED → Production allowed
- ⚠️ SECONDARY + CORROBORATED (3+) → Production with legal review
- ❌ INFERRED / AMBIGUOUS / UNRESOLVED → Production prohibited

**Current A.3 Status:**
- 0/24 PRIMARY + CONFIRMED
- 2/24 SECONDARY + CORROBORATED
- 22/24 Need verification

**Gate 2 Criteria:**
- 4/4 CRITICAL verified (PRIMARY or SECONDARY 3+)
- ≥6/12 AMBIGUOUS verified
- ≥2/8 UNRESOLVED addressed
- 0 CONFLICTING unresolved

**Lesson:**
> "Research may infer. Architecture may provisionalize. Production may only rely on verified semantics."

---

**Document Status:** Evidence Taxonomy LOCKED (F5.6 Invariant)  
**Application:** All A.3 semantic assertions must be classified  
**Enforcement:** Verification Register (Task #6), Gate 2 Review  
**Next:** Apply taxonomy to Canonical Semantic Model (Task #5) ✅
