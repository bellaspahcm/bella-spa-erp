# Bella Dental — 11 Verification Gates Test Plan

**Product:** Bella Dental  
**Version:** 1.0.0-alpha  
**Purpose:** Define automated verification gates for architecture compliance  
**Status:** 🚧 ARCHITECTURE ANALYSIS (Phase 1 - Document 5/5)

---

## I. Gate Overview

### The 11 Gates

| Gate | Name | Purpose | Fail = Block |
|------|------|---------|--------------|
| **G0** | Tenant Isolation Test | Verify RLS prevents cross-tenant data leakage | ✅ BLOCK PR |
| **G1** | Architecture Compliance Test | Verify no Kernel modifications | ✅ BLOCK PR |
| **G2** | Contract Boundary Test | Verify Product uses Contracts only | ✅ BLOCK PR |
| **G3** | Ownership Boundary Test | Verify Product owns only declared tables | ✅ BLOCK PR |
| **G4** | Database Migration Safety Test | Verify additive-only migrations | ✅ BLOCK PR |
| **G5** | Event-After-Persistence Test | Verify DB COMMIT before DOMAIN EVENT | ✅ BLOCK PR |
| **G6** | Clinical Safety Routing Test | Verify CDS integration for safety checks | ⚠️ WARN |
| **G7** | Temporal Provenance Test | Verify bitemporal tracking for audit | ⚠️ WARN |
| **G8** | Rule Governance Test | Verify protocol compliance validation | ⚠️ WARN |
| **G9** | Audit Integrity Test | Verify all clinical actions audited | ✅ BLOCK PR |
| **G10** | Full Kernel Regression Test | Verify 52/52 Healthcare Kernel tests PASS | ✅ BLOCK PR |

**Total:** 11 Gates (7 blocking, 4 warning)

---

## II. Gate Execution Flow

### CI Pipeline Integration

```yaml
# .github/workflows/dental-verification.yml

name: Bella Dental — Verification Gates

on:
  pull_request:
    paths:
      - 'src/products/dental/**'
      - 'docs/products/dental/**'
      - 'migrations/dental/**'

jobs:
  verification-gates:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: 🔒 Gate 0 — Tenant Isolation Test
        run: npm run test:dental:gate0
        
      - name: 🔒 Gate 1 — Architecture Compliance Test
        run: npm run test:dental:gate1
        
      - name: 🔒 Gate 2 — Contract Boundary Test
        run: npm run test:dental:gate2
        
      - name: 🔒 Gate 3 — Ownership Boundary Test
        run: npm run test:dental:gate3
        
      - name: 🔒 Gate 4 — Database Migration Safety Test
        run: npm run test:dental:gate4
        
      - name: 🔒 Gate 5 — Event-After-Persistence Test
        run: npm run test:dental:gate5
        
      - name: ⚠️ Gate 6 — Clinical Safety Routing Test
        run: npm run test:dental:gate6
        continue-on-error: true
        
      - name: ⚠️ Gate 7 — Temporal Provenance Test
        run: npm run test:dental:gate7
        continue-on-error: true
        
      - name: ⚠️ Gate 8 — Rule Governance Test
        run: npm run test:dental:gate8
        continue-on-error: true
        
      - name: 🔒 Gate 9 — Audit Integrity Test
        run: npm run test:dental:gate9
        
      - name: 🔒 Gate 10 — Full Kernel Regression Test
        run: npm run test:healthcare:kernel:all
      
      - name: 📊 Generate Gate Report
        if: always()
        run: npm run test:dental:report
```

---

## III. Gate Specifications

### Gate 0: Tenant Isolation Test

**Priority:** P0 (CRITICAL - Security)  
**Blocks PR:** YES  
**Test File:** `src/products/dental/__tests__/gates/gate-0-tenant-isolation.test.ts`

**Purpose:** Verify Row Level Security prevents cross-tenant data access

**Test Cases:**

```typescript
describe('Gate 0 — Tenant Isolation Test', () => {
  beforeEach(async () => {
    // Setup: Create two tenants with sample data
    await setupMultiTenantTestData();
  });

  it('should prevent cross-tenant read access via RLS', async () => {
    // Set context to Tenant A
    await db.query("SET app.current_tenant_id = 'tenant-a-uuid'");
    
    // Query tooth chart
    const resultsA = await db.query('SELECT * FROM dental_tooth_chart');
    
    // Assert: Only Tenant A data visible
    expect(resultsA.every(row => row.tenant_id === 'tenant-a-uuid')).toBe(true);
    expect(resultsA.some(row => row.tenant_id === 'tenant-b-uuid')).toBe(false);
  });

  it('should prevent cross-tenant write access via RLS', async () => {
    // Set context to Tenant A
    await db.query("SET app.current_tenant_id = 'tenant-a-uuid'");
    
    // Try to insert data for Tenant B
    const insertPromise = db.insert('dental_tooth_chart', {
      person_id: 'patient-b',
      encounter_id: 'encounter-b',
      tooth_number: 16,
      condition: 'healthy',
      tenant_id: 'tenant-b-uuid'  // ❌ Different tenant
    });
    
    // Assert: Insert should fail due to RLS
    await expect(insertPromise).rejects.toThrow();
  });

  it('should enforce RLS on all Dental tables', async () => {
    const dentalTables = [
      'dental_tooth_chart',
      'dental_assessments',
      'dental_treatment_plans',
      'dental_treatment_plan_steps',
      'dental_procedures',
      'dental_procedure_materials',
      'dental_billing_projections'
    ];

    for (const tableName of dentalTables) {
      const rlsStatus = await db.query(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = $1
      `, [tableName]);

      expect(rlsStatus[0].rowsecurity).toBe(true);
    }
  });
});
```

**Success Criteria:**
- ✅ All Dental tables have RLS enabled
- ✅ Cross-tenant read returns zero rows
- ✅ Cross-tenant write throws error

---

### Gate 1: Architecture Compliance Test

**Priority:** P0 (CRITICAL - Architecture)  
**Blocks PR:** YES  
**Test File:** `src/products/dental/__tests__/gates/gate-1-architecture-compliance.test.ts`

**Purpose:** Verify zero modifications to frozen Healthcare Kernel (H1–H12)

**Test Cases:**

```typescript
describe('Gate 1 — Architecture Compliance Test', () => {
  it('should NOT modify frozen Kernel files', async () => {
    const frozenFiles = [
      'src/platform/healthcare/engines/person-engine/**',
      'src/platform/healthcare/engines/encounter-engine/**',
      'src/platform/healthcare/engines/appointment-engine/**',
      'src/platform/healthcare/engines/clinical-order-engine/**',
      // ... H1–H12 all engines
    ];

    const modifiedFiles = await getModifiedFilesInPR();
    
    for (const file of modifiedFiles) {
      expect(frozenFiles.some(pattern => matchGlob(file, pattern))).toBe(false);
    }
  });

  it('should NOT modify Kernel database tables', async () => {
    const kernelTables = await db.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'hc_%'
    `);

    for (const table of kernelTables) {
      const schemaBefore = await getTableSchema(table.tablename, 'baseline');
      const schemaAfter = await getTableSchema(table.tablename, 'current');
      
      expect(schemaAfter).toEqual(schemaBefore);
    }
  });

  it('should NOT duplicate Kernel entities', async () => {
    const dentalFiles = glob.sync('src/products/dental/**/*.ts');
    
    const forbiddenDuplicates = [
      /class\s+Patient/,
      /class\s+Doctor/,
      /class\s+Encounter/,
      /class\s+Appointment/,
      /interface\s+Patient/,
      /interface\s+Doctor/
    ];

    for (const file of dentalFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of forbiddenDuplicates) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});
```

**Success Criteria:**
- ✅ Zero files in `src/platform/healthcare/engines/` modified
- ✅ Zero Kernel database tables altered
- ✅ Zero Kernel entity duplications

---

### Gate 2: Contract Boundary Test

**Priority:** P0 (CRITICAL - Architecture)  
**Blocks PR:** YES  
**Test File:** `src/products/dental/__tests__/gates/gate-2-contract-boundary.test.ts`

**Purpose:** Verify Product accesses Kernel via Contracts only (never direct implementation)

**Test Cases:**

```typescript
describe('Gate 2 — Contract Boundary Test', () => {
  it('should NOT import Kernel implementation directly', () => {
    const dentalFiles = glob.sync('src/products/dental/**/*.ts');
    
    const forbiddenPatterns = [
      /from\s+['"]@\/platform\/healthcare\/engines\/.*\/implementation['"]/,
      /from\s+['"].*\/hc_.*['"]/,  // Direct table imports
      /PersonEngineImpl/,
      /EncounterEngineImpl/,
    ];

    for (const file of dentalFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of forbiddenPatterns) {
        if (content.match(pattern)) {
          throw new Error(
            `Contract boundary violation in ${file}: found ${pattern}`
          );
        }
      }
    }
  });

  it('should use Contract imports for all Kernel interactions', () => {
    const dentalServices = glob.sync('src/products/dental/services/**/*.ts');

    for (const file of dentalServices) {
      const ast = parseTypeScript(file);
      const imports = extractImports(ast);

      const kernelImports = imports.filter(i => 
        i.source.includes('/platform/healthcare/')
      );

      for (const imp of kernelImports) {
        // Must import from /contract.ts, not /implementation.ts
        expect(imp.source).toMatch(/\/contract$/);
        expect(imp.source).not.toMatch(/\/implementation$/);
      }
    }
  });

  it('should NOT access hc_* tables directly in queries', () => {
    const dentalFiles = glob.sync('src/products/dental/**/*.ts');

    for (const file of dentalFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Forbidden: db.query('SELECT * FROM hc_persons ...')
      const directTableAccess = content.match(/FROM\s+hc_\w+/gi);
      
      expect(directTableAccess).toBeNull();
    }
  });
});
```

**Success Criteria:**
- ✅ Zero direct implementation imports
- ✅ All Kernel imports end with `/contract`
- ✅ Zero direct `hc_*` table queries

---

### Gate 3: Ownership Boundary Test

**Priority:** P0 (CRITICAL - Architecture)  
**Blocks PR:** YES  
**Test File:** `src/products/dental/__tests__/gates/gate-3-ownership-boundary.test.ts`

**Purpose:** Verify Product owns only declared tables, doesn't write to Kernel tables

**Test Cases:**

```typescript
describe('Gate 3 — Ownership Boundary Test', () => {
  it('should own exactly 7 Dental tables', async () => {
    const dentalTables = await db.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'dental_%'
    `);

    expect(dentalTables.length).toBe(7);
    expect(dentalTables.map(t => t.tablename).sort()).toEqual([
      'dental_assessments',
      'dental_billing_projections',
      'dental_procedure_materials',
      'dental_procedures',
      'dental_tooth_chart',
      'dental_treatment_plan_steps',
      'dental_treatment_plans'
    ]);
  });

  it('should NOT write to Kernel tables', () => {
    const dentalFiles = glob.sync('src/products/dental/**/*.ts');
    
    const forbiddenWrites = [
      /INSERT\s+INTO\s+hc_/gi,
      /UPDATE\s+hc_\w+\s+SET/gi,
      /DELETE\s+FROM\s+hc_/gi,
    ];

    for (const file of dentalFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of forbiddenWrites) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('should only read from Kernel via foreign keys', async () => {
    // Verify all FK constraints exist
    const fkConstraints = await db.query(`
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name LIKE 'dental_%'
      AND ccu.table_name LIKE 'hc_%'
    `);

    // Expected FKs: person_id, encounter_id, dentist_id, etc.
    expect(fkConstraints.length).toBeGreaterThanOrEqual(11);
  });
});
```

**Success Criteria:**
- ✅ Exactly 7 `dental_*` tables exist
- ✅ Zero write operations to `hc_*` tables
- ✅ All Kernel references use FK constraints

---

### Gate 4: Database Migration Safety Test

**Priority:** P0 (CRITICAL - Database)  
**Blocks PR:** YES  
**Test File:** `src/products/dental/__tests__/gates/gate-4-migration-safety.test.ts`

**Purpose:** Verify all migrations are additive only (no ALTER/DROP on Kernel)

**Test Cases:**

```typescript
describe('Gate 4 — Database Migration Safety Test', () => {
  it('should contain only CREATE statements', () => {
    const migrationFiles = glob.sync('migrations/dental/*.sql');
    
    const forbiddenKeywords = [
      /ALTER\s+TABLE\s+hc_/gi,
      /DROP\s+TABLE\s+hc_/gi,
      /DROP\s+COLUMN/gi,
      /TRUNCATE\s+hc_/gi,
      /DELETE\s+FROM\s+hc_/gi,
    ];

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(file, 'utf8');
      
      for (const pattern of forbiddenKeywords) {
        if (sql.match(pattern)) {
          throw new Error(`Forbidden SQL in ${file}: ${pattern}`);
        }
      }
    }
  });

  it('should create only dental_* tables', () => {
    const migrationFiles = glob.sync('migrations/dental/*.sql');

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(file, 'utf8');
      
      // Extract CREATE TABLE statements
      const createStatements = sql.match(/CREATE\s+TABLE.*?(dental_\w+)/gi) || [];
      
      for (const stmt of createStatements) {
        expect(stmt).toMatch(/dental_\w+/);
        expect(stmt).not.toMatch(/hc_\w+/);
      }
    }
  });

  it('should run migrations without breaking Kernel', async () => {
    // Take snapshot of Kernel schema
    const kernelSchemasBefore = await getAllKernelTableSchemas();
    
    // Run all Dental migrations
    const migrations = glob.sync('migrations/dental/*.sql').sort();
    for (const migration of migrations) {
      await runMigrationFile(migration);
    }
    
    // Verify Kernel schema unchanged
    const kernelSchemasAfter = await getAllKernelTableSchemas();
    
    expect(kernelSchemasAfter).toEqual(kernelSchemasBefore);
  });
});
```

**Success Criteria:**
- ✅ Zero ALTER/DROP on Kernel tables
- ✅ All CREATE statements target `dental_*` tables
- ✅ Kernel schema unchanged after migrations

---

### Gate 5: Event-After-Persistence Test

**Priority:** P0 (CRITICAL - Data Integrity)  
**Blocks PR:** YES  
**Test File:** `src/products/dental/__tests__/gates/gate-5-event-after-persistence.test.ts`

**Purpose:** Verify domain events emitted AFTER database commit (not before)

**Test Cases:**

```typescript
describe('Gate 5 — Event-After-Persistence Test', () => {
  it('should emit events AFTER database commit', async () => {
    const eventLog: Array<{ type: string; timestamp: number }> = [];
    const dbLog: Array<{ operation: string; timestamp: number }> = [];

    // Mock event emitter
    const mockEventBus = {
      emit: (eventType: string) => {
        eventLog.push({ type: eventType, timestamp: Date.now() });
      }
    };

    // Mock database with commit tracking
    const mockDb = {
      commit: async () => {
        dbLog.push({ operation: 'COMMIT', timestamp: Date.now() });
      }
    };

    // Execute: Create treatment plan
    await createTreatmentPlan({
      personId: 'patient-1',
      encounterId: 'encounter-1',
      dentistId: 'dentist-1',
      steps: [{ procedure: 'filling', tooth: 16 }]
    }, mockDb, mockEventBus);

    // Assert: COMMIT happened before EVENT
    const commitTime = dbLog.find(log => log.operation === 'COMMIT')?.timestamp;
    const eventTime = eventLog.find(e => e.type === 'TreatmentPlanCreated')?.timestamp;

    expect(commitTime).toBeLessThan(eventTime!);
  });

  it('should NOT emit events if transaction fails', async () => {
    const eventsEmitted: string[] = [];

    const mockEventBus = {
      emit: (eventType: string) => {
        eventsEmitted.push(eventType);
      }
    };

    // Simulate transaction failure
    const mockDb = {
      insert: async () => {
        throw new Error('Database constraint violation');
      }
    };

    // Execute: Try to create procedure (should fail)
    await expect(
      recordProcedure({
        encounterId: 'invalid',
        procedure: 'extraction',
        tooth: 16
      }, mockDb, mockEventBus)
    ).rejects.toThrow();

    // Assert: No events emitted on failure
    expect(eventsEmitted.length).toBe(0);
  });
});
```

**Success Criteria:**
- ✅ Events emitted after `db.commit()`
- ✅ No events emitted on transaction failure
- ✅ Event ordering: WRITE → COMMIT → EVENT

---

### Gate 6: Clinical Safety Routing Test

**Priority:** P1 (HIGH - Safety)  
**Blocks PR:** NO (Warning only)  
**Test File:** `src/products/dental/__tests__/gates/gate-6-clinical-safety.test.ts`

**Purpose:** Verify CDS Engine integration for drug interactions and contraindications

**Test Cases:**

```typescript
describe('Gate 6 — Clinical Safety Routing Test', () => {
  it('should check drug interactions before prescribing', async () => {
    const mockCDS = {
      checkDrugInteractions: jest.fn().mockResolvedValue({
        hasInteractions: true,
        severity: 'major',
        message: 'Aspirin contraindicated with current anticoagulant'
      })
    };

    const prescription = {
      medication: 'Aspirin',
      dosage: '500mg',
      patientId: 'patient-with-anticoagulant'
    };

    // Execute: Try to prescribe
    const result = await prescribeMedication(prescription, mockCDS);

    // Assert: CDS was consulted
    expect(mockCDS.checkDrugInteractions).toHaveBeenCalledWith({
      medication: 'Aspirin',
      patientId: 'patient-with-anticoagulant'
    });

    // Assert: Prescription blocked due to interaction
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('contraindicated');
  });

  it('should validate procedure safety via CDS', async () => {
    const mockCDS = {
      validateProcedure: jest.fn().mockResolvedValue({
        safe: false,
        warnings: ['Patient has uncontrolled diabetes - delay non-urgent procedures']
      })
    };

    const procedure = {
      type: 'tooth_extraction',
      patientId: 'patient-with-diabetes'
    };

    // Execute: Validate procedure
    const result = await validateProcedureSafety(procedure, mockCDS);

    // Assert: CDS consulted
    expect(mockCDS.validateProcedure).toHaveBeenCalled();

    // Assert: Warning issued
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
```

**Success Criteria:**
- ⚠️ CDS consulted before medication orders
- ⚠️ CDS consulted for high-risk procedures
- ⚠️ Safety warnings propagated to UI

---

### Gate 7: Temporal Provenance Test

**Priority:** P1 (HIGH - Audit)  
**Blocks PR:** NO (Warning only)  
**Test File:** `src/products/dental/__tests__/gates/gate-7-temporal-provenance.test.ts`

**Purpose:** Verify bitemporal tracking for tooth chart history

**Test Cases:**

```typescript
describe('Gate 7 — Temporal Provenance Test', () => {
  it('should record bitemporal events via Temporal Engine', async () => {
    const mockTemporal = {
      recordBitemporalEvent: jest.fn().mockResolvedValue(true)
    };

    // Execute: Update tooth chart
    await updateToothCondition({
      personId: 'patient-1',
      toothNumber: 16,
      condition: 'filled',
      surface: 'O',
      recordedBy: 'dentist-1'
    }, mockTemporal);

    // Assert: Temporal event recorded
    expect(mockTemporal.recordBitemporalEvent).toHaveBeenCalledWith({
      entity_type: 'dental_tooth_chart',
      event_type: 'tooth_condition_changed',
      valid_from: expect.any(Date),
      data: expect.objectContaining({
        tooth_number: 16,
        condition: 'filled'
      })
    });
  });

  it('should retrieve historical tooth states', async () => {
    const mockTemporal = {
      getStateAtTime: jest.fn().mockResolvedValue({
        tooth_number: 16,
        condition: 'decayed',
        recorded_at: '2026-01-15T10:00:00Z'
      })
    };

    // Execute: Get tooth state 6 months ago
    const pastState = await getToothStateAtTime({
      personId: 'patient-1',
      toothNumber: 16,
      asOfDate: new Date('2026-01-15')
    }, mockTemporal);

    // Assert: Historical state retrieved
    expect(pastState.condition).toBe('decayed');
  });
});
```

**Success Criteria:**
- ⚠️ Temporal events recorded for tooth changes
- ⚠️ Historical states retrievable
- ⚠️ Valid time vs transaction time tracked

---

### Gate 8: Rule Governance Test

**Priority:** P1 (HIGH - Compliance)  
**Blocks PR:** NO (Warning only)  
**Test File:** `src/products/dental/__tests__/gates/gate-8-rule-governance.test.ts`

**Purpose:** Verify treatment protocol compliance validation

**Test Cases:**

```typescript
describe('Gate 8 — Rule Governance Test', () => {
  it('should validate treatment protocol via Governance Engine', async () => {
    const mockGovernance = {
      validateTreatmentProtocol: jest.fn().mockResolvedValue({
        isValid: false,
        violations: ['Root canal must precede crown placement']
      })
    };

    const treatmentSteps = [
      { phase: 'restoration', procedure: 'crown', tooth: 16 },
      // Missing: root canal step
    ];

    // Execute: Validate protocol
    const result = await validateTreatmentPlan({ steps: treatmentSteps }, mockGovernance);

    // Assert: Governance consulted
    expect(mockGovernance.validateTreatmentProtocol).toHaveBeenCalled();

    // Assert: Violation detected
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('should enforce rule version tracking', async () => {
    const mockGovernance = {
      getRuleVersion: jest.fn().mockResolvedValue('dental-protocol-v2.1.0')
    };

    // Execute: Create treatment plan
    const plan = await createTreatmentPlan({
      personId: 'patient-1',
      steps: [{ procedure: 'filling', tooth: 16 }]
    }, mockGovernance);

    // Assert: Rule version recorded
    expect(plan.metadata.rule_version).toBe('dental-protocol-v2.1.0');
  });
});
```

**Success Criteria:**
- ⚠️ Treatment protocols validated
- ⚠️ Rule version tracked per plan
- ⚠️ Violations prevent plan approval

---

### Gate 9: Audit Integrity Test

**Priority:** P0 (CRITICAL - Compliance)  
**Blocks PR:** YES  
**Test File:** `src/products/dental/__tests__/gates/gate-9-audit-integrity.test.ts`

**Purpose:** Verify all clinical actions audited via Audit Engine

**Test Cases:**

```typescript
describe('Gate 9 — Audit Integrity Test', () => {
  it('should audit all procedure executions', async () => {
    const mockAudit = {
      recordClinicalAction: jest.fn().mockResolvedValue(true)
    };

    // Execute: Record procedure
    await recordProcedure({
      encounterId: 'encounter-1',
      personId: 'patient-1',
      dentistId: 'dentist-1',
      procedureType: 'filling',
      toothNumber: 16
    }, mockAudit);

    // Assert: Audit recorded
    expect(mockAudit.recordClinicalAction).toHaveBeenCalledWith({
      actor: 'dentist-1',
      action: 'DENTAL_PROCEDURE_COMPLETED',
      encounter: 'encounter-1',
      details: expect.objectContaining({
        procedure_type: 'filling',
        tooth_number: 16
      }),
      fingerprint: expect.any(String)  // SHA-256 fingerprint
    });
  });

  it('should audit patient consent', async () => {
    const mockAudit = {
      recordPatientConsent: jest.fn().mockResolvedValue(true)
    };

    // Execute: Record consent
    await recordTreatmentPlanConsent({
      personId: 'patient-1',
      planId: 'plan-1',
      signature: 'base64encodedimage',
      ipAddress: '192.168.1.1'
    }, mockAudit);

    // Assert: Consent audited
    expect(mockAudit.recordPatientConsent).toHaveBeenCalledWith({
      personId: 'patient-1',
      consentType: 'treatment_plan',
      consentData: expect.objectContaining({ planId: 'plan-1' }),
      signature: 'base64encodedimage',
      timestamp: expect.any(Date)
    });
  });

  it('should calculate SHA-256 fingerprints for audit trail', () => {
    const data = {
      procedure: 'extraction',
      tooth: 18,
      timestamp: '2026-08-23T10:00:00Z'
    };

    const fingerprint = calculateFingerprint(data);

    // Assert: Valid SHA-256 hash
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

**Success Criteria:**
- ✅ All procedures audited
- ✅ Patient consent audited
- ✅ SHA-256 fingerprints calculated

---

### Gate 10: Full Kernel Regression Test

**Priority:** P0 (CRITICAL - System Integrity)  
**Blocks PR:** YES  
**Test File:** Existing Healthcare Kernel test suite (52/52 tests)

**Purpose:** Verify Dental Product does not break Healthcare Kernel

**Test Cases:**

```bash
# Run full Healthcare Kernel regression suite
npm run test:healthcare:kernel:all

# Expected output:
# ✅ H1 Person Engine: 8/8 tests PASS
# ✅ H2 Encounter Engine: 6/6 tests PASS
# ✅ H3 Appointment Engine: 5/5 tests PASS
# ✅ H4 Clinical Order Engine: 7/7 tests PASS
# ✅ H5 Lab Results Engine: 4/4 tests PASS
# ✅ H6 Imaging Engine: 3/3 tests PASS
# ✅ H7 Pharmacy Engine: 6/6 tests PASS
# ✅ H8 CDS Engine: 5/5 tests PASS
# ✅ H9 Temporal Engine: 4/4 tests PASS
# ✅ H10 Governance Engine: 2/2 tests PASS
# ✅ H11 Audit Engine: 2/2 tests PASS
# ────────────────────────────────────
# 52/52 tests PASSING ✅
```

**Success Criteria:**
- ✅ All 52 Kernel tests PASS
- ✅ Zero test failures introduced by Dental code
- ✅ Test execution time < 30 seconds

---

## IV. NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test:dental:gate0": "jest src/products/dental/__tests__/gates/gate-0-tenant-isolation.test.ts",
    "test:dental:gate1": "jest src/products/dental/__tests__/gates/gate-1-architecture-compliance.test.ts",
    "test:dental:gate2": "jest src/products/dental/__tests__/gates/gate-2-contract-boundary.test.ts",
    "test:dental:gate3": "jest src/products/dental/__tests__/gates/gate-3-ownership-boundary.test.ts",
    "test:dental:gate4": "jest src/products/dental/__tests__/gates/gate-4-migration-safety.test.ts",
    "test:dental:gate5": "jest src/products/dental/__tests__/gates/gate-5-event-after-persistence.test.ts",
    "test:dental:gate6": "jest src/products/dental/__tests__/gates/gate-6-clinical-safety.test.ts",
    "test:dental:gate7": "jest src/products/dental/__tests__/gates/gate-7-temporal-provenance.test.ts",
    "test:dental:gate8": "jest src/products/dental/__tests__/gates/gate-8-rule-governance.test.ts",
    "test:dental:gate9": "jest src/products/dental/__tests__/gates/gate-9-audit-integrity.test.ts",
    "test:dental:gate10": "npm run test:healthcare:kernel:all",
    
    "test:dental:gates:all": "npm run test:dental:gate0 && npm run test:dental:gate1 && npm run test:dental:gate2 && npm run test:dental:gate3 && npm run test:dental:gate4 && npm run test:dental:gate5 && npm run test:dental:gate9 && npm run test:dental:gate10",
    
    "test:dental:gates:blocking": "npm run test:dental:gate0 && npm run test:dental:gate1 && npm run test:dental:gate2 && npm run test:dental:gate3 && npm run test:dental:gate4 && npm run test:dental:gate5 && npm run test:dental:gate9 && npm run test:dental:gate10",
    
    "test:dental:gates:warnings": "npm run test:dental:gate6; npm run test:dental:gate7; npm run test:dental:gate8",
    
    "test:dental:report": "node scripts/generate-gate-report.js"
  }
}
```

---

## V. Gate Report Format

**CLI Output Example:**

```
═══════════════════════════════════════════════════════════════════════
 BELLA DENTAL — VERIFICATION GATES REPORT
═══════════════════════════════════════════════════════════════════════

🔒 BLOCKING GATES (Must Pass to Merge PR)
──────────────────────────────────────────────────────────────────────
✅ Gate 0: Tenant Isolation Test               PASS    (123ms)
✅ Gate 1: Architecture Compliance Test        PASS    (456ms)
✅ Gate 2: Contract Boundary Test              PASS    (234ms)
✅ Gate 3: Ownership Boundary Test             PASS    (189ms)
✅ Gate 4: Database Migration Safety Test      PASS    (567ms)
✅ Gate 5: Event-After-Persistence Test        PASS    (312ms)
✅ Gate 9: Audit Integrity Test                PASS    (445ms)
✅ Gate 10: Full Kernel Regression Test        PASS    (8.2s)

⚠️  WARNING GATES (Non-Blocking)
──────────────────────────────────────────────────────────────────────
⚠️  Gate 6: Clinical Safety Routing Test       WARN    (2 issues)
⚠️  Gate 7: Temporal Provenance Test           WARN    (1 issue)
✅ Gate 8: Rule Governance Test                PASS    (298ms)

═══════════════════════════════════════════════════════════════════════
 SUMMARY
═══════════════════════════════════════════════════════════════════════
Total Gates:      11
Blocking Passed:  8/8   ✅
Warnings:         2/3   ⚠️
Total Time:       12.3s

✅ ALL BLOCKING GATES PASSED — PR CAN BE MERGED
⚠️  2 warnings detected — review recommended but not required

───────────────────────────────────────────────────────────────────────
Gate 6 Issues:
  • CDS not consulted in recordProcedure() at line 142
  • Missing drug interaction check in prescribeMedication()

Gate 7 Issues:
  • Temporal event missing for tooth condition change at line 87
═══════════════════════════════════════════════════════════════════════
```

---

## VI. Architecture Guard Integration

### Pre-Tool-Use Hook Enhancement

Extend existing Architecture Guard hook to include Gate checks:

```typescript
// .kiro/hooks/architecture-guard.json
{
  "version": "v1",
  "hooks": [{
    "name": "Architecture Guard + Dental Gates",
    "trigger": "PreToolUse",
    "matcher": "fs_write|str_replace|fs_append",
    "action": {
      "type": "command",
      "command": "node scripts/architecture-guard-with-gates.js"
    }
  }]
}
```

**Script Logic:**

```typescript
// scripts/architecture-guard-with-gates.js

const { targetFile } = JSON.parse(process.stdin.read());

// Layer 1: Frozen Kernel Protection (existing)
if (isFrozenKernelFile(targetFile)) {
  console.error('❌ BLOCKED: Attempt to modify frozen Kernel file');
  process.exit(2);  // Block the tool
}

// Layer 2: Contract Boundary Check (new)
if (targetFile.startsWith('src/products/dental/')) {
  const violations = checkContractBoundary(targetFile);
  if (violations.length > 0) {
    console.error('❌ BLOCKED: Contract boundary violations detected');
    console.error(violations.join('\n'));
    process.exit(2);  // Block the tool
  }
}

// Layer 3: Ownership Boundary Check (new)
if (targetFile.startsWith('migrations/dental/')) {
  const violations = checkMigrationSafety(targetFile);
  if (violations.length > 0) {
    console.error('❌ BLOCKED: Unsafe migration detected');
    console.error(violations.join('\n'));
    process.exit(2);  // Block the tool
  }
}

console.log('✅ Architecture Guard PASS');
process.exit(0);
```

---

## VII. Summary

### Gate Coverage Matrix

| Concern | Gate | Priority | Blocking |
|---------|------|----------|----------|
| **Security** | G0: Tenant Isolation | P0 | ✅ |
| **Architecture** | G1: Architecture Compliance | P0 | ✅ |
| **Architecture** | G2: Contract Boundary | P0 | ✅ |
| **Architecture** | G3: Ownership Boundary | P0 | ✅ |
| **Database** | G4: Migration Safety | P0 | ✅ |
| **Data Integrity** | G5: Event-After-Persistence | P0 | ✅ |
| **Clinical Safety** | G6: CDS Integration | P1 | ⚠️ |
| **Audit** | G7: Temporal Provenance | P1 | ⚠️ |
| **Compliance** | G8: Rule Governance | P1 | ⚠️ |
| **Compliance** | G9: Audit Integrity | P0 | ✅ |
| **System Integrity** | G10: Kernel Regression | P0 | ✅ |

**Enforcement Layers:**

1. **Pre-Commit Hook** - Blocks local commits with frozen file modifications
2. **Pre-Tool-Use Hook** - Blocks AI code generation in real-time
3. **CI Pipeline** - Blocks PR merge if gates fail
4. **Architecture Review** - Human verification before Phase 2

**Key Metrics:**

- ✅ 8/11 gates are blocking (PR cannot merge if failed)
- ⚠️ 3/11 gates are warnings (issues logged but not blocking)
- 🎯 Target: All gates GREEN before implementation (Phase 2)

---

**Document Owner:** Kiro AI Development Environment  
**Last Updated:** 2026-08-23  
**Version:** 1.0.0  
**Status:** DRAFT (pending Architecture Review)
