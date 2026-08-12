# HEALTHCARE OS EXECUTABLE ARCHITECTURE REFERENCE & GOLDEN PATH BLUEPRINT

**Document Version:** 1.1.0  
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

## 5. Các Patterns Đã Được Khóa Tại Baseline v3, v4 & v5 (Ratified Architectural Patterns)

### Baseline v3 (Ratified Architectural Patterns — ADR-013)
- **Công Thức Baseline v3**:  
  $$\text{Architecture Baseline v3} = \text{H1 Baseline (383 Tests)} + \text{H2 Tests (27 Tests)} + \text{H3 Tests (18 Tests)} = \mathbf{428\text{ Executable Tests PASS}}$$

1. **Continuous Monitoring & Telemetry Ingestion Pattern**: Tách biệt ingestion sinh hiệu tần suất cao bằng contract. Chỉ lưu trữ summary.
2. **Safety Barrier & Hard Block Pattern**: Aggregate chặn cứng giao dịch khi thông số vượt ngưỡng lâm sàng an toàn.
3. **Clinical Critical Care Scoring Strategy Pattern**: Tách biệt thuật toán chấm điểm (SOFA) qua `IScoringStrategy`.
4. **Decoupled Observation Consumption Pattern**: Đọc chéo dữ liệu qua read-only contracts.
5. **Critical Resource Concurrency & Conditional Allocation Pattern**: Khóa tài nguyên bay/giường chống race condition ở database level.
6. **Multi-Domain Clinical Continuity Workflow Pattern**: Quyền quyết định điểm đến lâm sàng (Decision Ownership) $\neq$ Quyền điều phối vòng đời điểm đến đó (Lifecycle Ownership).

### Baseline v4 (Ratified Architectural Patterns — ADR-014)
- **Công Thức Baseline v4**:  
  $$\text{Architecture Baseline v4} = \text{Baseline v3 (428 Tests)} + \text{H4 Tests (7 Tests)} = \mathbf{435\text{ Executable Tests PASS}}$$

1. **WHO Checklist Gates as Aggregated Invariants**: Chặn cứng quy trình phẫu thuật dựa trên WHO checklist (Sign-In, Time-Out, Sign-Out) tại aggregate root.
2. **Multi-Engine Safety Gate Checking via Decoupled Contracts**: Kiểm tra điều kiện bên ngoài (CSSD Sterilization) thông qua contract, đảm bảo không chiếm dụng lifecycle của phân hệ khác.
3. **Anesthesia Safety Gate and External Record Alignment**: Điều phối qua service layer để kiểm tra pre-op assessment và ASA classification (1-5) từ Anesthesia record trước khi gây mê.
4. **Database-level Exclusion Constraints for Concurrent Resource Scheduling**: Sử dụng PostgreSQL exclusion constraints để chống race condition đồng thời khi xếp lịch phòng mổ/bác sĩ ngoại khoa.

### Baseline v5 (Ratified Architectural Patterns — ADR-015)
- **Công Thức Baseline v5**:  
  $$\text{Architecture Baseline v5} = \text{Baseline v4 (435 Tests)} + \text{H5 Tests (16 Tests)} = \mathbf{451\text{ Executable Tests PASS}}$$

1. **Domain State Machine Sequence Pattern**: Enforce tuần tự các trạng thái kết quả lâm sàng (`ORDERED -> COLLECTED -> RECEIVED -> PROCESSING -> RESULTED -> VERIFIED`), chặn mọi hành vi đi tắt hay quay ngược.
2. **Diagnostic Interpretation and Range Assessment Pattern**: Sử dụng cấu hình TestDefinition tách biệt để tự động đánh giá phân loại giá trị xét nghiệm (`NORMAL | ABNORMAL | CRITICAL`).
3. **Clinical Safety Acknowledgment Pattern**: Giữ cảnh báo nguy kịch (`CRITICAL` -> `ESCALATION_REQUIRED`) như một nghĩa vụ an toàn chưa được giải quyết cho đến khi bác sĩ chủ động thực hiện ký xác nhận (`ACKNOWLEDGED`), lưu lại vết người thực hiện và mốc thời gian.
4. **Decoupled Subscriber and Anti-Corruption Layer (ACL) Integration Pattern**: Đồng bộ danh sách xét nghiệm từ clinical order thông qua contract reader cô lập, che giấu cấu trúc bảng database legacy bằng repository mapper.
5. **Optimistic Concurrency Control (OCC) for State Transitions**: Ngăn chặn race condition khi nhập/duyệt song song thông qua ràng buộc kiểm tra giá trị null ở tầng repository khi lưu trữ.

### Baseline v6 (Ratified Architectural Patterns — ADR-016)
- **Công Thức Baseline v6**:  
  $$\text{Architecture Baseline v6} = \text{Baseline v5 (451 Tests)} + \text{H6 Tests (9 Tests)} = \mathbf{460\text{ Executable Tests PASS}}$$

1. **Clinical Safety Screening Engine (CDS Policy Integration)**: Tách biệt các bộ lọc an toàn thuốc (dị ứng, tương tác, liều, trùng trị liệu) thành các lớp policy độc lập bên ngoài aggregate root.
2. **Human Override & Audit Provenance Pattern**: Cho phép ghi đè cảnh báo lâm sàng nhưng bắt buộc lưu lại vết chứng minh đầy đủ (Who, Why, When, Policy Version) dưới dạng lịch sử append-only không thể chỉnh sửa.
3. **High-Alert Dual Verification Safety Gate**: Chặn quy trình cấp phát thuốc nguy cơ cao cho đến khi có sự ký duyệt của hai dược sĩ độc lập khác nhau.
4. **Decoupled Inventory Allocation & Deductions Pattern**: Quản lý kho dược tách biệt với Aggregate Root đơn thuốc, thực hiện kiểm tra và trừ kho thông qua giao dịch repository.

*Lưu ý cốt lõi*: **Pattern được chứng minh $\neq$ Abstraction được tạo ra**. Không được kéo các patterns thành Shared Abstractions (như `PlatformResourceAllocationPrimitive` hay `UniversalVerificationEngine`) khi chưa đủ 3 verticals có cùng lifecycle và business semantics thực sự.

---

## 6. Lộ Trình Phân Hệ Chuẩn Hóa (Milestones H1 → H8)

- ✅ **H1 — Inpatient Vertical Slice** — **Baseline v1 (383 Tests PASS)**
- ✅ **H1.1 — Self-Defending Architecture & CI Gate** — **RATIFIED**
- ✅ **H2 — Emergency Vertical Slice** — **Baseline v2 (410 Tests PASS)**
- ✅ **H3 — ICU / CCU Vertical Slice** — **Baseline v3 (428 Tests PASS)**
- ✅ **H4 — Surgery / Perioperative Suite** — **Baseline v4 (435 Tests PASS)**
- ✅ **H5 — Laboratory Engine** — **Baseline v5 (451 Tests PASS)**
- ✅ **H6 — Pharmacy Engine** (Clinical Pharmacy Verification) — **Baseline v6 (460 Tests PASS)**
- 🔜 **H7 — Blood Bank Engine**
- 🔜 **H8 — Home Care OS**

---

**Phê duyệt bởi Architecture Review Board (ARB)**  
*Healthcare OS — Executable Architecture Reference Edition (Baseline v6: 460 Tests PASS, Exit 0)*

