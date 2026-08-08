# Healthcare Capability Risk Matrix v1.0

**Version:** 1.0  
**Date:** 2026-08-08  
**Status:** Frozen  
**Owner:** Engineering Lead + Clinical Safety Officer  
**Scope:** Bella Healthcare Platform / Healthcare OS  
**Purpose:** Official human-governance source for healthcare capability risk classification

---

## 1. Purpose

This document defines the official risk classification of Bella Healthcare capabilities.

The matrix is the **Governance Source of Truth** for determining:

- Risk dimensions
- Calculated Risk Score
- Calculated Tier
- Safety Override
- Final Tier
- Applicable Rollout Policy
- Required Safety Profile
- Governance Status

The resulting classification is later transformed into the machine-readable:

`Capability Risk Registry`

The Registry MUST NOT independently redefine risk classification.

---

# 2. Governance Principles

## 2.1 Matrix is the Source of Truth

The authoritative sequence is:

Human Governance
↓
Healthcare Capability Risk Matrix
↓
Approval
↓
Freeze
↓
Machine Registry
↓
Policy Enforcement

The database Registry is a derived representation of this Matrix.

---

## 2.2 Tier Is Derived

Final Tier MUST be derived from:

```text
Calculated Tier
    +
Safety Override Rules
    =
Final Tier

Calculated Risk Score:

Risk Score = S × C × B

Where:

S = Scale Factor
C = Clinical Criticality
B = Blast Radius
```

## 2.3 Safety Override Has Priority

A high-risk clinical capability MUST NOT receive a lower Tier simply because deployment scale is small.

Therefore:

Final Tier = MAX(Calculated Tier, Override Tier)

Any applicable Safety Override forces the minimum required Tier.

## 2.4 No Runtime Authority Principle

Runtime systems may consume risk classification but MUST NOT become authoritative sources of risk classification.

In other words:
- Feature Flags MUST NOT decide the Tier.
- Policy Engines MUST NOT change the Tier.
- Database Registries MUST NOT edit their own Tier.
- Developers MUST NOT override the Tier in any configuration or database directly.
- The Deployment pipeline MUST NOT downgrade the Tier.
- Runtime configuration MUST NOT bypass the clinical safety profile.

Only a frozen Governance Matrix revision (`Revision -> Approval -> Freeze -> Registry Regeneration`) has the authority to change the classification of a capability.

---

# 3. Risk Classification Reference

## 3.1 Scale Factor
| Level | Score | Definition |
| :--- | :--- | :--- |
| Small | 1 | Single tenant, <100 users |
| Medium | 2 | Multiple tenants, <1,000 users |
| Large | 3 | Enterprise, <10,000 users |
| Platform | 4 | Multi-enterprise, 10,000+ users |

## 3.2 Clinical Criticality
| Level | Score | Definition |
| :--- | :--- | :--- |
| Low | 1 | Administrative, no clinical impact |
| Medium | 2 | Clinical support, indirect patient care |
| High | 3 | Direct patient care, non-life-threatening |
| Very High | 4 | Life-threatening conditions |
| Critical | 5 | Immediate life/death decisions |

## 3.3 Blast Radius
| Level | Score | Definition |
| :--- | :--- | :--- |
| Isolated | 1 | Single module, no cascade |
| Cross-Department | 2 | Multiple departments affected |
| Cross-Engine | 3 | Multiple engines / event cascade |
| Financial | 3 | Billing, revenue, regulatory impact |
| Clinical State | 4 | Patient record corruption |
| Patient Safety | 5 | Direct patient harm potential |

---

# 4. Tier Rules
| Risk Score | Calculated Tier | Rollout Policy |
| :--- | :--- | :--- |
| 1-10 | Tier 1 | Progressive Rollout v1.0 |
| 11-30 | Tier 2 | v1.0 + Healthcare Operational Gates |
| 31-100 | Tier 3 | v1.1 Clinical Safety Profile |

---

# 5. Mandatory Safety Overrides

Any of the following conditions MUST force Tier 3:

- Clinical Criticality = 5
- Blast Radius = 5
- Clinical Criticality >= 4 AND Blast Radius >= 4
- Capability belongs to a designated high-risk clinical domain
- Patient Identity Safety Override (Applies to critical patient merge & identity resolution workflows)

High-risk domains include:

- Medication
- Anesthesia
- Blood Bank
- Surgery / Perioperative
- Critical Laboratory
- Emergency Triage
- ICU Monitoring

Therefore:

Final Tier = MAX(Calculated Tier, Override Tier)

Tier downgrade is prohibited when a mandatory safety override applies.

---

# 6. Safety Profiles
| Profile | Tier | Description |
| :--- | :--- | :--- |
| Generic | T1 | Standard platform deployment |
| Healthcare Operational | T2 | Healthcare operational controls |
| Clinical Safety | T3 | Clinical safety-critical controls |

---

# 7. Capability Inventory

## Domain Group A — Core / Patient
| ID | Capability | Domain | S | C | B | Calc Score | Calc Tier | Override | Final Tier | Policy | Safety Profile | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| HC-001 | Patient Registration | Core | 2 | 2 | 2 | 8 | T1 | None | T1 | v1.0 | Generic | Approved | Administrative entry point |
| HC-002 | Patient Identity & Demographics | Core | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Identity data |
| HC-003 | Patient Merge / Identity Resolution | Core | 3 | 3 | 4 | 36 | T3 | Patient Identity Safety | T3 | v1.1 | Clinical Safety | Approved | Wrong identity can affect care |
| HC-004 | Encounter Management | Core | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Encounter lifecycle |
| HC-005 | Consent Management | Core | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Consent workflow |
| HC-006 | Emergency Contact Management | Core | 2 | 2 | 2 | 8 | T1 | None | T1 | v1.0 | Generic | Approved | Administrative support |

*\* Override designation confirmed during governance review on 2026-08-08.*

---

## 8. Domain Group B — Clinical Operations
| ID | Capability | Domain | S | C | B | Calc Score | Calc Tier | Override | Final Tier | Policy | Safety Profile | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| HC-007 | OPD Scheduling | Clinical Ops | 3 | 2 | 2 | 12 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Non-urgent outpatient |
| HC-008 | Queue / Calling | Clinical Ops | 3 | 2 | 2 | 12 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Patient flow |
| HC-009 | Doctor Consultation Workflow | Clinical Ops | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Clinical workflow |
| HC-010 | Ward Management | Clinical Ops | 3 | 3 | 2 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Inpatient operations |
| HC-011 | Bed Management | Clinical Ops | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Bed allocation |
| HC-012 | Nursing Workflow | Clinical Ops | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Nursing execution |
| HC-013 | Discharge Management | Clinical Ops | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Discharge workflow |
| HC-014 | Referral / Transfer | Clinical Ops | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Care transition |

---

## 9. Domain Group C — Clinical Safety-Critical
| ID | Capability | Domain | S | C | B | Calc Score | Calc Tier | Override | Final Tier | Policy | Safety Profile | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| HC-015 | Emergency Triage | Safety-Critical | 3 | 5 | 5 | 75 | T3 | C=5+B=5 | T3 | v1.1 | Clinical Safety | Approved | Life/death decisions |
| HC-016 | ICU Monitoring | Safety-Critical | 3 | 4 | 5 | 60 | T3 | C≥4+B≥4 | T3 | v1.1 | Clinical Safety | Approved | Missed alert = severe harm |
| HC-017 | Medication Ordering | Safety-Critical | 3 | 5 | 5 | 75 | T3 | C=5+B=5 | T3 | v1.1 | Clinical Safety | Approved | Wrong drug/dose |
| HC-018 | Medication Administration | Safety-Critical | 3 | 5 | 5 | 75 | T3 | C=5+B=5 | T3 | v1.1 | Clinical Safety | Approved | Direct patient safety |
| HC-019 | Anesthesia Records | Safety-Critical | 3 | 5 | 5 | 75 | T3 | C=5+B=5 | T3 | v1.1 | Clinical Safety | Approved | Airway / anesthesia |
| HC-020 | Perioperative Platform | Safety-Critical | 4 | 5 | 5 | 100 | T3 | C=5+B=5 | T3 | v1.1 | Clinical Safety | Approved | Highest-risk capability |
| HC-021 | Surgical Safety Workflow | Safety-Critical | 3 | 5 | 5 | 75 | T3 | C=5+B=5 | T3 | v1.1 | Clinical Safety | Approved | Wrong-site / surgical safety |
| HC-022 | Blood Bank Management | Safety-Critical | 3 | 5 | 5 | 75 | T3 | C=5+B=5 | T3 | v1.1 | Clinical Safety | Approved | Wrong blood type |
| HC-023 | Critical Lab Alerting | Safety-Critical | 3 | 4 | 5 | 60 | T3 | C≥4+B≥4 | T3 | v1.1 | Clinical Safety | Approved | Missed critical values |
| HC-024 | Clinical Critical Alerts | Safety-Critical | 3 | 4 | 5 | 60 | T3 | C≥4+B≥4 | T3 | v1.1 | Clinical Safety | Approved | Safety alert delivery |

---

## 10. Domain Group D — Diagnostics / Pharmacy
| ID | Capability | Domain | S | C | B | Calc Score | Calc Tier | Override | Final Tier | Policy | Safety Profile | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| HC-025 | Laboratory Orders | Diagnostics | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Diagnostic workflow |
| HC-026 | Laboratory Results | Diagnostics | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Result integrity |
| HC-027 | Critical Laboratory Results | Diagnostics | 3 | 4 | 5 | 60 | T3 | C≥4+B≥4 | T3 | v1.1 | Clinical Safety | Approved | Life-threatening values |
| HC-028 | Imaging Orders | Diagnostics | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Imaging workflow |
| HC-029 | Imaging Results | Diagnostics | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Diagnostic result integrity |
| HC-030 | Pharmacy Management | Pharmacy | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Pharmacy operations |
| HC-031 | Prescription Management | Pharmacy | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Prescription lifecycle |
| HC-032 | Drug Dispensing | Pharmacy | 3 | 4 | 4 | 48 | T3 | C≥4+B≥4 | T3 | v1.1 | Clinical Safety | Approved | Dispensing safety |
| HC-033 | Drug Inventory | Pharmacy | 3 | 3 | 3 | 27 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Inventory control |

---

## 11. Domain Group E — Clinical Records / Supporting
| ID | Capability | Domain | S | C | B | Calc Score | Calc Tier | Override | Final Tier | Policy | Safety Profile | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| HC-034 | Medical Records | Clinical Records | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Clinical record integrity |
| HC-035 | Clinical Documentation | Clinical Records | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Clinical documentation |
| HC-036 | Vital Signs | Clinical Records | 3 | 4 | 5 | 60 | T3 | C≥4+B≥4 | T3 | v1.1 | Clinical Safety | Approved | Patient monitoring |
| HC-037 | Allergy Management | Clinical Records | 3 | 4 | 5 | 60 | T3 | C≥4+B≥4 | T3 | v1.1 | Clinical Safety | Approved | Allergy information |
| HC-038 | Diagnosis Management | Clinical Records | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Clinical decision support input |
| HC-039 | Procedure / Treatment Records | Clinical Records | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Treatment history |
| HC-040 | Care Plan | Clinical Records | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Care coordination |
| HC-041 | Clinical History | Clinical Records | 3 | 3 | 4 | 36 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Longitudinal clinical data |

---

## 12. Domain Group F — Administrative / Enterprise Healthcare
| ID | Capability | Domain | S | C | B | Calc Score | Calc Tier | Override | Final Tier | Policy | Safety Profile | Status | Notes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :--- | :--- | :--- |
| HC-042 | Healthcare Billing | Administrative | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Financial integrity |
| HC-043 | Insurance Management | Administrative | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Insurance workflow |
| HC-044 | Claims Management | Administrative | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Claims |
| HC-045 | Pricing Management | Administrative | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Healthcare pricing |
| HC-046 | Revenue Management | Administrative | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Revenue lifecycle |
| HC-047 | Healthcare Inventory | Administrative | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Enterprise inventory |
| HC-048 | Procurement | Administrative | 3 | 1 | 3 | 9 | T1 | None | T1 | v1.0 | Generic | Approved | Procurement operations |
| HC-049 | Healthcare HR | Administrative | 3 | 1 | 3 | 9 | T1 | None | T1 | v1.0 | Generic | Approved | Workforce administration |
| HC-050 | Compliance / Audit | Administrative | 4 | 2 | 4 | 32 | T3 | None | T3 | v1.1 | Clinical Safety | Approved | Cross-system audit integrity |
| HC-051 | Healthcare Reporting | Administrative | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Operational reporting |
| HC-052 | Medical Statistics | Administrative | 3 | 2 | 3 | 18 | T2 | None | T2 | v1.0+HC | Healthcare Operational | Approved | Aggregate analytics |

*\* Governance classification confirmed during review. All 52 capabilities approved on 2026-08-08.*

---

## 13. Special Governance Notes

### 13.1 Domain Does Not Determine Tier

A capability's healthcare domain does not automatically determine its Tier.

Example:

Laboratory
├── Laboratory Orders          → T2
├── Laboratory Results         → T3
└── Critical Laboratory Result → T3

Likewise:

Pharmacy
├── Drug Inventory             → T2
├── Prescription Management    → T2
└── Drug Dispensing            → T3

### 13.2 Capability Boundary Is Critical

Risk assessment applies to a specific capability boundary, not merely a product or module.

For example:

Bella Medical
    └── Laboratory
         ├── Order
         ├── Specimen
         ├── Result
         └── Critical Result Notification

Each capability MUST be independently assessed when its failure mode differs.

---

## 14. Tier 1 Requirements

Tier 1 capabilities require:

- Feature flag control
- Progressive rollout
- Standard observability
- Error-rate monitoring
- Latency monitoring
- Rollback capability

Standard rollout:

`10% → 25% → 50% → 100%`

---

## 15. Tier 2 Requirements

Tier 2 capabilities require all Tier 1 controls plus:

- Tenant isolation validation
- PHI / PII protection
- Healthcare audit trail
- Billing integrity where applicable
- Healthcare workflow validation
- Operational rollback verification

---

## 16. Tier 3 Requirements

Tier 3 capabilities require:

- Clinical Safety Profile v1.1
- Shadow Mode
- Minimum 7-14 day shadow period according to capability policy
- Clinical Safety Gates
- Department-level rollout
- Controlled high-risk pilot
- Automated P0 rollback
- Hypercare
- Stability validation

Mandatory P0 gates:

- Medication Event Loss = 0
- Vital Sign Event Loss = 0
- Patient Identity Mismatch = 0
- Cross-Tenant Leakage = 0
- Critical Event DLQ = 0

---

## 17. Governance Lifecycle

Every capability follows:

```text
DRAFT
  ↓
REVIEWED
  ↓
APPROVED
  ↓
FROZEN
```

### DRAFT
Initial engineering/product assessment.

### REVIEWED
Risk dimensions reviewed by relevant technical and clinical stakeholders.

### APPROVED
Required governance approvals obtained.

### FROZEN
Classification becomes authoritative for machine Registry generation.

---

## 18. Approval Requirements

### Tier 1
Required:
- Product Owner
- Engineering Lead

### Tier 2
Required:
- Product Owner
- Engineering Lead
- DevOps Lead

### Tier 3
Required:
- Product Owner
- Engineering Lead
- DevOps Lead
- Clinical Safety Officer
- CTO

---

## 19. Registry Generation Rule & Pipeline

After this Matrix reaches the `FROZEN` status, the Capability Risk Registry is generated through an automated, one-way generator pipeline.

```text
Frozen Matrix (Source)
       ↓
Parse Document
       ↓
Calculate S × C × B
       ↓
Apply Safety Overrides
       ↓
Validate Final Tier
       ↓
Integrity Check (Hash matches approved Matrix)
       ↓
Persist to Capability Risk Registry
```

The generator MUST extract the following fields for each capability:
- `Capability ID`
- `Capability Name`
- `Domain`
- `S`, `C`, `B`
- `Risk Score`
- `Calculated Tier`
- `Override`
- `Final Tier`
- `Rollout Policy`
- `Safety Profile`
- `Governance Status`

### 19.1 Registry Provenance & Validation Metadata
To ensure strict security and prevent configuration drift, the generated Registry MUST store the following metadata:
- `source_document`: Path to this Matrix file.
- `source_version`: Semantic version of this Matrix (e.g., `v1.0`).
- `source_capability_id`: The ID of the capability (e.g., `HC-001`).
- `generated_at`: ISO timestamp of generation.
- `generated_from_hash`: SHA-256 hash of this frozen Matrix document.
- `matrix_signature`: Digital Signature of the Matrix SHA-256 hash to prove authenticity.
- `approved_by`: A record of the human governance authority that approved the matrix.
- `approved_at`: ISO timestamp of the human governance approval.
- `registry_version`: Version of the registry schema.
- `generator_version`: Semantic version of the Registry Generator tool (e.g., `v1.0.0`).

### 19.2 Registry Build Artifact Flow

```text
Matrix v1.0
      │
      ├── SHA-256 (Integrity)
      ├── Digital Signature (Authenticity)
      │
      ▼
Registry Build Artifact
      │
      ├── matrix_version = 1.0
      ├── matrix_hash = ...
      ├── matrix_signature = ...
      ├── approved_by = ...
      ├── approved_at = ...
      ├── generated_at = ...
      ├── generator_version = ...
      │
      ▼
Registry DB
      │
      ▼
Policy Engine (Verify Provenance)
```

At runtime, the Policy Engine MUST verify that the database registry matches the approved document version, generator version, and hash/signature. Any mismatch (e.g., `sourceHash != approvedMatrixHash` or signature validation failure) MUST be flagged as **Governance Drift**, causing the Policy Engine to block deployment immediately.

---

## 20. Registry Integrity & Immutability Rules

The following path is strictly prohibited and blocked:

`Developer → Direct database modification → Tier downgrade = Governance Violation`

The only valid classification path is:

`Governance Matrix → Approval → Freeze → Registry Generator Pipeline → Registry DB`

Any Registry value in the database that is inconsistent with the frozen Matrix, or fails hash/signature verification, is considered a governance violation. The Policy Engine MUST reject the configuration and block deployment of the associated capability.

### 20.1 Deployment Invariants (No Registry, No Deployment)

To ensure strict compliance at runtime, the Policy Engine MUST enforce the following invariants:
- **No Classification, No Deployment:** Any capability without a valid Registry entry MUST be blocked from deployment (`Capability without valid Registry entry → DEPLOYMENT BLOCKED`).
- **Provenance Integrity:** Any capability with an invalid or missing hash/signature in the Registry database MUST be blocked (`Capability with invalid provenance → DEPLOYMENT BLOCKED`).
- **Safety Profile Enforcement:** Any capability with a missing or undefined Safety Profile MUST be blocked (`Capability with missing Safety Profile → DEPLOYMENT BLOCKED`).
- **Tier Invariant Verification:** Any capability where the runtime feature flag configuration or deployment pipeline configuration has a tier mismatch against the registry final tier MUST be blocked (`Capability with Tier mismatch → DEPLOYMENT BLOCKED`).

### 20.2 Policy Engine Validation Invariant

The Policy Engine MUST validate and enforce the approved classification from the Registry, but **MUST NOT reinterpret, recalculate, or define its own rules**. 

Specifically:
- The Policy Engine MUST NOT autonomously calculate Tiers using logic like `C >= 4` or by checking domain groups directly.
- All tier classifications and override logic MUST be defined strictly within the frozen Matrix and derived registry schema.
- This prevents the accumulation of decoupled rules in runtime logic (`Governance Rule != Registry Rule != Runtime Rule`), ensuring the Registry remains the absolute source of truth.

### 20.3 Registry Immutability Principle

The Capability Risk Registry is a derived, immutable governance artifact.

- Runtime services MAY read the Registry.
- Runtime services MUST NOT mutate risk classification fields.
- Database access control lists (ACLs) and database permission layers MUST enforce read-only access to the Registry table for all application roles.

Any change to:
- S
- C
- B
- Risk Score
- Calculated Tier
- Override
- Final Tier
- Safety Profile
- Rollout Policy

MUST originate from a new approved Matrix revision. Registry regeneration through the official Generator Pipeline is the only authorized mechanism for updating classification fields. Direct SQL `UPDATE` operations on the Registry tables are strictly prohibited.

---

## 21. Change Management

Any change to:

- S
- C
- B
- Override
- Final Tier
- Rollout Policy
- Safety Profile

requires a new Matrix revision.

Example:

`v1.0 → Risk reassessment → v1.1 → Review → Approval → Freeze → Registry regeneration`

Direct modification of the production Registry without corresponding Matrix revision is prohibited.

---

## 22. Risk Escalation

Automatic reassessment is required when:

- Patient safety incident occurs
- PHI breach occurs
- Cross-tenant leakage occurs
- Critical event loss occurs
- Clinical workflow changes materially
- Capability scope expands
- New clinical decision-making functionality is introduced
- Capability becomes integrated with a higher-risk clinical workflow

A capability may only move toward a stricter safety profile automatically.

Downgrade requires formal governance reassessment.

---

## 23. Current Risk Distribution

Initial Matrix contains:

- 52 healthcare capabilities
- 6 domain groups
- Tier 1 capabilities
- Tier 2 healthcare operational capabilities
- Tier 3 clinical safety capabilities

v1.0 defines the currently known and governed capability inventory. New capabilities require risk assessment before entering the Registry.

---

## 24. Perioperative Priority

The following capability is designated as the first Tier 3 implementation candidate:

```text
ID: HC-020
Capability: Perioperative Platform
S = 4
C = 5
B = 5
Risk Score = 100
Final Tier = T3
Policy = v1.1 Clinical Safety
```

This capability becomes the candidate for:

```text
Official Risk Assessment
        ↓
Governance Approval
        ↓
Registry Entry
        ↓
Policy Validation
        ↓
Shadow Mode
        ↓
Controlled Pilot
        ↓
Progressive Production
```

---

## 25. Governance Approval

### Matrix Approval
- Product Owner: **Approved** (Review completed)
- Engineering Lead: **Approved** (Review completed)
- DevOps Lead: **Approved** (Review completed)
- Clinical Safety Officer: **Approved** (Clinical Safety review completed)
- CTO: **Approved** (Final Architecture approval)

Approval Date: **2026-08-08**

Approved Version: **1.0**

Freeze Date: **2026-08-08**

---

## 26. Document Control
| Field | Value |
| :--- | :--- |
| Document | Healthcare Capability Risk Matrix |
| Version | 1.0 |
| Status | FROZEN |
| Created | 2026-08-08 |
| Owner | Engineering Lead + Clinical Safety Officer |
| Review Cycle | 30 days |
| Next Review | 2026-09-07 |
| Source of Truth | YES |
| Registry Source | YES |
| Runtime Editable | NO |

---

## 27. Architectural Position

This document is the authoritative governance layer of the Bella Healthcare OS. The architecture enforces a strict 4-layer Governance Plane hierarchy, running in parallel with the Healthcare Kernel:

```text
┌───────────────────────────────────────────┐
│  HUMAN GOVERNANCE                         │
│                                           │
│  Healthcare Capability Risk Matrix        │
│  Approval / Review / Freeze               │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│  GOVERNANCE ARTIFACT                      │
│                                           │
│  Capability Risk Registry                 │
│  Hash / Signature / Provenance            │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│  POLICY ENFORCEMENT                       │
│                                           │
│  Deployment Policy Engine                 │
│  Safety Profile                           │
│  Rollout Gates                            │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│  RUNTIME                                  │
│                                           │
│  Feature Flags                            │
│  Progressive Rollout                      │
│  Shadow Mode                              │
│  Clinical Safety Enforcement              │
└───────────────────────────────────────────┘
```

The data flow is strictly unidirectional down the plane. No runtime component, deployment tool, or developer may bypass or write back up the governance chain:

`Runtime ✕ Policy Engine ✕ Registry ✕ Governance Matrix`

The Healthcare Capability Risk Matrix is the human-approved source of truth.

The Capability Risk Registry is a machine-derived representation.

The Policy Engine enforces the approved classification.

Runtime systems MUST NOT bypass the governance chain.
