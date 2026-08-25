# Bella Dental — Data Ownership Map

**Product:** Bella Dental  
**Version:** 1.0.0-alpha  
**Purpose:** Define WHO OWNS WHAT DATA to prevent Kernel boundary violations  
**Status:** 🚧 ARCHITECTURE ANALYSIS (Phase 1)

---

## I. Ownership Principles

### Rule 1: Single Owner per Entity

**Every piece of data has exactly ONE authoritative owner:**
- ✅ **Kernel owns core clinical entities** (Patient, Doctor, Encounter)
- ✅ **Product owns specialty-specific extensions** (Tooth Chart, Dental Procedure)
- ❌ **Never duplicate Kernel entities** in Product tables

---

### Rule 2: Foreign Key = Owner Reference

**Product tables reference Kernel entities via foreign keys:**
```sql
-- ✅ CORRECT: Product references Kernel
CREATE TABLE dental_tooth_chart (
  id UUID PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES hc_persons(id),  -- Kernel owns person
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id), -- Kernel owns encounter
  tooth_number INT NOT NULL,
  condition VARCHAR(50) NOT NULL,
  tenant_id UUID NOT NULL
);

-- ❌ FORBIDDEN: Product duplicates Kernel data
CREATE TABLE dental_patients (
  id UUID PRIMARY KEY,
  name VARCHAR(255),      -- ❌ Duplicate of hc_persons.name
  date_of_birth DATE,     -- ❌ Duplicate of hc_persons.dob
  phone VARCHAR(50)       -- ❌ Duplicate of hc_persons.phone
);
```

---

### Rule 3: Read via Contract, Write to Own Tables

**Product READS Kernel data via Contracts, WRITES to Product tables:**
```typescript
// ✅ CORRECT: Read from Kernel via Contract
const patient = await PersonEngineContract.getPersonById(personId);

// ✅ CORRECT: Write to Product table
await db.insert('dental_tooth_chart', {
  person_id: patient.id,
  tooth_number: 11,
  condition: 'decayed'
});

// ❌ FORBIDDEN: Direct write to Kernel table
await db.insert('hc_persons', { ... }); // Violation!
```

---

## II. Ownership Matrix

### Healthcare Kernel H1-H12 (FROZEN — Owns Core Entities)

| Entity / Data | Owner | Kernel Engine | Access Method |
|---------------|-------|---------------|---------------|
| **Patient Profile** | Kernel | H1: Person Engine | `PersonEngineContract.getPersonById()` |
| **Dentist Profile** | Kernel | H1: Person Engine | `PersonEngineContract.getPersonById()` |
| **Encounter (Visit)** | Kernel | H2: Encounter Engine | `EncounterEngineContract.createEncounter()` |
| **Clinical Order (Prescription)** | Kernel | H4: Clinical/Pharmacy | `ClinicalOrderContract.createOrder()` |
| **Medication List** | Kernel | H4: Clinical/Pharmacy | `ClinicalOrderContract.getMedications()` |
| **Clinical Safety Rules** | Kernel | H8: CDS Engine | `ClinicalDecisionContract.checkInteractions()` |
| **Treatment Protocol** | Kernel | H10: Governance | `RuleGovernanceContract.validateProtocol()` |
| **Historical State @ T** | Kernel | H9: Temporal Engine | `TemporalEngineContract.getStateAtTime()` |
| **Audit Trail** | Kernel | H11: Audit Engine | `AuditEngineContract.recordAction()` |
| **User Authentication** | Kernel | Identity Platform | `AuthContract.authenticate()` |
| **Role & Permissions** | Kernel | Identity Platform | `AuthContract.checkPermission()` |

**Key Insight:** Product NEVER writes to these. Product READS via Contracts and references via foreign keys.

---

### Bella Dental Product Vertical (Owns Specialty Extensions)

| Entity / Data | Owner | Table | Purpose |
|---------------|-------|-------|---------|
| **Tooth Chart** | Product | `dental_tooth_chart` | Tooth-by-tooth condition tracking |
| **Tooth History** | Product | `dental_tooth_chart` (bitemporal) | Historical tooth states |
| **Dental Assessment** | Product | `dental_assessments` | Oral exam, periodontal assessment |
| **Treatment Plan** | Product | `dental_treatment_plans` | Multi-step treatment plans |
| **Treatment Plan Steps** | Product | `dental_treatment_plan_steps` | Individual procedures in plan |
| **Dental Procedure** | Product | `dental_procedures` | Executed procedures (filling, root canal, etc.) |
| **Procedure Materials** | Product | `dental_procedure_materials` | Materials used per procedure |
| **Billing Projection** | Product | `dental_billing_projections` (read-model) | Calculated costs, payment tracking |

**Key Insight:** Product owns these tables and can write freely (within tenant boundaries).

---

## III. Detailed Ownership Breakdown

### 1. Patient Management

#### WHO OWNS PATIENT DATA?

**Owner:** Healthcare Kernel H1 (Person Engine)

**Kernel Owns:**
- ✅ Patient name, DOB, gender, contact info
- ✅ Patient medical history
- ✅ Patient insurance info
- ✅ Patient consent forms

**Product MUST:**
- ✅ Read patient data via `PersonEngineContract`
- ✅ Reference patient via foreign key `person_id`
- ❌ Never duplicate patient data in `dental_patients` table

**Example:**
```typescript
// ✅ CORRECT
const patient = await PersonEngineContract.getPersonById(personId);

// Create dental tooth chart referencing Kernel patient
await db.insert('dental_tooth_chart', {
  person_id: patient.id,  // Foreign key to Kernel
  encounter_id: encounterId,
  tooth_number: 11,
  condition: 'healthy'
});

// ❌ FORBIDDEN
await db.insert('dental_patients', {
  name: patient.name,  // Duplicate!
  dob: patient.dob     // Duplicate!
});
```

---

### 2. Dentist Management

#### WHO OWNS DENTIST DATA?

**Owner:** Healthcare Kernel H1 (Person Engine)

**Kernel Owns:**
- ✅ Dentist name, credentials, license number
- ✅ Dentist specialization
- ✅ Dentist working hours
- ✅ Dentist role & permissions

**Product MUST:**
- ✅ Read dentist data via `PersonEngineContract`
- ✅ Reference dentist via foreign key `dentist_id`
- ❌ Never create separate `dental_staff` table

**Example:**
```typescript
// ✅ CORRECT
const dentist = await PersonEngineContract.getPersonById(dentistId);

// Link procedure to dentist
await db.insert('dental_procedures', {
  dentist_id: dentist.id,  // Foreign key to Kernel
  procedure_type: 'root_canal',
  ...
});
```

---

### 3. Clinical Encounter (Visit)

#### WHO OWNS ENCOUNTER DATA?

**Owner:** Healthcare Kernel H2 (Encounter Engine)

**Kernel Owns:**
- ✅ Encounter start/end time
- ✅ Encounter status (scheduled, in-progress, completed)
- ✅ Encounter type (outpatient, emergency)
- ✅ Encounter location (clinic branch)

**Product MUST:**
- ✅ Create encounter via `EncounterEngineContract.createEncounter()`
- ✅ Reference encounter via foreign key `encounter_id`
- ✅ Link all dental actions to encounter
- ❌ Never create `dental_visits` table

**Example:**
```typescript
// ✅ CORRECT
const encounter = await EncounterEngineContract.createEncounter({
  personId: patientId,
  type: 'outpatient',
  chiefComplaint: 'Toothache on upper left molar'
});

// Link dental assessment to encounter
await db.insert('dental_assessments', {
  encounter_id: encounter.id,  // Foreign key to Kernel
  oral_exam_notes: 'Cavity detected on tooth 26',
  ...
});
```

---

### 4. Tooth Chart

#### WHO OWNS TOOTH CHART DATA?

**Owner:** Bella Dental Product Vertical

**Product Owns:**
- ✅ Tooth number (1-32 for adults, A-T for children)
- ✅ Tooth condition (healthy, decayed, filled, missing, crown, bridge, implant)
- ✅ Surface notation (mesial, distal, occlusal, buccal, lingual)
- ✅ Tooth chart history (bitemporal timeline)

**Product Table:**
```sql
CREATE TABLE dental_tooth_chart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES hc_persons(id),  -- Kernel owns person
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id),  -- Kernel owns encounter
  tooth_number INT NOT NULL CHECK (tooth_number BETWEEN 1 AND 32),
  condition VARCHAR(50) NOT NULL CHECK (condition IN ('healthy', 'decayed', 'filled', 'missing', 'crown', 'bridge', 'implant')),
  surface VARCHAR(50),  -- 'MOD', 'DO', 'B', etc.
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID NOT NULL REFERENCES hc_persons(id),  -- Dentist who charted
  tenant_id UUID NOT NULL,
  
  -- Bitemporal tracking (H9 Temporal Engine pattern)
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  transaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT dental_tooth_chart_tenant_person_tooth_key UNIQUE (tenant_id, person_id, tooth_number, valid_from)
);

-- RLS Policy
ALTER TABLE dental_tooth_chart ENABLE ROW LEVEL SECURITY;

CREATE POLICY dental_tooth_chart_tenant_isolation ON dental_tooth_chart
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Why Product owns this:**
- ✅ Dental-specific domain (not used by other specialties)
- ✅ No Kernel engine for tooth charting
- ✅ Extension of patient data, not core patient entity

---

### 5. Dental Assessment

#### WHO OWNS DENTAL ASSESSMENT DATA?

**Owner:** Bella Dental Product Vertical

**Product Owns:**
- ✅ Chief complaint
- ✅ Oral cavity examination findings
- ✅ Periodontal assessment (pocket depth, bleeding, mobility)
- ✅ Radiograph interpretation notes
- ✅ Diagnosis & differential diagnosis

**Product Table:**
```sql
CREATE TABLE dental_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id),  -- Kernel owns encounter
  person_id UUID NOT NULL REFERENCES hc_persons(id),  -- Kernel owns person
  dentist_id UUID NOT NULL REFERENCES hc_persons(id),  -- Kernel owns dentist
  
  chief_complaint TEXT NOT NULL,
  oral_exam_notes TEXT,
  
  -- Periodontal assessment (6 points per tooth: MB, B, DB, ML, L, DL)
  periodontal_chart JSONB,  -- { "11": [3, 2, 3, 2, 3, 2], "12": [...], ... }
  
  radiograph_notes TEXT,
  diagnosis TEXT,
  differential_diagnosis TEXT,
  
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,
  
  CONSTRAINT dental_assessments_encounter_key UNIQUE (encounter_id)
);

-- RLS Policy
ALTER TABLE dental_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY dental_assessments_tenant_isolation ON dental_assessments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Why Product owns this:**
- ✅ Dental-specific structured data
- ✅ Not part of Kernel clinical observation model
- ✅ References Kernel encounter for audit trail

---

### 6. Treatment Plan

#### WHO OWNS TREATMENT PLAN DATA?

**Owner:** Bella Dental Product Vertical

**Product Owns:**
- ✅ Treatment plan phases (Emergency, Restoration, Maintenance)
- ✅ Procedure list with estimated costs
- ✅ Plan status (draft, proposed, accepted, completed, cancelled)
- ✅ Patient consent timestamp

**Product Tables:**
```sql
CREATE TABLE dental_treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES hc_persons(id),  -- Kernel owns person
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id),  -- Kernel owns encounter
  dentist_id UUID NOT NULL REFERENCES hc_persons(id),  -- Kernel owns dentist
  
  plan_title VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'accepted', 'in_progress', 'completed', 'cancelled')),
  
  total_estimated_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  patient_consent_at TIMESTAMPTZ,
  patient_consent_signature TEXT,  -- Base64 encoded signature image
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

CREATE TABLE dental_treatment_plan_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_plan_id UUID NOT NULL REFERENCES dental_treatment_plans(id) ON DELETE CASCADE,
  
  phase VARCHAR(50) NOT NULL CHECK (phase IN ('emergency', 'restoration', 'maintenance')),
  sequence_order INT NOT NULL,
  
  procedure_type VARCHAR(100) NOT NULL,  -- 'filling', 'root_canal', 'crown', 'extraction', etc.
  tooth_number INT CHECK (tooth_number BETWEEN 1 AND 32),
  surface VARCHAR(50),
  
  estimated_cost DECIMAL(10, 2) NOT NULL,
  estimated_duration_minutes INT,
  
  notes TEXT,
  
  status VARCHAR(50) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES hc_persons(id),
  
  tenant_id UUID NOT NULL,
  
  CONSTRAINT treatment_plan_steps_order_key UNIQUE (treatment_plan_id, sequence_order)
);

-- RLS Policies
ALTER TABLE dental_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_treatment_plan_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY dental_treatment_plans_tenant_isolation ON dental_treatment_plans
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY dental_treatment_plan_steps_tenant_isolation ON dental_treatment_plan_steps
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Why Product owns this:**
- ✅ Dental-specific workflow
- ✅ Aggregate of procedures (not individual Kernel orders)
- ✅ Treatment planning is product-level concern

---

### 7. Dental Procedure (Execution)

#### WHO OWNS PROCEDURE EXECUTION DATA?

**Owner:** Bella Dental Product Vertical

**Product Owns:**
- ✅ Procedure performed (filling, root canal, extraction, crown prep, etc.)
- ✅ Materials used
- ✅ Procedure duration
- ✅ Clinical notes and complications
- ✅ Link to treatment plan step

**Product Table:**
```sql
CREATE TABLE dental_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id),  -- Kernel owns encounter
  person_id UUID NOT NULL REFERENCES hc_persons(id),  -- Kernel owns person
  dentist_id UUID NOT NULL REFERENCES hc_persons(id),  -- Kernel owns dentist
  assistant_id UUID REFERENCES hc_persons(id),  -- Kernel owns assistant
  
  treatment_plan_step_id UUID REFERENCES dental_treatment_plan_steps(id),  -- Optional link to plan
  
  procedure_type VARCHAR(100) NOT NULL,
  tooth_number INT CHECK (tooth_number BETWEEN 1 AND 32),
  surface VARCHAR(50),
  
  clinical_notes TEXT,
  complications TEXT,
  
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) STORED,
  
  billed_amount DECIMAL(10, 2),
  billing_status VARCHAR(50) DEFAULT 'pending' CHECK (billing_status IN ('pending', 'billed', 'paid')),
  
  tenant_id UUID NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dental_procedure_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id UUID NOT NULL REFERENCES dental_procedures(id) ON DELETE CASCADE,
  
  material_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  
  lot_number VARCHAR(100),
  expiry_date DATE,
  
  tenant_id UUID NOT NULL
);

-- RLS Policies
ALTER TABLE dental_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_procedure_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY dental_procedures_tenant_isolation ON dental_procedures
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY dental_procedure_materials_tenant_isolation ON dental_procedure_materials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Why Product owns this:**
- ✅ Dental-specific execution details
- ✅ Procedure is atomic unit of dental work
- ✅ References Kernel encounter for audit context

---

## IV. Interaction Patterns

### Pattern 1: Create New Dental Patient Visit

**Flow:**
```typescript
// Step 1: Get patient from Kernel (or create if new)
const patient = await PersonEngineContract.getPersonById(personId);

// Step 2: Create encounter via Kernel
const encounter = await EncounterEngineContract.createEncounter({
  personId: patient.id,
  type: 'outpatient',
  chiefComplaint: 'Toothache on upper right molar'
});

// Step 3: Create dental assessment (Product owns)
const assessment = await db.insert('dental_assessments', {
  encounter_id: encounter.id,
  person_id: patient.id,
  dentist_id: currentUserId,
  chief_complaint: 'Toothache on tooth 16',
  oral_exam_notes: 'Large cavity detected on occlusal surface',
  tenant_id: currentTenantId
});

// Step 4: Update tooth chart (Product owns)
await db.insert('dental_tooth_chart', {
  person_id: patient.id,
  encounter_id: encounter.id,
  tooth_number: 16,
  condition: 'decayed',
  surface: 'O',
  recorded_by: currentUserId,
  tenant_id: currentTenantId
});

// Step 5: Audit action via Kernel
await AuditEngineContract.recordAction({
  actor: currentUserId,
  action: 'DENTAL_ASSESSMENT_CREATED',
  encounter: encounter.id,
  details: { assessmentId: assessment.id }
});
```

**Ownership:**
- ✅ Patient → Kernel (H1)
- ✅ Encounter → Kernel (H2)
- ✅ Assessment → Product
- ✅ Tooth Chart → Product
- ✅ Audit → Kernel (H11)

---

### Pattern 2: Create Treatment Plan

**Flow:**
```typescript
// Step 1: Create plan (Product owns)
const plan = await db.insert('dental_treatment_plans', {
  person_id: patientId,
  encounter_id: encounterId,
  dentist_id: currentUserId,
  plan_title: 'Comprehensive Restoration Plan',
  status: 'draft',
  tenant_id: currentTenantId
});

// Step 2: Add plan steps (Product owns)
const steps = [
  { phase: 'emergency', procedure_type: 'extraction', tooth_number: 18, estimated_cost: 500000 },
  { phase: 'restoration', procedure_type: 'filling', tooth_number: 16, estimated_cost: 300000 },
  { phase: 'maintenance', procedure_type: 'cleaning', estimated_cost: 200000 }
];

for (const [index, step] of steps.entries()) {
  await db.insert('dental_treatment_plan_steps', {
    treatment_plan_id: plan.id,
    sequence_order: index + 1,
    ...step,
    tenant_id: currentTenantId
  });
}

// Step 3: Calculate total cost
const totalCost = steps.reduce((sum, s) => sum + s.estimated_cost, 0);
await db.update('dental_treatment_plans', {
  id: plan.id,
  total_estimated_cost: totalCost
});

// Step 4: Audit action via Kernel
await AuditEngineContract.recordAction({
  actor: currentUserId,
  action: 'DENTAL_TREATMENT_PLAN_CREATED',
  encounter: encounterId,
  details: { planId: plan.id, totalCost }
});
```

**Ownership:**
- ✅ Plan → Product
- ✅ Steps → Product
- ✅ Audit → Kernel (H11)

---

## V. Forbidden Patterns (Anti-Patterns)

### Anti-Pattern 1: Duplicate Patient Data ❌

```sql
-- ❌ FORBIDDEN
CREATE TABLE dental_patients (
  id UUID PRIMARY KEY,
  name VARCHAR(255),      -- ❌ Duplicate of hc_persons.name
  dob DATE,               -- ❌ Duplicate of hc_persons.dob
  phone VARCHAR(50),      -- ❌ Duplicate of hc_persons.phone
  address TEXT            -- ❌ Duplicate of hc_persons.address
);
```

**Why forbidden:** Violates Single Owner principle. Kernel owns patient data.

**Correct approach:** Reference via foreign key `person_id`

---

### Anti-Pattern 2: Direct Kernel Table Query ❌

```typescript
// ❌ FORBIDDEN
const patient = await db.query('SELECT * FROM hc_persons WHERE id = $1', [personId]);
```

**Why forbidden:** Violates Contract-Only Access principle.

**Correct approach:**
```typescript
// ✅ CORRECT
const patient = await PersonEngineContract.getPersonById(personId);
```

---

### Anti-Pattern 3: Modify Kernel Table ❌

```sql
-- ❌ FORBIDDEN
ALTER TABLE hc_encounters ADD COLUMN dental_notes TEXT;
```

**Why forbidden:** Violates Zero Kernel Modification principle. H1-H12 FROZEN.

**Correct approach:**
```sql
-- ✅ CORRECT
CREATE TABLE dental_assessments (
  id UUID PRIMARY KEY,
  encounter_id UUID REFERENCES hc_encounters(id),  -- Foreign key
  dental_notes TEXT  -- Product owns this
);
```

---

### Anti-Pattern 4: Bypass Audit Trail ❌

```typescript
// ❌ FORBIDDEN
await db.insert('dental_procedures', { ... });
// No audit call!
```

**Why forbidden:** Violates Full Auditability principle (Law 9).

**Correct approach:**
```typescript
// ✅ CORRECT
await db.insert('dental_procedures', { ... });
await AuditEngineContract.recordAction({
  actor: dentistId,
  action: 'DENTAL_PROCEDURE_COMPLETED',
  ...
});
```

---

## VI. Summary

### Kernel Owns (H1-H12)

✅ Patient, Dentist, Staff (Person Engine)  
✅ Encounter, Visit (Encounter Engine)  
✅ Clinical Orders, Medications (Clinical/Pharmacy Engine)  
✅ Clinical Safety Rules (CDS Engine)  
✅ Treatment Protocols (Governance Engine)  
✅ Historical States (Temporal Engine)  
✅ Audit Trail (Audit Engine)  

**Product READS via Contracts, NEVER writes**

---

### Product Owns (Bella Dental)

✅ Tooth Chart & History  
✅ Dental Assessment  
✅ Treatment Plan & Steps  
✅ Dental Procedures  
✅ Procedure Materials  
✅ Billing Projections  

**Product WRITES freely (within tenant boundaries), references Kernel via foreign keys**

---

**Document Owner:** Kiro AI Development Environment  
**Last Updated:** 2026-08-23  
**Version:** 1.0.0  
**Status:** DRAFT (pending Architecture Review)
