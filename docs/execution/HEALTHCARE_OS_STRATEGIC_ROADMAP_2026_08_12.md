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

## 🏛️ 5. H1 & H1.1 Ratified As Architecture Baseline v1

 Milestone **H1 (Inpatient Vertical Slice)** và **H1.1 (Architecture Hardening & CI Gate)** chính thức được đóng băng và nghiệm thu thành **Architecture Baseline v1** của Bella Healthcare OS.

Con số chuẩn hóa chính thức của bộ **Guardian Test Suite**: **383 Executable Test Cases** (trên 27 Test Suites, 100% PASS).

### Lộ Trình Giai Đoạn H2 — Emergency Vertical Slice

Giai đoạn H2 áp dụng chiến lược **Vertical Slice Tối Thiểu**, tập trung vào luồng Cấp cứu Time-Critical và phân luồng độ ưu tiên:

```text
Emergency Arrival ──→ Triage (Acuity & Priority) ──→ Emergency Encounter ──→ Clinical Assessment
                                                                                  │
Admission / Transfer / Discharge ◄── Disposition Decision ◄── Order / Medication / Intervention ◄─┘
```

**Capability Reuse Gate (Cơ chế chống nhân bản Vertical Duplicate)**:
- H2 BẮT BUỘC tái sử dụng các Engine Kernel đã được chứng minh tại H1 (`Encounter Engine`, `Admission Engine`, `Pharmacy Kernel`, `Order Engine`, `Bed Engine`).
- **TỰ ĐỘNG CHẶN (BLOCK)** nếu phát hiện việc tạo trùng lặp capability (ví dụ: `emergency-medication-engine` hay `emergency-bed-engine`). Emergency CHỈ sở hữu domain đặc thù của mình (`Triage`, `Acuity`, `Disposition`, `EmergencyBay`).

Tham chiếu tài liệu chi tiết: **[HEALTHCARE_OS_EXECUTABLE_ARCHITECTURE_REFERENCE.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/architecture/HEALTHCARE_OS_EXECUTABLE_ARCHITECTURE_REFERENCE.md)**.

