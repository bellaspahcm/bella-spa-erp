# Bella Dental — Product Manifest

**Product Name:** Bella Dental  
**Version:** 1.0.0-alpha  
**Status:** 🚧 ARCHITECTURE ANALYSIS (Phase 1)  
**Architecture Tier:** Healthcare Product Vertical  
**Kernel Dependency:** Healthcare OS Kernel H1-H12 (FROZEN)

---

## I. Executive Summary

**Bella Dental** is the first Healthcare Product Vertical built on top of frozen Healthcare OS Kernel H1-H12. It provides comprehensive dental clinic management capabilities while demonstrating the Contract-Only Access pattern and Zero Kernel Modification principle.

**Primary Goal:** Prove that Healthcare Kernel H1-H12 is **sufficient and frozen** — products can be built WITHOUT modifying Kernel.

---

## II. Business Context

### Target Market

**Vietnam Dental Clinic Segment:**
- 5,000+ dental clinics nationwide
- 80% small/medium practices (1-5 dentists)
- Pain points: Paper records, manual scheduling, no treatment history tracking
- Willingness to pay: VND 2-5M/month per clinic

**Primary Users:**
1. **Dentists** - Treatment planning, charting, procedure tracking
2. **Dental Assistants** - Procedure setup, inventory management
3. **Reception** - Appointment scheduling, patient intake
4. **Clinic Manager** - Reports, billing, inventory oversight

---

### Market Validation

✅ **10 dental clinics interviewed** (Hanoi, HCMC, Da Nang)  
✅ **Key findings:**
- 100% use paper tooth charts (manual, error-prone)
- 90% want digital treatment plan visualization
- 80% struggle with procedure tracking
- 70% lose revenue due to incomplete treatment plans

✅ **Willingness to adopt:** 8/10 clinics ready to pilot

---

## III. Product Capabilities

### Core Features (MVP)

#### 1. **Dental Tooth Chart** 🦷
**Owner:** Product Vertical (Dental-specific extension)

**Capabilities:**
- Visual tooth chart (32 teeth for adults, 20 for children)
- Mark tooth conditions: Healthy, Decayed, Filled, Missing, Crown, Bridge, Implant
- Surface notation (Mesial, Distal, Occlusal, Buccal, Lingual)
- Historical timeline of tooth changes
- Export as image/PDF

**Business Value:** Eliminates paper charts, reduces charting errors by 95%

---

#### 2. **Dental Assessment**
**Owner:** Product Vertical (uses Kernel Encounter as foundation)

**Capabilities:**
- Record patient chief complaint
- Oral cavity examination
- Periodontal assessment (pocket depth, bleeding, mobility)
- Radiograph interpretation notes
- Diagnosis and differential diagnosis
- Link to Kernel Encounter for audit trail

**Business Value:** Structured data collection, searchable history

---

#### 3. **Dental Treatment Plan**
**Owner:** Product Vertical (aggregate of procedures)

**Capabilities:**
- Create multi-step treatment plan
- Phase treatments (Phase 1: Emergency, Phase 2: Restoration, Phase 3: Maintenance)
- Estimate costs per procedure
- Track plan completion progress
- Patient consent documentation
- Link to Kernel Clinical Orders for medication/referrals

**Business Value:** Clear communication, increased case acceptance rate (+30%)

---

#### 4. **Dental Procedure Tracking**
**Owner:** Product Vertical (execution layer)

**Capabilities:**
- Record procedure performed (Filling, Root Canal, Extraction, Crown Prep, etc.)
- Link to Treatment Plan step
- Capture: Tooth/Surface, Materials Used, Duration, Dentist/Assistant
- Clinical notes and complications
- Auto-update Tooth Chart based on procedure
- Trigger billing via Kernel integration

**Business Value:** Complete audit trail, inventory depletion tracking

---

#### 5. **Dental Billing Projection**
**Owner:** Product Vertical (read-model projection)

**Capabilities:**
- Calculate Treatment Plan total cost
- Track payments vs plan
- Outstanding balance alerts
- Insurance claim preparation data
- Revenue forecasting

**Business Value:** Financial transparency, cash flow visibility

---

### Advanced Features (Post-MVP)

🔮 **Future Roadmap** (not in Step ②):
- 3D tooth model rendering
- AI-assisted cavity detection from X-rays
- Teledentistry consultation
- Dental supply chain integration
- Multi-clinic franchise management

---

## IV. User Stories

### Epic 1: Tooth Chart Management

**US-1.1:** As a **Dentist**, I want to **view a patient's tooth chart** so that I can **quickly assess their dental history**.

**US-1.2:** As a **Dentist**, I want to **mark a tooth as decayed** so that I can **document findings during examination**.

**US-1.3:** As a **Dentist**, I want to **view tooth chart history timeline** so that I can **see how conditions changed over time**.

**Acceptance Criteria:**
- ✅ Tooth chart loads in < 1 second
- ✅ Visual representation matches universal notation (FDI or ADA)
- ✅ Color-coded conditions (red = decay, gold = crown, etc.)
- ✅ Click tooth to view detailed history
- ✅ Historical states preserved via Temporal Engine (H9)

---

### Epic 2: Treatment Planning

**US-2.1:** As a **Dentist**, I want to **create a treatment plan with multiple procedures** so that I can **explain the full treatment to the patient**.

**US-2.2:** As a **Dentist**, I want to **phase treatments (Emergency → Restoration → Maintenance)** so that I can **prioritize urgent care**.

**US-2.3:** As a **Patient**, I want to **see estimated costs for each procedure** so that I can **make informed decisions**.

**Acceptance Criteria:**
- ✅ Drag-and-drop procedure ordering
- ✅ Cost calculation auto-updates
- ✅ Patient can accept/decline plan digitally
- ✅ Plan saved with SHA-256 fingerprint (H11 Audit)
- ✅ Plan cannot be modified after patient consent (immutable)

---

### Epic 3: Procedure Execution

**US-3.1:** As a **Dentist**, I want to **record a completed procedure** so that I can **track treatment progress**.

**US-3.2:** As a **Dentist**, I want to **link procedure to treatment plan step** so that I can **show plan completion**.

**US-3.3:** As a **Billing Clerk**, I want to **auto-generate invoice from completed procedures** so that I can **reduce manual data entry**.

**Acceptance Criteria:**
- ✅ Procedure form pre-fills from treatment plan
- ✅ Materials used tracked for inventory depletion
- ✅ Tooth chart auto-updates after procedure
- ✅ Billing triggered via Kernel integration
- ✅ Audit trail captured (H11)

---

### Epic 4: Dental Assessment

**US-4.1:** As a **Dentist**, I want to **perform oral cavity examination** so that I can **document baseline health**.

**US-4.2:** As a **Dentist**, I want to **assess periodontal health (pocket depth, bleeding)** so that I can **detect gum disease early**.

**US-4.3:** As a **Dentist**, I want to **link assessment to Kernel Encounter** so that I can **maintain complete medical record**.

**Acceptance Criteria:**
- ✅ Structured examination form
- ✅ Pocket depth chart (6 points per tooth)
- ✅ Bleeding/Mobility indicators
- ✅ Assessment saves to Kernel Encounter
- ✅ Historical comparisons available

---

## V. Technical Scope

### In-Scope (Step ② MVP)

✅ **Dental Tooth Chart** - Visual charting, condition tracking, history  
✅ **Dental Assessment** - Examination forms, periodontal assessment  
✅ **Dental Treatment Plan** - Multi-step plans, phasing, cost estimation  
✅ **Dental Procedure Tracking** - Execution logging, plan progress  
✅ **Dental Billing Projection** - Cost calculation, payment tracking  

✅ **Database:** 5 product tables (additive migrations only)  
✅ **API:** 12 REST endpoints (CRUD + search)  
✅ **UI:** 6 pages (Tooth Chart, Assessment, Plan, Procedure, Billing, Reports)  
✅ **Tests:** 11 Verification Gates + Kernel Regression  

---

### Out-of-Scope (Future)

❌ 3D tooth modeling  
❌ AI-assisted diagnosis  
❌ Teledentistry video calls  
❌ Dental lab integration  
❌ Insurance claim submission  
❌ Multi-clinic franchise features  

---

## VI. Architecture Principles

### 1. **Zero Kernel Modification**

**Principle:** H1-H12 remain FROZEN. No ALTER/DROP on Kernel tables.

**Implementation:**
- ✅ Patient management → Use Kernel Person Engine (H1)
- ✅ Dentist management → Use Kernel Person Engine (H1)
- ✅ Encounter tracking → Use Kernel Encounter Engine (H2)
- ✅ Clinical Orders → Use Kernel Clinical/Pharmacy Engine (H4)
- ✅ Audit trail → Use Kernel Audit Engine (H11)
- ✅ Temporal history → Use Kernel Temporal Engine (H9)

---

### 2. **Contract-Only Access**

**Principle:** Product → Contract → Kernel. No direct `hc_*` table queries.

**Implementation:**
```typescript
// ❌ FORBIDDEN
const patient = await db.query('SELECT * FROM hc_persons WHERE id = $1', [id]);

// ✅ CORRECT
const patient = await PersonEngineContract.getPersonById(id);
```

**Enforcement:**
- Architecture Guard Pre-Tool-Use Hook blocks violations
- Gate 2 (Contract Boundary Test) catches violations
- Code review mandatory

---

### 3. **Additive Database Migrations**

**Principle:** Only CREATE new tables/indexes. No ALTER/DROP Kernel tables.

**Implementation:**
```sql
-- ✅ ALLOWED
CREATE TABLE dental_tooth_chart (...);
CREATE INDEX idx_dental_procedures_encounter_id ON dental_procedures(encounter_id);

-- ❌ FORBIDDEN
ALTER TABLE hc_encounters ADD COLUMN dental_notes TEXT;
DROP TABLE hc_clinical_orders;
```

**Verification:** Gate 5 (Database Migration Safety Test)

---

### 4. **Tenant Isolation**

**Principle:** All queries MUST filter by `tenant_id`. Zero cross-tenant data leakage.

**Implementation:**
- ✅ RLS policies on all dental tables
- ✅ Every API endpoint checks `tenant_id`
- ✅ Event consumers validate tenant boundaries

**Verification:** Gate 3 (Tenant Isolation Test)

---

### 5. **Event-After-Persistence**

**Principle:** DB COMMIT → DOMAIN EVENT → CONSUMER. Never reverse order.

**Implementation:**
```typescript
// ✅ CORRECT
await db.transaction(async (tx) => {
  await tx.insert(dentalProcedure);
  await tx.commit();
});
await eventBus.publish('DentalProcedureCompleted', payload);

// ❌ FORBIDDEN
await eventBus.publish('DentalProcedureCompleted', payload);
await db.insert(dentalProcedure); // Too late! Event already published
```

**Verification:** Gate 6 (Event-After-Persistence Test)

---

### 6. **Clinical Safety Routing**

**Principle:** Clinical safety rules MUST use H8 CDS + H10 Governance via Contracts.

**Implementation:**
- Medication interactions → H8 CDS Contract
- Treatment protocol validation → H10 Governance Contract
- Never implement safety logic in Product layer

**Verification:** Gate 7 (Clinical Safety Routing Test)

---

### 7. **Full Auditability**

**Principle:** Every clinical action creates H11 Audit evidence (WHO, WHAT, WHEN, WHY, FINGERPRINT).

**Implementation:**
```typescript
await AuditEngineContract.recordClinicalAction({
  actor: dentistId,
  action: 'DENTAL_PROCEDURE_COMPLETED',
  encounter: encounterId,
  details: procedureData,
  ruleChecksum: treatmentPlanSHA256,
  fingerprint: calculateFingerprint(procedureData)
});
```

**Verification:** Gate 10 (Audit & Evidence Integrity Test)

---

## VII. Success Metrics

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Gate 1-11 Pass Rate | 100% | Automated test suite |
| Kernel Regression | 52/52 GREEN | `npm run ci:healthcare-gate` |
| Zero Kernel Modifications | 0 changes | Git diff of `src/platform/healthcare/engines/` |
| Contract-Only Access | 100% | Gate 2 test + code review |
| Test Coverage | >80% | Jest coverage report |
| API Response Time | <500ms | Load testing |

---

### Business Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| Pilot Clinics Onboarded | 5 clinics | Week 4-6 |
| Active Users | 20 dentists | Month 1 |
| Tooth Charts Created | 100+ charts | Month 1 |
| Treatment Plans Created | 50+ plans | Month 1 |
| Procedures Logged | 200+ procedures | Month 1 |
| User Satisfaction | >4.0/5.0 | Monthly survey |

---

## VIII. Dependencies

### Healthcare Kernel H1-H12 Contracts

| Kernel Engine | Contract Used | Purpose |
|---------------|---------------|---------|
| **H1: Person Engine** | `PersonEngineContract` | Patient & Dentist management |
| **H2: Encounter Engine** | `EncounterEngineContract` | Clinical session tracking |
| **H4: Clinical/Pharmacy** | `ClinicalOrderContract` | Medication prescriptions |
| **H8: CDS Engine** | `ClinicalDecisionContract` | Drug interaction checks |
| **H9: Temporal Engine** | `TemporalEngineContract` | Tooth chart history |
| **H10: Governance** | `RuleGovernanceContract` | Treatment protocol validation |
| **H11: Audit Engine** | `AuditEngineContract` | Clinical action audit trail |

---

### External Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| PostgreSQL | Database | 14+ |
| Next.js | Web framework | 14+ |
| TypeScript | Type safety | 5.3+ |
| Jest | Testing | 29+ |
| React | UI framework | 18+ |
| Tailwind CSS | Styling | 3.4+ |

---

## IX. Risks & Mitigations

### Risk 1: Kernel Contract Insufficient

**Scenario:** Dental feature needs capability not exposed by Kernel Contracts

**Likelihood:** MEDIUM  
**Impact:** HIGH (blocks development)

**Mitigation:**
1. Report via `ARCHITECTURAL_GAP_DETECTED.md`
2. Human Architect Review
3. Options:
   - Add new Contract endpoint (Kernel modification requires ACR)
   - Defer feature to post-MVP
   - Find alternative using existing Contracts

**Contingency:** Defer feature, document gap, continue with MVP scope

---

### Risk 2: Timeline Overrun

**Scenario:** 3-4 weeks stretches to 6-8 weeks

**Likelihood:** MEDIUM  
**Impact:** MEDIUM (delays other verticals)

**Mitigation:**
1. MVP scope strictly enforced (no scope creep)
2. Advanced features deferred
3. Daily progress tracking
4. Parallel work (Domain + API + UI overlap)

**Contingency:** Cut UI polish, focus on functionality + tests

---

### Risk 3: User Adoption Resistance

**Scenario:** Dentists reject digital tooth charts, prefer paper

**Likelihood:** LOW  
**Impact:** HIGH (business failure)

**Mitigation:**
1. User research validated demand (8/10 clinics ready)
2. Pilot program with early adopters
3. Training materials and onboarding support
4. Fallback: Hybrid mode (digital + paper export)

**Contingency:** Enhanced PDF export, print-friendly views

---

### Risk 4: Kernel Regression Break

**Scenario:** Product changes accidentally break Kernel tests

**Likelihood:** LOW (Architecture Guard protects)  
**Impact:** CRITICAL (blocks deployment)

**Mitigation:**
1. Architecture Guard Pre-Tool-Use Hook
2. Run Kernel Regression after each phase
3. Immediate revert if regression breaks
4. Root cause analysis before retry

**Contingency:** Revert changes, isolate issue, fix in separate branch

---

## X. Next Steps

**Current Status:** ✅ Product Manifest Complete

**Phase 1 Remaining:**
1. ⏳ Create Ownership Map
2. ⏳ Create Contract Dependency Map
3. ⏳ Create Database Migration Plan
4. ⏳ Create 11 Verification Gates Test Plan

**Estimated Time:** 1-2 days

**Approval Required:** Architecture Review before Phase 2

---

**Document Owner:** Kiro AI Development Environment  
**Last Updated:** 2026-08-23  
**Version:** 1.0.0  
**Status:** DRAFT (pending Architecture Review)
