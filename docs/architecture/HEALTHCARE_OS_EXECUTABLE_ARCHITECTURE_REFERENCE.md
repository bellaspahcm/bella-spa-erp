# HEALTHCARE OS EXECUTABLE ARCHITECTURE REFERENCE & GOLDEN PATH BLUEPRINT

**Document Version:** 1.0.0  
**Effective Date:** 2026-08-12  
**Status:** ✅ RATIFIED & ENFORCED (Architecture Constitution)  
**Governance Scope:** Healthcare OS Engines & Vertical Modules (ICU, Emergency, Surgery, Laboratory, Pharmacy, Blood Bank, Home Care, Dental, Specialist Clinic, etc.)

---

## 1. Tầm Nhìn Chiến Lược: H1 As Golden Path Reference Architecture

Milestone **H1 (Inpatient Vertical Slice)** không đơn thuần là một tính năng đã hoàn thành hay 384 test cases thành công. **H1 chính là Executable Architecture Golden Path (Kiến Trúc Tham Chiếu Thực Thi)** cho toàn bộ Healthcare OS trong 5–10 năm tới.

Mọi phân hệ mới (ICU, Emergency, Surgery, Lab, Pharmacy, Blood Bank, Home Care, Dental, Specialist Clinic...) khi gia nhập hệ thống đều **BẮT BUỘC** phải tuân thủ và chứng minh qua 11 bước tiêu chuẩn của Pattern này, đồng thời đảm bảo **Không phá vỡ bất kỳ Invariant nào của H1**.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   HEALTHCARE OS ENGINE PATTERN PIPELINE                          │
└──────────────────────────────────────────────────────────────────────────────────┘
  [1] Domain Boundary        ──→ [2] Aggregate Root        ──→ [3] Repository Contract
         │
         ▼
  [4] Application Service    ──→ [5] Domain Event          ──→ [6] Event Subscriber
         │
         ▼
  [7] Cross-Engine Contract  ──→ [8] Persistence Invariant ──→ [9] Tier 1 Test (Unit)
         │
         ▼
  [10] Tier 2 Test (Cross)   ──→ [11] Tier 3 Test (Clinical Continuity Integration)
```

---

## 2. Quy Trình 11 Bước Chuẩn Hóa (Engine Pattern Pipeline)

Mỗi Engine hoặc Vertical Module khi phát triển mới **phải trải qua đủ 11 bước**:

### Bước 1: Domain Boundary Definition
Xác định ranh giới nghiệp vụ độc lập tuyệt đối. Mỗi Engine chỉ chịu trách nhiệm về Aggregate Root của chính nó. Không phụ thuộc trực tiếp vào các Aggregate Root của Engine khác.

### Bước 2: Aggregate Root & Value Objects
Xây dựng Aggregate Root với State Machine và Invariants nội tại.
- Thuộc tính private/protected, biến đổi trạng thái qua các phương thức ghi đè có kiểm tra logic.
- Immutability cho Value Objects.

### Bước 3: Repository Contract
Định nghĩa Interface Repository độc lập với công nghệ lưu trữ.
- Sử dụng Supabase/PostgreSQL hoặc In-Memory Store tuân thủ cùng Interface.
- Loại bỏ hoàn toàn kiểu `any`, sử dụng `Record<string, unknown>` hoặc Generics.

### Bước 4: Application Service Orchestration
Viết Service Orchestrator điều phối luồng công việc.
- Tiếp nhận DTO đầu vào, gọi Aggregate Root xử lý nghiệp vụ, lưu thông qua Repository.
- Trả về kết quả chuẩn hóa `EngineResponse<T>` hoặc `ServiceResult<T>`.

### Bước 5: Domain Events Emission
Phát sinh immutable Domain Event (`hos.<engine>.<action>.v1`) đại diện cho sự thay đổi trạng thái.
- **Invariant Event-After-Persistence**: Sự kiện CHỈ ĐƯỢC PHÁT đi sau khi ghi nhận vào Cơ Sở Dữ Liệu thành công.

### Bước 6: Asynchronous Event Subscriber
Xây dựng Subscriber xử lý bất đồng bộ các Domain Event từ các Engine khác.
- Đảm bảo tính **Idempotency** (cho phép nhận lại sự kiện trùng lặp mà không làm sai lệch dữ liệu).

### Bước 7: Cross-Engine Decoupled Contract / Reader
Kết nối với các Engine khác thông qua Contract Readers/Interfaces (ví dụ: `IEncounterReader`, `IMARReader`, `IClinicalOrderReader`).
- **Cấm nhập khẩu trực tiếp (No Direct Domain Import)** đối tượng nội bộ của Engine khác.

### Bước 8: Persistence Invariants & Concurrency Protection
Khóa an toàn dữ liệu ở tầng lưu trữ (Cơ Sở Dữ Liệu):
- Sử dụng Optimistic Concurrency Control (Column `version`).
- Sử dụng DB-Level Conditional Updates (ví dụ: `.eq('status', 'available')`) hoặc DB Constraints để ngăn chặn Race Condition khi ghi đồng thời.

### Bước 9: Acceptance Tier 1 — Engine Unit Tests
Viết Unit Test cho Aggregate Root, Value Objects, và Application Services trong môi trường cô lập.

### Bước 10: Acceptance Tier 2 — Cross-Engine Interaction Tests
Kiểm thử tích hợp tương tác giữa 2 hoặc 3 Engine lân cận (ví dụ: `Admission -> Bed`, `Bed -> Nursing`).

### Bước 11: Acceptance Tier 3 — End-to-End Clinical Continuity Integration
Kiểm thử luồng lâm sàng hoàn chỉnh xuyên suốt từ khi tiếp nhận đến khi hoàn thành điều trị:
`Encounter -> Admission -> Bed Assignment -> Clinical Order -> Order Validation & CDS Check -> Prescription Bootstrap -> Medication Dispense -> MAR Administration -> Discharge & Bed Release`.

---

## 3. Cấu Trúc File Chuẩn Mẫu (Standard Directory Anatomy)

Tất cả các Engine mới bắt buộc tổ chức cây thư mục theo cấu trúc mẫu đã được kiểm chứng tại `src/platform/healthcare/engines/`:

```
src/platform/healthcare/engines/<engine-name>/
├── domain/
│   ├── <aggregate-root>.entity.ts          # Aggregate Root & Invariants
│   ├── <value-object>.vo.ts                # Value Objects
│   └── __tests__/                          # Unit Tests Tier 1
├── contracts/
│   ├── <engine-name>.contract.ts           # Internal & Cross-Engine API Specs
│   └── <dependency>-reader.interface.ts    # Decoupled Reader Interface
├── events/
│   ├── <engine-name>.events.ts             # Domain Events Specs
│   ├── <subscriber-name>.ts                # Idempotent Event Subscriber
│   └── __tests__/                          # Event Integration Tests Tier 1
├── repositories/
│   ├── <engine-name>.repository.interface.ts
│   ├── supabase-<engine-name>.repository.ts # Concurrency Protection & RLS
│   └── __tests__/                          # Repository Integration Tests
└── <engine-name>.service.ts                # Application Service Orchestrator
```

---

## 4. 5 Điều Luật Bắt Buộc (Constitution Invariants For Merge Approval)

Một Pull Request chứa Engine hoặc Vertical Slice mới **CHỈ ĐƯỢC PHÉP MERGE** khi vượt qua kiểm tra 5 Điều Luật:

1. **Law of Boundary Isolation**: Không import trực tiếp file nằm trong thư mục `domain/` hoặc `repositories/` của Engine khác. Giao tiếp 100% qua `contracts/` hoặc `readers/`.
2. **Law of Concurrency Defense**: Phải có kiểm thử Race Condition (sử dụng `Promise.all` đồng thời) chứng minh DB Constraint hoặc Conditional Update ngăn chặn việc ghi trùng lặp dữ liệu.
3. **Law of Event-After-Persistence**: Không bao giờ phát Event trước khi DB `.save()` thành công. Nếu DB thất bại, Event không được phát đi.
4. **Law of Zero `any` (Constitution Law 11)**: Không chứa bất kỳ từ khóa `: any` hoặc `as any` nào trong mã nguồn sản xuất và mã nguồn kiểm thử.
5. **Law of Non-Regression (383 Test Guardian)**: Phải chạy thành công 100% toàn bộ **383 executable test cases** (27 Test Suites) sẵn có của Healthcare OS. Không một tính năng mới nào được làm hỏng bộ test tham chiếu H1.
6. **Law of Capability Reuse (Law tái sử dụng Capability — MỚI)**: Cấm nhân bản các capability sẵn có của Kernel (Encounter, Admission, Pharmacy, Order, Bed) khi xây dựng phân hệ mới (ví dụ: cấm tạo `emergency-medication-engine` hay `emergency-bed-engine`). Mọi Engine mới BẮT BUỘC phải tái sử dụng các Engine Kernel qua Decoupled Readers/Contracts và chỉ sở hữu domain đặc thù của phân hệ đó.

---

---

## 5. 4 Patterns Đã Được Khóa Tại Baseline v2 (Ratified Architectural Patterns — ADR-012)

**Công Thức Baseline v2**:  
$$\text{Architecture Baseline v2} = \text{H1 Baseline (383 Guardian Tests)} + \text{H2 Tests (27 Tests)} = \mathbf{410\text{ Executable Tests PASS}}$$

Sau khi hoàn thành và vượt qua 100% kiểm thử **H2 Emergency Vertical Slice** (410 Executable Tests PASS across 35 Test Suites, Exit 0), Healthcare OS chính thức Ratify 4 Pattern Kiến Trúc (ADR-012):

### 1. Time-Critical Workflow Pattern
- **Luồng**: `Triage -> Rapid Assessment -> Time-Sensitive Reassessment -> Acuity Escalation -> Audit Trail`.
- **Nguyên tắc**: Giữ phạm vi độc lập trong các Bounded Context khẩn cấp (Emergency, ICU, Trauma), **KHÔNG** đưa sớm xuống Kernel Engine chung. Mọi lần reassessment bắt buộc gắn liền với `encounterId`, timestamp, người thực hiện, và lưu lại lịch sử thay đổi acuity (`reassessmentHistory`) để đảm bảo tính truy nguyên.

### 2. Resource Allocation & Concurrency Defense Pattern
- **Luồng**: Atomic Conditional Updates (`.eq('status', 'AVAILABLE')` hoặc DB Locking) áp dụng cho tài nguyên vật lý (`Bed` entity ở H1, `EmergencyBay` resource ở H2).
- **Luật Chống Trừu Tượng Hóa Sớm (Rule Against Premature Kernel Abstraction)**: Không bao giờ trừu tượng hóa capability xuống Shared Kernel chỉ dựa trên 1 hoặc 2 implementations. Một abstraction chỉ được xem xét khi có **ít nhất 3 Bounded Contexts độc lập** chứng minh cùng invariant, semantics, và lifecycle requirements. (Nghiêm cấm tạo `ResourceEngine` ở Baseline v2).

### 3. Protocol-Driven Decision Pattern
- **Luồng**: `Domain Entity -> Strategy Interface (ITriageProtocol) -> Concrete Protocol (EsiTriageProtocol) -> Clinical Score / Decision`.
- **Nguyên tắc**: Clinical Aggregate làm chủ ý nghĩa nghiệp vụ (`AcuityLevel`, `Priority`); Protocol Implementation làm chủ phương pháp tính (scoring algorithm). Tách biệt logic này cho phép hoán đổi giữa ESI, CTAS, Manchester mà không làm hỏng Aggregate.

### 4. Disposition Orchestration Pattern
- **Luồng**: `Domain Decision (EmergencyDisposition) -> Destination Contract (ITransferContract / IAdmissionContract) -> Destination Engine làm chủ Vòng Đời Thực Thi`.
- **Nguyên tắc (Healthcare OS Platform Pattern)**: Tách biệt tuyệt đối giữa **Quyền Làm Chủ Quyết Định Lâm Sàng (Decision Ownership)** và **Quyền Làm Chủ Vòng Đời Điểm Đến (Lifecycle Ownership)** (áp dụng toàn hệ thống: Emergency → Inpatient, Emergency → Transfer, Clinic → Surgery, ED → ICU, Ward → OR).

---

## 6. Lộ Trình Phân Hệ Chuẩn Hóa (Milestones H1 → H4)

- ✅ **H1 — Inpatient Vertical Slice** (Inpatient Bed Allocation, Nursing, Admission, Encounter) — **Baseline v1 (383 Tests PASS)**
- ✅ **H1.1 — Self-Defending Architecture & CI Gate** (Static, Structural, Behavioral, 384 Guardian Gate) — **RATIFIED**
- ✅ **H2 — Emergency Vertical Slice** (Triage, Acuity 1-5, Emergency Bay Concurrency, Assessment, 3 Disposition Scenarios) — **410 Tests PASS**
- ✅ **H2.1 — Architecture Baseline v2 & Pattern Ratification** — **CHÍNH THỨC RATIFIED (ADR-012)**
- 🔜 **H3 — ICU / CCU Vertical Slice** (Continuous Critical Care, Vital Monitoring, High-Frequency State Transitions, Patient Safety & Device Integration)
- 🔜 **H4 — Surgery / OR / PACU Suite** (Phẫu thuật - Tháo mê - Hồi tỉnh)

---

**Phê duyệt bởi Architecture Review Board (ARB)**  
*Healthcare OS — Executable Architecture Reference Edition (Baseline v2: 410 Tests PASS, Exit 0)*

