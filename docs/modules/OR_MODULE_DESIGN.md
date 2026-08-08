# Operating Room (OR) Module Design

**Version:** 1.0  
**Date:** 2026-08-07  
**Status:** Phase B1 - Design  
**Constitution Compliance:** Law 5 (Event-Driven), Law 7 (Single Source of Truth)

---

## 1. Overview

### 1.1. Purpose
Operating Room (OR) Module quản lý toàn bộ chu trình phẫu thuật:
- OR scheduling và room availability
- Surgical case management (team, procedures, outcomes)
- Anesthesia records (pre-op, intra-op, post-op)
- Equipment tracking và CSSD (Central Sterile Supply Department)

### 1.2. Key Features
1. **OR Scheduling:** Book/cancel/reschedule operations, conflict detection
2. **Surgical Case Management:** Create cases, assign team, track procedures
3. **Anesthesia Records:** Pre-op assessment, intra-op monitoring, ASA classification
4. **Equipment Tracking:** Instrument sets, sterilization cycles, traceability
5. **CSSD Integration:** Sterilization workflow, equipment readiness

### 1.3. Engines
- **OREngine:** OR scheduling và room management
- **SurgicalEngine:** Surgical case lifecycle
- **AnesthesiaEngine:** Anesthesia documentation
- **CssdEngine:** Equipment tracking và sterilization

---

## 2. Architecture

### 2.1. Platform-of-Platforms Pattern
```
┌─────────────────────────────────────────────────────────┐
│                    OR Module UI                         │
│  /dashboard/hospital/or/schedule                        │
│  /dashboard/hospital/or/cases                           │
│  /dashboard/hospital/or/anesthesia                      │
│  /dashboard/hospital/or/equipment                       │
└─────────────────────────────────────────────────────────┘
                          ↕ (hooks)
┌─────────────────────────────────────────────────────────┐
│              Platform Host (Event Bus)                  │
│  - ORScheduled → Equipment Reservation                  │
│  - SurgicalCaseCreated → Anesthesia Pre-op              │
│  - ProcedureCompleted → Billing                         │
│  - EquipmentSterilized → OR Availability                │
└─────────────────────────────────────────────────────────┘
                          ↕ (contracts)
┌──────────────┬──────────────┬──────────────┬────────────┐
│  OREngine    │ SurgicalEng  │ AnesthesiaEng│ CssdEngine │
│  - schedule  │ - createCase │ - preOpAssess│ - track    │
│  - cancel    │ - assignTeam │ - intraOp    │ - sterilize│
│  - check     │ - complete   │ - postOp     │ - ready    │
└──────────────┴──────────────┴──────────────┴────────────┘
                          ↕ (database)
┌─────────────────────────────────────────────────────────┐
│                   Healthcare Database                    │
│  hc_operating_rooms, hc_or_schedules,                   │
│  hc_surgical_cases, hc_anesthesia_records,              │
│  hc_equipment, hc_cssd_sterilization_cycles             │
└─────────────────────────────────────────────────────────┘
```

### 2.2. Event Flows
1. **OR Booking → Equipment Reservation:**
   - User books OR → OREngine.scheduleOperation()
   - Publishes `ORScheduled` event
   - CssdEngine subscribes → reserves instrument sets

2. **Case Creation → Anesthesia Pre-op:**
   - Surgeon creates case → SurgicalEngine.createCase()
   - Publishes `SurgicalCaseCreated` event
   - AnesthesiaEngine subscribes → schedules pre-op assessment

3. **Procedure Completed → Billing:**
   - Surgeon completes case → SurgicalEngine.completeProcedure()
   - Publishes `ProcedureCompleted` event
   - BillingEngine subscribes → generates invoice

4. **Equipment Sterilized → OR Ready:**
   - CSSD completes sterilization → CssdEngine.markReady()
   - Publishes `EquipmentSterilized` event
   - OREngine subscribes → updates room status to ready

---

## 3. Database Schema

### 3.1. hc_operating_rooms
Operating room master data.

```sql
CREATE TABLE hc_operating_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  room_number VARCHAR(20) NOT NULL,
  room_name VARCHAR(100) NOT NULL,
  floor VARCHAR(20),
  department VARCHAR(100),
  room_type VARCHAR(50) NOT NULL, -- General, Cardiac, Neuro, Ortho, etc.
  status VARCHAR(20) NOT NULL DEFAULT 'available', -- available, occupied, cleaning, maintenance
  equipment_list TEXT[], -- Fixed equipment (lights, tables, monitors)
  capacity_max_hours_per_day NUMERIC(4,2) DEFAULT 16.00, -- Max OR hours per day
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  CONSTRAINT uq_or_room_number UNIQUE (tenant_id, room_number)
);

CREATE INDEX idx_or_rooms_tenant ON hc_operating_rooms(tenant_id);
CREATE INDEX idx_or_rooms_status ON hc_operating_rooms(tenant_id, status);
```

### 3.2. hc_or_schedules
OR booking schedules.

```sql
CREATE TABLE hc_or_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  operating_room_id UUID NOT NULL REFERENCES hc_operating_rooms(id),
  surgical_case_id UUID REFERENCES hc_surgical_cases(id),
  patient_id UUID NOT NULL REFERENCES hc_patients(id),
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME NOT NULL,
  estimated_duration_minutes INT NOT NULL,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  priority VARCHAR(20) DEFAULT 'routine', -- emergency, urgent, routine, elective
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  CONSTRAINT chk_schedule_times CHECK (scheduled_end_time > scheduled_start_time)
);

CREATE INDEX idx_or_schedules_tenant ON hc_or_schedules(tenant_id);
CREATE INDEX idx_or_schedules_date ON hc_or_schedules(tenant_id, scheduled_date);
CREATE INDEX idx_or_schedules_room ON hc_or_schedules(operating_room_id, scheduled_date);
CREATE INDEX idx_or_schedules_patient ON hc_or_schedules(patient_id);
```

### 3.3. hc_surgical_cases
Surgical case management.

```sql
CREATE TABLE hc_surgical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES hc_patients(id),
  admission_id UUID REFERENCES hc_admissions(id),
  case_number VARCHAR(50) NOT NULL, -- Auto-generated
  case_type VARCHAR(50) NOT NULL, -- Elective, Emergency, Trauma
  primary_surgeon_id UUID NOT NULL REFERENCES hc_staff(id),
  assistant_surgeon_ids UUID[], -- Array of surgeon IDs
  anesthesiologist_id UUID REFERENCES hc_staff(id),
  scrub_nurse_id UUID REFERENCES hc_staff(id),
  circulating_nurse_id UUID REFERENCES hc_staff(id),
  primary_diagnosis_code VARCHAR(20), -- ICD-10
  primary_diagnosis_text TEXT NOT NULL,
  planned_procedures JSONB NOT NULL, -- [{ code: 'CPT-12345', name: 'Appendectomy' }]
  actual_procedures JSONB, -- Procedures actually performed
  pre_op_diagnosis TEXT,
  post_op_diagnosis TEXT,
  surgical_findings TEXT,
  complications TEXT,
  blood_loss_ml INT,
  transfusion_given BOOLEAN DEFAULT false,
  specimens_collected TEXT[],
  status VARCHAR(20) NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, cancelled
  outcome VARCHAR(50), -- successful, complicated, aborted
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  CONSTRAINT uq_case_number UNIQUE (tenant_id, case_number)
);

CREATE INDEX idx_surgical_cases_tenant ON hc_surgical_cases(tenant_id);
CREATE INDEX idx_surgical_cases_patient ON hc_surgical_cases(patient_id);
CREATE INDEX idx_surgical_cases_surgeon ON hc_surgical_cases(primary_surgeon_id);
CREATE INDEX idx_surgical_cases_date ON hc_surgical_cases(tenant_id, created_at);
```

### 3.4. hc_anesthesia_records
Anesthesia documentation (pre-op, intra-op, post-op).

```sql
CREATE TABLE hc_anesthesia_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  surgical_case_id UUID NOT NULL REFERENCES hc_surgical_cases(id),
  or_schedule_id UUID REFERENCES hc_or_schedules(id),
  patient_id UUID NOT NULL REFERENCES hc_patients(id),
  anesthesiologist_id UUID NOT NULL REFERENCES hc_staff(id),
  
  -- Pre-op Assessment
  asa_classification VARCHAR(10) NOT NULL, -- ASA I, II, III, IV, V, VI
  pre_op_vital_signs JSONB, -- { bp: '120/80', hr: 72, rr: 16, temp: 36.5, spo2: 98 }
  allergies TEXT[],
  current_medications TEXT[],
  medical_history TEXT,
  airway_assessment TEXT,
  mallampati_score INT, -- 1-4
  npo_status_hours NUMERIC(4,1), -- Hours fasting
  consent_obtained BOOLEAN DEFAULT false,
  
  -- Anesthesia Plan
  anesthesia_type VARCHAR(50) NOT NULL, -- General, Regional, Local, Sedation
  anesthesia_technique TEXT, -- e.g., Endotracheal intubation, LMA, Spinal, Epidural
  planned_agents TEXT[],
  
  -- Intra-op Monitoring
  induction_time TIMESTAMPTZ,
  intubation_time TIMESTAMPTZ,
  maintenance_agents JSONB, -- [{ agent: 'Sevoflurane', dose: '2%', start: '10:30', end: '12:00' }]
  intra_op_vitals JSONB, -- Time-series vitals
  intra_op_events JSONB, -- [{ time: '11:00', event: 'Hypotension', action: 'Ephedrine 10mg' }]
  fluids_given JSONB, -- [{ type: 'Ringer Lactate', volume_ml: 1000 }]
  
  -- Emergence and Post-op
  extubation_time TIMESTAMPTZ,
  emergence_time TIMESTAMPTZ,
  post_op_vital_signs JSONB,
  post_op_pain_score INT, -- 0-10
  post_op_nausea BOOLEAN DEFAULT false,
  complications TEXT,
  discharge_to VARCHAR(50), -- PACU, ICU, Ward
  
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, completed, reviewed
  reviewed_by UUID REFERENCES hc_staff(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_anesthesia_records_tenant ON hc_anesthesia_records(tenant_id);
CREATE INDEX idx_anesthesia_records_case ON hc_anesthesia_records(surgical_case_id);
CREATE INDEX idx_anesthesia_records_patient ON hc_anesthesia_records(patient_id);
CREATE INDEX idx_anesthesia_records_anesthesiologist ON hc_anesthesia_records(anesthesiologist_id);
```

### 3.5. hc_equipment
Medical equipment and instrument sets.

```sql
CREATE TABLE hc_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  equipment_code VARCHAR(50) NOT NULL,
  equipment_name VARCHAR(200) NOT NULL,
  equipment_type VARCHAR(50) NOT NULL, -- Instrument Set, Device, Implant
  category VARCHAR(100), -- Orthopedic, Cardiac, General Surgery, etc.
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  purchase_date DATE,
  warranty_expiry DATE,
  last_maintenance_date DATE,
  next_maintenance_due DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'available', -- available, in_use, sterilizing, maintenance, retired
  location VARCHAR(100), -- OR1, CSSD, Storage
  requires_sterilization BOOLEAN DEFAULT false,
  sterilization_method VARCHAR(50), -- Autoclave, ETO, Plasma
  quantity INT DEFAULT 1,
  reusable BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  CONSTRAINT uq_equipment_code UNIQUE (tenant_id, equipment_code)
);

CREATE INDEX idx_equipment_tenant ON hc_equipment(tenant_id);
CREATE INDEX idx_equipment_status ON hc_equipment(tenant_id, status);
CREATE INDEX idx_equipment_type ON hc_equipment(tenant_id, equipment_type);
```

### 3.6. hc_cssd_sterilization_cycles
CSSD sterilization tracking.

```sql
CREATE TABLE hc_cssd_sterilization_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cycle_number VARCHAR(50) NOT NULL, -- Auto-generated
  sterilizer_id VARCHAR(50) NOT NULL, -- Machine ID
  sterilization_method VARCHAR(50) NOT NULL, -- Autoclave, ETO, Plasma
  cycle_start_time TIMESTAMPTZ NOT NULL,
  cycle_end_time TIMESTAMPTZ,
  temperature_celsius NUMERIC(5,2),
  pressure_kpa NUMERIC(6,2),
  duration_minutes INT,
  equipment_ids UUID[], -- Array of equipment IDs sterilized in this cycle
  biological_indicator_result VARCHAR(20), -- Pass, Fail, Pending
  chemical_indicator_result VARCHAR(20), -- Pass, Fail
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress, completed, failed, aborted
  operator_id UUID NOT NULL REFERENCES hc_staff(id),
  verified_by UUID REFERENCES hc_staff(id),
  verified_at TIMESTAMPTZ,
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  CONSTRAINT uq_cycle_number UNIQUE (tenant_id, cycle_number)
);

CREATE INDEX idx_cssd_cycles_tenant ON hc_cssd_sterilization_cycles(tenant_id);
CREATE INDEX idx_cssd_cycles_date ON hc_cssd_sterilization_cycles(tenant_id, cycle_start_time);
CREATE INDEX idx_cssd_cycles_status ON hc_cssd_sterilization_cycles(tenant_id, status);
```

### 3.7. hc_or_equipment_usage
Track equipment usage per OR case (junction table).

```sql
CREATE TABLE hc_or_equipment_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  or_schedule_id UUID NOT NULL REFERENCES hc_or_schedules(id),
  surgical_case_id UUID REFERENCES hc_surgical_cases(id),
  equipment_id UUID NOT NULL REFERENCES hc_equipment(id),
  quantity_used INT DEFAULT 1,
  sterilization_cycle_id UUID REFERENCES hc_cssd_sterilization_cycles(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  condition_on_return VARCHAR(50), -- Clean, Contaminated, Damaged
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_equipment_usage_tenant ON hc_or_equipment_usage(tenant_id);
CREATE INDEX idx_equipment_usage_schedule ON hc_or_equipment_usage(or_schedule_id);
CREATE INDEX idx_equipment_usage_equipment ON hc_or_equipment_usage(equipment_id);
```

---

## 4. Engine Contracts

### 4.1. OREngine

**Purpose:** OR scheduling và room availability management.

**Methods:**
```typescript
interface OREngine {
  // Schedule OR
  scheduleOperation(params: {
    tenantId: string;
    operatingRoomId: string;
    patientId: string;
    surgicalCaseId?: string;
    scheduledDate: Date;
    scheduledStartTime: string; // HH:mm
    estimatedDurationMinutes: number;
    priority: 'emergency' | 'urgent' | 'routine' | 'elective';
    notes?: string;
  }): Promise<{ scheduleId: string }>;
  
  // Cancel OR booking
  cancelSchedule(params: {
    tenantId: string;
    scheduleId: string;
    cancellationReason: string;
  }): Promise<void>;
  
  // Reschedule OR
  rescheduleOperation(params: {
    tenantId: string;
    scheduleId: string;
    newDate: Date;
    newStartTime: string;
  }): Promise<void>;
  
  // Check OR availability
  checkAvailability(params: {
    tenantId: string;
    operatingRoomId: string;
    date: Date;
    startTime: string;
    durationMinutes: number;
  }): Promise<{ available: boolean; conflicts: string[] }>;
  
  // Get OR schedule
  getSchedule(params: {
    tenantId: string;
    date: Date;
    operatingRoomId?: string;
  }): Promise<ORSchedule[]>;
  
  // Start OR case
  startCase(params: {
    tenantId: string;
    scheduleId: string;
    actualStartTime: Date;
  }): Promise<void>;
  
  // Complete OR case
  completeCase(params: {
    tenantId: string;
    scheduleId: string;
    actualEndTime: Date;
  }): Promise<void>;
}
```

**Events Published:**
- `ORScheduled` - When OR is booked
- `ORCancelled` - When OR booking is cancelled
- `ORRescheduled` - When OR is rescheduled
- `ORCaseStarted` - When OR case starts
- `ORCaseCompleted` - When OR case ends

**Events Subscribed:**
- `EquipmentSterilized` - Update room status to ready

---

### 4.2. SurgicalEngine

**Purpose:** Surgical case lifecycle management.

**Methods:**
```typescript
interface SurgicalEngine {
  // Create surgical case
  createCase(params: {
    tenantId: string;
    patientId: string;
    admissionId?: string;
    caseType: 'Elective' | 'Emergency' | 'Trauma';
    primarySurgeonId: string;
    primaryDiagnosisText: string;
    plannedProcedures: Array<{ code: string; name: string }>;
  }): Promise<{ caseId: string; caseNumber: string }>;
  
  // Assign surgical team
  assignTeam(params: {
    tenantId: string;
    caseId: string;
    assistantSurgeonIds?: string[];
    anesthesiologistId?: string;
    scrubNurseId?: string;
    circulatingNurseId?: string;
  }): Promise<void>;
  
  // Start procedure
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
  
  // Get case details
  getCaseDetails(params: {
    tenantId: string;
    caseId: string;
  }): Promise<SurgicalCase>;
}
```

**Events Published:**
- `SurgicalCaseCreated` - When case is created
- `SurgicalTeamAssigned` - When team is assigned
- `ProcedureStarted` - When procedure starts
- `ProcedureCompleted` - When procedure ends

**Events Subscribed:**
- `ORScheduled` - Link case to OR schedule

---

### 4.3. AnesthesiaEngine

**Purpose:** Anesthesia record documentation (pre-op, intra-op, post-op).

**Methods:**
```typescript
interface AnesthesiaEngine {
  // Create anesthesia record
  createRecord(params: {
    tenantId: string;
    surgicalCaseId: string;
    patientId: string;
    anesthesiologistId: string;
  }): Promise<{ recordId: string }>;
  
  // Pre-op assessment
  recordPreOpAssessment(params: {
    tenantId: string;
    recordId: string;
    asaClassification: 'ASA I' | 'ASA II' | 'ASA III' | 'ASA IV' | 'ASA V' | 'ASA VI';
    preOpVitalSigns: VitalSigns;
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
  
  // Record intra-op events
  recordIntraOpEvent(params: {
    tenantId: string;
    recordId: string;
    eventTime: Date;
    eventType: 'induction' | 'intubation' | 'maintenance' | 'vital_change' | 'complication' | 'intervention';
    details: any;
  }): Promise<void>;
  
  // Record post-op data
  recordPostOp(params: {
    tenantId: string;
    recordId: string;
    extubationTime?: Date;
    emergenceTime: Date;
    postOpVitalSigns: VitalSigns;
    postOpPainScore: number; // 0-10
    postOpNausea: boolean;
    complications?: string;
    dischargeTo: 'PACU' | 'ICU' | 'Ward';
  }): Promise<void>;
  
  // Complete record
  completeRecord(params: {
    tenantId: string;
    recordId: string;
  }): Promise<void>;
  
  // Get record
  getRecord(params: {
    tenantId: string;
    recordId: string;
  }): Promise<AnesthesiaRecord>;
}
```

**Events Published:**
- `AnesthesiaRecordCreated` - When record is created
- `PreOpAssessmentCompleted` - When pre-op is done
- `AnesthesiaInduced` - When anesthesia starts
- `PatientRecovered` - When patient is stable post-op

**Events Subscribed:**
- `SurgicalCaseCreated` - Create anesthesia record
- `ProcedureStarted` - Begin intra-op monitoring

---

### 4.4. CssdEngine

**Purpose:** Equipment tracking và sterilization management.

**Methods:**
```typescript
interface CssdEngine {
  // Register equipment
  registerEquipment(params: {
    tenantId: string;
    equipmentCode: string;
    equipmentName: string;
    equipmentType: string;
    requiresSterilization: boolean;
    sterilizationMethod?: string;
  }): Promise<{ equipmentId: string }>;
  
  // Start sterilization cycle
  startSterilizationCycle(params: {
    tenantId: string;
    sterilizerId: string;
    sterilizationMethod: 'Autoclave' | 'ETO' | 'Plasma';
    equipmentIds: string[];
    operatorId: string;
  }): Promise<{ cycleId: string; cycleNumber: string }>;
  
  // Complete sterilization cycle
  completeSterilizationCycle(params: {
    tenantId: string;
    cycleId: string;
    cycleEndTime: Date;
    biologicalIndicatorResult: 'Pass' | 'Fail';
    chemicalIndicatorResult: 'Pass' | 'Fail';
    verifiedBy: string;
  }): Promise<void>;
  
  // Issue equipment to OR
  issueEquipment(params: {
    tenantId: string;
    orScheduleId: string;
    equipmentId: string;
    quantityUsed: number;
    sterilizationCycleId?: string;
  }): Promise<void>;
  
  // Return equipment from OR
  returnEquipment(params: {
    tenantId: string;
    usageId: string;
    returnedAt: Date;
    conditionOnReturn: 'Clean' | 'Contaminated' | 'Damaged';
  }): Promise<void>;
  
  // Check equipment availability
  checkEquipmentAvailability(params: {
    tenantId: string;
    equipmentId: string;
    date: Date;
  }): Promise<{ available: boolean; nextAvailable?: Date }>;
}
```

**Events Published:**
- `EquipmentRegistered` - When equipment is added
- `SterilizationCycleStarted` - When cycle begins
- `EquipmentSterilized` - When cycle completes successfully
- `EquipmentIssued` - When equipment is sent to OR
- `EquipmentReturned` - When equipment is returned

**Events Subscribed:**
- `ORScheduled` - Reserve equipment for OR case
- `ProcedureCompleted` - Trigger equipment return workflow

---

## 5. Event Wiring

### 5.1. Event Flow Diagram

```
┌──────────────────┐
│   ORScheduled    │
└────────┬─────────┘
         │
         ├──────────────────────────────────┐
         │                                  │
         ▼                                  ▼
┌────────────────────┐          ┌─────────────────────┐
│ CssdEngine         │          │ SurgicalEngine      │
│ reserves equipment │          │ links case to       │
│ for OR date        │          │ schedule            │
└────────────────────┘          └─────────────────────┘


┌────────────────────────┐
│ SurgicalCaseCreated    │
└──────────┬─────────────┘
           │
           ▼
┌─────────────────────────┐
│ AnesthesiaEngine        │
│ creates pre-op record   │
│ schedules assessment    │
└─────────────────────────┘


┌──────────────────────┐
│ ProcedureCompleted   │
└────────┬─────────────┘
         │
         ├───────────────────────────────────┐
         │                                   │
         ▼                                   ▼
┌────────────────────┐          ┌──────────────────────┐
│ BillingEngine      │          │ CssdEngine           │
│ generates invoice  │          │ triggers equipment   │
│ for procedures     │          │ return workflow      │
└────────────────────┘          └──────────────────────┘


┌───────────────────────┐
│ EquipmentSterilized   │
└─────────┬─────────────┘
          │
          ▼
┌─────────────────────┐
│ OREngine            │
│ updates OR status   │
│ to ready            │
└─────────────────────┘
```

### 5.2. Event Wiring Code

Will be implemented in `src/platform/host/event-bus/wiring/or-workflows.wiring.ts`:

```typescript
// OR Scheduled → Equipment Reservation
eventBus.subscribe('ORScheduled', async (event) => {
  const cssdEngine = await getCssdEngine(event.tenantId);
  await cssdEngine.reserveEquipmentForCase({
    tenantId: event.tenantId,
    orScheduleId: event.scheduleId,
    date: event.scheduledDate,
  });
});

// Surgical Case Created → Anesthesia Pre-op
eventBus.subscribe('SurgicalCaseCreated', async (event) => {
  const anesthesiaEngine = await getAnesthesiaEngine(event.tenantId);
  await anesthesiaEngine.createRecord({
    tenantId: event.tenantId,
    surgicalCaseId: event.caseId,
    patientId: event.patientId,
    anesthesiologistId: event.anesthesiologistId,
  });
});

// Procedure Completed → Billing
eventBus.subscribe('ProcedureCompleted', async (event) => {
  const billingEngine = await getBillingEngine(event.tenantId);
  await billingEngine.generateInvoiceForProcedures({
    tenantId: event.tenantId,
    patientId: event.patientId,
    procedures: event.actualProcedures,
    surgicalCaseId: event.caseId,
  });
});

// Equipment Sterilized → OR Ready
eventBus.subscribe('EquipmentSterilized', async (event) => {
  const orEngine = await getOREngine(event.tenantId);
  await orEngine.updateRoomStatusIfReady({
    tenantId: event.tenantId,
    equipmentIds: event.equipmentIds,
  });
});
```

---

## 6. UI Pages

### 6.1. OR Schedule Page
**Route:** `/dashboard/hospital/or/schedule`

**Features:**
- Calendar view (day/week/month)
- Room-wise schedule grid
- Book/cancel/reschedule OR
- Conflict detection
- Emergency case insertion
- Utilization statistics

**Hook:** `useOREngine()`

### 6.2. Surgical Cases Page
**Route:** `/dashboard/hospital/or/cases`

**Features:**
- List of surgical cases (today, upcoming, past)
- Create new case
- Assign surgical team
- View case details
- Link to OR schedule
- Procedure documentation
- Outcome tracking

**Hook:** `useSurgicalEngine()`

### 6.3. Anesthesia Records Page
**Route:** `/dashboard/hospital/or/anesthesia`

**Features:**
- Pre-op assessment form
- Intra-op monitoring (vitals timeline)
- Post-op recovery data
- ASA classification
- Drug administration log
- Complication tracking

**Hook:** `useAnesthesiaEngine()`

### 6.4. Equipment Tracking Page
**Route:** `/dashboard/hospital/or/equipment`

**Features:**
- Equipment inventory list
- Sterilization cycle tracking
- Issue equipment to OR
- Return equipment from OR
- Maintenance schedule
- Traceability reports

**Hook:** `useCssdEngine()`

---

## 7. Testing Strategy

### 7.1. Unit Tests
- OREngine: schedule conflicts, availability checks
- SurgicalEngine: case lifecycle, team assignment
- AnesthesiaEngine: ASA validation, vitals recording
- CssdEngine: sterilization cycle validation

### 7.2. Integration Tests
- Event flow: ORScheduled → Equipment Reservation
- Event flow: SurgicalCaseCreated → Anesthesia Pre-op
- Event flow: ProcedureCompleted → Billing
- Event flow: EquipmentSterilized → OR Ready
- Multi-engine workflow: Book OR → Create Case → Complete Procedure → Bill

### 7.3. E2E Tests
- Complete OR workflow: Schedule → Team Assignment → Procedure → Billing
- Emergency case insertion (bump elective case)
- Equipment sterilization cycle → OR availability
- Anesthesia record completion → Discharge to PACU

---

## 8. Deployment Plan

### 8.1. Database Migration
1. Run migration: `20270107_create_or_module_tables.sql`
2. Verify schema: `\d hc_operating_rooms` (and other tables)
3. Seed test data: 3 operating rooms, 5 equipment items

### 8.2. Engine Deployment
1. Deploy OREngine, SurgicalEngine, AnesthesiaEngine, CssdEngine
2. Deploy event wiring: `or-workflows.wiring.ts`
3. Verify Event Bus connections

### 8.3. Feature Flag
- Create flag: `phase_b1_operating_room`
- Initial rollout: 0% (pilot tenants only)
- Gradual rollout: 10% → 25% → 50% → 100%
- Monitoring: OR booking errors, event flow latency

### 8.4. Monitoring Metrics
- OR utilization rate (scheduled hours / available hours)
- Surgical case turnaround time (end of case → next case start)
- Anesthesia record completion rate
- Equipment sterilization cycle time
- Event flow success rate (ORScheduled → Equipment Reserved)

---

## 9. Risk Mitigation

### 9.1. OR Schedule Conflicts
**Risk:** Double-booking same OR
**Mitigation:** 
- Database constraint on overlapping schedules
- Real-time availability check before booking
- Lock mechanism during booking

### 9.2. Equipment Availability
**Risk:** Equipment not sterilized in time for OR
**Mitigation:**
- Event-driven workflow (EquipmentSterilized → OR Ready)
- Real-time equipment status tracking
- Alert if sterilization cycle fails

### 9.3. Anesthesia Record Completeness
**Risk:** Incomplete anesthesia records (regulatory issue)
**Mitigation:**
- Required field validation (ASA classification, vital signs)
- Auto-save drafts every 5 minutes
- Prevent OR case completion if anesthesia record incomplete

### 9.4. Event Bus Failures
**Risk:** Event not delivered → downstream action missed
**Mitigation:**
- Event persistence in database
- Retry logic for failed events (3 attempts)
- Dead letter queue for failed events
- Alert if event flow breaks

---

## 10. Constitution Compliance

### 10.1. Law 5: Event-Driven Architecture ✅
- All engines publish domain events
- Event Bus coordinates workflows
- Loose coupling between engines

### 10.2. Law 7: Single Source of Truth ✅
- `hc_or_schedules` is source of truth for OR bookings
- `hc_surgical_cases` is source of truth for surgical data
- `hc_anesthesia_records` is source of truth for anesthesia
- `hc_equipment` is source of truth for equipment status

### 10.3. Law 3: Multi-Tenancy ✅
- All tables have `tenant_id` column
- All queries filter by tenant
- Row-level security policies enforced

### 10.4. Law 8: Idempotency ✅
- Engine methods are idempotent (safe to retry)
- Event handlers check for duplicates before processing

---

## 11. Success Criteria

### 11.1. Functional
- [ ] Can schedule OR without conflicts
- [ ] Can create surgical case and assign team
- [ ] Can document anesthesia record (pre-op, intra-op, post-op)
- [ ] Can track equipment sterilization cycles
- [ ] Event flows work correctly (ORScheduled → Equipment Reserved, etc.)

### 11.2. Technical
- [ ] All engines pass unit tests
- [ ] Integration tests pass (8/8 event flows)
- [ ] UI pages render correctly
- [ ] Feature flag rollout completes without errors

### 11.3. Performance
- [ ] OR availability check < 200ms
- [ ] Event flow latency < 1 second
- [ ] Anesthesia record auto-save < 500ms

### 11.4. Regulatory (Future)
- [ ] Anesthesia records meet hospital standards
- [ ] Equipment traceability compliant with ISO 13485
- [ ] Audit trail for all OR schedule changes

---

## 12. Next Steps

1. **Task #2:** Create database migrations (7 tables)
2. **Task #3-6:** Implement 4 engines (OREngine, SurgicalEngine, AnesthesiaEngine, CssdEngine)
3. **Task #7:** Wire event flows via Event Bus
4. **Task #8:** Create UI pages with hooks
5. **Task #9:** Write integration tests
6. **Task #10:** Deploy and enable feature flag

---

**Document Status:** ✅ Ready for Implementation  
**Reviewed By:** AI Agent  
**Last Updated:** 2026-08-07
