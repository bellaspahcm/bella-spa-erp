# Progressive Rollout Strategy v1.1 - Clinical Safety

**Version:** 1.1 (Clinical Safety Edition)  
**Date:** 2026-08-07  
**Status:** Draft - Awaiting Approval  
**Previous Version:** v1.0 (Generic Platform Rollout)  
**Applies To:** Phase B1 Perioperative Care Platform and all future clinical-risk capabilities

---

## Executive Summary

**v1.0 → v1.1 Upgrade Rationale:**

v1.0 Progressive Rollout Strategy (Phase A) đạt ~75-80% production-ready cho generic platform features nhưng **không đủ an toàn cho clinical workflows** như Perioperative Care, ICU monitoring, Medication Administration, hay Emergency Department.

v1.1 nâng cấp với **20 critical improvements** để đạt **90%+ clinical safety** trước khi rollout high-risk healthcare capabilities.

**Key Changes:**
1. 🔴 **Clinical Safety Gates** (P0) - Event loss = 0, Patient safety incidents = 0
2. 🔴 **Shadow Mode** (P0) - 7-day validation before Stage 1
3. 🔴 **Department-Level Granularity** (P0) - Tenant + Department rollout (NOT just tenant)
4. 🔴 **3D Risk Matrix** (P0) - Scale + Clinical Criticality + Blast Radius
5. 🔴 **Clinical Integrity SLO** (P0) - Data consistency, NOT just HTTP 200
6. 🟠 **Event Lifecycle Tracking** (P1) - Published → Queued → Delivered → Processed → Acknowledged
7. 🟠 **Patient Safety Rollback Triggers** (P1) - Immediate stop on identity/medication errors
8. 🟠 **Data Integrity Canary** (P1) - End-to-end workflow validation
9. 🟠 **Event Replay Test** (P1) - Idempotency verification
10. 🟠 **Tenant Isolation Test** (P1) - Zero cross-tenant leakage

---

## 1. Architecture Context

### 1.1. Platform Hierarchy

```
BELLA HOST PLATFORM (Phase 0)
    ↓
Platform-of-Platforms (Phase A) ← v1.0 rollout strategy
    ↓
Healthcare Kernel (Foundation)
    ↓
Clinical Capabilities (Phase B+) ← v1.1 rollout strategy (THIS DOCUMENT)
    ├── Perioperative Platform (B1)
    ├── ICU Module (B2)
    ├── Emergency Department (B3)
    └── Blood Bank (B4)
```


### 1.2. Relationship with v1.0

**v1.0 (Phase A) is NOT replaced - it becomes the foundation.**

| Aspect | v1.0 (Generic) | v1.1 (Clinical Safety) |
|--------|----------------|------------------------|
| **Scope** | Platform infrastructure | Clinical workflows |
| **Risk** | Technical (API/Event/DB) | Clinical + Patient Safety |
| **Rollout Unit** | Tenant | Tenant + Department |
| **SLOs** | Performance, availability | Performance + Clinical Integrity |
| **Shadow Mode** | Optional | Mandatory (7 days) |
| **Gates** | Technical | Technical + Clinical Safety |
| **Rollback Triggers** | Error rate, latency | Error rate + Patient safety incidents |

**v1.1 extends v1.0 for high-risk clinical capabilities.**

---

## 2. Risk Classification (3D Matrix)

### 2.1. Dimension 1: Scale

| Level | Criteria |
|-------|----------|
| Small | < 50 beds, < 100 users, < 1000 req/day |
| Medium | 50-200 beds, 100-500 users, 1000-10000 req/day |
| Large | 200-500 beds, 500-2000 users, 10000-50000 req/day |
| Enterprise | > 500 beds, > 2000 users, > 50000 req/day |

### 2.2. Dimension 2: Clinical Criticality

| Level | Workflows | Event Loss Impact |
|-------|-----------|-------------------|
| **Low** | OPD booking, scheduling | Patient inconvenience |
| **Medium** | Ward management, billing | Financial/operational impact |
| **High** | Medication admin, lab results | Patient harm risk |
| **Very High** | Vital signs monitoring, OR | Life-threatening if lost |
| **Critical** | ICU monitoring, ED triage, anesthesia | Immediate life-threatening |

### 2.3. Dimension 3: Blast Radius

| Level | Impact Scope |
|-------|--------------|
| **Isolated** | Single department, single workflow |
| **Cross-Department** | Multiple departments (e.g., Pharmacy → Ward) |
| **Cross-Engine** | Multiple engines coordinated (e.g., OR → Billing → Lab) |
| **Financial** | Revenue cycle, insurance claims |
| **Clinical** | Patient safety, clinical decisions |
| **Patient-Safety** | Wrong patient, wrong site, wrong medication |

### 2.4. Combined Risk Assessment

**Formula:** `Risk Score = Scale × Clinical Criticality × Blast Radius`

**Examples:**

| Workflow | Scale | Criticality | Blast Radius | Risk Level | Rollout Profile |
|----------|-------|-------------|--------------|------------|-----------------|
| OPD Booking | Medium | Low | Isolated | **LOW** | Generic (v1.0) |
| Bed Allocation | High | Medium | Cross-Dept | **MEDIUM** | v1.0 + Shadow |
| Medication Admin | High | Very High | Cross-Engine | **HIGH** | v1.1 Clinical |
| OR Workflow | Medium | Critical | Patient-Safety | **CRITICAL** | v1.1 + Extended Pilot |
| ICU Monitoring | High | Critical | Patient-Safety | **CRITICAL** | v1.1 + Extended Pilot |



---

## 3. Clinical Safety Gates (P0 - Blocking)

### 3.1. Gate 1: Clinical Safety

**ALL must be TRUE to proceed to next stage:**

```typescript
{
  medicationEventLoss: 0,           // ✅ HARD ZERO
  vitalSignEventLoss: 0,            // ✅ HARD ZERO
  patientIdentityMismatch: 0,       // ✅ HARD ZERO
  crossTenantDataLeakage: 0,        // ✅ HARD ZERO
  wrongSiteSurgery: 0,              // ✅ HARD ZERO (Perioperative)
  retainedInstruments: 0,           // ✅ HARD ZERO (Perioperative)
  wrongPatientProcedure: 0,         // ✅ HARD ZERO
  criticalAlertLoss: 0,             // ✅ HARD ZERO
}
```

**Monitoring:**
- Real-time event tracking per type (medication, vitals, alerts)
- Patient identity verification on every clinical action
- Cross-tenant isolation tests (automated + manual)
- Surgical safety checklist completion rate = 100%

**Rollback Trigger:**
- ANY value > 0 → IMMEDIATE STOP + ROLLBACK

### 3.2. Gate 2: Data Integrity

```typescript
{
  inconsistentClinicalStates: 0,    // ✅ Command → Event → State must match
  unReconciledFinancialCharges: 0,  // ✅ Procedure → Billing must match
  orphanedPacuAdmissions: 0,        // ✅ Surgery complete → PACU admission exists
  missingSafetyChecklists: 0,       // ✅ OR case → Safety checklist exists
  eventReplayPass: true,            // ✅ Replay 1h/24h produces same state
}
```

**Verification:**
- End-to-end workflow tests (command → projection)
- Financial reconciliation reports
- Clinical audit trail completeness
- Event replay automated tests

### 3.3. Gate 3: Event Integrity

```typescript
{
  criticalEventDLQ: 0,              // ✅ Dead Letter Queue = 0
  eventDeliverySuccessRate: > 99.99%, // ✅ Near-perfect delivery
  eventLatencyP95: < 50ms,
  eventLatencyP99: < 200ms,
  duplicateEventRate: < 0.01%,
  outOfOrderEventRate: < 0.01%,
}
```

**Critical Events** (DLQ = 0 required):
- `hos.surgical.procedure.completed.v1`
- `hos.anesthesia.observation.recorded.v1`
- `hos.medication.administered.v1`
- `hos.cssd.cycle.completed.v1`
- `hos.pacu.discharged.v1`

### 3.4. Gate 4: Tenant Isolation

```typescript
{
  crossTenantEventDelivery: 0,
  crossTenantQueryResults: 0,
  crossTenantCacheHits: 0,
  rlsPoliciesVerified: true,        // ✅ All 15 Perioperative tables
}
```

**Automated Tests:**
- Tenant A creates surgical case → Tenant B query returns 0
- Tenant A event → Tenant B subscriber does NOT receive
- RLS policy enforcement on all tables

### 3.5. Gate 5: Idempotency

```typescript
{
  eventReplay1Hour: 'PASS',         // ✅ Same final state
  eventReplay24Hour: 'PASS',
  duplicateEventHandling: 'PASS',
  concurrentOperations: 'PASS',
}
```

---

## 4. Shadow Mode (Stage 0.5 - MANDATORY for Clinical Risk)

### 4.1. Purpose

**Shadow Mode = Validation BEFORE production rollout.**

```
Legacy Workflow (if exists)
       │
       ├──────────► Production (live traffic)
       │
       └──────────► New Platform (shadow - observe only)
                        │
                        ├── Capture events
                        ├── Build projections
                        ├── Compare results
                        └── NO state mutations
```

### 4.2. Duration

- **Minimum:** 7 days
- **Recommended:** 14 days for Critical-risk workflows
- **Extends if:** Data equivalence < 99.9%

### 4.3. Success Criteria

```typescript
{
  dataEquivalence: >= 99.99%,       // Compare legacy vs new projections
  eventCaptureRate: 100%,           // All events captured
  projectionBuildSuccess: 100%,     // No projection build errors
  crossTenantLeakage: 0,
  eventReplayPass: true,
}
```

### 4.4. Comparison Points

**For Perioperative Platform:**
- OR schedule state (booked, in-progress, completed)
- Surgical case lifecycle state
- Anesthesia observations (time-series)
- CSSD cycle completions
- PACU admission/discharge events
- Billing charges generated

**Report Format:**
```
Shadow Mode Report - Day 7

Metric                     Legacy    New      Delta    Status
─────────────────────────────────────────────────────────────
OR schedules               1,247     1,247    0        ✅
Surgical cases             89        89       0        ✅
Anesthesia observations    4,523     4,521    -2       ⚠️
CSSD cycles                156       156      0        ✅
PACU admissions            87        87       0        ✅
Billing charges            89        89       0        ✅

Overall: 99.96% equivalence (PASS threshold: 99.99%)
Action: Investigate 2 missing anesthesia observations
```



---

## 5. Rollout Stages (v1.1 Clinical Safety Profile)

### 5.1. Stage 0.5: Shadow Mode (7-14 days)

**Scope:** ALL eligible tenants (shadow only, no production traffic)

**Actions:**
- Deploy Perioperative Platform to production
- Enable shadow mode flag
- Route events to shadow consumers
- Compare projections with legacy (if exists)
- Monitor for 7-14 days

**Exit Criteria:**
- ✅ 99.99% data equivalence
- ✅ All 5 gates PASS
- ✅ Event replay successful
- ✅ Tenant isolation verified
- ✅ Engineering approval

### 5.2. Stage 1: Representative Canary (10% - 48h)

**NOT random 10% - must be representative cohort.**

**Selection Criteria:**
- 2 small clinics (different specialties: orthopedic, cardiac)
- 1 medium hospital (150 beds, OPD + Ward ONLY)
- Mix of traffic patterns (low + high)
- Mix of enabled modules (different feature combinations)
- Exclude: ICU, OR, ED departments (too high-risk for Stage 1)

**Department-Level Control:**
```typescript
{
  enabledTenants: ['tenant-001', 'tenant-042', 'tenant-089'],
  enabledDepartments: {
    'tenant-001': ['OPD', 'Ward'],          // Small clinic
    'tenant-042': ['OPD', 'Ward', 'Pharmacy'], // Medium hospital (NO OR yet)
    'tenant-089': ['OPD'],                  // Small clinic (minimal scope)
  },
  rolloutPercentage: 10,
}
```

**Monitoring (48h):**
- Clinical Safety SLOs (every 5 minutes)
- Event integrity (real-time)
- Data consistency checks (every 1 hour)
- User feedback (manual + automated surveys)

**Exit Criteria:**
- ✅ All 5 gates PASS
- ✅ 0 P0/P1 incidents
- ✅ User satisfaction > 80%
- ✅ 48h stability window

### 5.3. Stage 2: Expand (25% - 48h)

**Add:** 15% more tenants (total 25%)

**Selection:**
- More medium hospitals
- Increase department scope gradually
- Still exclude ICU/OR/ED

**Department Expansion Example:**
```typescript
{
  'tenant-042': ['OPD', 'Ward', 'Pharmacy', 'Laboratory'], // Add Lab
}
```

**Exit Criteria:** Same as Stage 1

### 5.4. Stage 3: High-Risk Pilot (50% + Controlled Pilot - 72h)

**Critical Change:** Introduce high-risk departments in CONTROLLED manner.

**Scope:**
- 45% normal tenants (OPD/Ward/Pharmacy)
- 5% high-risk departments (1-2 ICU pilots, 1-2 OR pilots)

**Controlled Pilot Selection:**
```typescript
{
  enabledDepartments: {
    'tenant-large-001': ['OPD', 'Ward', 'Pharmacy', 'OR'],  // OR pilot
    'tenant-large-002': ['OPD', 'Ward', 'Pharmacy', 'ICU'], // ICU pilot
  },
}
```

**Additional Monitoring (72h):**
- Surgical Safety Checklist completion = 100%
- OR readiness evaluation accuracy
- CSSD traceability verification
- PACU discharge criteria enforcement

**Exit Criteria:**
- ✅ All 5 gates PASS
- ✅ High-risk pilots stable for 72h
- ✅ Surgical safety incidents = 0
- ✅ Clinical validation complete

### 5.5. Stage 4A: Gradual Majority (70% - 24-48h)

**Expand:** 70% total coverage

**Exit Criteria:** All 5 gates PASS

### 5.6. Stage 4B: Near Complete (85% - 24-48h)

**Expand:** 85% total coverage

**Exit Criteria:** All 5 gates PASS

### 5.7. Stage 4C: Full Rollout (100% - 7-day Hypercare)

**Expand:** 100% eligible tenants/departments

**Hypercare Period:**
- Duration: 7 days
- On-call rotation: 24/7
- Incident response SLA: < 15 minutes
- Daily status reports
- Daily stakeholder check-ins

**Success Declaration:**
- ✅ 7 days hypercare complete
- ✅ 0 P0/P1 incidents
- ✅ All SLOs met
- ✅ Clinical validation complete
- ✅ User satisfaction > 85%
- ✅ Feature flag removable (30-day stability)

---

## 6. Rollback Strategy

### 6.1. Automated Rollback Triggers (Immediate Stop)

**P0 Triggers - NO human approval needed:**
```typescript
if (
  patientIdentityMismatch > 0 ||
  crossTenantDataLeakage > 0 ||
  criticalEventDLQ > 0 ||
  wrongSiteSurgery > 0 ||
  retainedInstruments > 0 ||
  medicationEventLoss > 0 ||
  vitalSignEventLoss > 0
) {
  IMMEDIATE_STOP();
  ROLLBACK_TO_PREVIOUS_STAGE();
  ALERT_ONCALL();
}
```

### 6.2. Manual Rollback Process

**Steps:**
1. Disable feature flag: `phase_b1_perioperative_platform = false`
2. Stop Event Bus subscribers for Perioperative events
3. Drain event queue (process remaining events, timeout 5 minutes)
4. Verify legacy workflow operational (if exists)
5. Incident command center activation
6. Root cause analysis (within 4 hours)
7. Fix + hotfix deployment
8. Re-enable with fix (restart from Stage 1 or current stage based on severity)

### 6.3. Rollback Testing

**Quarterly Rollback Drills:**
- Simulate rollback from each stage
- Verify data consistency after rollback
- Test incident response SLA
- Document lessons learned



---

## 7. Monitoring & Observability

### 7.1. Clinical Integrity Dashboard

**Real-Time Metrics (5-minute refresh):**

```
┌─────────────────────────────────────────────────────────────┐
│       CLINICAL SAFETY DASHBOARD - PHASE B1                  │
├─────────────────────────────────────────────────────────────┤
│ Stage: 3 (50% + Pilot)         Status: 🟢 HEALTHY          │
│ Rollout: 48h 23m               Next Gate: 23h 37m           │
├─────────────────────────────────────────────────────────────┤
│ CLINICAL SAFETY GATES                                       │
│ ✅ Medication Event Loss:           0 (target: 0)          │
│ ✅ Vital Sign Event Loss:           0 (target: 0)          │
│ ✅ Patient Identity Mismatch:       0 (target: 0)          │
│ ✅ Cross-Tenant Leakage:            0 (target: 0)          │
│ ✅ Wrong-Site Surgery:              0 (target: 0)          │
│ ✅ Retained Instruments:            0 (target: 0)          │
├─────────────────────────────────────────────────────────────┤
│ DATA INTEGRITY                                              │
│ ✅ Inconsistent States:             0                       │
│ ✅ Unreconciled Billing:            0                       │
│ ✅ Orphaned PACU:                   0                       │
│ ✅ Missing Safety Checklists:       0                       │
│ ✅ Event Replay Status:             PASS                    │
├─────────────────────────────────────────────────────────────┤
│ EVENT INTEGRITY                                             │
│ ✅ Critical Event DLQ:              0                       │
│ ✅ Delivery Success Rate:           99.998%                 │
│ 🟢 Event Latency p95:              42ms (target: <50ms)    │
│ 🟢 Event Latency p99:              187ms (target: <200ms)  │
│ ✅ Duplicate Rate:                  0.003%                  │
├─────────────────────────────────────────────────────────────┤
│ PERFORMANCE                                                 │
│ 🟢 OR Availability Check p95:      89ms                     │
│ 🟢 Schedule OR p95:                 156ms                   │
│ 🟢 Record Observation p95:          38ms                    │
│ 🟢 Readiness Evaluation p95:        124ms                   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2. Event Lifecycle Tracking

**NOT just published vs received - track full lifecycle:**

```typescript
{
  event_id: '550e8400-e29b-41d4-a716-446655440000',
  event_type: 'hos.surgical.procedure.completed.v1',
  
  // Lifecycle timestamps
  published_at: '2026-08-07T14:32:15.234Z',
  persisted_at: '2026-08-07T14:32:15.245Z',  // +11ms
  queued_at: '2026-08-07T14:32:15.248Z',     // +3ms
  delivered_at: '2026-08-07T14:32:15.267Z',  // +19ms
  processed_at: '2026-08-07T14:32:15.289Z',  // +22ms
  acknowledged_at: '2026-08-07T14:32:15.291Z', // +2ms
  
  // Status
  status: 'ACKNOWLEDGED',  // PUBLISHED → QUEUED → DELIVERED → PROCESSED → ACKNOWLEDGED
  retry_count: 0,
  
  // Validation
  tenant_id_match: true,   // Event tenant_id matches consumer tenant_id
  idempotency_check: 'PASS',
  duplicate_detected: false,
}
```

**Event Loss Detection:**
- Compare `published_count` vs `acknowledged_count` per event type
- Alert if gap > 0 for critical events
- Auto-investigation triggers

### 7.3. Alerting Rules

**P0 - Immediate Oncall Page:**
- ANY clinical safety gate fails (value > 0)
- Critical event DLQ > 0
- Event delivery success rate < 99.9%
- Cross-tenant leakage detected

**P1 - Slack Alert + Incident:**
- Event latency p99 > 500ms (sustained 5 minutes)
- Data inconsistency detected
- User-reported safety incident

**P2 - Dashboard Warning:**
- Event latency p95 approaching threshold
- Duplicate event rate increasing
- Stage duration approaching limit

---

## 8. Feature Flag Configuration

### 8.1. Phase B1 Feature Flag

```typescript
{
  flag_key: 'phase_b1_perioperative_platform',
  enabled: false,  // Start disabled (shadow mode)
  strategy: 'gradual_clinical',  // v1.1 clinical safety profile
  
  rollout_config: {
    stage: 'shadow',  // shadow → stage_1 → stage_2 → stage_3 → stage_4a → stage_4b → stage_4c
    
    // Stage progression timestamps
    shadowModeStart: '2026-09-01T00:00:00Z',
    stage1Start: '2026-09-08T00:00:00Z',  // After 7-day shadow
    stage2Start: '2026-09-10T00:00:00Z',  // +48h
    stage3Start: '2026-09-12T00:00:00Z',  // +48h
    stage4aStart: '2026-09-15T00:00:00Z', // +72h
    stage4bStart: '2026-09-17T00:00:00Z', // +48h
    stage4cStart: '2026-09-19T00:00:00Z', // +48h
    hypercareEnd: '2026-09-26T00:00:00Z', // +7 days
    
    // Department-level granularity (✅ NEW)
    enabledTenants: [],  // Populated per stage
    enabledDepartments: {
      'tenant-uuid-1': ['OPD', 'Ward', 'Pharmacy'],  // Stage 1: Low-risk only
      'tenant-uuid-2': ['OPD', 'Ward'],
      'tenant-large-1': ['OPD', 'Ward', 'Pharmacy', 'OR'],  // Stage 3: OR pilot
      'tenant-large-2': ['OPD', 'Ward', 'Pharmacy', 'ICU'], // Stage 3: ICU pilot
    },
    
    rolloutPercentage: 0,  // Updated per stage
    shadowMode: true,      // ✅ NEW
  },
  
  metadata: {
    description: 'Perioperative Care Platform (OR, Surgical, Anesthesia, CSSD, PACU)',
    clinical_impact: 'critical',  // low, medium, high, critical
    blast_radius: 'patient_safety',
    rollback_safe: true,
    requires_clinical_validation: true,
    requires_shadow_mode: true,  // ✅ NEW
    minimum_shadow_days: 7,
    
    // Clinical safety thresholds
    clinical_safety_gates: {
      medication_event_loss_max: 0,
      vital_event_loss_max: 0,
      patient_identity_mismatch_max: 0,
      cross_tenant_leakage_max: 0,
      wrong_site_surgery_max: 0,
    },
  }
}
```



---

## 9. Success Criteria (Complete Rollout)

### 9.1. Phase B1 SUCCESS When:

**Deployment (P0):**
- ✅ Shadow Mode passed (99.99% equivalence)
- ✅ All stages completed (0.5 → 1 → 2 → 3 → 4a → 4b → 4c)
- ✅ 100% eligible tenants/departments migrated
- ✅ 7-day hypercare period completed

**Clinical Safety (P0 - HARD ZERO):**
- ✅ 0 patient-safety incidents
- ✅ 0 medication event loss
- ✅ 0 vital sign event loss
- ✅ 0 patient identity mismatches
- ✅ 0 cross-tenant data leakage
- ✅ 0 wrong-site surgery incidents
- ✅ 0 retained instrument incidents

**Data Integrity (P0):**
- ✅ 0 unreconciled clinical states
- ✅ 0 unreconciled financial charges
- ✅ 0 orphaned PACU admissions
- ✅ 0 missing safety checklists
- ✅ Event replay verification passed (1h + 24h)

**Event Integrity (P0):**
- ✅ Critical event DLQ = 0
- ✅ Event delivery success rate > 99.99%
- ✅ Event latency p95 < 50ms, p99 < 200ms
- ✅ Duplicate event rate < 0.01%

**Performance (P1):**
- ✅ All engine SLOs met (OR availability, scheduling, observations, readiness)
- ✅ No performance regressions vs baseline

**Testing (P1):**
- ✅ Unit test coverage > 80%
- ✅ Integration tests: 10/10 event flows pass
- ✅ E2E tests: 3/3 scenarios pass
- ✅ Security tests: 0 tenant isolation violations

**Operational (P1):**
- ✅ Rollback tested successfully (drill completed)
- ✅ 0 critical incidents during hypercare
- ✅ Monitoring dashboards operational
- ✅ Runbooks documented
- ✅ On-call rotation established

**Clinical Validation (P2):**
- ✅ Clinician acceptance testing complete
- ✅ User satisfaction > 85%
- ✅ Workflow efficiency maintained or improved
- ✅ Regulatory compliance verified (if required)

### 9.2. Feature Flag Removal Criteria

Can remove `phase_b1_perioperative_platform` flag when:
- ✅ 30 days post-100% rollout stability
- ✅ 0 rollbacks required during stability period
- ✅ All success criteria met
- ✅ Legacy workflow (if any) fully deprecated
- ✅ Clinical validation complete
- ✅ Engineering + Clinical leadership approval

---

## 10. Comparison: v1.0 vs v1.1

| Aspect | v1.0 (Phase A Generic) | v1.1 (Phase B1 Clinical) |
|--------|------------------------|--------------------------|
| **Risk Level** | Low-Medium (Platform) | Critical (Patient Safety) |
| **Shadow Mode** | Optional | ✅ Mandatory 7 days |
| **Rollout Unit** | Tenant | Tenant + Department |
| **Stages** | 10% → 25% → 50% → 100% | Shadow → 10% → 25% → 50%+pilot → 70% → 85% → 100%+hypercare |
| **Gates** | 2 (Technical, Performance) | ✅ 5 (Clinical Safety, Data Integrity, Event Integrity, Tenant Isolation, Idempotency) |
| **Clinical Safety SLO** | None | ✅ Event loss = 0, Patient safety = 0 |
| **Data Integrity Canary** | Basic | ✅ End-to-end workflow validation |
| **Event Lifecycle** | Published vs Received | ✅ Full lifecycle tracking |
| **Rollback Triggers** | Error rate > 1% | ✅ Error rate OR any safety incident |
| **High-Risk Pilot** | No | ✅ Stage 3 controlled pilot (ICU/OR) |
| **Hypercare** | Optional | ✅ Mandatory 7 days |
| **Approval Required** | Engineering | ✅ Engineering + Clinical Leadership |

---

## 11. Approval Process

### 11.1. Document Approval (This Document)

**Approvers:**
- [ ] Engineering Lead (Platform Architecture)
- [ ] Clinical Safety Officer (Patient Safety)
- [ ] DevOps Lead (Deployment & Monitoring)
- [ ] Product Owner (Phase B1 Perioperative Platform)
- [ ] CTO (Final Approval)

**Approval Criteria:**
- [ ] All 20 improvements from v1.0 addressed
- [ ] Clinical safety gates defined and measurable
- [ ] Shadow mode process documented
- [ ] Department-level rollout strategy clear
- [ ] Rollback procedures tested

**Approval Timeline:** 5 business days

### 11.2. Per-Stage Approval

**Automated (no human approval needed):**
- Shadow Mode → Stage 1 (if all gates PASS)
- Stage 1 → Stage 2 (if all gates PASS + 48h elapsed)
- Stage 2 → Stage 3 (if all gates PASS + 48h elapsed)

**Manual Approval Required:**
- **Stage 3 → Stage 4a:** Clinical Leadership approval (high-risk pilot review)
- **Stage 4c → Feature Flag Removal:** Engineering + Clinical Leadership + CTO

---

## 12. Implementation Checklist

### 12.1. Pre-Shadow Mode

- [ ] Perioperative Platform v1.1 deployed to production
- [ ] Feature flag created: `phase_b1_perioperative_platform`
- [ ] Shadow mode infrastructure ready
- [ ] Event Bus wiring complete (20+ event types)
- [ ] Monitoring dashboards deployed
- [ ] Alerting rules configured
- [ ] On-call rotation established
- [ ] Runbooks documented
- [ ] THIS DOCUMENT APPROVED

### 12.2. Per-Stage Checklist

**Before Each Stage:**
- [ ] Previous stage gates: ALL PASS
- [ ] Previous stage duration: Met (48h/72h)
- [ ] Tenant/department selection: Reviewed
- [ ] Rollback plan: Tested
- [ ] On-call: Confirmed available

**During Stage:**
- [ ] Monitor dashboards: Every 5 minutes first 4 hours, then hourly
- [ ] Clinical safety gates: Real-time (alert if any fail)
- [ ] User feedback: Collected daily
- [ ] Incident log: Maintained

**After Stage:**
- [ ] All gates: PASS
- [ ] Incidents: Resolved (0 P0/P1 remaining)
- [ ] Data consistency: Verified
- [ ] Event replay: Tested
- [ ] Stakeholder report: Published

---

## 13. Appendix: 20 Improvements Summary

| # | Improvement | Priority | Status |
|---|-------------|----------|--------|
| 1 | Clinical Safety Gates | 🔴 P0 | ✅ Section 3.1 |
| 2 | Shadow Mode (7 days) | 🔴 P0 | ✅ Section 4 |
| 3 | Department-Level Granularity | 🔴 P0 | ✅ Section 5.2 |
| 4 | 3D Risk Matrix | 🔴 P0 | ✅ Section 2 |
| 5 | Clinical Integrity SLO | 🔴 P0 | ✅ Section 3.2 |
| 6 | Event Lifecycle Tracking | 🟠 P1 | ✅ Section 7.2 |
| 7 | Patient Safety Rollback Triggers | 🟠 P1 | ✅ Section 6.1 |
| 8 | Data Integrity Canary | 🟠 P1 | ✅ Section 3.2 |
| 9 | Event Replay Test | 🟠 P1 | ✅ Section 3.5 |
| 10 | Tenant Isolation Test | 🟠 P1 | ✅ Section 3.4 |
| 11 | High-Risk Pilot (Stage 3) | 🟠 P1 | ✅ Section 5.4 |
| 12 | Gradual 100% (4A/4B/4C) | 🟠 P1 | ✅ Section 5.5-5.7 |
| 13 | 7-Day Hypercare | 🟠 P1 | ✅ Section 5.7 |
| 14 | Event Versioning Namespace | 🟠 P1 | ✅ Perioperative Design |
| 15 | Charge Capture Separation | 🟠 P1 | ✅ Perioperative Design |
| 16 | Representative Canary (not random) | 🟠 P1 | ✅ Section 5.2 |
| 17 | Event DLQ Monitoring | 🟠 P1 | ✅ Section 3.3 |
| 18 | p95/p99 SLO Distinction | 🟠 P1 | ✅ Section 7.1 |
| 19 | Rollback Drill Testing | 🟠 P1 | ✅ Section 6.3 |
| 20 | Clinical Leadership Approval | 🟠 P1 | ✅ Section 11 |

---

**Document Status:** ✅ COMPLETE - Awaiting Approval  
**Version:** 1.1 Clinical Safety  
**Supersedes:** v1.0 Generic Platform Rollout  
**Applies To:** Phase B1+ (All clinical-risk capabilities)  
**Next Review:** After Phase B1 deployment complete  
**Last Updated:** 2026-08-07

---

## Approval Signatures

**Engineering Lead:** _________________________ Date: _________

**Clinical Safety Officer:** _________________________ Date: _________

**DevOps Lead:** _________________________ Date: _________

**Product Owner:** _________________________ Date: _________

**CTO (Final Approval):** _________________________ Date: _________

