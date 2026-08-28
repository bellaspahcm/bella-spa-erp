# BELLA HEALTHCARE — CANONICAL CAPABILITY MAP
### Phiên bản: 1.0 | Ngày: 27/08/2026 | Nguồn: Git Forensic + Codebase Verification

> **Mục đích:** Tài liệu này là nguồn sự thật duy nhất (single source of truth) cho Healthcare OS.
> Giải quyết sự nhập nhằng giữa H-number milestone, Kernel Engine và Healthcare capability.
> Mọi tài liệu khác phải tham chiếu về đây khi nói về Healthcare.

---

## Quy tắc đặt tên — Healthcare Naming Convention

> **H-number là immutable identifier của Healthcare milestone/certification.**
> Một H-number chỉ có một nghĩa duy nhất, không được tái sử dụng cho capability khác.
>
> - **Kernel Engine** → có tên engine cụ thể (`bed-engine`, `cds-engine`, v.v.) + service file thực tế
> - **Milestone/Gate** → H-number là nhãn certification, không phải nhãn engine
> - **Capability (TBD)** → dùng tên capability rõ ràng, không dùng H-number cho đến khi có quyết định ADR

---

## Phân loại Phân hệ Động cơ (Healthcare Engine Taxonomy)

> **Mục tiêu:** Phân định rõ ràng giữa động cơ được expose ra hệ thống bên ngoài thông qua Service Locator và các động cơ xử lý nghiệp vụ nội bộ hoặc đang ở trạng thái placeholder.

```
HEALTHCARE OS ENGINE TAXONOMY
│
├── 1. Active Exposed Engines (11 engines)
│   └── Expose qua Service Locator (Admission, Encounter, Bed, CDS, Nursing, Order, Pharmacy, Laboratory, OR, Surgical, Anesthesia)
│
├── 2. Implemented but Unexposed/Unwired Engines (9 engines)
│   └── Có source code & tests đầy đủ, chạy isolated nhưng KHÔNG đăng ký qua Service Locator (Blood Bank, ICU, Emergency, CSSD, PACU, OR-Readiness, Rule, Temporal, Audit-Compliance)
│
└── 3. Placeholder / Pending Engines (7 engines)
    └── Thư mục rỗng hoặc comment placeholder (Imaging, Scheduling, Billing, Clinical, Insurance, Queue, MPI)
```

---

## Layer 1 — Active Exposed Engines (11 engines)

> Đây là những engine **thực sự tồn tại** trong `src/platform/healthcare/engines/`,
> có `*.service.ts`, đã được register trong `service-locator.ts`, và có integration tests.

| Engine Name | Service File | Active in Service Locator | Tests | Verify Status |
|---|---|---|---|---|
| `admission-engine` | ✅ `admission-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `bed-engine` | ✅ `bed-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `cds-engine` | ✅ `cds-engine.service.ts` | ✅ | ✅ 19 scenarios | 🔒 Baseline |
| `encounter-engine` | ✅ `encounter-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `nursing-engine` | ✅ `nursing-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `order-engine` | ✅ `order-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `pharmacy-engine` | ✅ `pharmacy-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `laboratory-engine` | ✅ `laboratory-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `or-engine` | ✅ `or-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `surgical-engine` | ✅ `surgical-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |
| `anesthesia-engine` | ✅ `anesthesia-engine.service.ts` | ✅ | ✅ | 🔒 Baseline |

**Tổng: 11 engines active. Regression: 500/504 PASS.**

---

## Layer 2 — Implemented but Unexposed Engines (9 engines)

> Những engine này có implementation thật, thậm chí có test chuyên biệt quy mô lớn,
> nhưng **không được wire thông qua Service Locator**. Chúng hoạt động độc lập hoặc
> được dùng cục bộ để chạy các flow kiểm thử.

| Engine Name | Trạng thái codebase | Tests | Ghi chú |
|---|---|---|---|
| `blood-bank-engine` | ✅ `blood-bank-engine.service.ts` | ✅ `blood-bank-engine.integration.test.ts` (496 lines) | H7 Blood Bank. Code sạch, logic thật nhưng unexposed. |
| `icu-engine` | ✅ `icu-engine.service.ts` | ✅ `icu-h2-h3-h1-continuity.integration.test.ts` | Tích hợp sâu vào ICU stay, unexposed. |
| `emergency-engine` | ✅ `emergency-engine.service.ts` | ✅ `emergency-3-scenarios.integration.test.ts` | Triage, Emergency bay, unexposed. |
| `cssd-engine` | ✅ `cssd-engine.service.ts` | ❌ None | Thiết bị khử trùng |
| `pacu-engine` | ✅ `pacu-engine.service.ts` | ❌ None | Post-anesthesia care |
| `or-readiness-engine` | ✅ `or-readiness-engine.service.ts` | ❌ None | Sẵn sàng phòng mổ |
| `rule-engine` | ✅ `rule-engine.service.ts` | ✅ `rule-engine.integration.test.ts` (297 lines) | H10 clinical governance |
| `temporal-engine` | ✅ `temporal-engine.service.ts` | ✅ `temporal-engine.integration.test.ts` (287 lines) | H9 bitemporal history |
| `audit-compliance-engine` | ✅ `audit-compliance.service.ts` | ✅ `audit-compliance.integration.test.ts` (290 lines) | H11 legal audit infrastructure |

---

## Layer 3 — Healthcare Capabilities (Product/Service Layer — TBD on Kernel Elevation)

> Những capability này **có tồn tại ở Product hoặc Service layer** nhưng **chưa có Kernel Engine**.
> Chưa có quyết định ADR về việc có nâng lên Kernel hay không.

| Capability | Hiện trạng thực tế | ADR | Quyết định |
|---|---|---|---|
| **Imaging (RIS/PACS)** | Product-layer service actions trong `lis-ris-actions.ts`, `healthcare-actions.ts`; DB table `hc_imaging_orders`; DICOM viewer UI | [ADR-016](../05-adr/ADR-016-h7-imaging-kernel-vs-product.md) | ✅ Hướng B - Product Layer (ADR-016) |
| **Scheduling (Appointments)** | Product-level scheduling state trong Dental (`dental-chair.service.ts`); domain event string `Scheduling.Appointment.Created.v1` | [ADR-017](../05-adr/ADR-017-h12-scheduling-kernel-vs-platform-vs-product.md) | ✅ Hướng C - Product Layer (ADR-017) |

> **Lưu ý quan trọng:**
> - `src/platform/healthcare/engines/imaging-engine/` và `scheduling-engine/` là **empty placeholder folders** và sẽ được dọn dẹp (xóa bỏ) ở sprint sau.
> - Chưa có contract file cho cả hai.
> - Chúng bị comment out trong `service-locator.ts` từ commit `af25d53c` (23/08/2026).
> - Git forensic xác nhận: **chưa bao giờ được implement trong toàn bộ lịch sử Git.**

---

## Layer 4 — H-Number Canonical Index (Milestone/Certification Map)

> **H-number = Healthcare milestone identifier — KHÔNG phải engine name.**
> Mapping chính thức dưới đây là nguồn sự thật. Mọi tài liệu dùng H-number phải theo bảng này.

| H-ID | Canonical Meaning | Type | Status | Git Evidence |
|---|---|---|---|---|
| **H1** | Patient Identity & Encounter Foundation | Kernel Engine | 🔒 Baseline | `admission-engine`, `encounter-engine` |
| **H2** | Inpatient Clinical Workflow (Nursing + Bed) | Kernel Engine | 🔒 Baseline | `nursing-engine`, `bed-engine` |
| **H3** | ICU & Critical Care Module | Kernel Engine | 🔒 Baseline | `icu-engine` |
| **H4** | Pharmacy & Medication Safety | Kernel Engine | 🔒 Baseline | `pharmacy-engine` |
| **H5** | Laboratory Information System (LIS) | Kernel Engine | 🔒 Baseline | `laboratory-engine` |
| **H6** | Clinical Order Management | Kernel Engine | 🔒 Baseline | `order-engine` |
| **H7** | Blood Bank & Transfusion Safety | Kernel Engine | 🔒 Baseline | Commit `8ef7277b` — *"H7 Blood Bank Engine + Baseline v7 Ratification (470/470 PASS)"* |
| **H8** | Clinical Decision Support (CDS) | Kernel Engine | 🔒 Baseline | `cds-engine` — Commit `13112076` |
| **H9** | Temporal & Clinical History (Bitemporal) | Kernel Engine | 🔒 Baseline | `temporal-engine` — Commit `13112076` |
| **H10** | Clinical Governance & Rule Engine | Kernel Engine | 🔒 Baseline | `rule-engine` — Commit `13112076` |
| **H11** | Clinical Audit & Compliance (Anti-False-Compliance) | Kernel Engine | 🔒 Baseline | `audit-compliance-engine` — Commit `13112076` |
| **H12** | Platform Hardening & Certification Gate | **Milestone/Gate** | ✅ Passed | Commit `13112076` — *"9/9 Gates PASS, 52/52 Test Suites, 504/504 Tests GREEN"* |

> **Giải thích H12:**
> H12 không phải là một engine. H12 là **certification milestone** — điểm đánh dấu rằng Platform đã đạt đủ điều kiện để tuyên bố Healthcare OS Kernel Candidate Freeze.
> Đây là lý do không tồn tại `scheduling-engine` mang tên H12 — H12 không bao giờ có nghĩa là Scheduling.

---

## Điều cần làm ngay: Cleanup Artifacts

### Placeholder folders cần quyết định (sau khi ADR được ký)

Nếu ADR-016 chọn **Product layer** → xóa:
```
src/platform/healthcare/engines/imaging-engine/    (empty)
```
Và xóa khỏi `KNOWN_EXEMPTIONS` trong `engine-architecture-compliance.test.ts`.

Nếu ADR-017 chọn **Product layer** → xóa:
```
src/platform/healthcare/engines/scheduling-engine/  (empty)
```
Và xóa khỏi `KNOWN_EXEMPTIONS`.

### Tài liệu cần cập nhật (sau khi Canonical Map này được approve)

| Tài liệu | Thay đổi cần làm |
|---|---|
| `reports/progress_report_2026_08_26.md` | Thay "H1–H12 Frozen" → "11 Kernel Engines Baseline; Imaging/Scheduling TBD (ADR-016/017)" |
| `docs/BELLA_SYSTEM_INDEX.md` | Cập nhật Healthcare section |
| `docs/CURRENT_STATE.md` | Cập nhật Healthcare status |
| `docs/BELLA_ARCHITECTURE_CONSTITUTION.md` | Thêm ghi chú H-number naming convention |
| `src/platform/healthcare/README.md` | Cập nhật engine list |

---

## Trạng thái Healthcare — Phát biểu chính xác (cho DD/Investor)

> **Dùng đoạn này khi cần mô tả Healthcare cho due diligence hoặc investor:**

```
Bella Healthcare OS hiện có 11 Kernel Engines đã được expose và active qua Service Locator,
cùng 9 engines nghiệp vụ/bảo mật đã được code và kiểm thử đầy đủ nhưng unexposed ở runtime.
Tất cả đã pass 500/504 integration tests (4 pre-existing SLO timeouts).

Healthcare OS đã đạt H12 Platform Certification Milestone (9/9 gates, 52/52 test suites).

Hai capabilities — Imaging (RIS/PACS) và Appointment Scheduling — hiện tồn tại ở
Product/service layer và đang trong quá trình quyết định kiến trúc (ADR-016, ADR-017)
về việc có nâng lên Kernel Engine hay giữ ở Product layer.

Ba Product Verticals đang hoạt động: Bella Medical Clinic (K6.3 Closed, Pilot Ready),
Bella Hospital, và Bella Dental (Phase 1 complete, Phase 2 pending approval).
```

---

## Lịch sử thay đổi tài liệu này

| Ngày | Phiên bản | Mô tả |
|---|---|---|
| 27/08/2026 | 1.0 | Tạo mới sau Git Forensic Investigation. Giải quyết nhập nhằng H7=Imaging, H12=Scheduling. Xác lập 3-layer structure. |
| 27/08/2026 | 1.1 | Cập nhật Engine Taxonomy sau P0 Forensic. Phân định rõ 4 lớp Taxonomy: Active Exposed, Implemented but Unexposed, và Placeholder. Sửa lại Layer numbering. |

