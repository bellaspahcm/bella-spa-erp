# Bella Hospital Enterprise Architecture

## Overview
This document defines the complete enterprise architecture for Bella Hospital as part of the Bella AI Platform ecosystem.

**Current Status:** Hospital Core (Phase A) - 30-35% complete
**Target:** Full HIS Enterprise Platform

---

## Architecture Tree (Platform-of-Platforms)

```
BELLA AI PLATFORM
│
├─────────────────────────────────────────────────────────────
│ BELLA HOST PLATFORM (Enterprise Foundation Layer)
├─────────────────────────────────────────────────────────────
│
├── Shared Services & Runtime
│   ├── Identity & IAM
│   ├── Tenant Management
│   ├── Organization Center
│   ├── Person Center (Universal Person)
│   ├── Notification Center
│   ├── Document Management
│   ├── File Storage
│   ├── Workflow Runtime
│   ├── Policy Runtime
│   ├── Rule Engine
│   ├── Event Bus
│   ├── Automation Runtime
│   ├── AI Platform Runtime
│   └── Integration Runtime
│
├── Platform Governance & Control Plane
│   ├── Contract Registry (API / Event / Schema)
│   ├── Capability Registry (Capability Catalog)
│   ├── Feature Flag Platform
│   │   ├── Dark Launch
│   │   ├── Canary Deployment
│   │   ├── Progressive Rollout
│   │   └── Tenant Feature Toggle
│   ├── Metadata Platform
│   ├── Audit & Compliance
│   └── Plugin Runtime
│
├── Data & AI Fabric
│   ├── Knowledge Graph
│   ├── Data Fabric
│   └── Marketplace
│
│
├─────────────────────────────────────────────────────────────
│ INDUSTRY PLATFORMS (Domain-Specific Capability Layers)
├─────────────────────────────────────────────────────────────
│
├── BELLA HEALTHCARE PLATFORM
│   │
│   ├── Healthcare Shared Engines (Domain Kernel)
│   │   ├── MPI Engine (Master Patient Index)
│   │   ├── Encounter Engine
│   │   ├── Clinical Engine
│   │   ├── Order Engine
│   │   ├── Billing Engine
│   │   ├── Insurance Engine
│   │   ├── Scheduling Engine
│   │   ├── Smart Queue Engine
│   │   ├── Pharmacy Engine
│   │   ├── Laboratory Engine
│   │   ├── Imaging Engine
│   │   ├── Bed Engine
│   │   ├── Nursing Engine
│   │   ├── Emergency Engine
│   │   ├── Infection Control Engine
│   │   ├── Clinical Decision Support Engine
│   │   ├── Voice AI Engine
│   │   └── Healthcare Analytics Engine
│   │
│   └── Healthcare Product Packs (Consumes Engines)
│       │
│       ├── Bella Medical Clinic (Product Pack)
│       │   ├── Outpatient Dashboard
│       │   ├── Appointment UI
│       │   ├── EMR UI
│       │   └── Billing UI
│       │
│       ├── Bella Dental Clinic (Product Pack)
│       │   ├── Dental Dashboard
│       │   ├── Odontogram UI
│       │   ├── Treatment Plan UI
│       │   └── Imaging UI
│       │
│       ├── Bella Hospital (Product Pack) ⭐
│       │   │
│       │   ├── Executive Dashboard
│       │   │
│       │   ├── Inpatient
│       │   │   ├── Admission UI
│       │   │   ├── Ward Management UI
│       │   │   ├── Bed Transfer UI
│       │   │   ├── Nursing Station UI
│       │   │   ├── Vital Signs UI
│       │   │   ├── MAR UI
│       │   │   └── Nursing Notes UI
│       │   │
│       │   ├── Critical Care
│       │   │   ├── ICU Dashboard
│       │   │   ├── Real-time Vital Monitor
│       │   │   ├── Ventilator UI
│       │   │   └── Infusion Pump UI
│       │   │
│       │   ├── Emergency
│       │   │   ├── ED Dashboard
│       │   │   ├── Triage UI
│       │   │   ├── ED Queue UI
│       │   │   ├── Resuscitation UI
│       │   │   └── Ambulance Tracking
│       │   │
│       │   ├── Operating Room
│       │   │   ├── OR Dashboard
│       │   │   ├── Surgery Scheduling UI
│       │   │   ├── Anesthesia Records UI
│       │   │   └── Surgical Instruments UI
│       │   │
│       │   ├── Ancillary Integration UI
│       │   │   ├── Laboratory Results Viewer
│       │   │   ├── Radiology Viewer
│       │   │   ├── PACS Viewer
│       │   │   └── Blood Bank UI
│       │   │
│       │   └── Hospital Operations
│       │       ├── Bed Occupancy Viewer
│       │       ├── Capacity Dashboard
│       │       ├── Command Center
│       │       └── Hospital KPI Dashboard
│       │
│       ├── Bella Laboratory (Product Pack)
│       ├── Bella Pharmacy (Product Pack)
│       ├── Bella HomeCare (Product Pack)
│       ├── Bella Specialist Center (Product Pack)
│       └── Bella Medical Group (Product Pack)
│
├── BELLA BEAUTY SPA PLATFORM
│   └── Beauty Product Packs...
│
├── BELLA REAL ESTATE PLATFORM
│   └── Real Estate Product Packs...
│
├── BELLA AUTO PLATFORM
│   └── Auto Product Packs...
│
├── BELLA RETAIL PLATFORM
│   └── Retail Product Packs...
│
├── BELLA EDUCATION PLATFORM
│   └── Education Product Packs...
│
└── BELLA MANUFACTURING PLATFORM
    └── Manufacturing Product Packs...
```

---

## Current Implementation Status (Phase A - Hospital Core)

### ✅ Implemented (30-35%)

#### Executive & AI
- Dashboard điều hành (Executive Dashboard)
- AI Copilot

#### Front Office
- Appointment (Đặt Lịch)
- QR Check-in
- Queue Center (Quản lý Hàng Đợi)
- TV Waiting Display (Màn Hình TV Hàng Đợi AI)
- Doctor Schedule (Lịch Trực Bác sĩ)

#### Clinical
- MPI (Master Patient Index - Hồ sơ bệnh nhân)
- EMR (Electronic Medical Records - Lượt khám bệnh)
- Clinical Timeline (Hành trình điều trị)

#### Inpatient
- Admission (Bệnh Án Nội Trú)
- Bed Management (Sơ đồ Buồng Giường)
- Vital Signs (Theo Dõi Sinh Hiệu Điều Dưỡng)
- MAR (Medication Administration Record - Phiếu Thực Hiện Y Lệnh)

#### Ancillary
- LIS/RIS/PACS (Cận Lâm Sàng - placeholder UI)

#### Revenue Cycle
- BHYT XML130 (Cổng Giám Định BHYT - placeholder UI)

---

## Roadmap to HIS Enterprise (70% remaining)

### Phase B: Critical Hospital Operations (Priority 1)
**Target:** Q3 2026
**Effort:** 3-4 months

#### Operating Room (OR) Module
- Pre-operative Assessment
- Surgery Scheduling
- OR Dashboard
- Anesthesia Records
- Surgical Instruments Tracking
- Post-operative Notes

#### ICU/CCU Module
- ICU Dashboard
- Critical Vital Monitoring (real-time)
- Ventilator Management
- Infusion Pump Integration
- ICU Scoring (APACHE, SOFA)
- Critical Event Alerts

#### Emergency Department (ED)
- ED Dashboard
- Triage System
- ED Queue Management
- Fast Track
- Resuscitation Room
- Ambulance Tracking
- NEDOCS Calculation

#### Blood Bank
- Blood Inventory
- Blood Request
- Crossmatch
- Transfusion Records
- Blood Donor Management
- Adverse Reaction Tracking

### Phase C: Pharmacy & Supply Chain (Priority 2)
**Target:** Q4 2026
**Effort:** 2-3 months

#### Pharmacy Module (Complete)
- Inpatient Dispensing
- Outpatient Dispensing
- IV Admixture
- Controlled Drugs (CDIS)
- Medication Reconciliation
- Drug-Drug Interaction (DDI)
- Allergy Checking
- Pharmacy Inventory
- Expiry Management
- Narcotic Audit Trail

#### Supply Chain
- Central Supply
- Ward Stock
- Requisition
- Asset Management
- Biomedical Equipment
- Preventive Maintenance
- CSSD (Central Sterile Supply Department)

### Phase D: Advanced Clinical (Priority 3)
**Target:** Q1 2027
**Effort:** 3-4 months

#### Clinical Decision Support (CDS)
- Clinical Pathways
- Order Sets
- Drug Dosing Calculator
- Clinical Alerts
- Evidence-Based Guidelines
- Drug Allergy Checking
- Lab Result Interpretation

#### Infection Control
- Surveillance Dashboard
- Outbreak Detection
- Contact Tracing
- Antimicrobial Stewardship
- Infection Registry
- Environmental Monitoring

#### Rehabilitation
- Rehab Orders
- Therapy Sessions
- Progress Tracking
- Functional Assessment
- Discharge Planning

#### Nutrition
- Diet Orders
- Nutrition Assessment
- Meal Planning
- Allergy Management
- Enteral/Parenteral Nutrition

### Phase E: Revenue Cycle Management (Priority 4)
**Target:** Q2 2027
**Effort:** 2-3 months

#### Billing (Complete)
- Charge Capture
- Invoice Generation
- Payment Processing
- Deposit Management
- Refund Processing
- Bad Debt Management

#### Insurance & Claims
- Insurance Verification
- Pre-authorization
- Claims Submission
- Claims Tracking
- Denial Management
- Appeals

#### BHYT Integration (Complete)
- XML130 Generation
- Thông tuyến Checking
- BHYT Eligibility
- Co-payment Calculation
- Settlement Reports

### Phase F: Multi-Hospital & Command Center (Priority 5)
**Target:** Q3 2027
**Effort:** 3-4 months

#### Multi-Hospital Management
- Group Dashboard
- Cross-site Patient Transfer
- Centralized Scheduling
- Resource Sharing
- Consolidated Reporting
- Master Data Management

#### Command Center
- Real-time Hospital Operations
- Capacity Management
- Throughput Analysis
- Patient Flow Visualization
- Alert Management
- Incident Response

### Phase G: AI & Advanced Analytics (Priority 6)
**Target:** Q4 2027
**Effort:** 4-6 months

#### AI Clinical Copilot
- Voice-to-Text Clinical Notes
- Diagnosis Suggestion
- Treatment Recommendation
- Drug Interaction Prediction
- Clinical Question Answering

#### Predictive Analytics
- Bed Demand Forecasting
- Patient Risk Scoring
- Readmission Prediction
- Length of Stay Prediction
- Resource Optimization

#### Executive Intelligence
- Real-time BI Dashboard
- Financial Analytics
- Clinical Quality Metrics
- Operational KPIs
- Benchmarking
- Data Warehouse

---

## Platform Strategy (Corrected: Platform-of-Platforms)

### Layer 1: Bella Host Platform (Foundation)
**Purpose:** Provide shared services and runtime for ALL industry platforms

#### Core Platform Services
- **Identity & IAM:** SSO, RBAC, MFA, LDAP integration
- **Tenant Management:** Multi-tenancy, white-labeling, subscription
- **Organization Center:** Org chart, departments, locations
- **Person Center:** Universal person registry (staff, patients, partners)
- **Notification Center:** Email, SMS, push, in-app notifications
- **Document Management:** DMS, versioning, templates
- **File Storage:** S3-compatible object storage
- **Workflow Runtime:** BPMN engine, approval workflows
- **Policy Runtime:** Policy enforcement, dynamic permissions
- **Rule Engine:** Business rules, decision tables
- **Event Bus:** Event-driven architecture, pub/sub
- **Automation Runtime:** Scheduled jobs, RPA integration
- **AI Platform Runtime:** LLM gateway, embeddings, RAG
- **Integration Runtime:** HL7, FHIR, DICOM, API gateway

#### Platform Governance & Control Plane (NEW)
- **Contract Registry:** API contracts, Event schemas, Schema registry (AsyncAPI, OpenAPI)
- **Capability Registry:** Capability catalog, feature discovery, versioning
- **Feature Flag Platform:**
  - Dark Launch (deploy without exposing)
  - Canary Deployment (gradual rollout)
  - Progressive Rollout (percentage-based)
  - Tenant Feature Toggle (per-tenant enablement)
- **Metadata Platform:** Schema registry, data catalog
- **Audit & Compliance:** Audit logs, compliance reports
- **Plugin Runtime:** Plugin marketplace, hot-swap

#### Data & AI Fabric
- **Knowledge Graph:** Entity relationships, inference
- **Data Fabric:** Unified data access, federation
- **Marketplace:** Plugin store, integration catalog

---

### Layer 2: Industry Platforms (Domain Capability Layer)
**Purpose:** Provide domain-specific shared engines (NOT product UIs)

#### Bella Healthcare Platform
**Important:** Healthcare Platform does NOT contain UI pages. It only contains ENGINES.

##### Healthcare Shared Engines (Reusable across all healthcare products)
- **MPI Engine:** Master Patient Index, patient search, identity resolution
- **Encounter Engine:** Visit management, registration, check-in/check-out
- **Clinical Engine:** SOAP notes, diagnosis (ICD-10), procedures (ICD-9-CM)
- **Order Engine:** Clinical orders lifecycle, order fulfillment tracking
- **Billing Engine:** Charge capture, invoicing, payment processing
- **Insurance Engine:** Insurance verification, claims submission, adjudication
- **Scheduling Engine:** Appointment booking, availability management, slot optimization
- **Smart Queue Engine:** Queue optimization, AI calling, wait time prediction
- **Pharmacy Engine:** Drug database, DDI checking, dispensing workflow
- **Laboratory Engine:** Test catalog, result entry, result interpretation
- **Imaging Engine:** Modality worklist, PACS integration, study management
- **Bed Engine:** Bed availability, allocation algorithm, occupancy tracking
- **Nursing Engine:** Nursing workflows, documentation templates, handoff
- **Emergency Engine:** Triage (ESI 1-5), ED workflow, NEDOCS calculation
- **Infection Control Engine:** Surveillance algorithms, outbreak detection
- **Clinical Decision Support Engine:** Clinical pathways, order sets, alerts
- **Voice AI Engine:** Voice-to-text, voice commands, clinical note generation
- **Healthcare Analytics Engine:** Clinical BI, quality metrics, dashboards

**Key Point:** Hospital Product Pack CONSUMES these engines, does NOT implement them.

---

### Layer 3: Product Packs (UI + Workflows)
**Purpose:** Provide user-facing applications that CONSUME platform engines

#### Bella Hospital (Product Pack)
**Important:** Hospital is NOT a platform. It is a product pack that consumes Healthcare Platform engines.

**What Hospital Product Pack Contains:**
- ✅ UI Pages (dashboards, forms, viewers)
- ✅ Workflows specific to hospital operations
- ✅ Hospital-specific business rules (on top of engine APIs)
- ✅ Hospital-specific reports and analytics views

**What Hospital Product Pack DOES NOT Contain:**
- ❌ MPI logic (uses MPI Engine from Healthcare Platform)
- ❌ Billing logic (uses Billing Engine from Healthcare Platform)
- ❌ Queue logic (uses Smart Queue Engine from Healthcare Platform)
- ❌ AI logic (uses AI Platform Runtime from Host Platform)
- ❌ Workflow engine (uses Workflow Runtime from Host Platform)
- ❌ Notification logic (uses Notification Center from Host Platform)

##### Hospital Product Pack Structure

###### Executive Dashboard (UI Layer Only)
- Dashboard UI consuming Healthcare Analytics Engine
- KPI widgets consuming various engines for data
- Real-time updates via Event Bus

###### Inpatient Module (UI + Hospital-specific workflows)
- **Admission UI:** Form UI consuming MPI Engine, Encounter Engine, Bed Engine
- **Ward Management UI:** Dashboard consuming Bed Engine, Nursing Engine
- **Bed Transfer UI:** Workflow UI consuming Bed Engine APIs
- **Nursing Station UI:** Nurse dashboard consuming Nursing Engine
- **Vital Signs UI:** Data entry form consuming Nursing Engine
- **MAR UI:** Medication admin UI consuming Pharmacy Engine
- **Nursing Notes UI:** Documentation form consuming Nursing Engine

###### Critical Care (ICU/CCU)
- **ICU Dashboard:** Real-time monitor consuming Nursing Engine + Event Bus
- **Ventilator UI:** Device integration consuming Integration Runtime
- **Infusion Pump UI:** Device integration consuming Integration Runtime

###### Emergency Department
- **ED Dashboard:** Dashboard consuming Emergency Engine
- **Triage UI:** Triage form consuming Emergency Engine
- **ED Queue UI:** Queue display consuming Smart Queue Engine
- **Ambulance Tracking:** GPS tracking consuming Integration Runtime

###### Operating Room
- **OR Dashboard:** Dashboard consuming Order Engine (surgery orders)
- **Surgery Scheduling UI:** Calendar UI consuming Scheduling Engine
- **Anesthesia Records UI:** Form consuming Clinical Engine
- **Surgical Instruments UI:** Inventory consuming Integration Runtime

###### Ancillary Integration UI
- **Laboratory Results Viewer:** Results display consuming Laboratory Engine
- **Radiology Viewer:** Image viewer consuming Imaging Engine
- **PACS Viewer:** DICOM viewer consuming Imaging Engine + Integration Runtime
- **Blood Bank UI:** Inventory UI consuming Laboratory Engine (blood bank module)

###### Hospital Operations
- **Bed Occupancy Viewer:** Dashboard consuming Bed Engine
- **Capacity Dashboard:** Dashboard consuming Healthcare Analytics Engine
- **Command Center:** Real-time operations consuming multiple engines + Event Bus
- **Hospital KPI Dashboard:** BI dashboard consuming Healthcare Analytics Engine

---

### Architecture Principles (Platform-of-Platforms)

#### 1. Clear Separation of Concerns
```
Host Platform:     Shared services (Identity, Notification, Workflow, AI)
Industry Platform: Domain engines (MPI, Billing, Queue, Bed, Nursing)
Product Pack:      UI pages + product-specific workflows
```

#### 2. Engine Ownership
- **Healthcare Platform owns ALL healthcare domain logic**
- **Hospital Product Pack only owns hospital-specific UI and workflows**
- **Hospital NEVER implements core engines** (MPI, Billing, Queue, etc.)

#### 3. API Contracts First
- All engines expose well-defined APIs via Contract Registry
- Product packs consume engines ONLY via published contracts
- No direct database access from product packs to engine tables

#### 4. Feature Flags & Capability Registry
- New features deployed via Feature Flag Platform
- Products declare required capabilities via Capability Registry
- Runtime checks capability before enabling features

#### 5. Zero Engine Duplication
- **NEVER duplicate MPI logic in Hospital Product Pack**
- **NEVER duplicate Billing logic in Dental Clinic Product Pack**
- **NEVER duplicate Queue logic in Medical Clinic Product Pack**
- All products consume the SAME engines from Healthcare Platform

---

### Current Implementation Reality Check

#### What We Currently Have (Incorrect Layer Assignment)
```typescript
// ❌ WRONG: Hospital contains engine logic
src/services/healthcare-hospital-services.ts
  - BedEngineService        // Should be in Healthcare Platform
  - MARService              // Should be in Healthcare Platform (Pharmacy Engine)
  - NursingVitalsService    // Should be in Healthcare Platform (Nursing Engine)
  - InpatientAdmissionService // Should consume Encounter Engine + Bed Engine
```

#### What We Should Have (Correct Layer Assignment)
```
// ✅ CORRECT: Healthcare Platform contains engines
src/platform/healthcare/engines/
  - bed-engine.ts           // Bed Engine (consumed by Hospital, Clinic, etc.)
  - pharmacy-engine.ts      // Pharmacy Engine (MAR is part of this)
  - nursing-engine.ts       // Nursing Engine (vitals, notes, etc.)
  - encounter-engine.ts     // Encounter Engine (admission is an encounter type)

// ✅ CORRECT: Hospital Product Pack only has UI + workflows
src/products/bella-hospital/
  - pages/                  // UI pages
  - workflows/              // Hospital-specific workflows
  - hooks/                  // React hooks consuming engine APIs
  - components/             // Hospital-specific UI components
```

---

### Refactoring Roadmap (To Achieve True Platform Architecture)

#### Phase 0: Platform Foundation Refactor (Before Phase B)
**Priority:** CRITICAL
**Effort:** 4-6 weeks
**Goal:** Move all engines from Hospital Product Pack to Healthcare Platform

##### Step 1: Extract Engines from Hospital Services
```typescript
// Move from:
src/services/healthcare-hospital-services.ts

// Move to:
src/platform/healthcare/engines/bed-engine/
  - bed-allocation.service.ts
  - bed-occupancy.service.ts
  - bed-transfer.service.ts

src/platform/healthcare/engines/nursing-engine/
  - vital-signs.service.ts
  - nursing-notes.service.ts
  - handoff.service.ts

src/platform/healthcare/engines/pharmacy-engine/
  - mar.service.ts
  - dispensing.service.ts
  - ddi-check.service.ts
```

##### Step 2: Define Engine API Contracts
```typescript
// src/platform/healthcare/contracts/bed-engine.contract.ts
export interface BedEngineContract {
  allocateBed(request: BedAllocationRequest): Promise<BedAllocationResponse>;
  transferBed(request: BedTransferRequest): Promise<BedTransferResponse>;
  getOccupancy(wardId: string): Promise<BedOccupancySnapshot>;
}
```

##### Step 3: Register Contracts in Contract Registry
```typescript
// src/platform/host/contract-registry/
contracts/
  - healthcare/
    - bed-engine.v1.json
    - nursing-engine.v1.json
    - pharmacy-engine.v1.json
```

##### Step 4: Refactor Hospital Product Pack to Consume Engines
```typescript
// src/products/bella-hospital/hooks/use-bed-engine.ts
import { BedEngineContract } from '@/platform/healthcare/contracts';

export function useBedEngine() {
  const bedEngine = usePlatformEngine<BedEngineContract>('bed-engine');
  
  return {
    allocateBed: bedEngine.allocateBed,
    transferBed: bedEngine.transferBed,
    getOccupancy: bedEngine.getOccupancy,
  };
}
```

##### Step 5: Feature Flag Migration
```typescript
// Enable new engine-based architecture gradually
const useNewEngineArchitecture = await featureFlags.isEnabled(
  'healthcare.new-engine-architecture',
  { tenantId, userId }
);

if (useNewEngineArchitecture) {
  // Use Healthcare Platform engines
  return await bedEngine.allocateBed(request);
} else {
  // Fallback to old hospital service (deprecated)
  return await BedEngineService.allocateBed(request);
}
```

---

## Database Architecture

### Multi-Tenancy Strategy
- **Schema-per-tenant:** Each tenant gets isolated schema
- **Shared tables:** `tenants`, `users`, `organizations`, `persons`, `audit_logs`
- **Tenant-scoped tables:** All clinical/operational data filtered by `tenant_id`

### Healthcare-Specific Tables (High Priority)

#### Inpatient (Phase B)
```sql
-- Operating Room
CREATE TABLE operating_rooms (id, name, status, equipment);
CREATE TABLE surgeries (id, patient_id, encounter_id, or_id, surgeon_id, scheduled_at, ...);
CREATE TABLE anesthesia_records (id, surgery_id, anesthesiologist_id, ...);

-- ICU
CREATE TABLE icu_beds (id, ward_id, bed_id, monitoring_level);
CREATE TABLE icu_observations (id, admission_id, timestamp, vital_params JSONB);
CREATE TABLE ventilator_records (id, admission_id, mode, settings JSONB);

-- Emergency
CREATE TABLE emergency_visits (id, patient_id, triage_level, chief_complaint, ...);
CREATE TABLE triage_assessments (id, emergency_visit_id, esi_level, ...);

-- Blood Bank
CREATE TABLE blood_inventory (id, blood_type, rh_factor, units_available);
CREATE TABLE blood_requests (id, patient_id, encounter_id, units_requested, ...);
CREATE TABLE transfusion_records (id, patient_id, blood_unit_id, administered_at, ...);
```

#### Pharmacy (Phase C)
```sql
CREATE TABLE medication_orders (id, encounter_id, drug_id, dose, route, frequency, ...);
CREATE TABLE dispensing_records (id, order_id, pharmacist_id, dispensed_at, ...);
CREATE TABLE controlled_drugs_log (id, drug_id, transaction_type, user_id, timestamp, ...);
CREATE TABLE drug_interactions (drug_a_id, drug_b_id, severity, description);
```

#### Clinical Decision Support (Phase D)
```sql
CREATE TABLE clinical_pathways (id, name, condition, steps JSONB);
CREATE TABLE order_sets (id, name, specialty, orders JSONB);
CREATE TABLE clinical_alerts (id, patient_id, alert_type, severity, message, ...);
```

---

## Technology Stack Considerations

### Real-time Infrastructure (for ICU, ED, Command Center)
- **WebSockets:** Supabase Realtime for live vital signs
- **Event Streaming:** Kafka/RabbitMQ for high-throughput events
- **Time-series DB:** TimescaleDB for vital signs history

### Integration Standards
- **HL7 v2:** ADT, ORM, ORU messages
- **FHIR R4:** REST API for interoperability
- **DICOM:** PACS integration, imaging worklist
- **IHE Profiles:** XDS, PIX, PDQ

### AI/ML Stack
- **Voice AI:** Whisper for transcription, GPT for clinical notes
- **Predictive Models:** Scikit-learn, XGBoost for risk scoring
- **LLM Integration:** OpenAI API, Claude for clinical copilot
- **Vector DB:** Pinecone/Weaviate for semantic search

---

## Success Metrics

### Phase A (Current - 30-35%)
- ✅ Core inpatient workflows functional (UI layer)
- ✅ Basic bed management
- ✅ Vital signs tracking
- ✅ MAR implementation
- ⚠️ **Architecture Violation:** Engines in product pack (must refactor)

### Phase 0 Target (Architecture Refactor - BEFORE Phase B)
- ⏳ All engines moved to Healthcare Platform
- ⏳ Contract Registry implemented
- ⏳ Capability Registry implemented
- ⏳ Feature Flag Platform implemented
- ⏳ Hospital refactored to consume engines (not implement)
- ⏳ Zero engine duplication validated
- ⏳ Architecture freeze achieved (98/100)

### Phase B Target (60%)
- ⏳ OR scheduling operational (consuming Order Engine)
- ⏳ ICU real-time monitoring (consuming Nursing Engine + Event Bus)
- ⏳ ED triage workflow (consuming Emergency Engine)
- ⏳ Blood bank inventory (consuming Laboratory Engine)

### Phase C Target (75%)
- ⏳ Pharmacy dispensing complete (consuming Pharmacy Engine)
- ⏳ Drug-drug interaction checking (Pharmacy Engine feature)
- ⏳ Supply chain management (new engine)

### Phase D Target (85%)
- ⏳ Clinical decision support active (CDS Engine)
- ⏳ Infection control dashboard (Infection Control Engine)
- ⏳ Rehabilitation tracking (new engine)

### Phase E Target (92%)
- ⏳ Full revenue cycle management (consuming Billing Engine)
- ⏳ Insurance claims automation (consuming Insurance Engine)
- ⏳ BHYT integration complete (Insurance Engine feature)

### Phase F Target (96%)
- ⏳ Multi-hospital support (Host Platform feature)
- ⏳ Command center operational (consuming Healthcare Analytics Engine)
- ⏳ Cross-site patient transfer (MPI Engine + Encounter Engine feature)

### Phase G Target (100%)
- ⏳ AI clinical copilot deployed (AI Platform Runtime + CDS Engine)
- ⏳ Predictive analytics live (Healthcare Analytics Engine)
- ⏳ Executive BI dashboard (Healthcare Analytics Engine)

---

## Strategic Vision

### Current Reality: Mixed Architecture (70/100)
- ✅ Product Pack concept understood
- ✅ UI layer separation correct
- ⚠️ Engines incorrectly placed in product pack
- ❌ No Contract Registry
- ❌ No Capability Registry
- ❌ No Feature Flag Platform
- ❌ Engine duplication risk (if other products copy Hospital engines)

### Target State: True Platform-of-Platforms (98/100)
When fully implemented correctly, **Bella Hospital** will be a **thin product pack** consuming rich platform engines:

#### 1. **Zero Engine Duplication**
- Medical Clinic, Dental Clinic, Hospital, Pharmacy, Laboratory ALL use SAME engines
- MPI Engine: ONE implementation, multiple product consumers
- Billing Engine: ONE implementation, multiple product consumers
- Queue Engine: ONE implementation, multiple product consumers

#### 2. **Contract-First Development**
- All engines expose well-defined API contracts
- Contracts versioned and registered in Contract Registry
- Breaking changes require new contract version (v1, v2, v3)
- Products declare required contract versions in manifest

#### 3. **Feature Flag-Driven Rollout**
- New features deployed dark (disabled by default)
- Canary rollout to 5% → 25% → 50% → 100% tenants
- Per-tenant feature toggles for custom enablement
- Instant rollback if issues detected

#### 4. **Capability-Based Discovery**
- Products declare capabilities in manifest
- Runtime checks capabilities before enabling features
- Dynamic menu generation based on enabled capabilities
- No hardcoded feature checks in code

#### 5. **Multi-Facility Support**
- Manage clinics, hospitals, chains, specialist centers on one platform
- Shared MPI across all facilities (patient identity resolution)
- Cross-facility patient transfer (one-click referral)
- Consolidated billing and claims

#### 6. **Extensibility**
- Plugin architecture for custom modules
- Third-party integrations via Integration Runtime
- Custom workflows via Workflow Runtime
- Custom rules via Rule Engine

#### 7. **Interoperability**
- Standard-based integration (HL7, FHIR, DICOM)
- API gateway for external systems
- Event Bus for real-time integration
- Data Fabric for unified data access

#### 8. **AI-First**
- Built-in AI copilot (consuming AI Platform Runtime)
- Predictive analytics (consuming Healthcare Analytics Engine)
- Voice assistance (consuming Voice AI Engine)
- Clinical decision support (consuming CDS Engine)

#### 9. **Enterprise Scale**
- Multi-tenant architecture (Host Platform)
- Multi-org support (Organization Center)
- Multi-language, multi-currency (Host Platform)
- High availability, disaster recovery (Host Platform)

#### 10. **Compliance**
- HIPAA, GDPR, Vietnam MOH regulations
- Audit trails (Audit & Compliance service)
- Data encryption (Host Platform)
- Role-based access control (Identity & IAM)

**Vision Statement:**
> "Bella Healthcare Platform — The unified, AI-powered foundation for modern healthcare delivery across clinics, hospitals, and medical groups in Vietnam and beyond."

**Key Differentiator:**
> "Unlike traditional monolithic HIS systems, Bella Hospital is a thin product pack consuming rich platform engines, enabling zero-duplication reuse across ALL healthcare products while maintaining product-specific UX and workflows."

---

## Next Steps

### Immediate Priority: Architecture Refactor (Phase 0)
**Timeline:** 4-6 weeks
**Goal:** Achieve true Platform-of-Platforms architecture

#### Week 1-2: Foundation Setup
1. **Create Platform Directory Structure**
   ```
   src/
   ├── platform/
   │   ├── host/
   │   │   ├── contract-registry/
   │   │   ├── capability-registry/
   │   │   ├── feature-flags/
   │   │   ├── identity/
   │   │   ├── notification/
   │   │   ├── workflow/
   │   │   └── ai-runtime/
   │   │
   │   └── healthcare/
   │       ├── engines/
   │       │   ├── mpi-engine/
   │       │   ├── encounter-engine/
   │       │   ├── clinical-engine/
   │       │   ├── order-engine/
   │       │   ├── billing-engine/
   │       │   ├── insurance-engine/
   │       │   ├── scheduling-engine/
   │       │   ├── queue-engine/
   │       │   ├── pharmacy-engine/
   │       │   ├── laboratory-engine/
   │       │   ├── imaging-engine/
   │       │   ├── bed-engine/
   │       │   ├── nursing-engine/
   │       │   └── emergency-engine/
   │       │
   │       └── contracts/
   │           ├── mpi-engine.contract.ts
   │           ├── bed-engine.contract.ts
   │           ├── nursing-engine.contract.ts
   │           └── pharmacy-engine.contract.ts
   ```

2. **Define Core Contracts**
   - Create TypeScript interfaces for ALL engine contracts
   - Document contract versions (v1.0.0)
   - Register contracts in Contract Registry

#### Week 3-4: Engine Extraction
1. **Move BedEngineService → Bed Engine**
   - Extract from `src/services/healthcare-hospital-services.ts`
   - Move to `src/platform/healthcare/engines/bed-engine/`
   - Implement `BedEngineContract` interface
   - Add unit tests

2. **Move NursingVitalsService → Nursing Engine**
   - Extract from `src/services/healthcare-hospital-services.ts`
   - Move to `src/platform/healthcare/engines/nursing-engine/vital-signs.service.ts`
   - Implement `NursingEngineContract` interface
   - Add unit tests

3. **Move MARService → Pharmacy Engine**
   - Extract from `src/services/healthcare-hospital-services.ts`
   - Move to `src/platform/healthcare/engines/pharmacy-engine/mar.service.ts`
   - Implement `PharmacyEngineContract` interface
   - Add unit tests

4. **Refactor InpatientAdmissionService**
   - Remove direct DB queries
   - Consume `EncounterEngine.createEncounter()` for admission
   - Consume `BedEngine.allocateBed()` for bed assignment
   - Consume `BillingEngine.createInvoice()` for billing
   - Add unit tests with engine mocks

#### Week 5: Product Pack Refactor
1. **Create Hospital Hooks**
   ```typescript
   // src/products/bella-hospital/hooks/use-bed-engine.ts
   export function useBedEngine() {
     return usePlatformEngine<BedEngineContract>('bed-engine');
   }
   
   // src/products/bella-hospital/hooks/use-nursing-engine.ts
   export function useNursingEngine() {
     return usePlatformEngine<NursingEngineContract>('nursing-engine');
   }
   
   // src/products/bella-hospital/hooks/use-pharmacy-engine.ts
   export function usePharmacyEngine() {
     return usePlatformEngine<PharmacyEngineContract>('pharmacy-engine');
   }
   ```

2. **Refactor Hospital Pages**
   - Update all pages to use hooks (not services)
   - Remove direct service imports
   - Add engine loading states
   - Add engine error handling

#### Week 6: Feature Flags & Rollout
1. **Implement Feature Flag Platform**
   - Create `FeatureFlagService`
   - Add database table `feature_flags`
   - Add tenant-level toggles
   - Add user-level toggles

2. **Add Dual-Path Support**
   ```typescript
   const useNewEngines = await featureFlags.isEnabled(
     'healthcare.new-engine-architecture',
     { tenantId, userId }
   );
   
   if (useNewEngines) {
     return await bedEngine.allocateBed(request);
   } else {
     return await BedEngineService.allocateBed(request); // Deprecated
   }
   ```

3. **Pilot Testing**
   - Enable for 1 test tenant
   - Run full regression test suite
   - Monitor for errors
   - Rollout to 25% → 50% → 100%

4. **Cleanup**
   - Remove old service files
   - Update documentation
   - Archive migration logs

### Post-Refactor: Phase B Implementation
**Timeline:** 8-12 weeks (Q3 2026)

#### Priority 1: Operating Room Module
- **UI Pages:** OR Dashboard, Surgery Scheduling, Anesthesia Records
- **Engine Consumed:** Order Engine (surgery orders), Scheduling Engine
- **New Tables:** `operating_rooms`, `surgeries`, `anesthesia_records`

#### Priority 2: ICU Module
- **UI Pages:** ICU Dashboard, Real-time Vital Monitor, Ventilator UI
- **Engine Consumed:** Nursing Engine (vital signs), Event Bus (real-time)
- **New Tables:** `icu_beds`, `icu_observations`, `ventilator_records`

#### Priority 3: Emergency Department
- **UI Pages:** ED Dashboard, Triage UI, ED Queue, Ambulance Tracking
- **Engine Consumed:** Emergency Engine, Smart Queue Engine
- **New Tables:** `emergency_visits`, `triage_assessments`

#### Priority 4: Blood Bank
- **UI Pages:** Blood Inventory, Blood Request, Transfusion Records
- **Engine Consumed:** Laboratory Engine (blood bank module)
- **New Tables:** `blood_inventory`, `blood_requests`, `transfusion_records`

---

**Document Version:** 2.0 (Platform-of-Platforms Architecture)
**Date:** 2026-08-07
**Author:** Bella AI Development Team
**Status:** Architecture Blueprint - Refactor Required (Phase 0)
**Architecture Score:** 70/100 → Target: 98/100 (after Phase 0)

