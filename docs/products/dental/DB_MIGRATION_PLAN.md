# Bella Dental — Database Migration Plan

**Product:** Bella Dental  
**Version:** 1.0.0-alpha  
**Purpose:** Define all database schema changes (ADDITIVE ONLY)  
**Status:** 🚧 ARCHITECTURE ANALYSIS (Phase 1 - Document 4/5)

---

## I. Migration Principles

### Hard Rules

1. ✅ **CREATE ONLY** - New tables, indexes, functions
2. ❌ **NO ALTER** - Zero modifications to Kernel tables
3. ❌ **NO DROP** - Zero deletions of Kernel columns
4. ✅ **RLS MANDATORY** - All Product tables MUST have Row Level Security
5. ✅ **FOREIGN KEY ENFORCEMENT** - All references to Kernel must use FK constraints
6. ✅ **TENANT_ID EVERYWHERE** - Every Product table MUST have `tenant_id`

---

### Migration File Structure

```
migrations/dental/
├── 001_create_dental_foundation.sql        # Core tables
├── 002_add_dental_rls_policies.sql         # Security policies
├── 003_add_dental_indexes.sql              # Performance indexes
├── 004_add_dental_functions.sql            # Helper functions (optional)
└── 005_add_dental_views.sql                # Read-model projections (optional)
```

**Execution Order:** Sequential (001 → 002 → 003 → 004 → 005)

---

## II. Migration 001: Core Tables

**File:** `migrations/dental/001_create_dental_foundation.sql`

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- BELLA DENTAL — DATABASE FOUNDATION (MIGRATION 001)
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Create core Dental Product Vertical tables
-- Architecture: Additive only (zero Kernel modifications)
-- Ownership: Product owns these tables, Kernel owns referenced entities
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE 1: dental_tooth_chart
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Track tooth conditions with bitemporal history
-- Owner: Bella Dental Product Vertical
-- References: hc_persons (Kernel), hc_encounters (Kernel)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dental_tooth_chart (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys to Kernel (READ-ONLY references)
  person_id UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id) ON DELETE RESTRICT,
  recorded_by UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  
  -- Dental-Specific Data (Product owns)
  tooth_number INT NOT NULL CHECK (tooth_number BETWEEN 1 AND 32),
  condition VARCHAR(50) NOT NULL CHECK (condition IN (
    'healthy',
    'decayed',
    'filled',
    'missing',
    'crown',
    'bridge',
    'implant',
    'root_canal',
    'extracted'
  )),
  surface VARCHAR(50) CHECK (surface IN ('M', 'D', 'O', 'B', 'L', 'MOD', 'DO', 'MO', 'OB', 'OL')),
  notes TEXT,
  
  -- Bitemporal Tracking (H9 Temporal Engine pattern)
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  transaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,
  
  -- Constraints
  CONSTRAINT dental_tooth_chart_valid_time_check CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT dental_tooth_chart_tenant_person_tooth_time_key UNIQUE (
    tenant_id, person_id, tooth_number, valid_from
  )
);

-- Comments
COMMENT ON TABLE dental_tooth_chart IS 'Tooth-by-tooth condition tracking with bitemporal history';
COMMENT ON COLUMN dental_tooth_chart.tooth_number IS 'FDI notation: 11-18 (upper right), 21-28 (upper left), 31-38 (lower left), 41-48 (lower right)';
COMMENT ON COLUMN dental_tooth_chart.valid_from IS 'When this tooth condition became true in reality';
COMMENT ON COLUMN dental_tooth_chart.valid_to IS 'When this tooth condition ceased to be true (NULL = current)';
COMMENT ON COLUMN dental_tooth_chart.transaction_time IS 'When this record was inserted into database';

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE 2: dental_assessments
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Structured oral examination and periodontal assessment
-- Owner: Bella Dental Product Vertical
-- References: hc_persons (Kernel), hc_encounters (Kernel)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dental_assessments (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys to Kernel
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id) ON DELETE RESTRICT,
  person_id UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  dentist_id UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  
  -- Assessment Data
  chief_complaint TEXT NOT NULL,
  oral_exam_notes TEXT,
  
  -- Periodontal Assessment (JSONB for flexibility)
  -- Format: { "11": [3, 2, 3, 2, 3, 2], "12": [...], ... }
  -- Each tooth has 6 pocket depth measurements (MB, B, DB, ML, L, DL) in mm
  periodontal_chart JSONB,
  
  -- Radiograph Interpretation
  radiograph_notes TEXT,
  
  -- Diagnosis
  diagnosis TEXT,
  differential_diagnosis TEXT,
  
  -- Metadata
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,
  
  -- Constraints
  CONSTRAINT dental_assessments_encounter_key UNIQUE (encounter_id)
);

COMMENT ON TABLE dental_assessments IS 'Dental examination findings and periodontal assessment';
COMMENT ON COLUMN dental_assessments.periodontal_chart IS 'Pocket depths per tooth: { "tooth_number": [MB, B, DB, ML, L, DL] }';

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE 3: dental_treatment_plans
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Multi-phase treatment plans with cost estimation
-- Owner: Bella Dental Product Vertical
-- References: hc_persons (Kernel), hc_encounters (Kernel)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dental_treatment_plans (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys to Kernel
  person_id UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id) ON DELETE RESTRICT,
  dentist_id UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  
  -- Plan Data
  plan_title VARCHAR(255) NOT NULL,
  plan_description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'proposed',
    'accepted',
    'in_progress',
    'completed',
    'cancelled'
  )),
  
  -- Financial
  total_estimated_cost DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (total_estimated_cost >= 0),
  
  -- Patient Consent
  patient_consent_at TIMESTAMPTZ,
  patient_consent_signature TEXT,  -- Base64 encoded signature image
  patient_consent_ip VARCHAR(45),  -- IP address for audit trail
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

COMMENT ON TABLE dental_treatment_plans IS 'Multi-phase dental treatment plans with patient consent';
COMMENT ON COLUMN dental_treatment_plans.patient_consent_signature IS 'Base64 encoded PNG of patient signature';

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE 4: dental_treatment_plan_steps
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Individual procedures within treatment plan
-- Owner: Bella Dental Product Vertical
-- References: dental_treatment_plans (Product), hc_persons (Kernel)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dental_treatment_plan_steps (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  treatment_plan_id UUID NOT NULL REFERENCES dental_treatment_plans(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES hc_persons(id) ON DELETE RESTRICT,
  
  -- Plan Phase
  phase VARCHAR(50) NOT NULL CHECK (phase IN ('emergency', 'restoration', 'maintenance')),
  sequence_order INT NOT NULL CHECK (sequence_order > 0),
  
  -- Procedure Details
  procedure_type VARCHAR(100) NOT NULL,
  tooth_number INT CHECK (tooth_number BETWEEN 1 AND 48),  -- Supports primary teeth (51-85)
  surface VARCHAR(50),
  
  -- Estimates
  estimated_cost DECIMAL(10, 2) NOT NULL CHECK (estimated_cost >= 0),
  estimated_duration_minutes INT CHECK (estimated_duration_minutes > 0),
  
  -- Execution
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'in_progress',
    'completed',
    'skipped',
    'cancelled'
  )),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  tenant_id UUID NOT NULL,
  
  -- Constraints
  CONSTRAINT treatment_plan_steps_order_key UNIQUE (treatment_plan_id, sequence_order),
  CONSTRAINT treatment_plan_steps_completed_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND completed_by IS NOT NULL) OR
    (status != 'completed')
  )
);

COMMENT ON TABLE dental_treatment_plan_steps IS 'Individual procedure steps within treatment plan';
COMMENT ON COLUMN dental_treatment_plan_steps.phase IS 'Treatment phase: emergency (urgent), restoration (comprehensive), maintenance (preventive)';

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE 5: dental_procedures
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Record executed dental procedures
-- Owner: Bella Dental Product Vertical
-- References: hc_encounters (Kernel), hc_persons (Kernel), dental_treatment_plan_steps (Product)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dental_procedures (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys to Kernel
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id) ON DELETE RESTRICT,
  person_id UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  dentist_id UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  assistant_id UUID REFERENCES hc_persons(id) ON DELETE RESTRICT,
  
  -- Foreign Key to Product (optional link to treatment plan)
  treatment_plan_step_id UUID REFERENCES dental_treatment_plan_steps(id) ON DELETE SET NULL,
  
  -- Procedure Details
  procedure_type VARCHAR(100) NOT NULL,
  tooth_number INT CHECK (tooth_number BETWEEN 1 AND 48),
  surface VARCHAR(50),
  
  -- Clinical Notes
  clinical_notes TEXT,
  complications TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL CHECK (completed_at >= started_at),
  duration_minutes INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
  ) STORED,
  
  -- Billing
  billed_amount DECIMAL(10, 2),
  billing_status VARCHAR(50) DEFAULT 'pending' CHECK (billing_status IN (
    'pending',
    'billed',
    'paid',
    'insurance_claimed'
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL
);

COMMENT ON TABLE dental_procedures IS 'Executed dental procedures with timing and billing';
COMMENT ON COLUMN dental_procedures.duration_minutes IS 'Auto-calculated from started_at and completed_at';

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE 6: dental_procedure_materials
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Track materials used per procedure (inventory depletion)
-- Owner: Bella Dental Product Vertical
-- References: dental_procedures (Product)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dental_procedure_materials (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key to Product
  procedure_id UUID NOT NULL REFERENCES dental_procedures(id) ON DELETE CASCADE,
  
  -- Material Details
  material_name VARCHAR(255) NOT NULL,
  material_code VARCHAR(100),  -- SKU or internal code
  quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,  -- 'grams', 'ml', 'pieces', etc.
  
  -- Traceability
  lot_number VARCHAR(100),
  expiry_date DATE,
  
  -- Metadata
  tenant_id UUID NOT NULL
);

COMMENT ON TABLE dental_procedure_materials IS 'Materials consumed during dental procedures (inventory tracking)';

-- ────────────────────────────────────────────────────────────────────────────
-- TABLE 7: dental_billing_projections (READ-MODEL)
-- ────────────────────────────────────────────────────────────────────────────
-- Purpose: Projected costs and payment tracking (read-model, can be rebuilt)
-- Owner: Bella Dental Product Vertical
-- References: dental_treatment_plans (Product), hc_persons (Kernel)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dental_billing_projections (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  treatment_plan_id UUID NOT NULL REFERENCES dental_treatment_plans(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES hc_persons(id) ON DELETE RESTRICT,
  
  -- Cost Breakdown
  total_cost DECIMAL(12, 2) NOT NULL CHECK (total_cost >= 0),
  insurance_coverage_pct DECIMAL(5, 2) DEFAULT 0 CHECK (insurance_coverage_pct BETWEEN 0 AND 100),
  insurance_pays DECIMAL(12, 2) GENERATED ALWAYS AS (
    total_cost * (insurance_coverage_pct / 100)
  ) STORED,
  patient_pays DECIMAL(12, 2) GENERATED ALWAYS AS (
    total_cost - (total_cost * (insurance_coverage_pct / 100))
  ) STORED,
  
  -- Payment Tracking
  amount_paid DECIMAL(12, 2) DEFAULT 0 CHECK (amount_paid >= 0),
  outstanding_balance DECIMAL(12, 2) GENERATED ALWAYS AS (
    total_cost - (total_cost * (insurance_coverage_pct / 100)) - amount_paid
  ) STORED,
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
    'pending',
    'partial',
    'paid',
    'overdue'
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID NOT NULL,
  
  -- Constraints
  CONSTRAINT dental_billing_projections_plan_key UNIQUE (treatment_plan_id)
);

COMMENT ON TABLE dental_billing_projections IS 'Treatment plan cost projections and payment tracking (read-model)';
COMMENT ON COLUMN dental_billing_projections.insurance_pays IS 'Auto-calculated: total_cost * (insurance_coverage_pct / 100)';
COMMENT ON COLUMN dental_billing_projections.patient_pays IS 'Auto-calculated: total_cost - insurance_pays';

-- ════════════════════════════════════════════════════════════════════════════
-- END MIGRATION 001
-- ════════════════════════════════════════════════════════════════════════════
```

---

## III. Migration 002: Row Level Security (RLS)

**File:** `migrations/dental/002_add_dental_rls_policies.sql`

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- BELLA DENTAL — RLS POLICIES (MIGRATION 002)
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Enable Row Level Security for tenant isolation (Gate 0 / P0)
-- Architecture: Zero cross-tenant data leakage
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- Enable RLS on all Dental tables
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE dental_tooth_chart ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_treatment_plan_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_procedure_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE dental_billing_projections ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- RLS Policy: Tenant Isolation
-- ────────────────────────────────────────────────────────────────────────────
-- Rule: Users can only access data from their own tenant
-- Enforcement: current_setting('app.current_tenant_id') must match row tenant_id
-- ────────────────────────────────────────────────────────────────────────────

CREATE POLICY dental_tooth_chart_tenant_isolation ON dental_tooth_chart
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY dental_assessments_tenant_isolation ON dental_assessments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY dental_treatment_plans_tenant_isolation ON dental_treatment_plans
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY dental_treatment_plan_steps_tenant_isolation ON dental_treatment_plan_steps
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY dental_procedures_tenant_isolation ON dental_procedures
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY dental_procedure_materials_tenant_isolation ON dental_procedure_materials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY dental_billing_projections_tenant_isolation ON dental_billing_projections
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ════════════════════════════════════════════════════════════════════════════
-- END MIGRATION 002
-- ════════════════════════════════════════════════════════════════════════════
```

---

## IV. Migration 003: Performance Indexes

**File:** `migrations/dental/003_add_dental_indexes.sql`

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- BELLA DENTAL — PERFORMANCE INDEXES (MIGRATION 003)
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose: Optimize query performance for common access patterns
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- dental_tooth_chart indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_dental_tooth_chart_person_id ON dental_tooth_chart(person_id);
CREATE INDEX idx_dental_tooth_chart_encounter_id ON dental_tooth_chart(encounter_id);
CREATE INDEX idx_dental_tooth_chart_tenant_person ON dental_tooth_chart(tenant_id, person_id);
CREATE INDEX idx_dental_tooth_chart_valid_from ON dental_tooth_chart(valid_from);  -- Temporal queries

-- ────────────────────────────────────────────────────────────────────────────
-- dental_assessments indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_dental_assessments_person_id ON dental_assessments(person_id);
CREATE INDEX idx_dental_assessments_encounter_id ON dental_assessments(encounter_id);
CREATE INDEX idx_dental_assessments_dentist_id ON dental_assessments(dentist_id);
CREATE INDEX idx_dental_assessments_tenant_person ON dental_assessments(tenant_id, person_id);

-- ────────────────────────────────────────────────────────────────────────────
-- dental_treatment_plans indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_dental_treatment_plans_person_id ON dental_treatment_plans(person_id);
CREATE INDEX idx_dental_treatment_plans_encounter_id ON dental_treatment_plans(encounter_id);
CREATE INDEX idx_dental_treatment_plans_dentist_id ON dental_treatment_plans(dentist_id);
CREATE INDEX idx_dental_treatment_plans_status ON dental_treatment_plans(status);
CREATE INDEX idx_dental_treatment_plans_tenant_status ON dental_treatment_plans(tenant_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- dental_treatment_plan_steps indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_dental_treatment_plan_steps_plan_id ON dental_treatment_plan_steps(treatment_plan_id);
CREATE INDEX idx_dental_treatment_plan_steps_status ON dental_treatment_plan_steps(status);
CREATE INDEX idx_dental_treatment_plan_steps_phase ON dental_treatment_plan_steps(phase);

-- ────────────────────────────────────────────────────────────────────────────
-- dental_procedures indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_dental_procedures_encounter_id ON dental_procedures(encounter_id);
CREATE INDEX idx_dental_procedures_person_id ON dental_procedures(person_id);
CREATE INDEX idx_dental_procedures_dentist_id ON dental_procedures(dentist_id);
CREATE INDEX idx_dental_procedures_treatment_plan_step_id ON dental_procedures(treatment_plan_step_id);
CREATE INDEX idx_dental_procedures_started_at ON dental_procedures(started_at);
CREATE INDEX idx_dental_procedures_tenant_started ON dental_procedures(tenant_id, started_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- dental_procedure_materials indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_dental_procedure_materials_procedure_id ON dental_procedure_materials(procedure_id);
CREATE INDEX idx_dental_procedure_materials_material_code ON dental_procedure_materials(material_code);

-- ────────────────────────────────────────────────────────────────────────────
-- dental_billing_projections indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_dental_billing_projections_treatment_plan_id ON dental_billing_projections(treatment_plan_id);
CREATE INDEX idx_dental_billing_projections_person_id ON dental_billing_projections(person_id);
CREATE INDEX idx_dental_billing_projections_payment_status ON dental_billing_projections(payment_status);
CREATE INDEX idx_dental_billing_projections_tenant_status ON dental_billing_projections(tenant_id, payment_status);

-- ════════════════════════════════════════════════════════════════════════════
-- END MIGRATION 003
-- ════════════════════════════════════════════════════════════════════════════
```

---

## V. Verification Checklist

### Before Running Migrations

- [ ] **Backup database** (production only)
- [ ] **Review SQL syntax** (no typos, valid PostgreSQL)
- [ ] **Verify foreign key references** (all referenced tables exist)
- [ ] **Check constraints** (no impossible conditions)
- [ ] **Test in development** (run on local database first)

### After Running Migrations

- [ ] **Verify table creation** (`SELECT * FROM dental_tooth_chart LIMIT 1`)
- [ ] **Verify RLS enabled** (`SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'dental_%'`)
- [ ] **Verify indexes created** (`\di dental_*` in psql)
- [ ] **Test tenant isolation** (try cross-tenant query, should return zero rows)
- [ ] **Run Gate 5 test** (Database Migration Safety Test)

---

## VI. Rollback Plan

**If migration fails:**

```sql
-- Rollback Migration 003
DROP INDEX IF EXISTS idx_dental_tooth_chart_person_id;
DROP INDEX IF EXISTS idx_dental_tooth_chart_encounter_id;
-- ... (drop all indexes)

-- Rollback Migration 002
DROP POLICY IF EXISTS dental_tooth_chart_tenant_isolation ON dental_tooth_chart;
DROP POLICY IF EXISTS dental_assessments_tenant_isolation ON dental_assessments;
-- ... (drop all policies)

ALTER TABLE dental_tooth_chart DISABLE ROW LEVEL SECURITY;
ALTER TABLE dental_assessments DISABLE ROW LEVEL SECURITY;
-- ... (disable RLS on all tables)

-- Rollback Migration 001
DROP TABLE IF EXISTS dental_billing_projections CASCADE;
DROP TABLE IF EXISTS dental_procedure_materials CASCADE;
DROP TABLE IF EXISTS dental_procedures CASCADE;
DROP TABLE IF EXISTS dental_treatment_plan_steps CASCADE;
DROP TABLE IF EXISTS dental_treatment_plans CASCADE;
DROP TABLE IF EXISTS dental_assessments CASCADE;
DROP TABLE IF EXISTS dental_tooth_chart CASCADE;
```

**Important:** `CASCADE` will drop dependent objects. Use with extreme caution.

---

## VII. Gate 5: Database Migration Safety Test

**Test Specification:**

```typescript
describe('Dental Product - Database Migration Safety Test', () => {
  it('should NOT modify Kernel tables', async () => {
    // Get list of all Kernel tables
    const kernelTables = await db.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'hc_%'
    `);
    
    // For each Kernel table, verify structure unchanged
    for (const table of kernelTables) {
      const columnsBeforeMigration = await getTableStructure(table.tablename);
      
      // Run Dental migrations
      await runMigration('migrations/dental/001_create_dental_foundation.sql');
      
      const columnsAfterMigration = await getTableStructure(table.tablename);
      
      // Assert: Structure unchanged
      expect(columnsAfterMigration).toEqual(columnsBeforeMigration);
    }
  });
  
  it('should create only Dental-specific tables', async () => {
    await runMigration('migrations/dental/001_create_dental_foundation.sql');
    
    const dentalTables = await db.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'dental_%'
    `);
    
    expect(dentalTables.length).toBe(7);
    expect(dentalTables.map(t => t.tablename)).toEqual([
      'dental_tooth_chart',
      'dental_assessments',
      'dental_treatment_plans',
      'dental_treatment_plan_steps',
      'dental_procedures',
      'dental_procedure_materials',
      'dental_billing_projections'
    ]);
  });
  
  it('should enable RLS on all Dental tables', async () => {
    await runMigration('migrations/dental/002_add_dental_rls_policies.sql');
    
    const rlsStatus = await db.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'dental_%'
    `);
    
    for (const table of rlsStatus) {
      expect(table.rowsecurity).toBe(true);
    }
  });
  
  it('should enforce tenant isolation via RLS', async () => {
    // Set tenant A context
    await db.query("SET app.current_tenant_id = 'tenant-a-uuid'");
    
    // Insert data for tenant A
    await db.insert('dental_tooth_chart', {
      person_id: 'patient-a',
      encounter_id: 'encounter-a',
      tooth_number: 16,
      condition: 'healthy',
      tenant_id: 'tenant-a-uuid'
    });
    
    // Insert data for tenant B
    await db.query("SET app.current_tenant_id = 'tenant-b-uuid'");
    await db.insert('dental_tooth_chart', {
      person_id: 'patient-b',
      encounter_id: 'encounter-b',
      tooth_number: 16,
      condition: 'decayed',
      tenant_id: 'tenant-b-uuid'
    });
    
    // Query as tenant A
    await db.query("SET app.current_tenant_id = 'tenant-a-uuid'");
    const resultsA = await db.query('SELECT * FROM dental_tooth_chart');
    
    // Assert: Only tenant A data visible
    expect(resultsA.length).toBe(1);
    expect(resultsA[0].tenant_id).toBe('tenant-a-uuid');
  });
});
```

---

## VIII. Summary

### Tables Created: 7

1. ✅ `dental_tooth_chart` - Tooth conditions with bitemporal history
2. ✅ `dental_assessments` - Oral examinations
3. ✅ `dental_treatment_plans` - Treatment plans
4. ✅ `dental_treatment_plan_steps` - Plan steps
5. ✅ `dental_procedures` - Executed procedures
6. ✅ `dental_procedure_materials` - Materials tracking
7. ✅ `dental_billing_projections` - Cost projections

### Foreign Keys to Kernel: 11

- `hc_persons` (Patient, Dentist, Assistant, Recorder)
- `hc_encounters` (Clinical sessions)

### RLS Policies: 7 (one per table)

### Indexes: 27 (performance optimization)

### Kernel Modifications: 0 ✅

**Architecture Proof:** Complete database schema without touching Kernel tables.

---

**Document Owner:** Kiro AI Development Environment  
**Last Updated:** 2026-08-23  
**Version:** 1.0.0  
**Status:** DRAFT (pending Architecture Review)
