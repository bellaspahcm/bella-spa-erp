# Healthcare OS Strategic Roadmap (2026-08-12)

**Version:** 2.1  
**Status:** Approved Architectural Plan & Execution Framework  
**Baseline:** Healthcare Reference OS Foundation  

---

## 🎯 Executive Summary & Capability Readiness Matrix

Phân hệ **Bella Healthcare OS** chính thức chuyển từ giai đoạn **Reference Kernel Foundation (Kiến trúc Lõi)** sang **Productization (Hoàn thiện Sản phẩm)**.

Hệ thống được phân định rõ ràng thành 4 mức độ sẵn sàng:

```text
🟢 PROVEN KERNEL
   ├── Person Center (MPI Root)
   ├── Encounter Engine (Aggregate Root)
   ├── Clinical Order Engine (Gate 4A)
   ├── Pharmacy Engine (Gate 4B)
   ├── MAR (Medication Administration Record)
   ├── CDS (Clinical Decision Support) Barrier 2
   ├── Common Core Integration (Event Bus, RLS, Audit, Idempotency)
   └── 3-Engine E2E Integration (358/358 Tests PASS)

🟡 OPERATIONAL PROTOTYPES
   ├── Admission Engine (Tách từ Encounter thành Aggregate Root độc lập)
   ├── Bed Engine (Service Prototype -> DDD Refactoring với Concurrency Protection)
   ├── Nursing Engine (Vitals Service -> Tách 4 Entities độc lập: Vitals, Assessment, CarePlan, CareTask)
   └── Perioperative Suite (Emergency, ICU, OR, Surgical, Anesthesia, PACU, CSSD, Blood Bank)

🔴 NOT YET IMPLEMENTED
   └── Billing, Laboratory, Imaging, Insurance, Queue, Scheduling, Clinical Protocol

🟡 LEGACY / PRODUCT INTEGRATION
   └── Hospital UI, Legacy Services (healthcare-hospital-services.ts), Server Actions
```

---

## 🏗️ 7 Nguyên Tắc Kiến Trúc Đòn Bẩy Cho Giai Đoạn H1

1. **Tách `Admission Engine` Độc Lập:**
   - `Encounter` là Aggregate Root cho đợt khám/điều trị lâm sàng (`planned -> arrived -> in_consultation -> completed`).
   - `Admission` là Aggregate Root độc lập quản lý quy trình nhập/xuất viện (`requested -> admitted -> transferred -> discharged`), tham chiếu `encounterId`. Không đặt `InpatientAdmission` làm sub-entity của `Encounter` để tránh god aggregate.

2. **Chia Nhỏ Nursing Entities:**
   - Không buộc tất cả vào 1 god aggregate `NursingCareSession`.
   - Tách thành 4 entities/records: `VitalSignRecord`, `NursingAssessment`, `CarePlan`, `CareTask`, liên kết nhau qua `tenantId`, `encounterId`, `admissionId`, `patientId`.

3. **Phân Tầng H1 (H1-A Core & H1-B Clinical Continuity):**
   - **H1-A (Inpatient Core):** `Encounter -> Admission -> Bed Assignment -> Nursing -> Transfer -> Discharge`.
   - **H1-B (Clinical Continuity):** `Admission -> Encounter -> Clinical Order -> Pharmacy -> MAR`.

4. **Bed Concurrency & Race-Condition Protection:**
   - Invariant: 1 Bed chỉ có **duy nhất 1 active occupancy** tại một thời điểm.
   - Kiểm chứng giả lập Race Condition (Request A & B đồng thời allocate Bed 101 $\rightarrow$ A: SUCCESS, B: CONFLICT). Bắt buộc có DB-level unique active index/constraint.

5. **Event-Driven Workflow `Admission -> Bed`:**
   - Thiết kế contract/events ngay từ đầu: `AdmissionCreated.v1 -> Bed Assignment -> BedAllocated.v1 -> Nursing Notified`.

6. **Nursing Tiêu Thụ MAR Từ Pharmacy Kernel:**
   - Nursing tiêu thụ MAR contract từ Pharmacy Kernel, **KHÔNG** tự tạo logic/bảng MAR trùng lặp.

7. **Chuẩn Hóa Thuật Ngữ Kiểm Thử:**
   - Dùng **"Inpatient Vertical Slice Integration"** (kiểm thử tích hợp cross-engine) cho H1. Thuật ngữ **"Hospital E2E"** dành riêng cho H2 khi UI kết nối với Platform Hooks.

---

## 🗺️ Master Strategic Roadmap (H1 → H4)

```text
H1 — INPATIENT VERTICAL SLICE
│
├── H1.1 Admission Engine (NEW AGGREGATE)
│       Encounter ↔ Admission
│
├── H1.2 Bed Engine (DDD & CONCURRENCY)
│       Ward → Bed → Occupancy → Transfer
│       Race-Condition Protection (DB + Domain)
│
├── H1.3 Nursing Engine (GRANULAR ENTITIES)
│       Vital Signs
│       Assessment
│       Care Plan
│       Care Task (Consumes Pharmacy MAR Contract)
│
├── H1.4 Clinical Continuity
│       Admission → Encounter → Order → Pharmacy → MAR
│
└── H1.5 Inpatient Vertical Slice Integration
        Admission → Bed → Nursing → Order → Pharmacy → MAR → Discharge
        │
        ▼
H2 — PRODUCT LAYER MIGRATION (UI → Platform Hooks)
        │
        ▼
H3 — DIAGNOSTIC WORKFLOW (Lab + Imaging)
        │
        ▼
H4 — ENTERPRISE + INTELLIGENCE + AI WORKFORCE
```

---

## 🎯 Acceptance Criteria Giai Đoạn H1 & H1.1 (COMPLETED ✅ 383/383 PASS)

- **Admission**: Admission lifecycle (`requested -> admitted -> transferred -> discharged`), Encounter linkage, Tenant RLS isolation, Discharge. (PASS)
- **Bed**: Allocation, Release, Transfer, Occupancy conflict, Race-condition concurrency (DB constraint), Tenant RLS isolation. (PASS)
- **Nursing**: Vital signs, Assessment, Care plan, Care task, Encounter/Admission linkage. (PASS)
- **Cross-Engine Workflow**: `Admission -> Bed -> Nursing -> Encounter -> Order -> Pharmacy -> MAR -> Discharge`. (PASS)
- **Regression**: Healthcare baseline PASS, Common Core baseline PASS, Education baseline PASS. (PASS - 383/383)
- **H1.1 Architecture Hardening**: Self-Defending CI Gate với 4 Tầng tự động chặn vi phạm (Static Law 1 & 11, Structural 11-Step, Behavioral Execution, 383 Guardian Regression). (PASS)

---

## 🏛️ 5. Historical Execution & Baseline Consolidation

Since the initial version of this roadmap, the engineering and product verification phases have been executed and baseline locked:

*   **H1 & H1.1 (Inpatient Baseline v1):** Ratified with 383 regression tests passing under strict Architecture Guard constraints.
*   **K1 - K5 (Healthcare & Vertical Reuse):** Proven cross-vertical reuse across **Inpatient Hospital (K2)**, **Outpatient Clinic (K3)**, and **Dental Clinic (K5)**. The Healthcare Kernel v1 has been frozen and protected by automated CI blockages.
*   **K6.1 - K6.3 (Product Layer Hardening):** Certified as **Clinic Pilot Candidate / Ready for Pilot Validation** with 11/11 E2E tests running without mock fallbacks on a real database.

---

## 🚀 6. Milestone K7: Pilot Readiness / Real Clinic Validation

Following the verification of **K6.3**, the roadmap shifts from **engineering and architectural proof** to **operational and customer proof**. 

We strictly enforce:
1.  **No New Kernel Abstractions:** No additional backend engines or frameworks will be built without real pilot feedback.
2.  **Strict Vertical Focus:** We prioritize making the **Medical Clinic** product slice work flawlessly before replicating patterns to Hospital or Dental workflows.

```text
K6.3 Complete (E2E Works on live DB)
                │
                ▼
K7: Pilot Readiness / Clinic Validation
  ├── 1. Real User Workflows (Login -> Complete Encounter)
  ├── 2. Real-world Authorization (RBAC: Doctor, Nurse, Admin, etc.)
  ├── 3. Operational UX (Friction-less data entry & error explanation)
  ├── 4. Auditability (Full compliance log on orders and vital records)
  └── 5. Feedback Loop (Observe users -> Fast Product-layer iterations)
```

### K7 Core Focus Areas

#### 1. Real User Workflow
Rather than relying on automated integration suites, real healthcare professionals (physicians, nurses, receptionists, pharmacists) must be able to perform the complete outpatient journey:
*   Secure Login -> Find or Register Patient -> Book/Check-in -> Vital Signs recording -> SOAP note & Diagnosis input -> Prescription via CDSS validation -> Clinical Order Approval -> Complete Encounter.

#### 2. Real-World Authorization (RBAC)
Tenant-level isolation has been proven. K7 must wire fine-grained roles to enforce what clinical functions are permitted:
*   **Doctor:** Write SOAP, diagnose, prescribe, approve medications.
*   **Nurse:** Record vitals, manage appointments.
*   **Receptionist:** Register patient, book appointments, check-in.
*   **Pharmacist:** Dispense approved prescriptions.
*   **Admin:** Manage tenant resources.

#### 3. Operational UX
UX efficiency directly impacts clinical efficacy. K7 will measure and minimize usability friction:
*   Minimize total clicks for checking in and completing an encounter.
*   Prevent repetitive data entries (e.g., auto-filling known patient data).
*   Implement user-friendly, descriptive UI alerts when database constraint/CDSS validation errors occur (replace generic raw Postgres messages with clinical explanations).

#### 4. Auditability
Maintain strict clinical accountability across the entire journey. Ensure the audit engine tracks:
*   Which user created/modified/approved a prescription or clinical order.
*   Bitemporal correctness of observation timestamps vs entry timestamps.

#### 5. Pilot Feedback Loop
The success of K7 is measured by user-reported friction and clinical speed.
*   **Feedback Ingestion:** Capture usability blocks directly from clinic staff.
*   **Rapid Product-Layer Iteration:** Resolve UI/Server Action friction points without touching or risk-reopening the frozen Healthcare Kernel.
