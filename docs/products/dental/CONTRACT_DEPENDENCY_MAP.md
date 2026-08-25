# Bella Dental — Contract Dependency Map

**Product:** Bella Dental  
**Version:** 1.0.0-alpha  
**Purpose:** Map Product Features → Public Contracts → Kernel Engines  
**Status:** 🚧 ARCHITECTURE ANALYSIS (Phase 1 - Document 3/5)

---

## I. Contract-Only Access Principle

### The Rule

**Product → Contract → Kernel** (ALWAYS)

**Product ❌ Kernel Implementation** (NEVER)

```typescript
// ❌ FORBIDDEN: Direct Kernel implementation access
import { PersonEngineImpl } from '@/platform/healthcare/engines/person-engine/implementation';
const patient = await PersonEngineImpl.getById(id);

// ✅ CORRECT: Access via Public Contract
import { PersonEngineContract } from '@/platform/healthcare/engines/person-engine/contract';
const patient = await PersonEngineContract.getPersonById(id);
```

---

### Why This Matters

**Benefits:**
1. ✅ **Kernel can evolve** without breaking Product
2. ✅ **Contract is stable** even if implementation changes
3. ✅ **Testability** - can mock Contracts easily
4. ✅ **Versioning** - Contract can version API separately
5. ✅ **Boundary enforcement** - Architecture Guard can detect violations

**Enforcement:**
- Gate 2 (Contract Boundary Test) validates this
- Architecture Guard Pre-Tool-Use Hook blocks violations
- Code review mandatory

---

## II. Dental Feature → Contract Mapping

### Feature 1: Tooth Chart Management

**Product Capability:** Visual tooth charting with historical timeline

**Contract Dependencies:**

| Dental Feature | Public Contract | Kernel Engine | Purpose |
|----------------|-----------------|---------------|---------|
| Get Patient | `PersonEngineContract.getPersonById()` | H1: Person Engine | Patient demographic data |
| Get Encounter | `EncounterEngineContract.getEncounterById()` | H2: Encounter Engine | Link tooth chart to visit |
| Record Chart | `TemporalEngineContract.recordBitemporalEvent()` | H9: Temporal Engine | Bitemporal tooth state |
| Get History | `TemporalEngineContract.getStateAtTime()` | H9: Temporal Engine | Historical tooth conditions |
| Audit Action | `AuditEngineContract.recordClinicalAction()` | H11: Audit Engine | WHO charted, WHEN, FINGERPRINT |

**Flow:**
```typescript
// Step 1: Get patient via Contract
const patient = await PersonEngineContract.getPersonById(personId);

// Step 2: Get encounter via Contract
const encounter = await EncounterEngineContract.getEncounterById(encounterId);

// Step 3: Save tooth chart to Product table
await db.insert('dental_tooth_chart', {
  person_id: patient.id,
  encounter_id: encounter.id,
  tooth_number: 16,
  condition: 'decayed',
  surface: 'O',
  tenant_id: currentTenantId
});

// Step 4: Record bitemporal event via Contract
await TemporalEngineContract.recordBitemporalEvent({
  entity_type: 'dental_tooth_chart',
  entity_id: chartId,
  event_type: 'tooth_condition_changed',
  valid_from: now,
  transaction_time: now,
  data: { tooth_number: 16, condition: 'decayed', surface: 'O' }
});

// Step 5: Audit action via Contract
await AuditEngineContract.recordClinicalAction({
  actor: dentistId,
  action: 'TOOTH_CHART_UPDATED',
  encounter: encounterId,
  details: { tooth_number: 16, condition: 'decayed' },
  fingerprint: calculateFingerprint(chartData)
});
```

---

### Feature 2: Dental Assessment

**Product Capability:** Structured oral examination with periodontal assessment

**Contract Dependencies:**

| Dental Feature | Public Contract | Kernel Engine | Purpose |
|----------------|-----------------|---------------|---------|
| Get Patient | `PersonEngineContract.getPersonById()` | H1: Person Engine | Patient info |
| Create Encounter | `EncounterEngineContract.createEncounter()` | H2: Encounter Engine | Clinical session |
| Update Encounter | `EncounterEngineContract.updateEncounter()` | H2: Encounter Engine | Add chief complaint |
| Audit Assessment | `AuditEngineContract.recordClinicalAction()` | H11: Audit Engine | Audit trail |

**Flow:**
```typescript
// Step 1: Get or create encounter via Contract
const encounter = await EncounterEngineContract.createEncounter({
  personId: patientId,
  type: 'outpatient',
  chiefComplaint: 'Toothache on upper right molar',
  tenantId: currentTenantId
});

// Step 2: Save dental assessment to Product table
const assessment = await db.insert('dental_assessments', {
  encounter_id: encounter.id,
  person_id: patientId,
  dentist_id: currentUserId,
  chief_complaint: 'Toothache on tooth 16',
  oral_exam_notes: 'Large cavity detected on occlusal surface',
  periodontal_chart: {
    "16": [3, 2, 3, 2, 3, 2] // Pocket depths in mm
  },
  tenant_id: currentTenantId
});

// Step 3: Audit via Contract
await AuditEngineContract.recordClinicalAction({
  actor: currentUserId,
  action: 'DENTAL_ASSESSMENT_CREATED',
  encounter: encounter.id,
  details: { assessmentId: assessment.id },
  fingerprint: calculateFingerprint(assessment)
});
```

---

### Feature 3: Treatment Plan Creation

**Product Capability:** Multi-phase treatment planning with cost estimation

**Contract Dependencies:**

| Dental Feature | Public Contract | Kernel Engine | Purpose |
|----------------|-----------------|---------------|---------|
| Get Patient | `PersonEngineContract.getPersonById()` | H1: Person Engine | Patient info |
| Get Encounter | `EncounterEngineContract.getEncounterById()` | H2: Encounter Engine | Link to visit |
| Validate Protocol | `RuleGovernanceContract.validateTreatmentProtocol()` | H10: Governance Engine | Protocol compliance |
| Record Consent | `AuditEngineContract.recordPatientConsent()` | H11: Audit Engine | Legal consent |
| Audit Plan | `AuditEngineContract.recordClinicalAction()` | H11: Audit Engine | Plan creation audit |

**Flow:**
```typescript
// Step 1: Get patient via Contract
const patient = await PersonEngineContract.getPersonById(patientId);

// Step 2: Create treatment plan in Product table
const plan = await db.insert('dental_treatment_plans', {
  person_id: patientId,
  encounter_id: encounterId,
  dentist_id: currentUserId,
  plan_title: 'Comprehensive Restoration Plan',
  status: 'draft',
  tenant_id: currentTenantId
});

// Step 3: Add treatment steps (Product table)
const steps = [
  { phase: 'emergency', procedure_type: 'extraction', tooth_number: 18, estimated_cost: 500000 },
  { phase: 'restoration', procedure_type: 'filling', tooth_number: 16, estimated_cost: 300000 }
];

for (const [index, step] of steps.entries()) {
  await db.insert('dental_treatment_plan_steps', {
    treatment_plan_id: plan.id,
    sequence_order: index + 1,
    ...step,
    tenant_id: currentTenantId
  });
}

// Step 4: Validate protocol via Contract (if needed)
const protocolCheck = await RuleGovernanceContract.validateTreatmentProtocol({
  protocol: 'dental_restoration_standard',
  steps: steps.map(s => s.procedure_type),
  patientCondition: { age: patient.age, conditions: patient.medical_history }
});

if (!protocolCheck.isValid) {
  throw new Error(`Protocol violation: ${protocolCheck.message}`);
}

// Step 5: Record patient consent via Contract
await AuditEngineContract.recordPatientConsent({
  personId: patientId,
  consentType: 'treatment_plan',
  consentData: { planId: plan.id, steps },
  signature: consentSignature,
  timestamp: now
});

// Step 6: Audit plan creation via Contract
await AuditEngineContract.recordClinicalAction({
  actor: currentUserId,
  action: 'DENTAL_TREATMENT_PLAN_CREATED',
  encounter: encounterId,
  details: { planId: plan.id, stepsCount: steps.length },
  fingerprint: calculateFingerprint(plan)
});
```

---

### Feature 4: Procedure Execution

**Product Capability:** Record completed dental procedures with materials tracking

**Contract Dependencies:**

| Dental Feature | Public Contract | Kernel Engine | Purpose |
|----------------|-----------------|---------------|---------|
| Get Encounter | `EncounterEngineContract.getEncounterById()` | H2: Encounter Engine | Link procedure to visit |
| Update Encounter | `EncounterEngineContract.updateEncounterStatus()` | H2: Encounter Engine | Mark visit in-progress |
| Check Interactions | `ClinicalDecisionContract.checkDrugInteractions()` | H8: CDS Engine | Safety check (if meds used) |
| Create Order | `ClinicalOrderContract.createOrder()` | H4: Clinical/Pharmacy | Medication order (if needed) |
| Record Evidence | `AuditEngineContract.recordClinicalAction()` | H11: Audit Engine | Procedure audit |
| Update Temporal | `TemporalEngineContract.recordBitemporalEvent()` | H9: Temporal Engine | Tooth state change |

**Flow:**
```typescript
// Step 1: Get encounter via Contract
const encounter = await EncounterEngineContract.getEncounterById(encounterId);

// Step 2: Update encounter status via Contract
await EncounterEngineContract.updateEncounterStatus({
  encounterId,
  status: 'in_progress'
});

// Step 3: Record procedure in Product table
const procedure = await db.insert('dental_procedures', {
  encounter_id: encounterId,
  person_id: patientId,
  dentist_id: currentUserId,
  procedure_type: 'filling',
  tooth_number: 16,
  surface: 'O',
  clinical_notes: 'Amalgam filling placed',
  started_at: startTime,
  completed_at: endTime,
  tenant_id: currentTenantId
});

// Step 4: Record materials used (Product table)
await db.insert('dental_procedure_materials', {
  procedure_id: procedure.id,
  material_name: 'Amalgam Filling Material',
  quantity: 2.5,
  unit: 'grams',
  tenant_id: currentTenantId
});

// Step 5: Update tooth chart via Temporal Contract
await TemporalEngineContract.recordBitemporalEvent({
  entity_type: 'dental_tooth_chart',
  entity_id: toothChartId,
  event_type: 'tooth_condition_changed',
  valid_from: now,
  data: { tooth_number: 16, condition: 'filled', surface: 'O' }
});

// Step 6: If medication prescribed, create order via Contract
if (needsPainMedication) {
  await ClinicalOrderContract.createOrder({
    encounterId,
    orderType: 'medication',
    medication: { name: 'Ibuprofen', dosage: '400mg', frequency: '3x daily', duration: '3 days' },
    prescribedBy: currentUserId
  });
}

// Step 7: Audit procedure via Contract
await AuditEngineContract.recordClinicalAction({
  actor: currentUserId,
  action: 'DENTAL_PROCEDURE_COMPLETED',
  encounter: encounterId,
  details: {
    procedureId: procedure.id,
    procedure_type: 'filling',
    tooth_number: 16,
    materials: ['Amalgam Filling Material']
  },
  fingerprint: calculateFingerprint(procedure)
});
```

---

### Feature 5: Billing Projection

**Product Capability:** Calculate treatment costs and payment tracking

**Contract Dependencies:**

| Dental Feature | Public Contract | Kernel Engine | Purpose |
|----------------|-----------------|---------------|---------|
| Get Patient | `PersonEngineContract.getPersonById()` | H1: Person Engine | Patient insurance info |
| Get Treatment Plan | (Product direct) | N/A | Product owns plans |
| Calculate Costs | (Product logic) | N/A | Product business logic |
| Record Revenue | `FinanceEngineContract.recordRevenue()` | Finance Engine | Revenue tracking |
| Audit Payment | `AuditEngineContract.recordFinancialTransaction()` | H11: Audit Engine | Payment audit |

**Flow:**
```typescript
// Step 1: Get patient insurance via Contract
const patient = await PersonEngineContract.getPersonById(patientId);
const insuranceCoverage = patient.insurance?.dentalCoverage || 0;

// Step 2: Get treatment plan from Product table
const plan = await db.query('SELECT * FROM dental_treatment_plans WHERE id = $1', [planId]);
const steps = await db.query('SELECT * FROM dental_treatment_plan_steps WHERE treatment_plan_id = $1', [planId]);

// Step 3: Calculate costs (Product logic)
const totalCost = steps.reduce((sum, step) => sum + step.estimated_cost, 0);
const insurancePays = totalCost * (insuranceCoverage / 100);
const patientPays = totalCost - insurancePays;

// Step 4: Create billing projection (Product table)
const projection = await db.insert('dental_billing_projections', {
  treatment_plan_id: planId,
  person_id: patientId,
  total_cost: totalCost,
  insurance_coverage_pct: insuranceCoverage,
  insurance_pays: insurancePays,
  patient_pays: patientPays,
  payment_status: 'pending',
  tenant_id: currentTenantId
});

// Step 5: When payment received, record revenue via Contract
await FinanceEngineContract.recordRevenue({
  tenantId: currentTenantId,
  amount: patientPays,
  category: 'dental_services',
  referenceId: planId,
  paymentMethod: 'cash',
  receivedBy: currentUserId,
  receivedAt: now
});

// Step 6: Audit payment via Contract
await AuditEngineContract.recordFinancialTransaction({
  actor: currentUserId,
  action: 'PAYMENT_RECEIVED',
  amount: patientPays,
  reference: { type: 'dental_treatment_plan', id: planId },
  fingerprint: calculateFingerprint({ amount: patientPays, planId, timestamp: now })
});
```

---

## III. Complete Contract Registry

### Healthcare Kernel Contracts Used by Dental

| Contract | Kernel Engine | Methods Used | Purpose |
|----------|---------------|--------------|---------|
| **PersonEngineContract** | H1: Person Engine | `getPersonById()`, `searchPersons()`, `updatePerson()` | Patient/Dentist management |
| **EncounterEngineContract** | H2: Encounter Engine | `createEncounter()`, `getEncounterById()`, `updateEncounterStatus()` | Clinical session tracking |
| **ClinicalOrderContract** | H4: Clinical/Pharmacy | `createOrder()`, `getOrdersByEncounter()`, `updateOrderStatus()` | Medication prescriptions |
| **ClinicalDecisionContract** | H8: CDS Engine | `checkDrugInteractions()`, `validateProcedure()` | Clinical safety checks |
| **TemporalEngineContract** | H9: Temporal Engine | `recordBitemporalEvent()`, `getStateAtTime()`, `getTimeline()` | Historical tooth states |
| **RuleGovernanceContract** | H10: Governance Engine | `validateTreatmentProtocol()`, `getRuleVersion()` | Protocol compliance |
| **AuditEngineContract** | H11: Audit Engine | `recordClinicalAction()`, `recordPatientConsent()`, `recordFinancialTransaction()` | Audit trail |
| **FinanceEngineContract** | Finance Engine | `recordRevenue()`, `recordExpense()` | Financial transactions |

---

## IV. Contract Interface Definitions

### PersonEngineContract

```typescript
interface PersonEngineContract {
  getPersonById(id: string): Promise<Person>;
  searchPersons(criteria: SearchCriteria): Promise<Person[]>;
  updatePerson(id: string, updates: PersonUpdate): Promise<Person>;
}

interface Person {
  id: string;
  name: string;
  dob: Date;
  gender: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: string;
  insurance?: InsuranceInfo;
  medical_history?: string[];
  tenant_id: string;
}
```

---

### EncounterEngineContract

```typescript
interface EncounterEngineContract {
  createEncounter(data: EncounterCreate): Promise<Encounter>;
  getEncounterById(id: string): Promise<Encounter>;
  updateEncounterStatus(id: string, status: EncounterStatus): Promise<Encounter>;
}

interface EncounterCreate {
  personId: string;
  type: 'outpatient' | 'emergency' | 'inpatient';
  chiefComplaint: string;
  tenantId: string;
}

interface Encounter {
  id: string;
  person_id: string;
  type: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  chief_complaint?: string;
  started_at: Date;
  ended_at?: Date;
  tenant_id: string;
}
```

---

### TemporalEngineContract

```typescript
interface TemporalEngineContract {
  recordBitemporalEvent(event: BitemporalEvent): Promise<void>;
  getStateAtTime(entityType: string, entityId: string, validTime: Date, transactionTime?: Date): Promise<unknown>;
  getTimeline(entityType: string, entityId: string): Promise<TimelineEntry[]>;
}

interface BitemporalEvent {
  entity_type: string;
  entity_id: string;
  event_type: string;
  valid_from: Date;
  valid_to?: Date;
  transaction_time: Date;
  data: Record<string, unknown>;
}
```

---

### AuditEngineContract

```typescript
interface AuditEngineContract {
  recordClinicalAction(action: ClinicalAction): Promise<void>;
  recordPatientConsent(consent: PatientConsent): Promise<void>;
  recordFinancialTransaction(transaction: FinancialTransaction): Promise<void>;
}

interface ClinicalAction {
  actor: string; // User ID
  action: string; // Action type
  encounter: string; // Encounter ID
  details: Record<string, unknown>;
  fingerprint: string; // SHA-256 fingerprint
  timestamp?: Date;
}

interface PatientConsent {
  personId: string;
  consentType: string;
  consentData: Record<string, unknown>;
  signature?: string;
  timestamp: Date;
}
```

---

## V. Contract Boundary Enforcement

### Gate 2: Contract Boundary Test

**Test Specification:**

```typescript
describe('Dental Product - Contract Boundary Test', () => {
  it('should NOT import Kernel implementation directly', () => {
    const dentalFiles = glob.sync('src/products/dental/**/*.ts');
    
    for (const file of dentalFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for forbidden imports
      const forbiddenPatterns = [
        /from\s+['"]@\/platform\/healthcare\/engines\/.*\/implementation['"]/,
        /from\s+['"].*\/hc_.*['"]/,  // Direct table imports
        /db\.query\(['"]SELECT.*FROM hc_/,  // Direct table queries
      ];
      
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
      
      // Check for required Contract imports
      if (content.includes('PersonEngine') || content.includes('getPersonById')) {
        expect(content).toMatch(/from\s+['"]@\/platform\/healthcare\/engines\/person-engine\/contract['"]/);
      }
    }
  });
  
  it('should use Contracts for all Kernel interactions', () => {
    const dentalServices = glob.sync('src/products/dental/services/**/*.ts');
    
    for (const file of dentalServices) {
      const ast = parseTypeScript(file);
      const kernelCalls = findKernelInteractions(ast);
      
      for (const call of kernelCalls) {
        expect(call.source).toMatch(/Contract$/);  // Must end with "Contract"
        expect(call.source).not.toMatch(/Impl$/);  // Must NOT end with "Impl"
      }
    }
  });
});
```

---

## VI. Summary

### Contract Usage Matrix

| Dental Feature | Contracts Used | Kernel Engines | Product Tables |
|----------------|----------------|----------------|----------------|
| **Tooth Chart** | Person, Encounter, Temporal, Audit | H1, H2, H9, H11 | `dental_tooth_chart` |
| **Assessment** | Person, Encounter, Audit | H1, H2, H11 | `dental_assessments` |
| **Treatment Plan** | Person, Encounter, Governance, Audit | H1, H2, H10, H11 | `dental_treatment_plans`, `dental_treatment_plan_steps` |
| **Procedure** | Encounter, Clinical, CDS, Temporal, Audit | H2, H4, H8, H9, H11 | `dental_procedures`, `dental_procedure_materials` |
| **Billing** | Person, Finance, Audit | H1, Finance, H11 | `dental_billing_projections` |

**Key Insight:** Product uses 8 Kernel Contracts, 0 direct Kernel implementations. ✅

---

**Document Owner:** Kiro AI Development Environment  
**Last Updated:** 2026-08-23  
**Version:** 1.0.0  
**Status:** DRAFT (pending Architecture Review)
