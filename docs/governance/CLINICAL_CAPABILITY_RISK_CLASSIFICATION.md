# Clinical Capability Risk Classification

**Version:** 1.0  
**Date:** 2026-08-07  
**Status:** Draft - Awaiting Approval  
**Purpose:** Machine-decidable tier assignment for Progressive Rollout Strategy  
**Applies To:** All Bella capabilities (Platform + Healthcare)

---

## Executive Summary

This document defines **how Bella determines which rollout policy applies to a capability**. It provides a quantitative risk scoring model that maps features to Tier 1 (v1.0 Generic), Tier 2 (v1.0 + Healthcare Gates), or Tier 3 (v1.1 Clinical Safety Profile).

**Key Principle:** Risk Score = Scale × Clinical Criticality × Blast Radius

**Decision Rule:**
- Risk Score 1-10 → Tier 1 (Generic platform deployment)
- Risk Score 11-30 → Tier 2 (Healthcare operational features)
- Risk Score 31-100 → Tier 3 (Clinical safety-critical, v1.1 MANDATORY)

---

## Risk Dimensions

### 1. Scale Factor (S)

Measures deployment breadth and user base impact.

| Level | Score | Definition | Examples |
|-------|-------|------------|----------|
| **Small** | 1 | Single tenant, <100 users | Beauty Spa booking, Cleaning service scheduler |
| **Medium** | 2 | Multiple tenants, <1,000 users | Multi-branch retail, Small clinic network |
| **Large** | 3 | Enterprise, <10,000 users | Hospital system, Large dental chain |
| **Platform** | 4 | Multi-enterprise, 10,000+ users | Bella Host Platform, Healthcare Kernel |

### 2. Clinical Criticality (C)

Measures impact on patient care and clinical decision-making.

| Level | Score | Definition | Clinical Impact | Examples |
|-------|-------|------------|-----------------|----------|
| **Low** | 1 | Administrative, no clinical impact | Scheduling error = inconvenience | Beauty spa booking, Retail POS |
| **Medium** | 2 | Clinical support, indirect patient care | Delay in non-urgent care | OPD scheduling, Dental appointment |
| **High** | 3 | Direct patient care, non-life-threatening | Treatment delay, discomfort | Ward management, Prescription refills |
| **Very High** | 4 | Life-threatening conditions | Delayed intervention = severe harm | ICU bed assignment, Lab critical values |
| **Critical** | 5 | Immediate life/death decisions | Error = immediate patient death risk | OR scheduling, Anesthesia records, Blood Bank, Emergency triage |

### 3. Blast Radius (B)

Measures cascade impact and failure domain size.

| Level | Score | Definition | Failure Impact | Examples |
|-------|-------|------------|----------------|----------|
| **Isolated** | 1 | Single module, no cascade | One feature breaks, others unaffected | Booking notes field, Receipt printing |
| **Cross-Department** | 2 | Multiple departments affected | Workflow disruption, manual workaround | Patient registration affecting OPD + Lab |
| **Cross-Engine** | 3 | Event cascade, multiple engines | Data inconsistency, reconciliation needed | Commission calculation affecting payroll |
| **Financial** | 3 | Billing, revenue, regulatory | Revenue loss, audit failure | Revenue recognition, Tax reporting |
| **Clinical State** | 4 | Patient record corruption | Incorrect clinical decisions | EHR data loss, Lab result mismatch |
| **Patient Safety** | 5 | Direct harm potential | Medication error, wrong-site surgery | Medication administration, Surgical safety checklist |

---

## Risk Score Calculation

**Formula:**

\\\
Risk Score = S × C × B

Where:
- S = Scale Factor (1-4)
- C = Clinical Criticality (1-5)
- B = Blast Radius (1-5)

Minimum: 1 × 1 × 1 = 1
Maximum: 4 × 5 × 5 = 100
\\\

---

## Safety Override Rules (CRITICAL)

**Problem:** The multiplicative formula can underestimate risk for high-criticality capabilities at small scale.

**Example Edge Case:**
- Small clinic (S=1)
- Medication Administration (C=5, critical)
- Patient Safety impact (B=5)
- **Calculated Score: 1×5×5 = 25 → Tier 2** ❌ **DANGEROUS!**

This capability can cause patient death but bypasses Tier 3 safety gates.

**Solution:** Hard override rules that force Tier 3 regardless of calculated score.

### Override Rules

```
Final_Tier = MAX(Calculated_Tier, Override_Tier)

Override Rules (ANY condition triggers Tier 3):
1. Clinical_Criticality = 5 (Critical) → Tier 3 MANDATORY
2. Blast_Radius = 5 (Patient Safety) → Tier 3 MANDATORY
3. Clinical_Criticality ≥ 4 AND Blast_Radius ≥ 4 → Tier 3 MANDATORY
4. High-Risk Domain (medication, anesthesia, blood_bank, surgery, critical_lab, emergency_triage) → Tier 3 MANDATORY
```

### Override Examples

| Capability | S | C | B | Calculated Score | Calculated Tier | Override Trigger | **Final Tier** |
|------------|---|---|---|------------------|-----------------|------------------|----------------|
| Small Clinic Medication | 1 | 5 | 5 | 25 | T2 | C=5, B=5 | **T3** ✅ |
| Single-Room ICU Monitor | 1 | 4 | 5 | 20 | T2 | C≥4, B≥4 | **T3** ✅ |
| Blood Bank (Small Hospital) | 2 | 5 | 5 | 50 | T3 | C=5, B=5 | **T3** ✅ (already T3) |
| Dental Appointment | 2 | 2 | 2 | 8 | T1 | None | **T1** (no override) |

### Rationale

**Patient safety cannot be compromised by deployment scale.** A medication administration module that serves 10 patients is as dangerous as one serving 10,000 patients when a single wrong dose can be fatal.

**Tier 3 safety gates are NOT optional for:**
- Medication (wrong drug, wrong dose)
- Anesthesia (airway management, drug interactions)
- Blood Bank (wrong blood type)
- Surgery (wrong site, retained instruments)
- Emergency (missed critical conditions)
- Critical Labs (missed life-threatening values)

---

## Tier Assignment Rules

| Risk Score Range | Tier | Rollout Policy | Safety Requirements |
|------------------|------|----------------|---------------------|
| **1-10** | **Tier 1** | Progressive Rollout v1.0 Generic | Standard platform deployment |
| **11-30** | **Tier 2** | v1.0 + Healthcare Operational Gates | Healthcare compliance checks |
| **31-100** | **Tier 3** | v1.1 Clinical Safety Profile | Shadow Mode + 5 P0 gates + Hypercare |

### Tier 1: Generic Platform (Risk Score 1-10)

**Applies To:** Non-clinical, low-risk features

**Rollout Policy:** Progressive Rollout v1.0 (standard)

**Requirements:**
- Feature flag control
- Staged rollout (10% → 25% → 50% → 100%)
- Standard monitoring (HTTP 200, latency, error rate)
- Rollback capability

**Examples:**
- Beauty Spa booking system
- Retail POS
- Real estate listing portal
- Cleaning service scheduler

### Tier 2: Healthcare Operational (Risk Score 11-30)

**Applies To:** Healthcare features with operational impact but no immediate patient safety risk

**Rollout Policy:** v1.0 + Healthcare Operational Gates

**Additional Requirements:**
- Tenant isolation validation
- PHI/PII protection checks
- Billing integrity validation
- Compliance audit trail

**Examples:**
- Hospital OPD scheduling
- Dental clinic patient registration
- Medical imaging report delivery
- Healthcare billing system

### Tier 3: Clinical Safety-Critical (Risk Score 31-100)

**Applies To:** Features where software error = patient safety risk

**Rollout Policy:** Progressive Rollout v1.1 Clinical Safety Profile (MANDATORY)

**Additional Requirements:**
- Shadow Mode (7-14 days)
- 5 Clinical Safety Gates (P0):
  - Medication Event Loss = 0
  - Vital Sign Event Loss = 0
  - Patient Identity Mismatch = 0
  - Cross-Tenant Leakage = 0
  - Critical Event DLQ = 0
- Department-level granularity
- Controlled high-risk pilot
- Automated P0 rollback triggers
- Mandatory hypercare period (7 days)
- 30-day stability validation

**Examples:**
- Perioperative Care Platform (OR, Anesthesia, PACU)
- ICU monitoring
- Emergency Department triage
- Medication Administration
- Blood Bank inventory
- Critical lab results

---

## Risk Classification Examples

### Example 1: Beauty Spa Booking System

**Assessment:**
- Scale: Small (1) - Single tenant, <100 users
- Clinical Criticality: Low (1) - No clinical impact
- Blast Radius: Isolated (1) - Booking module only

**Risk Score:** 1 × 1 × 1 = **1**

**Tier Assignment:** **Tier 1** (Generic Platform)

**Rollout Policy:** Progressive Rollout v1.0

---

### Example 2: Hospital OPD Scheduling

**Assessment:**
- Scale: Large (3) - Hospital enterprise, <10k users
- Clinical Criticality: Medium (2) - Indirect patient care, non-urgent
- Blast Radius: Cross-Department (2) - OPD + Registration + Billing

**Risk Score:** 3 × 2 × 2 = **12**

**Tier Assignment:** **Tier 2** (Healthcare Operational)

**Rollout Policy:** v1.0 + Healthcare Gates

**Additional Checks:**
- Tenant isolation ✅
- PHI protection ✅
- Billing integrity ✅

---

### Example 3: Perioperative Care Platform

**Assessment:**
- Scale: Platform (4) - Multi-hospital, 10k+ users
- Clinical Criticality: Critical (5) - OR, Anesthesia = immediate life/death
- Blast Radius: Patient Safety (5) - Surgical error = direct harm

**Risk Score:** 4 × 5 × 5 = **100**

**Tier Assignment:** **Tier 3** (Clinical Safety-Critical)

**Rollout Policy:** Progressive Rollout v1.1 Clinical Safety (MANDATORY)

**v1.1 Requirements:**
- ✅ Shadow Mode (14 days minimum)
- ✅ 5 Clinical Safety Gates (P0)
- ✅ Department-level granularity (enable OPD but exclude OR initially)
- ✅ Controlled OR pilot (1-2 rooms)
- ✅ Automated rollback on P0 violations
- ✅ 7-day hypercare
- ✅ 30-day stability

---

### Example 4: Medication Administration Module

**Assessment:**
- Scale: Large (3) - Hospital enterprise
- Clinical Criticality: Critical (5) - Medication error = patient death
- Blast Radius: Patient Safety (5) - Wrong drug/dose = immediate harm

**Risk Score:** 3 × 5 × 5 = **75**

**Tier Assignment:** **Tier 3** (Clinical Safety-Critical)

**Rollout Policy:** v1.1 MANDATORY

---

### Example 5: ICU Vital Signs Monitoring

**Assessment:**
- Scale: Large (3) - Hospital ICU department
- Clinical Criticality: Very High (4) - Life-threatening condition monitoring
- Blast Radius: Patient Safety (5) - Missed alert = death

**Risk Score:** 3 × 4 × 5 = **60**

**Tier Assignment:** **Tier 3** (Clinical Safety-Critical)

**Rollout Policy:** v1.1 MANDATORY

---

### Example 6: Dental Clinic Patient Registration

**Assessment:**
- Scale: Medium (2) - Multi-branch dental clinic
- Clinical Criticality: Medium (2) - Clinical support, non-urgent
- Blast Radius: Cross-Department (2) - Registration + OPD + Billing

**Risk Score:** 2 × 2 × 2 = **8**

**Tier Assignment:** **Tier 1** (Generic Platform)

**Rollout Policy:** v1.0 standard

**Note:** Even though healthcare context, no immediate patient safety risk.

---

### Example 7: Blood Bank Inventory Management

**Assessment:**
- Scale: Large (3) - Hospital blood bank
- Clinical Criticality: Critical (5) - Wrong blood type = patient death
- Blast Radius: Patient Safety (5) - Transfusion error = immediate harm

**Risk Score:** 3 × 5 × 5 = **75**

**Tier Assignment:** **Tier 3** (Clinical Safety-Critical)

**Rollout Policy:** v1.1 MANDATORY

---

### Example 8: Emergency Department Triage

**Assessment:**
- Scale: Large (3) - Hospital ED
- Clinical Criticality: Critical (5) - Life-threatening triage decisions
- Blast Radius: Patient Safety (5) - Delayed care = death

**Risk Score:** 3 × 5 × 5 = **75**

**Tier Assignment:** **Tier 3** (Clinical Safety-Critical)

**Rollout Policy:** v1.1 MANDATORY

---

## Decision Workflow

\\\mermaid
graph TD
    A[New Capability] --> B{Calculate Risk Score}
    B --> C{S × C × B}
    C --> D{Risk Score?}
    
    D -->|1-10| E[Tier 1: Generic Platform]
    D -->|11-30| F[Tier 2: Healthcare Operational]
    D -->|31-100| G[Tier 3: Clinical Safety-Critical]
    
    E --> H[Use v1.0 Progressive Rollout]
    F --> I[Use v1.0 + Healthcare Gates]
    G --> J[Use v1.1 Clinical Safety Profile]
    
    J --> K{Shadow Mode Pass?}
    K -->|No| L[Fix Issues, Retry]
    K -->|Yes| M{5 Clinical Gates Pass?}
    M -->|No| L
    M -->|Yes| N[Stage 1: 10% Rollout]
    
    L --> K
\\\

---

## Governance Process

### 1. Risk Assessment (Pre-Development)

**Who:** Product Owner + Engineering Lead + Clinical Safety Officer (if Tier 3)

**When:** Epic/Feature kickoff

**Artifacts:**
- Risk Classification Form (S, C, B scores)
- Tier assignment justification
- Rollout policy selection

### 2. Tier Validation (Pre-Deployment)

**Who:** Engineering Lead + DevOps Lead + Clinical Safety Officer (if Tier 3)

**When:** Before Stage 1 deployment

**Validation:**
- Confirm risk classification remains valid
- Verify rollout policy implementation
- Check safety gate readiness (Tier 3 only)

### 3. Tier Escalation Trigger

**Automatic Tier escalation if:**
- Patient safety incident reported → Escalate to Tier 3
- PHI breach detected → Escalate to Tier 2 minimum
- Cross-tenant data leakage → Escalate to Tier 2 minimum
- Financial regulatory violation → Escalate to Tier 2 minimum

### 4. Tier Override (Exceptional Cases)

**Tier downgrade NOT ALLOWED** if:
- Clinical Criticality = Very High (4) or Critical (5)
- Blast Radius = Patient Safety (5)
- Any P0 clinical safety gate applies

**Tier upgrade ALLOWED** if:
- Product Owner + CTO + Clinical Safety Officer unanimous approval
- Documented justification
- Audit trail

---

## Risk Classification Form Template

\\\markdown
# Risk Classification: [Capability Name]

**Date:** YYYY-MM-DD  
**Assessor:** [Name, Role]  
**Reviewers:** [Names]

## Risk Dimensions

| Dimension | Level | Score | Justification |
|-----------|-------|-------|---------------|
| Scale | [Small/Medium/Large/Platform] | [1-4] | [Why?] |
| Clinical Criticality | [Low/Medium/High/Very High/Critical] | [1-5] | [Patient impact?] |
| Blast Radius | [Isolated/Cross-Dept/Cross-Engine/Financial/Clinical/Patient Safety] | [1-5] | [Failure cascade?] |

## Calculation

**Risk Score:** S × C × B = \_\_\_ × \_\_\_ × \_\_\_ = **\_\_\_**

## Tier Assignment

**Tier:** [1 / 2 / 3]

**Rollout Policy:** [v1.0 / v1.0 + Healthcare Gates / v1.1 Clinical Safety]

## Approval

- [ ] Product Owner: \_\_\_\_\_\_\_\_\_\_\_\_
- [ ] Engineering Lead: \_\_\_\_\_\_\_\_\_\_\_\_
- [ ] Clinical Safety Officer (Tier 3 only): \_\_\_\_\_\_\_\_\_\_\_\_
- [ ] CTO (Tier 3 only): \_\_\_\_\_\_\_\_\_\_\_\_

**Date Approved:** \_\_\_\_\_\_\_\_\_\_
\\\

---

## Relationship to Progressive Rollout Strategies

\\\
Clinical Capability Risk Classification (This Document)
                    ↓
            Risk Score Calculation
                    ↓
              Tier Assignment
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
Progressive Rollout v1.0    Progressive Rollout v1.1
  (Tier 1 + Tier 2)          (Tier 3 Clinical Safety)
\\\

**This document is the ENTRY POINT** - it determines which rollout strategy applies.

---

## References

- [Progressive Rollout Strategy v1.0](../deployment/PROGRESSIVE_ROLLOUT_STRATEGY.md) - Canonical framework (Tier 1 + Tier 2)
- [Progressive Rollout Strategy v1.1 Clinical Safety](../deployment/PROGRESSIVE_ROLLOUT_STRATEGY_v1.1_CLINICAL_SAFETY.md) - Tier 3 mandatory overlay
- [Perioperative Platform Design](../modules/PERIOPERATIVE_PLATFORM_DESIGN.md) - First Tier 3 implementation

---

## Approval Status

**Status:** Draft - Awaiting Approval

**Required Approvals:**
- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Clinical Safety Officer
- [ ] DevOps Lead
- [ ] CTO

**Date Approved:** \_\_\_\_\_\_\_\_\_\_\_\_

---

**Document Control:**
- Version: 1.0
- Last Updated: 2026-08-07
- Next Review: 2026-09-07 (30 days)
- Owner: Engineering Lead + Clinical Safety Officer
