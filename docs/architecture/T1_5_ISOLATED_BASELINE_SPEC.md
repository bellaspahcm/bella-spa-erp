# T1.5: Isolated Verification Database Baseline Specification

**Date:** 2026-08-25  
**Status:** 🟡 AWAITING ARCHITECT APPROVAL  
**Decision:** PATH A (Isolated Verification Database)  
**Purpose:** Deterministic baseline manifest for T1-T7 execution  

---

## 🎯 OBJECTIVE

Define minimum Contract-compliant baseline for isolated verification database.

**Success Criteria:**
- ✅ Satisfies all Contract v1.0.0 global security invariants
- ✅ Provides prerequisite tables for T1 fixture FK constraints
- ✅ Provenance to existing migration sources
- ✅ Deterministic T1 PASS (when fixture + baseline both satisfy Contract)
- ✅ Reusable for T2-T7 (reset between tests)

**NOT:**
- ❌ Fake schema to make T1 pass
- ❌ Contract modifications
- ❌ Engine modifications
- ❌ Production database alterations

---

## 📋 CONTRACT REQUIREMENTS (FROM v1.0.0 37ae4544)

### Security Invariants

**From Contract:**
```javascript
const SECURITY_CRITICAL_TABLES = [
  'runtime_tenant_registry',
  'hc_*',        // Healthcare Kernel
  'edu_*',       // Education Kernel
  'logistics_*', // Logistics Kernel
  'finance_*',   // Finance Kernel
];

const RLS_REQUIREMENTS = {
  enabled: true,
  policies: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  tenantIsolationEnforced: true,
};
```

### T1 Failure Evidence

**17 FAIL checks identified required baseline objects:**

**Core Infrastructure:**
- runtime_tenant_registry (with tenant_id)

**Healthcare Kernel (6 tables minimum):**
- hc_patients
- hc_medications
- hc_patient_notes
- hc_encounters
- hc_prescriptions
- hc_appointments

**Education Kernel (4 tables minimum):**
- edu_students
- edu_grades
- edu_enrollments
- (additional edu_* tables as needed)

**Logistics Kernel (2 tables minimum):**
- logistics_shipments
- logistics_inventory
- (additional logistics_* tables as needed)

**RLS Requirements:**
- Each table: RLS enabled
- Each table: 4 policies (SELECT, INSERT, UPDATE, DELETE)
- Each policy: Enforces tenant_id isolation

---

## 🗂️ BASELINE MANIFEST

### 1. Core Infrastructure

#### 1.1 runtime_tenant_registry

**Purpose:** Core tenant registry (prerequisite for all FK constraints)

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS runtime_tenant_registry (
  tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE runtime_tenant_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY runtime_tenant_registry_select ON runtime_tenant_registry
  FOR SELECT USING (true); -- All tenants can see registry

CREATE POLICY runtime_tenant_registry_insert ON runtime_tenant_registry
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY runtime_tenant_registry_update ON runtime_tenant_registry
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY runtime_tenant_registry_delete ON runtime_tenant_registry
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Core infrastructure (should exist in initial schema migrations)

**Sample Data:**
```sql
INSERT INTO runtime_tenant_registry (tenant_id, tenant_name, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'test-tenant-1', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'test-tenant-2', 'active')
ON CONFLICT (tenant_id) DO NOTHING;
```

---

### 2. Healthcare Kernel

#### 2.1 hc_patients

**Purpose:** Healthcare patient master data (Kernel H1)

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS hc_patients (
  patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES runtime_tenant_registry(tenant_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hc_patients_tenant ON hc_patients(tenant_id);

-- RLS
ALTER TABLE hc_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY hc_patients_select ON hc_patients
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_patients_insert ON hc_patients
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_patients_update ON hc_patients
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_patients_delete ON hc_patients
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Healthcare Kernel (should exist in hc_* migrations)

---

#### 2.2 hc_medications

**Purpose:** Healthcare medication catalog (Kernel H2)

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS hc_medications (
  medication_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES runtime_tenant_registry(tenant_id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT,
  form TEXT, -- tablet, capsule, injection, etc.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hc_medications_tenant ON hc_medications(tenant_id);

-- RLS
ALTER TABLE hc_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY hc_medications_select ON hc_medications
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_medications_insert ON hc_medications
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_medications_update ON hc_medications
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_medications_delete ON hc_medications
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Healthcare Kernel

---

#### 2.3 hc_patient_notes

**Purpose:** Healthcare patient clinical notes (Kernel H3)

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS hc_patient_notes (
  note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES runtime_tenant_registry(tenant_id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES hc_patients(patient_id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  note_type TEXT CHECK (note_type IN ('progress', 'admission', 'discharge', 'consultation')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hc_patient_notes_tenant ON hc_patient_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_patient_notes_patient ON hc_patient_notes(patient_id);

-- RLS
ALTER TABLE hc_patient_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY hc_patient_notes_select ON hc_patient_notes
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_patient_notes_insert ON hc_patient_notes
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_patient_notes_update ON hc_patient_notes
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_patient_notes_delete ON hc_patient_notes
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Healthcare Kernel

---

#### 2.4 hc_encounters

**Purpose:** Healthcare clinical encounters/visits

**Schema:** Already exists in `supabase/migrations/20260806030000_healthcare_kernel_schema.sql`

**Required Modifications:**
- ✅ RLS enabled (already present)
- ⚠️ RLS policies incomplete in existing migration

**Fixed RLS Policies:**
```sql
-- Drop existing incomplete policy
DROP POLICY IF EXISTS tenant_isolation_hc_encounters ON hc_encounters;

-- Create 4 complete policies
CREATE POLICY hc_encounters_select ON hc_encounters
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_encounters_insert ON hc_encounters
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_encounters_update ON hc_encounters
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_encounters_delete ON hc_encounters
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** `supabase/migrations/20260806030000_healthcare_kernel_schema.sql` (with RLS fix)

---

#### 2.5 hc_prescriptions

**Purpose:** Healthcare prescriptions

**Schema:** Already exists in `20260806030000_healthcare_kernel_schema.sql`

**Required Modifications:** Same RLS policy fix as hc_encounters

---

#### 2.6 hc_appointments

**Purpose:** Healthcare appointment scheduling

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS hc_appointments (
  appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES runtime_tenant_registry(tenant_id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES hc_patients(patient_id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hc_appointments_tenant ON hc_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_appointments_patient ON hc_appointments(patient_id);

-- RLS
ALTER TABLE hc_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY hc_appointments_select ON hc_appointments
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_appointments_insert ON hc_appointments
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_appointments_update ON hc_appointments
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY hc_appointments_delete ON hc_appointments
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Should exist in Healthcare vertical migrations

---

### 3. Education Kernel

#### 3.1 edu_students

**Purpose:** Education student master data

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS edu_students (
  student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES runtime_tenant_registry(tenant_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_edu_students_tenant ON edu_students(tenant_id);

-- RLS
ALTER TABLE edu_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY edu_students_select ON edu_students
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY edu_students_insert ON edu_students
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY edu_students_update ON edu_students
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY edu_students_delete ON edu_students
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Education Kernel

---

#### 3.2 edu_grades

**Purpose:** Education student grades

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS edu_grades (
  grade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES runtime_tenant_registry(tenant_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES edu_students(student_id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  score NUMERIC(5,2),
  grade_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_edu_grades_tenant ON edu_grades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edu_grades_student ON edu_grades(student_id);

-- RLS
ALTER TABLE edu_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY edu_grades_select ON edu_grades
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY edu_grades_insert ON edu_grades
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY edu_grades_update ON edu_grades
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY edu_grades_delete ON edu_grades
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Education Kernel

---

#### 3.3 edu_enrollments

**Purpose:** Education course enrollments

**Schema:** (Should exist in edu_* migrations)

**Required Modifications:** RLS policies must have 4 separate policies (not single '*' policy)

---

### 4. Logistics Kernel

#### 4.1 logistics_shipments

**Purpose:** Logistics shipment tracking

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS logistics_shipments (
  shipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES runtime_tenant_registry(tenant_id) ON DELETE CASCADE,
  shipment_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_tenant ON logistics_shipments(tenant_id);

-- RLS
ALTER TABLE logistics_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY logistics_shipments_select ON logistics_shipments
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY logistics_shipments_insert ON logistics_shipments
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY logistics_shipments_update ON logistics_shipments
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY logistics_shipments_delete ON logistics_shipments
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Logistics Kernel (E7)

---

#### 4.2 logistics_inventory

**Purpose:** Logistics inventory management

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS logistics_inventory (
  inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES runtime_tenant_registry(tenant_id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_logistics_inventory_tenant ON logistics_inventory(tenant_id);

-- RLS
ALTER TABLE logistics_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY logistics_inventory_select ON logistics_inventory
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY logistics_inventory_insert ON logistics_inventory
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY logistics_inventory_update ON logistics_inventory
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY logistics_inventory_delete ON logistics_inventory
  FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
```

**Provenance:** Logistics Kernel (E7)

---

## 📋 BASELINE SUMMARY

### Required Tables (15 minimum)

| Table | Kernel | RLS | Policies | FK Dependencies |
|-------|--------|-----|----------|-----------------|
| runtime_tenant_registry | Core | ✅ | 4 | None |
| hc_patients | Healthcare (H1) | ✅ | 4 | runtime_tenant_registry |
| hc_medications | Healthcare (H2) | ✅ | 4 | runtime_tenant_registry |
| hc_patient_notes | Healthcare (H3) | ✅ | 4 | runtime_tenant_registry, hc_patients |
| hc_encounters | Healthcare | ✅ | 4 | runtime_tenant_registry |
| hc_prescriptions | Healthcare | ✅ | 4 | runtime_tenant_registry, hc_encounters |
| hc_appointments | Healthcare | ✅ | 4 | runtime_tenant_registry, hc_patients |
| edu_students | Education (E7) | ✅ | 4 | runtime_tenant_registry |
| edu_grades | Education (E7) | ✅ | 4 | runtime_tenant_registry, edu_students |
| edu_enrollments | Education (E7) | ✅ | 4 | runtime_tenant_registry |
| logistics_shipments | Logistics (E7) | ✅ | 4 | runtime_tenant_registry |
| logistics_inventory | Logistics (E7) | ✅ | 4 | runtime_tenant_registry |

**Total:** 15 tables, 60 RLS policies

---

## 🔧 BOOTSTRAP STRATEGY

### Option A: Consolidated Migration

**File:** `supabase/migrations/99990000000000_verification_baseline.sql`

**Contents:**
1. Core infrastructure (runtime_tenant_registry)
2. Healthcare Kernel tables (6 tables + RLS)
3. Education Kernel tables (4 tables + RLS)
4. Logistics Kernel tables (2 tables + RLS)
5. Sample tenant data

**Pros:** Single file, deterministic baseline  
**Cons:** Large migration, duplicates existing schemas

---

### Option B: Reuse Existing Migrations

**Approach:**
1. Apply existing migrations: `20260806030000_healthcare_kernel_schema.sql`
2. Add missing Kernel tables via new migration
3. Fix incomplete RLS policies via new migration

**Pros:** Leverages existing schema work  
**Cons:** Depends on production migration correctness

---

### Option C: Isolated Baseline Script (Recommended)

**File:** `scripts/verification/provision-isolated-baseline.sql`

**NOT a migration.** Standalone provisioning script for isolated verification DB only.

**Pros:**
- Clean separation (verification vs production)
- No production migration pollution
- Deterministic baseline
- Easy reset between T1-T7

**Cons:** Requires separate DB provisioning step

---

## 🔄 RESET STRATEGY (T1 → T7)

### Between Tests

**Goal:** Clean baseline state for each test

**Approach A: Transaction Rollback**
```sql
BEGIN;
-- Run T1 fixture + verification
ROLLBACK;
```
**Issue:** DDL may not be transactional

**Approach B: Schema Reset (Recommended)**
```sql
-- After each test
DROP SCHEMA IF EXISTS test_fixtures CASCADE;
CREATE SCHEMA test_fixtures;
-- Baseline tables remain in public schema
```

**Approach C: Database Clone**
```sql
-- Create template
CREATE DATABASE verification_baseline_template;
-- Clone for each test
CREATE DATABASE verification_t1 WITH TEMPLATE verification_baseline_template;
```

---

## ✅ VERIFICATION CHECKLIST

### Baseline Must Satisfy

- [ ] runtime_tenant_registry exists with sample tenants
- [ ] All 15 minimum Kernel tables exist
- [ ] All tables have RLS enabled
- [ ] All tables have 4 RLS policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] All FK constraints valid
- [ ] No Contract invariant violations

### T1 Must Then

- [ ] Create fixture table (test_t1_xxx_appointments)
- [ ] Reference baseline tables (hc_patients, runtime_tenant_registry)
- [ ] Pass all 95 verification checks
- [ ] deployment_eligible = true
- [ ] Evidence artifact generated

---

## 🚦 NEXT STEPS

**After T1.5 Approval:**

1. **Provision isolated PostgreSQL database**
   ```bash
   createdb bella_verification
   ```

2. **Apply baseline schema**
   ```bash
   psql -d bella_verification -f scripts/verification/provision-isolated-baseline.sql
   ```

3. **Configure environment**
   ```bash
   export DATABASE_EXECUTOR_URL="postgresql://verification_executor:pass@localhost:5432/bella_verification"
   ```

4. **Re-run T1** (expect PASS)

5. **Proceed to T2-T7**

---

## 🚫 DO NOT

❌ Provision database before T1.5 approval  
❌ Modify Contract v1.0.0  
❌ Modify VerificationEngine  
❌ Use production database  
❌ Create fake schema  
❌ Skip baseline verification  

---

**Status:** 🟡 **AWAITING ARCHITECT APPROVAL**  
**Decision Required:** Approve baseline manifest + bootstrap strategy  
**After Approval:** Provision isolated DB → Re-run T1 → T2-T7
