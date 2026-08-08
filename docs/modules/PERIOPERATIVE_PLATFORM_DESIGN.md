# Perioperative Care Platform Design

**Version:** 1.1 Enterprise  
**Date:** 2026-08-07  
**Status:** Phase B1 - Enterprise Design Revision  
**Previous Version:** v1.0 (75% enterprise-ready) → v1.1 (12 critical fixes)  
**Constitution Compliance:** Law 3 (Multi-Tenancy), Law 5 (Event-Driven), Law 7 (Single Source of Truth), Law 8 (Idempotency)

---

## Executive Summary

**v1.0 → v1.1 Upgrade Rationale:**  
v1.0 design đạt ~75-80% enterprise readiness nhưng có 12 architectural gaps ngăn cản platform scale trong 15-20 năm. v1.1 sửa toàn bộ để đạt **Enterprise Perioperative Care Platform** chuẩn hospital enterprise.

**12 Critical Fixes Applied:**
1. 🔴 Healthcare Kernel Integration (Person/Encounter Aggregate Root)
2. 🔴 Surgical Team Normalization (bỏ UUID[] anti-pattern)
3. 🔴 Surgical Safety Checklist (WHO Sign In/Time Out/Sign Out)
4. 🔴 Anesthesia Time-Series Observations (bỏ JSONB blob)
5. 🔴 CSSD Cycle Items Traceability (instrument-level tracking)
6. 🔴 OR Readiness Engine (multi-factor readiness evaluation)
7. 🔴 Database-Level Overlap Protection (PostgreSQL EXCLUDE constraint)
8. 🟠 PACU Workflow (post-anesthesia recovery domain)
9. 🟠 Specimen & Implant Tracking
10. 🟠 Event Versioning (`hos.*.v1` namespace)
11. 🟠 Charge Capture Separation (không trực tiếp → Billing)
12. 🟠 Migration Naming Convention

---

## 1. Overview

### 1.1. Purpose
**Perioperative Care Platform** là enterprise-grade clinical workflow system quản lý toàn bộ perioperative journey, không phải chỉ "OR booking".

**Scope:**
- **Pre-operative:** Surgical consent, safety checklist, patient readiness
- **Intra-operative:** OR scheduling, surgical procedures, anesthesia monitoring
- **Post-operative:** PACU recovery, discharge criteria, handoff
- **Supporting Services:** CSSD sterilization, equipment traceability, specimen handling

**NOT in scope (delegated to other domains):**
- Patient demographics → PersonEngine (Kernel)
- Clinical encounters → EncounterEngine (Kernel)
- Lab specimens analysis → LaboratoryEngine
- Medication administration → PharmacyEngine
- Financial billing → RevenueCycleEngine

### 1.2. Key Capabilities
1. **OR Scheduling:** Database-protected room allocation với AI-powered capacity optimization
2. **Surgical Workflow:** Team assignment, safety checklist (WHO), procedure documentation
3. **Anesthesia Care:** Time-series vital signs monitoring, drug administration tracking
4. **CSSD Traceability:** Full instrument-level sterilization tracking
5. **PACU Recovery:** Post-anesthesia care với discharge readiness criteria
6. **Perioperative Intelligence:** OR readiness engine, predictive analytics, optimization

### 1.3. Engines

**Healthcare Kernel (Pre-existing):**
- **PersonEngine:** Patient identity & demographics
- **EncounterEngine:** Clinical encounter lifecycle (Aggregate Root)
- **ClinicalEngine:** Clinical data repository

**Perioperative Platform (New):**
- **OREngine:** Operating room scheduling & readiness orchestration
- **SurgicalEngine:** Surgical case workflow, team management, safety checklist
- **AnesthesiaEngine:** Anesthesia assessment & time-series monitoring
- **CssdEngine:** Sterilization cycles & instrument traceability
- **PacuEngine:** Post-anesthesia recovery care
- **ORReadinessEngine:** Multi-factor readiness evaluation (room, equipment, staff, patient)

**Supporting Engines (Integrate with):**
- **LaboratoryEngine:** Specimen tracking & pathology results
- **PharmacyEngine:** Controlled substance management, anesthesia drugs
- **ImagingEngine:** Intra-operative imaging (C-arm, fluoroscopy)
- **RevenueCycleEngine:** Charge capture, coding, billing

---

## 2. Architecture

### 2.1. Healthcare Kernel Integration (Critical Fix #1)

**v1.0 Issue:**  
OR Module trực tiếp owns `patient_id` → vi phạm Aggregate Root pattern. Perioperative không thể tồn tại độc lập mà không có Encounter context.

**v1.1 Fix:**  
Perioperative Platform **tiêu thụ** từ Healthcare Kernel qua Event Bus. Encounter là Aggregate Root, Surgical Case là child aggregate.

```
┌─────────────────────────────────────────────────────────┐
│              BELLA HEALTHCARE KERNEL                     │
│  - PersonEngine: Identity, demographics, consent        │
│  - EncounterEngine: Clinical encounter lifecycle        │
│  - ClinicalEngine: Vitals, allergies, medications       │
└─────────────────────────────────────────────────────────┘
                          ↕ (events)
         hos.encounter.surgical.created.v1
         hos.person.consent.signed.v1
                          ↓
┌─────────────────────────────────────────────────────────┐
│           PERIOPERATIVE CARE PLATFORM                    │
│  - OREngine: Room scheduling, readiness                 │
│  - SurgicalEngine: Case workflow, team, safety          │
│  - AnesthesiaEngine: Monitoring, documentation          │
│  - CssdEngine: Sterilization, equipment                 │
│  - PacuEngine: Recovery, discharge                      │
└─────────────────────────────────────────────────────────┘
                          ↕ (events)
         hos.surgical.procedure.completed.v1
         hos.cssd.cycle.completed.v1
                          ↓
┌─────────────────────────────────────────────────────────┐
│              SUPPORTING DOMAINS                          │
│  - Laboratory: Specimens, pathology                     │
│  - Pharmacy: Narcotics, anesthesia drugs                │
│  - Imaging: Intra-op imaging                            │
│  - RevenueCycle: Charge capture, coding                 │
└─────────────────────────────────────────────────────────┘
```

**Aggregate Root Hierarchy:**
```
Person (Kernel Root)
   ↓ has
Encounter (Clinical Root)
   ↓ triggers
SurgicalCase (Perioperative Root)
   ↓ requires
├── OR Schedule
├── Surgical Team
├── Safety Checklist
├── Anesthesia Record
│   └── Observations (time-series)
├── PACU Admission
├── Specimens
└── Implants
```

### 2.2. Event-Driven Architecture (Critical Fix #10: Versioning)

**v1.0 Issue:**  
Events không có version → breaking changes sau 2-3 năm khi healthcare requirements thay đổi.

**v1.1 Fix:**  
Tất cả events MUST follow namespace convention: `hos.{domain}.{action}.v{version}`

**Event Catalog:**
```typescript
// Encounter Events (Kernel)
'hos.encounter.surgical.created.v1'
'hos.person.consent.signed.v1'

// OR Scheduling Events
'hos.or.scheduled.v1'
'hos.or.rescheduled.v1'
'hos.or.cancelled.v1'
'hos.or.ready.v1'  // Multi-factor readiness validated

// Surgical Workflow Events
'hos.surgical.case.created.v1'
'hos.surgical.team.assigned.v1'
'hos.surgical.safety.signin.v1'   // Pre-procedure checklist
'hos.surgical.safety.timeout.v1'  // Before incision
'hos.surgical.safety.signout.v1'  // Before leaving OR
'hos.surgical.procedure.started.v1'
'hos.surgical.procedure.completed.v1'

// Anesthesia Events
'hos.anesthesia.preop.completed.v1'
'hos.anesthesia.induced.v1'
'hos.anesthesia.observation.recorded.v1'  // Time-series vitals
'hos.anesthesia.case.completed.v1'

// CSSD Events
'hos.cssd.cycle.started.v1'
'hos.cssd.cycle.completed.v1'
'hos.cssd.equipment.issued.v1'
'hos.cssd.equipment.returned.v1'

// PACU Events
'hos.pacu.admitted.v1'
'hos.pacu.assessment.recorded.v1'
'hos.pacu.discharged.v1'

// Revenue Events (Charge Capture)
'hos.revenue.charge.captured.v1'  // NOT direct billing
'hos.revenue.coding.completed.v1'
```

**Event Envelope (Standard):**
```typescript
{
  event_id: UUID,
  event_type: 'hos.surgical.procedure.completed.v1',
  event_version: 1,
  tenant_id: UUID,
  aggregate_id: UUID,  // surgical_case_id
  aggregate_type: 'SurgicalCase',
  occurred_at: TIMESTAMPTZ,
  correlation_id: UUID,  // Track workflow
  causation_id: UUID,    // Parent event
  actor_id: UUID,        // User who triggered
  payload: { ... }       // Domain-specific data
}
```

### 2.3. Key Event Flows

**Flow 1: Surgical Encounter → OR Booking**
```
EncounterEngine: hos.encounter.surgical.created.v1
         ↓
OREngine: evaluate readiness → schedule OR
         ↓
OREngine: hos.or.scheduled.v1
         ↓
├── CssdEngine: reserve instruments
├── SurgicalEngine: assign team
└── AnesthesiaEngine: schedule pre-op
```

**Flow 2: Surgical Safety Checklist (Critical Fix #3)**
```
Pre-procedure: hos.surgical.safety.signin.v1
   ├── Patient identity verified
   ├── Site marked
   ├── Consent signed
   └── Allergies confirmed
         ↓
Before incision: hos.surgical.safety.timeout.v1
   ├── Team introduction
   ├── Procedure confirmation
   ├── Antibiotic prophylaxis
   └── Critical steps reviewed
         ↓
Before leaving OR: hos.surgical.safety.signout.v1
   ├── Instrument count correct
   ├── Specimens labeled
   ├── Equipment issues
   └── Recovery plan discussed
```

**Flow 3: Procedure Completion → Charge Capture (Critical Fix #11)**
```
SurgicalEngine: hos.surgical.procedure.completed.v1
         ↓
ChargeCaptureEngine: validate procedures
         ↓
CodingEngine: assign CPT codes
         ↓
ChargeCaptureEngine: hos.revenue.charge.captured.v1
         ↓
RevenueCycleEngine: billing workflow
```

**Flow 4: CSSD → OR Readiness (Critical Fix #5 + #6)**
```
CssdEngine: hos.cssd.cycle.completed.v1
         ↓
ORReadinessEngine: evaluate multi-factor readiness
   ├── Room cleaned ✓
   ├── Equipment sterilized ✓
   ├── Instruments available ✓
   ├── Staff assigned ✓
   ├── Patient ready ✓
   └── Consent signed ✓
         ↓
ORReadinessEngine: hos.or.ready.v1
         ↓
OREngine: update room status → available
```

---

## 3. Database Schema (v1.1 Enterprise)

### 3.0. Healthcare Kernel Tables (Pre-existing, DO NOT recreate)

```sql
-- Already implemented in Healthcare Kernel
persons (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  name VARCHAR(200),
  date_of_birth DATE,
  gender VARCHAR(20),
  ...
);

encounters (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  person_id UUID REFERENCES persons(id),
  encounter_type VARCHAR(50),  -- 'surgical', 'emergency', 'outpatient'
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status VARCHAR(20),
  ...
);
```

**Critical Rule:** Perioperative tables MUST reference `persons.id` and `encounters.id`, NOT create own patient table.

### 3.1. Table Summary (v1.1 Enterprise - 15 tables)

**Core Perioperative Tables:**
1. `hc_operating_rooms` - OR master data
2. `hc_or_schedules` - ✅ Fix #7: TSTZRANGE với EXCLUDE constraint
3. `hc_surgical_cases` - ✅ Fix #1: References `encounter_id` NOT `patient_id`
4. `hc_surgical_teams` - ✅ Fix #2: Normalized team (NOT UUID[])
5. `hc_surgical_safety_checklists` - ✅ Fix #3: WHO checklist workflow
6. `hc_anesthesia_records` - Anesthesia documentation
7. `hc_anesthesia_observations` - ✅ Fix #4: Time-series vitals (NOT JSONB)
8. `hc_anesthesia_medications` - Drug administration log
9. `hc_pacu_admissions` - ✅ Fix #8: PACU recovery tracking
10. `hc_specimens` - ✅ Fix #9: Specimen tracking
11. `hc_implants` - ✅ Fix #9: Implant tracking
12. `hc_equipment` - Equipment master data
13. `hc_cssd_cycles` - Sterilization cycles
14. `hc_cssd_cycle_items` - ✅ Fix #5: Instrument-level traceability
15. `hc_or_equipment_usage` - Equipment usage per case

**Total: 15 tables (v1.0 had 7 tables)**

### 3.2. hc_or_schedules (Critical Fix #7: Overlap Protection)

**v1.0 Problem:**  
Application-level conflict check → race condition với concurrent bookings:
```sql
-- Thread A: SELECT availability (room free) ✓
-- Thread B: SELECT availability (room free) ✓  -- Race!
-- Thread A: INSERT schedule ✓
-- Thread B: INSERT schedule ✓  -- Double booking!
```

**v1.1 Solution:**  
PostgreSQL EXCLUDE constraint với tstzrange → database-level atomic protection:

```sql
CREATE TABLE hc_or_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  operating_room_id UUID NOT NULL REFERENCES hc_operating_rooms(id),
  encounter_id UUID NOT NULL REFERENCES encounters(id), -- ✅ Kernel integration
  surgical_case_id UUID REFERENCES hc_surgical_cases(id),
  
  scheduled_date DATE NOT NULL,
  scheduled_time_range TSTZRANGE NOT NULL,  -- ✅ PostgreSQL range type
  estimated_duration_minutes INT NOT NULL,
  
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  actual_duration_minutes INT,
  setup_time_minutes INT,
  turnover_time_minutes INT,
  cleaning_time_minutes INT,
  
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  priority VARCHAR(20) DEFAULT 'routine',
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  -- ✅ CRITICAL FIX #7: Database-level overlap protection
  CONSTRAINT exclude_or_schedule_overlap EXCLUDE USING gist (
    tenant_id WITH =,
    operating_room_id WITH =,
    scheduled_time_range WITH &&
  ) WHERE (status NOT IN ('cancelled', 'completed')),
  
  CONSTRAINT chk_duration_positive CHECK (estimated_duration_minutes > 0)
);

CREATE INDEX idx_or_schedules_tenant ON hc_or_schedules(tenant_id);
CREATE INDEX idx_or_schedules_encounter ON hc_or_schedules(encounter_id);
CREATE INDEX idx_or_schedules_room_date ON hc_or_schedules(operating_room_id, scheduled_date);
CREATE INDEX idx_or_schedules_time_range ON hc_or_schedules USING gist(scheduled_time_range);
```

**Benefits:**
- ✅ Atomic conflict detection (no race conditions)
- ✅ Concurrent booking safe
- ✅ Emergency case insertion safe
- ✅ Reschedule operations safe

### 3.3. hc_surgical_cases (Fix #1: Encounter Integration)

```sql
CREATE TABLE hc_surgical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  encounter_id UUID NOT NULL REFERENCES encounters(id), -- ✅ Aggregate Root
  case_number VARCHAR(50) NOT NULL,  -- Auto-generated: SC000001
  case_type VARCHAR(50) NOT NULL,    -- Elective, Emergency, Trauma
  
  -- Diagnosis
  primary_diagnosis_code VARCHAR(20),   -- ICD-10
  primary_diagnosis_text TEXT NOT NULL,
  pre_op_diagnosis TEXT,
  post_op_diagnosis TEXT,
  
  -- Procedures (planned vs actual)
  planned_procedures JSONB NOT NULL,  -- [{ code: 'CPT-12345', name: '...' }]
  actual_procedures JSONB,
  
  -- Clinical findings
  surgical_findings TEXT,
  complications TEXT,
  blood_loss_ml INT,
  transfusion_given BOOLEAN DEFAULT false,
  
  -- Workflow status
  status VARCHAR(20) NOT NULL DEFAULT 'planned',  -- planned, in_progress, completed, cancelled
  outcome VARCHAR(50),  -- successful, complicated, aborted
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  CONSTRAINT uq_case_number UNIQUE (tenant_id, case_number),
  CONSTRAINT chk_blood_loss CHECK (blood_loss_ml IS NULL OR blood_loss_ml >= 0)
);

CREATE INDEX idx_surgical_cases_encounter ON hc_surgical_cases(encounter_id);
CREATE INDEX idx_surgical_cases_status ON hc_surgical_cases(tenant_id, status);
```

### 3.4. hc_surgical_teams (Critical Fix #2: Normalized Team)

**v1.0 Problem:**
```sql
assistant_surgeon_ids UUID[]  -- Anti-pattern!
```
Cannot audit who actually participated, when they joined/left, their role sequence.

**v1.1 Solution:**
```sql
CREATE TABLE hc_surgical_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  surgical_case_id UUID NOT NULL REFERENCES hc_surgical_cases(id),
  staff_id UUID NOT NULL REFERENCES hc_staff(id),
  
  role VARCHAR(50) NOT NULL,  -- Primary Surgeon, Assistant, Anesthesiologist, Scrub Nurse, etc.
  sequence INT,               -- Order of assistants (1st assistant, 2nd assistant)
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT chk_team_role CHECK (role IN (
    'Primary Surgeon', 'Assistant Surgeon', 'Anesthesiologist',
    'Scrub Nurse', 'Circulating Nurse', 'Perfusionist',
    'Surgical Technician', 'Resident', 'Fellow'
  ))
);

CREATE INDEX idx_surgical_teams_case ON hc_surgical_teams(surgical_case_id);
CREATE INDEX idx_surgical_teams_staff ON hc_surgical_teams(staff_id);
```

**Benefits:**
- ✅ Full audit trail of team participation
- ✅ Track when each person joined/left
- ✅ Support complex team structures (multiple residents, fellows)
- ✅ Query "all cases Dr. Smith assisted" easily

### 3.5. hc_surgical_safety_checklists (Critical Fix #3: WHO Protocol)

**v1.0 Problem:**  
Surgical safety completely missing → high risk for wrong-site surgery, retained instruments.

**v1.1 Solution:**  
Implement WHO Surgical Safety Checklist with 3 phases:

```sql
CREATE TABLE hc_surgical_safety_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  surgical_case_id UUID NOT NULL REFERENCES hc_surgical_cases(id),
  
  -- Sign In (Before Anesthesia)
  signin_completed_at TIMESTAMPTZ,
  signin_completed_by UUID REFERENCES hc_staff(id),
  signin_patient_identity_confirmed BOOLEAN DEFAULT false,
  signin_site_marked BOOLEAN DEFAULT false,
  signin_consent_signed BOOLEAN DEFAULT false,
  signin_anesthesia_safety_check BOOLEAN DEFAULT false,
  signin_known_allergies TEXT,
  signin_aspiration_risk BOOLEAN DEFAULT false,
  signin_blood_loss_risk_ml INT,
  
  -- Time Out (Before Skin Incision)
  timeout_completed_at TIMESTAMPTZ,
  timeout_completed_by UUID REFERENCES hc_staff(id),
  timeout_team_introduction BOOLEAN DEFAULT false,
  timeout_patient_name_confirmed TEXT,
  timeout_procedure_confirmed TEXT,
  timeout_site_marked_confirmed BOOLEAN DEFAULT false,
  timeout_antibiotic_prophylaxis_given BOOLEAN DEFAULT false,
  timeout_critical_steps_discussed TEXT,
  timeout_anticipated_complications TEXT,
  timeout_imaging_displayed BOOLEAN,
  
  -- Sign Out (Before Patient Leaves OR)
  signout_completed_at TIMESTAMPTZ,
  signout_completed_by UUID REFERENCES hc_staff(id),
  signout_procedure_recorded TEXT,
  signout_instrument_count_correct BOOLEAN DEFAULT false,
  signout_sponge_count_correct BOOLEAN DEFAULT false,
  signout_needle_count_correct BOOLEAN DEFAULT false,
  signout_specimens_labeled BOOLEAN DEFAULT false,
  signout_equipment_problems TEXT,
  signout_key_concerns_for_recovery TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_checklist_per_case UNIQUE (surgical_case_id)
);

CREATE INDEX idx_safety_checklists_case ON hc_surgical_safety_checklists(surgical_case_id);
CREATE INDEX idx_safety_checklists_signin ON hc_surgical_safety_checklists(signin_completed_at);
CREATE INDEX idx_safety_checklists_timeout ON hc_surgical_safety_checklists(timeout_completed_at);
```

**Workflow Enforcement:**
```typescript
// Business rule in SurgicalEngine
async startProcedure(caseId: string) {
  const checklist = await getChecklist(caseId);
  
  if (!checklist.signin_completed_at) {
    throw new Error('Cannot start: Sign In not completed');
  }
  
  if (!checklist.timeout_completed_at) {
    throw new Error('Cannot start: Time Out not completed');
  }
  
  if (!checklist.timeout_instrument_count_correct) {
    throw new Error('Cannot start: Instrument count not verified');
  }
  
  // Publish event
  await eventBus.publish('hos.surgical.procedure.started.v1', { caseId });
}
```

**Benefits:**
- ✅ WHO Surgical Safety Checklist compliance
- ✅ Prevent wrong-site/wrong-patient surgery
- ✅ Retained instrument detection
- ✅ Full audit trail
- ✅ Regulatory compliance (JCI, AORN)

### 3.6. hc_anesthesia_observations (Critical Fix #4: Time-Series NOT JSONB)

**v1.0 Problem:**
```sql
intra_op_vitals JSONB  -- Blob storage for 4-hour surgery → query nightmare
```
Cannot query "all cases with MAP < 60", cannot trend BP over time, cannot aggregate for analytics.

**v1.1 Solution:**  
Proper time-series table with indexed columns:

```sql
CREATE TABLE hc_anesthesia_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  anesthesia_record_id UUID NOT NULL REFERENCES hc_anesthesia_records(id),
  
  observed_at TIMESTAMPTZ NOT NULL,
  observation_type VARCHAR(50) NOT NULL,  -- BP, HR, SpO2, EtCO2, Temperature, etc.
  
  -- Numeric value
  value_numeric NUMERIC(8,2),
  value_unit VARCHAR(20),  -- mmHg, bpm, %, °C
  
  -- Text value (for categorical observations)
  value_text VARCHAR(200),
  
  -- Source
  source VARCHAR(50) DEFAULT 'manual',  -- manual, monitor, ventilator
  device_id VARCHAR(100),
  
  -- Clinical context
  is_abnormal BOOLEAN DEFAULT false,
  alert_triggered BOOLEAN DEFAULT false,
  intervention_required BOOLEAN DEFAULT false,
  
  notes TEXT,
  recorded_by UUID REFERENCES hc_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_obs_type CHECK (observation_type IN (
    'Systolic_BP', 'Diastolic_BP', 'MAP',
    'Heart_Rate', 'SpO2', 'EtCO2',
    'Temperature', 'Respiratory_Rate',
    'Airway_Pressure', 'Tidal_Volume',
    'FiO2', 'PEEP', 'Anesthesia_Depth'
  ))
);

CREATE INDEX idx_anesthesia_obs_record ON hc_anesthesia_observations(anesthesia_record_id);
CREATE INDEX idx_anesthesia_obs_time ON hc_anesthesia_observations(anesthesia_record_id, observed_at);
CREATE INDEX idx_anesthesia_obs_type ON hc_anesthesia_observations(observation_type);
CREATE INDEX idx_anesthesia_obs_abnormal ON hc_anesthesia_observations(tenant_id, is_abnormal) WHERE is_abnormal = true;
```

**Query Examples:**
```sql
-- Trend MAP over time for a case
SELECT observed_at, value_numeric
FROM hc_anesthesia_observations
WHERE anesthesia_record_id = 'xxx'
  AND observation_type = 'MAP'
ORDER BY observed_at;

-- All cases with hypotension (MAP < 60)
SELECT DISTINCT ar.id, ar.surgical_case_id
FROM hc_anesthesia_records ar
JOIN hc_anesthesia_observations ao ON ao.anesthesia_record_id = ar.id
WHERE ao.observation_type = 'MAP'
  AND ao.value_numeric < 60;

-- Average SpO2 across all cases this month
SELECT AVG(value_numeric) as avg_spo2
FROM hc_anesthesia_observations
WHERE observation_type = 'SpO2'
  AND created_at >= date_trunc('month', NOW());
```

**Benefits:**
- ✅ Queryable time-series data
- ✅ Support analytics & AI (hypotension prediction)
- ✅ Full-text search on interventions
- ✅ Performance: indexed queries vs JSONB scan

### 3.7. hc_cssd_cycle_items (Critical Fix #5: Instrument-Level Traceability)

**v1.0 Problem:**
```sql
equipment_ids UUID[]  -- Cannot track individual instruments in a set
```

**v1.1 Solution:**
```sql
CREATE TABLE hc_cssd_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cycle_number VARCHAR(50) NOT NULL,  -- CYC000001
  sterilizer_id VARCHAR(50) NOT NULL,
  sterilization_method VARCHAR(50) NOT NULL,
  cycle_start_time TIMESTAMPTZ NOT NULL,
  cycle_end_time TIMESTAMPTZ,
  temperature_celsius NUMERIC(5,2),
  pressure_kpa NUMERIC(6,2),
  duration_minutes INT,
  biological_indicator_result VARCHAR(20),  -- Pass, Fail, Pending
  chemical_indicator_result VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  operator_id UUID NOT NULL REFERENCES hc_staff(id),
  verified_by UUID REFERENCES hc_staff(id),
  verified_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_cycle_number UNIQUE (tenant_id, cycle_number)
);

CREATE TABLE hc_cssd_cycle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cycle_id UUID NOT NULL REFERENCES hc_cssd_cycles(id),
  equipment_id UUID NOT NULL REFERENCES hc_equipment(id),
  
  quantity INT DEFAULT 1,
  load_position VARCHAR(50),  -- A1, B2, C3 (tray position in sterilizer)
  item_indicator_result VARCHAR(20),  -- Pass, Fail (per-item chemical indicator)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  CONSTRAINT chk_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_cssd_cycle_items_cycle ON hc_cssd_cycle_items(cycle_id);
CREATE INDEX idx_cssd_cycle_items_equipment ON hc_cssd_cycle_items(equipment_id);
```

**Query: Full Traceability**
```sql
-- Find which cycle sterilized instrument X used in case Y
SELECT 
  c.cycle_number,
  c.cycle_start_time,
  c.biological_indicator_result,
  e.equipment_name,
  u.issued_at,
  sc.case_number
FROM hc_or_equipment_usage u
JOIN hc_equipment e ON e.id = u.equipment_id
JOIN hc_cssd_cycle_items ci ON ci.equipment_id = e.id
JOIN hc_cssd_cycles c ON c.id = ci.cycle_id
JOIN hc_surgical_cases sc ON sc.id = u.surgical_case_id
WHERE sc.id = 'case-uuid'
  AND c.cycle_end_time < u.issued_at
ORDER BY c.cycle_end_time DESC;
```

### 3.8. hc_pacu_admissions (Critical Fix #8: PACU Workflow)

**v1.0 Problem:**  
`discharge_to = 'PACU'` as enum → no PACU tracking, no recovery criteria.

**v1.1 Solution:**
```sql
CREATE TABLE hc_pacu_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  surgical_case_id UUID NOT NULL REFERENCES hc_surgical_cases(id),
  encounter_id UUID NOT NULL REFERENCES encounters(id),
  
  admission_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharge_time TIMESTAMPTZ,
  
  -- Aldrete Score (recovery assessment 0-10)
  aldrete_activity INT,  -- 0-2
  aldrete_respiration INT,  -- 0-2
  aldrete_circulation INT,  -- 0-2
  aldrete_consciousness INT,  -- 0-2
  aldrete_color INT,  -- 0-2
  aldrete_total INT GENERATED ALWAYS AS (
    COALESCE(aldrete_activity,0) + COALESCE(aldrete_respiration,0) + 
    COALESCE(aldrete_circulation,0) + COALESCE(aldrete_consciousness,0) + 
    COALESCE(aldrete_color,0)
  ) STORED,
  
  pain_score INT,  -- 0-10
  nausea_score INT,  -- 0-10
  airway_status VARCHAR(50),  -- patent, obstructed, requiring support
  oxygen_therapy BOOLEAN DEFAULT false,
  oxygen_flow_rate_lpm NUMERIC(4,1),
  
  complications TEXT,
  discharge_criteria_met BOOLEAN DEFAULT false,
  discharge_destination VARCHAR(50),  -- Ward, ICU, Home, Morgue
  
  nurse_id UUID REFERENCES hc_staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_aldrete_score CHECK (aldrete_total BETWEEN 0 AND 10),
  CONSTRAINT chk_pain_score CHECK (pain_score IS NULL OR pain_score BETWEEN 0 AND 10)
);

CREATE INDEX idx_pacu_case ON hc_pacu_admissions(surgical_case_id);
CREATE INDEX idx_pacu_encounter ON hc_pacu_admissions(encounter_id);
CREATE INDEX idx_pacu_nurse ON hc_pacu_admissions(nurse_id);
```

### 3.9. hc_specimens & hc_implants (Critical Fix #9)

```sql
CREATE TABLE hc_specimens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  surgical_case_id UUID NOT NULL REFERENCES hc_surgical_cases(id),
  
  specimen_number VARCHAR(50) NOT NULL,  -- SPEC000001
  specimen_type VARCHAR(100) NOT NULL,   -- Tissue, Fluid, Frozen Section
  anatomic_site VARCHAR(200),
  description TEXT,
  
  collected_at TIMESTAMPTZ NOT NULL,
  collected_by UUID REFERENCES hc_staff(id),
  sent_to_lab_at TIMESTAMPTZ,
  lab_requisition_number VARCHAR(100),
  
  pathology_result TEXT,
  pathology_result_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_specimen_number UNIQUE (tenant_id, specimen_number)
);

CREATE TABLE hc_implants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  surgical_case_id UUID NOT NULL REFERENCES hc_surgical_cases(id),
  
  implant_type VARCHAR(100) NOT NULL,  -- Prosthesis, Mesh, Fixation Device
  manufacturer VARCHAR(200),
  model VARCHAR(200),
  serial_number VARCHAR(200),
  lot_number VARCHAR(200),
  expiry_date DATE,
  
  implanted_at TIMESTAMPTZ NOT NULL,
  implanted_by UUID REFERENCES hc_staff(id),
  anatomic_site VARCHAR(200),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_expiry CHECK (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
);
```

**Benefits:**
- ✅ Full specimen tracking for pathology correlation
- ✅ Implant traceability for recalls
- ✅ Regulatory compliance (FDA, MDR)



### 3.10. Remaining Core Tables

```sql
-- hc_operating_rooms (OR master data)
CREATE TABLE hc_operating_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  room_number VARCHAR(20) NOT NULL,
  room_name VARCHAR(100) NOT NULL,
  floor VARCHAR(20),
  department VARCHAR(100),
  room_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  equipment_list TEXT[],
  capacity_max_hours_per_day NUMERIC(4,2) DEFAULT 16.00,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_or_room_number UNIQUE (tenant_id, room_number)
);

-- hc_anesthesia_records (Main anesthesia document)
CREATE TABLE hc_anesthesia_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  surgical_case_id UUID NOT NULL REFERENCES hc_surgical_cases(id),
  or_schedule_id UUID REFERENCES hc_or_schedules(id),
  encounter_id UUID NOT NULL REFERENCES encounters(id),
  anesthesiologist_id UUID NOT NULL REFERENCES hc_staff(id),
  
  -- Pre-op
  asa_classification VARCHAR(10) NOT NULL,
  pre_op_vital_signs JSONB,
  allergies TEXT[],
  current_medications TEXT[],
  medical_history TEXT,
  airway_assessment TEXT,
  mallampati_score INT CHECK (mallampati_score BETWEEN 1 AND 4),
  npo_status_hours NUMERIC(4,1),
  consent_obtained BOOLEAN DEFAULT false,
  
  -- Anesthesia plan
  anesthesia_type VARCHAR(50) NOT NULL,
  anesthesia_technique TEXT,
  planned_agents TEXT[],
  
  -- Intra-op timing
  induction_time TIMESTAMPTZ,
  intubation_time TIMESTAMPTZ,
  extubation_time TIMESTAMPTZ,
  emergence_time TIMESTAMPTZ,
  
  -- Post-op
  post_op_pain_score INT CHECK (post_op_pain_score BETWEEN 0 AND 10),
  post_op_nausea BOOLEAN DEFAULT false,
  complications TEXT,
  discharge_to VARCHAR(50),
  
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  reviewed_by UUID REFERENCES hc_staff(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT chk_asa CHECK (asa_classification IN ('ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V', 'ASA VI')),
  CONSTRAINT chk_anesthesia_type CHECK (anesthesia_type IN ('General', 'Regional', 'Local', 'Sedation'))
);

-- hc_anesthesia_medications (Drug administration log)
CREATE TABLE hc_anesthesia_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  anesthesia_record_id UUID NOT NULL REFERENCES hc_anesthesia_records(id),
  
  medication_name VARCHAR(200) NOT NULL,
  dose_amount NUMERIC(10,3) NOT NULL,
  dose_unit VARCHAR(20) NOT NULL,
  route VARCHAR(50) NOT NULL,
  administered_at TIMESTAMPTZ NOT NULL,
  administered_by UUID REFERENCES hc_staff(id),
  
  indication VARCHAR(200),
  is_controlled_substance BOOLEAN DEFAULT false,
  lot_number VARCHAR(100),
  expiry_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_dose_positive CHECK (dose_amount > 0)
);

-- hc_equipment (Equipment master data)
CREATE TABLE hc_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  equipment_code VARCHAR(50) NOT NULL,
  equipment_name VARCHAR(200) NOT NULL,
  equipment_type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  purchase_date DATE,
  last_maintenance_date DATE,
  next_maintenance_due DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  location VARCHAR(100),
  requires_sterilization BOOLEAN DEFAULT false,
  sterilization_method VARCHAR(50),
  quantity INT DEFAULT 1,
  reusable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_equipment_code UNIQUE (tenant_id, equipment_code),
  CONSTRAINT chk_quantity_positive CHECK (quantity > 0)
);

-- hc_or_equipment_usage (Equipment usage per case)
CREATE TABLE hc_or_equipment_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  or_schedule_id UUID NOT NULL REFERENCES hc_or_schedules(id),
  surgical_case_id UUID REFERENCES hc_surgical_cases(id),
  equipment_id UUID NOT NULL REFERENCES hc_equipment(id),
  sterilization_cycle_id UUID REFERENCES hc_cssd_cycles(id),
  
  quantity_used INT DEFAULT 1,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  condition_on_return VARCHAR(50),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_usage_quantity CHECK (quantity_used > 0)
);
```

---

## 4. Engine Contracts (v1.1 Enterprise)

### 4.1. OREngine (Operating Room Orchestration)

**Purpose:** OR scheduling, readiness evaluation, capacity management.

**Methods:**
```typescript
interface OREngine {
  // Schedule OR with encounter context
  scheduleOperation(params: {
    tenantId: string;
    encounterId: string;  // ✅ Kernel integration
    operatingRoomId: string;
    scheduledTimeRange: { start: Date; end: Date };
    priority: 'emergency' | 'urgent' | 'routine' | 'elective';
    estimatedDurationMinutes: number;
  }): Promise<{ scheduleId: string }>;
  
  // Reschedule with conflict detection
  rescheduleOperation(params: {
    tenantId: string;
    scheduleId: string;
    newTimeRange: { start: Date; end: Date };
  }): Promise<void>;
  
  // Cancel OR booking
  cancelSchedule(params: {
    tenantId: string;
    scheduleId: string;
    cancellationReason: string;
  }): Promise<void>;
  
  // Check OR availability (PostgreSQL EXCLUDE handles conflicts)
  checkAvailability(params: {
    tenantId: string;
    operatingRoomId: string;
    timeRange: { start: Date; end: Date };
  }): Promise<{ available: boolean; conflicts: ORSchedule[] }>;
  
  // Evaluate OR readiness (multi-factor)
  evaluateReadiness(params: {
    tenantId: string;
    scheduleId: string;
  }): Promise<{
    ready: boolean;
    factors: {
      roomCleaned: boolean;
      equipmentAvailable: boolean;
      instrumentsSterilized: boolean;
      teamAssigned: boolean;
      patientReady: boolean;
      consentSigned: boolean;
    };
    blockers: string[];
  }>;
}
```

**Events Published:**
- `hos.or.scheduled.v1`
- `hos.or.rescheduled.v1`
- `hos.or.cancelled.v1`
- `hos.or.ready.v1`

**Events Subscribed:**
- `hos.cssd.cycle.completed.v1` → Check readiness
- `hos.surgical.team.assigned.v1` → Update readiness


### 4.2. SurgicalEngine (Surgical Workflow & Safety)

**Purpose:** Surgical case lifecycle, team management, safety checklist enforcement.

**Methods:**
```typescript
interface SurgicalEngine {
  // Create surgical case (from encounter)
  createCase(params: {
    tenantId: string;
    encounterId: string;  // ✅ Kernel integration
    caseType: 'Elective' | 'Emergency' | 'Trauma';
    primaryDiagnosisCode: string;  // ICD-10
    primaryDiagnosisText: string;
    plannedProcedures: Array<{ code: string; name: string }>;
  }): Promise<{ caseId: string; caseNumber: string }>;
  
  // Assign surgical team (normalized)
  assignTeamMember(params: {
    tenantId: string;
    caseId: string;
    staffId: string;
    role: 'Primary Surgeon' | 'Assistant Surgeon' | 'Anesthesiologist' | 
          'Scrub Nurse' | 'Circulating Nurse' | 'Perfusionist' | 
          'Surgical Technician' | 'Resident' | 'Fellow';
    sequence?: number;  // For multiple assistants
    isPrimary?: boolean;
  }): Promise<void>;
  
  // Safety checklist - Sign In
  completeSignIn(params: {
    tenantId: string;
    caseId: string;
    patientIdentityConfirmed: boolean;
    siteMarked: boolean;
    consentSigned: boolean;
    anesthesiaSafetyCheck: boolean;
    knownAllergies: string;
    aspirationRisk: boolean;
    bloodLossRiskMl: number;
  }): Promise<void>;
  
  // Safety checklist - Time Out (MUST complete before procedure)
  completeTimeOut(params: {
    tenantId: string;
    caseId: string;
    teamIntroduction: boolean;
    patientNameConfirmed: string;
    procedureConfirmed: string;
    siteMarkedConfirmed: boolean;
    antibioticProphylaxisGiven: boolean;
    criticalStepsDiscussed: string;
    anticipatedComplications: string;
  }): Promise<void>;
  
  // Start procedure (enforces Time Out completion)
  startProcedure(params: {
    tenantId: string;
    caseId: string;
  }): Promise<void>;
  
  // Complete procedure
  completeProcedure(params: {
    tenantId: string;
    caseId: string;
    actualProcedures: Array<{ code: string; name: string }>;
    postOpDiagnosis: string;
    surgicalFindings: string;
    complications?: string;
    bloodLossMl?: number;
    transfusionGiven?: boolean;
    outcome: 'successful' | 'complicated' | 'aborted';
  }): Promise<void>;
  
  // Safety checklist - Sign Out (before leaving OR)
  completeSignOut(params: {
    tenantId: string;
    caseId: string;
    procedureRecorded: string;
    instrumentCountCorrect: boolean;
    spongeCountCorrect: boolean;
    needleCountCorrect: boolean;
    specimensLabeled: boolean;
    equipmentProblems?: string;
    keyConcernsForRecovery?: string;
  }): Promise<void>;
}
```

**Events Published:**
- `hos.surgical.case.created.v1`
- `hos.surgical.team.assigned.v1`
- `hos.surgical.safety.signin.v1`
- `hos.surgical.safety.timeout.v1`
- `hos.surgical.procedure.started.v1`
- `hos.surgical.procedure.completed.v1`
- `hos.surgical.safety.signout.v1`

**Events Subscribed:**
- `hos.or.scheduled.v1` → Link case to schedule
- `hos.encounter.surgical.created.v1` → Create surgical case

---

### 4.3. AnesthesiaEngine (Monitoring & Documentation)

**Purpose:** Anesthesia assessment, time-series monitoring, drug administration.

**Methods:**
```typescript
interface AnesthesiaEngine {
  // Create anesthesia record
  createRecord(params: {
    tenantId: string;
    surgicalCaseId: string;
    encounterId: string;
    anesthesiologistId: string;
  }): Promise<{ recordId: string }>;
  
  // Pre-op assessment
  recordPreOpAssessment(params: {
    tenantId: string;
    recordId: string;
    asaClassification: 'ASA I' | 'ASA II' | 'ASA III' | 'ASA IV' | 'ASA V' | 'ASA VI';
    preOpVitalSigns: { systolic: number; diastolic: number; hr: number; rr: number; temp: number; spo2: number };
    allergies: string[];
    currentMedications: string[];
    medicalHistory: string;
    airwayAssessment: string;
    mallampatiScore: 1 | 2 | 3 | 4;
    npoStatusHours: number;
    consentObtained: boolean;
    anesthesiaType: 'General' | 'Regional' | 'Local' | 'Sedation';
    anesthesiaTechnique: string;
    plannedAgents: string[];
  }): Promise<void>;
  
  // Record vital sign observation (time-series)
  recordObservation(params: {
    tenantId: string;
    recordId: string;
    observedAt: Date;
    observationType: 'Systolic_BP' | 'Diastolic_BP' | 'MAP' | 'Heart_Rate' | 
                     'SpO2' | 'EtCO2' | 'Temperature' | 'Respiratory_Rate' |
                     'Airway_Pressure' | 'Tidal_Volume' | 'FiO2' | 'PEEP';
    valueNumeric: number;
    valueUnit: string;
    source?: 'manual' | 'monitor' | 'ventilator';
    deviceId?: string;
    isAbnormal?: boolean;
    alertTriggered?: boolean;
  }): Promise<void>;
  
  // Record medication administration
  recordMedication(params: {
    tenantId: string;
    recordId: string;
    medicationName: string;
    doseAmount: number;
    doseUnit: string;
    route: string;
    administeredAt: Date;
    administeredBy: string;
    indication?: string;
    isControlledSubstance?: boolean;
    lotNumber?: string;
    expiryDate?: Date;
  }): Promise<void>;
  
  // Record post-op data
  recordPostOp(params: {
    tenantId: string;
    recordId: string;
    extubationTime?: Date;
    emergenceTime: Date;
    postOpPainScore: number;  // 0-10
    postOpNausea: boolean;
    complications?: string;
    dischargeTo: 'PACU' | 'ICU' | 'Ward';
  }): Promise<void>;
  
  // Complete record (mark as reviewed)
  completeRecord(params: {
    tenantId: string;
    recordId: string;
  }): Promise<void>;
}
```

**Events Published:**
- `hos.anesthesia.record.created.v1`
- `hos.anesthesia.preop.completed.v1`
- `hos.anesthesia.induced.v1`
- `hos.anesthesia.observation.recorded.v1`  // High-frequency event
- `hos.anesthesia.medication.administered.v1`
- `hos.anesthesia.case.completed.v1`

**Events Subscribed:**
- `hos.surgical.case.created.v1` → Create anesthesia record
- `hos.surgical.procedure.started.v1` → Begin intra-op monitoring

---

### 4.4. CssdEngine (Sterilization & Traceability)

**Purpose:** Equipment sterilization, instrument tracking, cycle management.

**Methods:**
```typescript
interface CssdEngine {
  // Register equipment
  registerEquipment(params: {
    tenantId: string;
    equipmentCode: string;
    equipmentName: string;
    equipmentType: 'Instrument Set' | 'Device' | 'Implant' | 'Consumable';
    requiresSterilization: boolean;
    sterilizationMethod?: 'Autoclave' | 'ETO' | 'Plasma';
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
  }): Promise<{ equipmentId: string }>;
  
  // Start sterilization cycle
  startCycle(params: {
    tenantId: string;
    sterilizerId: string;
    sterilizationMethod: 'Autoclave' | 'ETO' | 'Plasma';
    equipmentItems: Array<{
      equipmentId: string;
      quantity: number;
      loadPosition: string;  // A1, B2, C3
    }>;
    operatorId: string;
  }): Promise<{ cycleId: string; cycleNumber: string }>;
  
  // Complete sterilization cycle
  completeCycle(params: {
    tenantId: string;
    cycleId: string;
    cycleEndTime: Date;
    temperatureCelsius: number;
    pressureKpa: number;
    durationMinutes: number;
    biologicalIndicatorResult: 'Pass' | 'Fail' | 'Pending';
    chemicalIndicatorResult: 'Pass' | 'Fail';
    verifiedBy: string;
  }): Promise<void>;
  
  // Issue equipment to OR
  issueEquipment(params: {
    tenantId: string;
    orScheduleId: string;
    equipmentId: string;
    quantityUsed: number;
    sterilizationCycleId: string;
  }): Promise<void>;
  
  // Return equipment from OR
  returnEquipment(params: {
    tenantId: string;
    usageId: string;
    returnedAt: Date;
    conditionOnReturn: 'Clean' | 'Contaminated' | 'Damaged';
    notes?: string;
  }): Promise<void>;
  
  // Query traceability
  getEquipmentTraceability(params: {
    tenantId: string;
    surgicalCaseId: string;
  }): Promise<Array<{
    equipmentName: string;
    cycleNumber: string;
    cycleDate: Date;
    biologicalIndicatorResult: string;
  }>>;
}
```

**Events Published:**
- `hos.cssd.cycle.started.v1`
- `hos.cssd.cycle.completed.v1`
- `hos.cssd.equipment.issued.v1`
- `hos.cssd.equipment.returned.v1`

**Events Subscribed:**
- `hos.or.scheduled.v1` → Reserve equipment
- `hos.surgical.procedure.completed.v1` → Trigger return workflow

---

### 4.5. PacuEngine (Post-Anesthesia Recovery)

**Purpose:** PACU admission, recovery assessment, discharge readiness.

**Methods:**
```typescript
interface PacuEngine {
  // Admit to PACU
  admitToPacu(params: {
    tenantId: string;
    surgicalCaseId: string;
    encounterId: string;
    nurseId: string;
  }): Promise<{ admissionId: string }>;
  
  // Record Aldrete score (recovery assessment)
  recordAldreteScore(params: {
    tenantId: string;
    admissionId: string;
    aldreteActivity: 0 | 1 | 2;
    aldreteRespiration: 0 | 1 | 2;
    aldreteCirculation: 0 | 1 | 2;
    aldreteConsciousness: 0 | 1 | 2;
    aldreteColor: 0 | 1 | 2;
    // Total auto-calculated (0-10)
  }): Promise<{ aldreteTotal: number }>;
  
  // Record pain/nausea scores
  recordRecoveryAssessment(params: {
    tenantId: string;
    admissionId: string;
    painScore: number;  // 0-10
    nauseaScore: number;  // 0-10
    airwayStatus: 'patent' | 'obstructed' | 'requiring support';
    oxygenTherapy: boolean;
    oxygenFlowRateLpm?: number;
    complications?: string;
  }): Promise<void>;
  
  // Evaluate discharge readiness
  evaluateDischargeReadiness(params: {
    tenantId: string;
    admissionId: string;
  }): Promise<{
    ready: boolean;
    criteria: {
      aldreteScore: number;  // Must be >= 9
      painControlled: boolean;  // Pain score <= 3
      nauseaControlled: boolean;  // No active nausea
      vitalStable: boolean;
      patientAlert: boolean;
    };
    blockers: string[];
  }>;
  
  // Discharge from PACU
  dischargeFromPacu(params: {
    tenantId: string;
    admissionId: string;
    dischargeDestination: 'Ward' | 'ICU' | 'Home';
    dischargeTime: Date;
  }): Promise<void>;
}
```

**Events Published:**
- `hos.pacu.admitted.v1`
- `hos.pacu.assessment.recorded.v1`
- `hos.pacu.discharged.v1`

**Events Subscribed:**
- `hos.anesthesia.case.completed.v1` → Admit to PACU
- `hos.surgical.procedure.completed.v1` → Prepare PACU bed

---

### 4.6. ORReadinessEngine (Multi-Factor Readiness)

**Purpose:** Orchestrate readiness checks across all perioperative domains.

**Methods:**
```typescript
interface ORReadinessEngine {
  // Evaluate comprehensive readiness
  evaluateReadiness(params: {
    tenantId: string;
    scheduleId: string;
  }): Promise<{
    overall: 'READY' | 'NOT_READY' | 'BLOCKED';
    score: number;  // 0-100
    factors: {
      roomCleaned: { status: boolean; lastCleanedAt?: Date };
      equipmentAvailable: { status: boolean; missing?: string[] };
      instrumentsSterilized: { status: boolean; cyclesPending?: string[] };
      teamAssigned: { status: boolean; missingRoles?: string[] };
      patientReady: { status: boolean; blockers?: string[] };
      consentSigned: { status: boolean };
      safetyChecklistReady: { status: boolean };
      anesthesiaReady: { status: boolean };
    };
    blockers: Array<{ factor: string; reason: string; severity: 'high' | 'medium' | 'low' }>;
    estimatedReadyTime?: Date;
  }>;
  
  // Subscribe to readiness-affecting events
  onFactorChanged(params: {
    tenantId: string;
    scheduleId: string;
    factor: string;
    newStatus: boolean;
  }): Promise<void>;
  
  // Get readiness history
  getReadinessHistory(params: {
    tenantId: string;
    scheduleId: string;
  }): Promise<Array<{
    timestamp: Date;
    overall: string;
    score: number;
    changedFactor: string;
  }>>;
}
```

**Events Published:**
- `hos.or.ready.v1`  // Overall readiness achieved
- `hos.or.readiness.changed.v1`  // Factor status changed
- `hos.or.blocked.v1`  // Critical blocker detected

**Events Subscribed:**
- `hos.cssd.cycle.completed.v1`
- `hos.surgical.team.assigned.v1`
- `hos.person.consent.signed.v1`
- `hos.surgical.safety.signin.v1`
- `hos.anesthesia.preop.completed.v1`

---

## 5. Deployment Strategy (v1.1 with Clinical Safety)

### 5.1. Prerequisites

**Before Phase B1 deployment:**
1. ✅ Phase A Platform-of-Platforms deployed (73 tenants)
2. ✅ Event Bus operational (memory adapter)
3. ✅ Healthcare Kernel tables exist (`persons`, `encounters`)
4. ✅ Progressive Rollout Strategy v1.1 Clinical Safety **APPROVED**
5. ✅ Shadow Mode infrastructure ready
6. ✅ Clinical Integrity SLO monitoring in place

**New requirement:** MUST NOT deploy migration until rollout strategy v1.1 approved.

### 5.2. Deployment Phases

**Phase B1.0 - Shadow Mode (NEW - 7 days)**
```
Legacy workflow (if exists) → Production
Perioperative Platform → Shadow (observe only)
├── Capture all events
├── Build projections
├── Compare with legacy
└── NO state mutations
```

**Success criteria:**
- 99.99% data equivalence with legacy (if exists)
- 0 cross-tenant leakage in shadow mode
- Event replay successful
- Idempotency verified

**Phase B1.1 - Stage 1 (10% Representative - 48h)**
- 2 small clinics (different specialties)
- 1 medium hospital (OPD + Ward only, NO ICU/OR/ED)
- Low traffic + High traffic mix
- Different enabled modules

**Phase B1.2 - Stage 2 (25% - 48h)**
- Expand to 25% tenants
- Still exclude ICU/OR/ED departments

**Phase B1.3 - Stage 3 (50% + Controlled Pilot - 72h)**
- 45% normal tenants
- 5% high-risk departments (1-2 ICU pilots, 1-2 OR pilots)
- Surgical Safety Checklist enforcement active

**Phase B1.4 - Stage 4 (Gradual 100%)**
- 4A: 70% (24-48h)
- 4B: 85% (24-48h)
- 4C: 100% (7-day hypercare)



### 5.3. Hard Gates (ALL Must Pass Before Stage Progression)

**Clinical Safety Gate:**
- ✅ 0 medication event loss
- ✅ 0 vital sign event loss
- ✅ 0 patient identity mismatch
- ✅ 0 cross-tenant data leakage
- ✅ 0 wrong-site surgery incidents
- ✅ 0 retained instrument incidents

**Data Integrity Gate:**
- ✅ 0 inconsistent surgical case states
- ✅ 0 unreconciled CSSD cycle completions
- ✅ 0 missing PACU admissions after anesthesia completion
- ✅ 0 billing charges without corresponding procedures
- ✅ Event replay produces identical state

**Event Integrity Gate:**
- ✅ DLQ count = 0 for critical events
- ✅ Event delivery p99 < 200ms
- ✅ Event processing success rate > 99.99%
- ✅ Duplicate event rate < 0.01%
- ✅ Out-of-order event rate < 0.01%

**Tenant Isolation Gate:**
- ✅ 0 cross-tenant event delivery
- ✅ 0 cross-tenant query results
- ✅ 0 cross-tenant cache hits
- ✅ RLS policies verified for all 15 tables

**Idempotency Gate:**
- ✅ Replay 1 hour of events → same final state
- ✅ Replay 24 hours → same final state
- ✅ Duplicate event handling verified
- ✅ Concurrent operation handling verified

### 5.4. Feature Flag Configuration

```typescript
{
  flag_key: 'phase_b1_perioperative_platform',
  enabled: false,  // Start disabled
  strategy: 'gradual',
  rollout_config: {
    stage: 'shadow',  // shadow → stage_1 → stage_2 → stage_3 → stage_4a → stage_4b → stage_4c
    enabledTenants: [],  // Populated per stage
    enabledDepartments: {  // ✅ NEW: Department-level granularity
      'tenant-uuid-1': ['OPD', 'Ward', 'Pharmacy'],  // Exclude ICU/OR/ED initially
      'tenant-uuid-2': ['OPD', 'Ward'],
      'tenant-uuid-3': ['OPD', 'Ward', 'ICU'],  // Stage 3 ICU pilot
    },
    rolloutPercentage: 0,
    shadowMode: true,  // ✅ NEW: Shadow mode flag
  },
  metadata: {
    description: 'Perioperative Care Platform (OR, Surgical, Anesthesia, CSSD, PACU)',
    clinical_impact: 'high',
    blast_radius: 'department',
    rollback_safe: true,
    requires_clinical_validation: true,
  }
}
```

---

## 6. Testing Strategy (v1.1 Enterprise)

### 6.1. Unit Tests (Per Engine)

**OREngine:**
- Schedule OR → conflict detection via PostgreSQL EXCLUDE
- Reschedule OR → update tstzrange
- Evaluate readiness → multi-factor check
- Emergency case insertion → priority handling

**SurgicalEngine:**
- Create case → auto-generate case_number
- Assign team → normalized team table
- Safety checklist Sign In → enforce before Time Out
- Safety checklist Time Out → enforce before procedure start
- Complete procedure → trigger charge capture event

**AnesthesiaEngine:**
- Record observation → time-series storage
- Record medication → controlled substance tracking
- ASA classification validation
- Aldrete score calculation

**CssdEngine:**
- Start cycle → auto-generate cycle_number
- Complete cycle → biological indicator validation
- Instrument traceability query → full audit trail
- Equipment issue/return workflow

**PacuEngine:**
- Admit to PACU → Aldrete score initialization
- Discharge readiness → criteria evaluation (score >= 9, pain <= 3)
- Discharge workflow

### 6.2. Integration Tests (Event Flows)

**Flow 1: Complete Surgical Journey**
```
hos.encounter.surgical.created.v1
  → SurgicalEngine.createCase()
  → hos.surgical.case.created.v1
  → AnesthesiaEngine.createRecord()
  → OREngine.scheduleOperation()
  → hos.or.scheduled.v1
  → CssdEngine reserves instruments
  → SurgicalEngine.completeSignIn()
  → SurgicalEngine.completeTimeOut()
  → SurgicalEngine.startProcedure()
  → AnesthesiaEngine records vitals (time-series)
  → SurgicalEngine.completeProcedure()
  → hos.surgical.procedure.completed.v1
  → ChargeCaptureEngine captures charges
  → AnesthesiaEngine.recordPostOp()
  → PacuEngine.admitToPacu()
  → PacuEngine.evaluateDischargeReadiness()
  → PacuEngine.dischargeFromPacu()
```

**Assertions:**
- ✅ All events delivered in order
- ✅ Surgical case state = 'completed'
- ✅ Safety checklist all phases completed
- ✅ Anesthesia observations stored (time-series)
- ✅ CSSD cycle linked to equipment usage
- ✅ PACU admission created
- ✅ Charge captured (NOT direct billing)
- ✅ No data inconsistencies
- ✅ No duplicate events processed

**Flow 2: Safety Checklist Enforcement**
```
Try to start procedure without Sign In
  → Expect: Error 'Cannot start: Sign In not completed'

Try to start procedure without Time Out
  → Expect: Error 'Cannot start: Time Out not completed'

Complete Sign In + Time Out → Start procedure
  → Expect: Success, event 'hos.surgical.procedure.started.v1'
```

**Flow 3: OR Readiness Orchestration**
```
hos.or.scheduled.v1
  → ORReadinessEngine.evaluateReadiness()
  → Expect: NOT_READY (missing factors)

hos.cssd.cycle.completed.v1
  → ORReadinessEngine updates factor
  → Still NOT_READY (other factors missing)

hos.surgical.team.assigned.v1
+ hos.person.consent.signed.v1
+ hos.anesthesia.preop.completed.v1
  → ORReadinessEngine.evaluateReadiness()
  → Expect: READY
  → Event 'hos.or.ready.v1' published
```

**Flow 4: CSSD Traceability**
```
Create surgical case
  → Issue equipment from cycle CYC000123
  → Complete procedure
  → Query traceability
  → Expect: Full audit trail (cycle number, BI result, timestamps)
```

### 6.3. End-to-End Tests

**E2E Test 1: Elective Surgery (Complete Journey)**
- Create patient encounter
- Create surgical case
- Assign surgical team (5 members: surgeon, assistant, anesthesiologist, 2 nurses)
- Schedule OR
- Reserve instruments (CSSD)
- Complete Sign In checklist
- Complete Time Out checklist
- Start procedure
- Record 50 anesthesia observations (simulate 2-hour surgery)
- Administer 10 medications
- Collect 2 specimens
- Implant 1 device
- Complete procedure
- Complete Sign Out checklist
- Admit to PACU
- Record Aldrete scores (every 15 min)
- Discharge to ward
- **Verify:** All states consistent, all events delivered, no data loss

**E2E Test 2: Emergency Case Insertion**
- Pre-condition: OR scheduled with elective case at 09:00
- Emergency case arrives at 09:30
- Bump elective case (reschedule to 14:00)
- Schedule emergency case at 09:30
- **Verify:** No double booking, elective case rescheduled, notifications sent

**E2E Test 3: CSSD Cycle Failure**
- Start sterilization cycle
- Biological indicator result = 'Fail'
- Mark cycle as failed
- **Verify:** Equipment not available for OR, readiness blocked

### 6.4. Performance Tests

**Load Test Scenarios:**
- 100 concurrent OR schedules (conflict detection)
- 1000 anesthesia observations/minute (time-series ingestion)
- 50 concurrent surgical case creations
- 500 CSSD cycles/day

**Performance SLOs:**
- OR availability check: p95 < 100ms
- Schedule OR: p95 < 200ms
- Record observation: p95 < 50ms
- Event end-to-end latency: p95 < 50ms, p99 < 200ms
- Readiness evaluation: p95 < 150ms

### 6.5. Security Tests

**Multi-Tenancy Isolation:**
- Tenant A creates surgical case → Tenant B query returns 0 results
- Tenant A event → Tenant B subscriber does NOT receive
- RLS policy enforcement on all 15 tables

**Cross-Tenant Attack Vectors:**
- Inject tenant_id in request → verify rejected
- Query with wrong tenant_id → verify 0 results
- Event with mismatched tenant_id → verify dropped

---

## 7. Success Criteria (v1.1 Enterprise)

### 7.1. Phase B1 Complete When:

**Deployment:**
- ✅ All 15 tables deployed successfully
- ✅ All 6 engines implemented and tested
- ✅ Event Bus wiring complete (10+ event types)
- ✅ Shadow Mode passed (99.99% equivalence)
- ✅ 100% eligible tenants/departments migrated

**Clinical Safety (P0):**
- ✅ 0 patient-safety incidents
- ✅ 0 medication/vital event loss
- ✅ 0 wrong-site surgery incidents
- ✅ 0 retained instrument incidents
- ✅ 0 patient identity mismatches
- ✅ 0 cross-tenant data leakage

**Data Integrity (P0):**
- ✅ 0 unreconciled clinical states
- ✅ 0 unreconciled financial charges
- ✅ 0 orphaned PACU admissions
- ✅ 0 missing safety checklists
- ✅ Event replay verification passed

**Event Integrity (P0):**
- ✅ DLQ = 0 for critical events
- ✅ Event delivery success rate > 99.99%
- ✅ p95 event latency < 50ms
- ✅ p99 event latency < 200ms
- ✅ Duplicate rate < 0.01%

**Performance (P1):**
- ✅ OR availability check p95 < 100ms
- ✅ Schedule OR p95 < 200ms
- ✅ Record observation p95 < 50ms
- ✅ Readiness evaluation p95 < 150ms

**Testing (P1):**
- ✅ Unit test coverage > 80%
- ✅ Integration tests: 10/10 event flows pass
- ✅ E2E tests: 3/3 scenarios pass
- ✅ Performance tests: all SLOs met
- ✅ Security tests: 0 tenant isolation violations

**Operational (P1):**
- ✅ Rollback tested successfully
- ✅ 7-day hypercare period completed
- ✅ 0 critical incidents during hypercare
- ✅ Monitoring dashboards operational
- ✅ Runbooks documented

**Documentation (P2):**
- ✅ API documentation complete
- ✅ Event catalog published
- ✅ Runbooks for on-call
- ✅ Architecture decision records (ADRs)

### 7.2. Feature Flag Removal Criteria

Can remove `phase_b1_perioperative_platform` flag when:
- ✅ 100% production tenants stable for 30 days
- ✅ 0 rollbacks required
- ✅ All success criteria met
- ✅ Legacy workflow (if any) fully deprecated
- ✅ Clinical validation complete
- ✅ Regulatory approval obtained (if required)

---

## 8. Constitution Compliance Matrix

| Law | Requirement | Compliance | Evidence |
|-----|-------------|------------|----------|
| **Law 3: Multi-Tenancy** | All data isolated by tenant | ✅ YES | 15 tables with `tenant_id`, RLS policies, tenant isolation tests |
| **Law 5: Event-Driven** | Domain events for all state changes | ✅ YES | 20+ event types, Event Bus wiring, correlation/causation IDs |
| **Law 7: Single Source of Truth** | Each domain owns its data | ✅ YES | Surgical Case owns procedures, Anesthesia owns observations, CSSD owns cycles |
| **Law 8: Idempotency** | Operations safe to retry | ✅ YES | Event replay tests, duplicate handling, idempotency keys |
| **Law 10: Clinical Safety** (NEW) | No patient safety compromise | ✅ YES | Safety checklist enforcement, 0 event loss SLO, readiness gates |

**New Law Proposed:**
> **Law 10 — Clinical Safety & Data Integrity:**  
> Platform evolution MUST NOT compromise patient identity, clinical state, medication state, financial integrity, or cross-tenant isolation. Clinical event loss rate = 0. Patient safety incidents = 0.

---

## 9. Risk Assessment & Mitigation

### 9.1. High-Risk Areas

**Risk 1: OR Schedule Double-Booking**
- **Mitigation:** PostgreSQL EXCLUDE constraint (database-level atomic protection)
- **Fallback:** Manual schedule review dashboard
- **Detection:** Real-time conflict alerts

**Risk 2: Safety Checklist Bypass**
- **Mitigation:** Enforce at engine level (cannot start procedure without Time Out)
- **Fallback:** Audit trail review, compliance reports
- **Detection:** Safety checklist completion monitoring

**Risk 3: Anesthesia Observation Loss**
- **Mitigation:** Time-series table with indexed storage, event replay capability
- **Fallback:** Manual entry from paper charts
- **Detection:** Observation gap detection (> 5 min interval alert)

**Risk 4: CSSD Traceability Break**
- **Mitigation:** Normalized cycle items table, full audit trail
- **Fallback:** Manual cycle documentation
- **Detection:** Missing sterilization cycle alerts

**Risk 5: Cross-Tenant Data Leakage**
- **Mitigation:** RLS policies on all tables, tenant isolation tests
- **Fallback:** Immediate rollback, data audit
- **Detection:** Cross-tenant query monitoring

### 9.2. Rollback Plan

**Automated Rollback Triggers:**
- Patient identity mismatch detected
- Cross-tenant data leakage detected
- Critical event DLQ > 0
- Safety checklist bypass detected

**Manual Rollback Process:**
1. Disable feature flag (`phase_b1_perioperative_platform = false`)
2. Stop Event Bus subscribers for Perioperative events
3. Drain event queue (process remaining events)
4. Verify legacy workflow operational (if exists)
5. Post-mortem analysis
6. Fix root cause
7. Re-enable with fix

**Rollback Testing:**
- Quarterly rollback drills
- Rollback from each stage
- Verify data consistency after rollback

---

## 10. Next Steps

### 10.1. Implementation Checklist

**Phase B1 Task List:**
- [ ] Task #1: Design v1.1 Enterprise (✅ COMPLETE)
- [ ] Task #2: Create database migration (BLOCKED - awaiting rollout strategy v1.1 approval)
- [ ] Task #3: Implement OREngine with contracts
- [ ] Task #4: Implement SurgicalEngine with contracts
- [ ] Task #5: Implement AnesthesiaEngine with contracts
- [ ] Task #6: Implement CssdEngine with contracts
- [ ] Task #7: Implement PacuEngine with contracts
- [ ] Task #8: Implement ORReadinessEngine with contracts
- [ ] Task #9: Wire Event Bus (20+ event flows)
- [ ] Task #10: Create UI pages with hooks (5 pages)
- [ ] Task #11: Write unit tests (6 engines)
- [ ] Task #12: Write integration tests (10 event flows)
- [ ] Task #13: Write E2E tests (3 scenarios)
- [ ] Task #14: Performance testing
- [ ] Task #15: Security testing (tenant isolation)
- [ ] Task #16: Deploy to staging
- [ ] Task #17: Shadow Mode (7 days)
- [ ] Task #18: Progressive rollout (Stages 1-4)
- [ ] Task #19: Hypercare (7 days)
- [ ] Task #20: Documentation & handoff

### 10.2. Pre-Migration Requirements

**MUST complete before Task #2:**
1. ✅ Design v1.1 approved
2. ❌ Progressive Rollout Strategy v1.1 Clinical Safety approved
3. ❌ Shadow Mode infrastructure ready
4. ❌ Clinical Integrity SLO monitoring configured
5. ❌ Healthcare Kernel verified (persons, encounters tables)

### 10.3. Dependencies

**Upstream (Healthcare Kernel):**
- `persons` table
- `encounters` table
- `hc_staff` table
- `hc_patients` table (legacy, but still referenced by kernel)

**Downstream (Supporting Domains):**
- Laboratory Engine (specimen analysis)
- Pharmacy Engine (medication administration)
- Imaging Engine (intra-op imaging)
- Revenue Cycle Engine (charge capture, coding)

---

**Document Status:** ✅ COMPLETE (v1.1 Enterprise-Ready)  
**Reviewed By:** AI Agent + User  
**Last Updated:** 2026-08-07  
**Next Review:** After Progressive Rollout Strategy v1.1 approval  
**Migration Blocker:** Awaiting rollout strategy v1.1 approval
