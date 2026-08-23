---
tier: MAP
domain: platform
status: ACTIVE
last_verified: "2026-08-23"
description: "Điểm vào duy nhất cho toàn bộ hệ thống tài liệu Bella"
maintainer: "Platform Architecture Team"
supersedes: "docs/index.md"
---

# BELLA SYSTEM INDEX
### Mở file này đầu tiên — Luôn luôn

> **Last Updated:** 2026-08-23  
> **Maintained by:** Platform Architecture Team  
> **Purpose:** Điểm vào duy nhất cho toàn bộ hệ thống tài liệu Bella

---

## ⚡ TÔI MUỐN... → ĐI ĐÂU?

| Tôi muốn... | Mở file này |
|---|---|
| **Xem trạng thái toàn bộ hệ thống hiện tại** | [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) |
| **Hiểu Bella là gì và kiến trúc tổng quan** | [`docs/architecture/BELLA_PLATFORM_VISION.md`](docs/architecture/BELLA_PLATFORM_VISION.md) |
| **Kiểm tra Healthcare OS / H1–H12** | [→ Healthcare OS](#healthcare-os) bên dưới |
| **Kiểm tra Finance OS / F1–F5** | [→ Finance OS](#finance-os) bên dưới |
| **Kiểm tra Logistics OS / E7** | [→ Logistics OS](#logistics-os) bên dưới |
| **Biết quy tắc nào AI/developer phải tuân theo** | [`AGENTS.md`](AGENTS.md) + [`docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`](docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md) |
| **Xem roadmap sản phẩm** | [`docs/BELLA_90_DAY_PLAN.md`](docs/BELLA_90_DAY_PLAN.md) |
| **Bắt đầu code tính năng mới** | [`AGENTS.md`](AGENTS.md) → đọc Constitution của OS liên quan |
| **Audit một Kernel/Engine cụ thể** | [→ Audit Workflow](#audit-workflow) bên dưới |
| **Tìm evidence/bằng chứng kiến trúc** | [`evidence/`](evidence/) + [`docs/architecture/`](docs/architecture/) |
| **Deploy hoặc vận hành** | [`docs/BDGF_PRODUCTION_DEPLOYMENT_GUIDE.md`](docs/BDGF_PRODUCTION_DEPLOYMENT_GUIDE.md) |
| **Xem danh mục toàn bộ tài liệu theo tầng** | [`docs/DOCUMENT_REGISTRY.md`](docs/DOCUMENT_REGISTRY.md) |

---

## 🗺️ BẢN ĐỒ KIẾN TRÚC BELLA (2026-08-23)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BELLA META-PLATFORM                               │
│                                                                      │
│   EIP (Enterprise Integration Plane)  ←→  EOS (Enterprise OS Shell) │
│   BDGF (Bella Deployment Governance Framework)                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ Public Contracts
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────┴──────┐   ┌────────┴──────┐   ┌────────┴──────┐
│ HEALTHCARE OS│   │  FINANCE OS   │   │ LOGISTICS OS  │
│  H1–H12 🔒  │   │  F1–F5 🟡    │   │  E7.1-7.3 🔒 │
│  FROZEN      │   │  F5.0–5.5 ✅ │   │  SEALED       │
│  52 Suites   │   │  F5.6 BLOCKED│   │  547 Tests    │
└──────────────┘   └───────────────┘   └───────────────┘
        │
┌───────┴──────┐   ┌───────────────┐
│ EDUCATION OS │   │ REAL ESTATE OS│
│  🟡 ACTIVE  │   │  🟢 IMPL.     │
└──────────────┘   └───────────────┘
```

> **Trạng thái chi tiết từng Engine:** xem [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md)

---

## 👤 BẮT ĐẦU THEO VAI TRÒ

### 🤖 AI Agent / Developer mới

1. Đọc [`AGENTS.md`](AGENTS.md) — **BẮT BUỘC**, các quy tắc hard-lock
2. Đọc [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — biết hệ thống đang ở đâu
3. Đọc Constitution của OS bạn sẽ làm việc (xem bảng Governance bên dưới)
4. Đọc [`docs/architecture/FREEZE_POLICY.md`](docs/architecture/FREEZE_POLICY.md) — hiểu quy trình thay đổi frozen layers

### 🏗️ Architect / Tech Lead

1. [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — trạng thái hệ thống
2. [`docs/architecture/BELLA_PLATFORM_ARCHITECTURE_TREE_2026_08_10.md`](docs/architecture/BELLA_PLATFORM_ARCHITECTURE_TREE_2026_08_10.md) — architecture tree
3. [`docs/architecture/BELLA_META_PLATFORM_CONSTITUTION.md`](docs/architecture/BELLA_META_PLATFORM_CONSTITUTION.md) — meta-platform constitution
4. [`docs/architecture/FREEZE_POLICY.md`](docs/architecture/FREEZE_POLICY.md) — freeze & change governance

### 📊 Auditor / Reviewer

1. [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — trạng thái với status từng Kernel
2. Chọn OS cần audit → xem section tương ứng bên dưới
3. Theo [Audit Workflow](#audit-workflow) để drill down

### 👨‍💼 Business Owner / Product Manager

1. [`docs/FEATURES.md`](docs/FEATURES.md) — 250+ tính năng hệ thống
2. [`docs/ROADMAP_2026-2027.md`](docs/ROADMAP_2026-2027.md) — roadmap
3. [`docs/BELLA_90_DAY_PLAN.md`](docs/BELLA_90_DAY_PLAN.md) — 90-day plan

---

## 🏥 HEALTHCARE OS {#healthcare-os}

**Kernel Status:** H1–H12 🔒 FROZEN | **Test Suite:** 52/52 Suites

### Constitution & Governance

| Tài liệu | Mục đích |
|---|---|
| [`docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`](docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md) | **20 Laws bắt buộc** — đọc trước khi code bất kỳ thứ gì |
| [`docs/architecture/HEALTHCARE_OS_EXECUTABLE_ARCHITECTURE_REFERENCE.md`](docs/architecture/HEALTHCARE_OS_EXECUTABLE_ARCHITECTURE_REFERENCE.md) | Architecture reference cho H1–H12 |
| [`docs/architecture/HEALTHCARE_ARCHITECTURE_PRINCIPLES.md`](docs/architecture/HEALTHCARE_ARCHITECTURE_PRINCIPLES.md) | Design principles |
| [`docs/architecture/H1_2_CONSTITUTION.md`](docs/architecture/H1_2_CONSTITUTION.md) | H1.2 Event Sourcing Resilience constitution |

### Engine Map

| Engine | Code Location | Status |
|---|---|---|
| H1 Event Store (MPI) | `src/platform/healthcare/engines/mpi-engine/` | ✅ FROZEN |
| H2 Encounter Engine | `src/platform/healthcare/engines/encounter-engine/` | ✅ FROZEN |
| H3 Clinical Engine | `src/platform/healthcare/engines/clinical-engine/` | ✅ FROZEN |
| H4 Order Engine | `src/platform/healthcare/engines/order-engine/` | ✅ FROZEN |
| H5 Pharmacy Engine | `src/platform/healthcare/engines/pharmacy-engine/` | ✅ FROZEN |
| H6 Laboratory Engine | `src/platform/healthcare/engines/laboratory-engine/` | ✅ FROZEN |
| H7 Imaging Engine | `src/platform/healthcare/engines/imaging-engine/` | ✅ FROZEN |
| H8 CDS Engine | `src/platform/healthcare/engines/cds-engine/` | ✅ FROZEN |
| H9 Temporal Engine | `src/platform/healthcare/engines/temporal-engine/` | ✅ FROZEN |
| H10 Rule Engine | `src/platform/healthcare/engines/rule-engine/` | ✅ FROZEN |
| H11 Audit Compliance | `src/platform/healthcare/engines/audit-compliance-engine/` | ✅ FROZEN |
| H12 Scheduling Engine | `src/platform/healthcare/engines/scheduling-engine/` | ✅ FROZEN |

### Test Evidence

| File | Mô tả |
|---|---|
| `src/platform/healthcare/__tests__/` | 17 integration test suites |
| `src/platform/healthcare/__tests__/engine-architecture-compliance.test.ts` | Architecture compliance gates |
| `src/platform/healthcare/__tests__/platform-certification.integration.test.ts` | Platform certification |

### Bắt đầu audit Healthcare:
> `docs/CURRENT_STATE.md` → **Healthcare OS** → chọn Engine → xem Code + Tests + Evidence

---

## 💰 FINANCE OS {#finance-os}

**Status:** F1–F2 ✅ FROZEN | F3–F4 ✅ FROZEN | **F5.0–5.5** ✅ FROZEN | **F5.6** 🔴 BLOCKED

### Constitution & Governance

| Tài liệu | Mục đích |
|---|---|
| [`docs/architecture/FINANCE_OS_ARCHITECTURE_CONSTITUTION.md`](docs/architecture/FINANCE_OS_ARCHITECTURE_CONSTITUTION.md) | Finance OS constitution tổng thể |
| [`docs/architecture/FINANCE_OS_INHERITANCE_CONSTITUTION.md`](docs/architecture/FINANCE_OS_INHERITANCE_CONSTITUTION.md) | Inheritance rules giữa F1–F5 |
| [`docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md`](docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md) | **Quan trọng:** Gating protocol trước khi code F5 |
| [`docs/architecture/FREEZE_POLICY.md`](docs/architecture/FREEZE_POLICY.md) | Freeze policy toàn platform |

### Finance Kernel Map

| Module | Code | Tests | Status |
|---|---|---|---|
| F1 Ledger Engine | `src/platform/finance/engines/ledger-engine/` | `__tests__/finance-f1-*.test.ts` | ✅ FROZEN |
| F2 Cash Engine | `src/platform/finance/engines/cash-engine/` | `__tests__/finance-f2-*.test.ts` | ✅ FROZEN |
| F3 AR Engine | (contracts layer) | `__tests__/f3-proof-runner.test.ts` | ✅ FROZEN |
| F4 AP Engine | (contracts layer) | `__tests__/f4-proof-runner.test.ts` | ✅ FROZEN |
| F5.0–F5.5 Reconciliation | (SQL functions) | `__tests__/f5-*.test.ts` | ✅ FROZEN |
| F5.6 Cash+Prepayment | — | — | 🔴 BLOCKED (awaiting semantic spec) |

### F5 Checkpoint (2026-08-23)
> [`docs/architecture/F5_CHECKPOINT_2026_08_23.md`](docs/architecture/F5_CHECKPOINT_2026_08_23.md)  
> **F5.5 CLOSED. F5.6 CORRECTLY BLOCKED** — chờ Human Architect cung cấp semantic specification.

---

## 📦 LOGISTICS OS {#logistics-os}

**Status:** E7.1 🔒 SEALED | E7.2 🔒 SEALED | E7.3 🔒 SEALED | **547/547 Tests**

### Frozen Layers

| Layer | Artifacts | Tests | Freeze Date |
|---|---|---|---|
| E7.1 Domain Kernel | 12 artifacts | 366 tests | 2024-01-15 |
| E7.2 Operational Kernel | 4 artifacts | 73 tests | 2024-02-01 |
| E7.3 Rules & Traceability | 9 artifacts | 108 tests | 2026-08-22 |

### Constitution & Governance

| Tài liệu | Mục đích |
|---|---|
| [`docs/architecture/FREEZE_POLICY.md`](docs/architecture/FREEZE_POLICY.md) | Freeze & ACR process |
| [`docs/LOGISTICS_KERNEL_QUICK_REFERENCE.md`](docs/LOGISTICS_KERNEL_QUICK_REFERENCE.md) | Quick reference |
| [`docs/LOGISTICS_OS_BOUNDARY_DEFINITION.md`](docs/LOGISTICS_OS_BOUNDARY_DEFINITION.md) | Boundary definitions |

### Engines (Logistics)

```
src/platform/logistics/engines/
├── freight-audit-engine.ts    (79KB)
├── route-engine.ts            (45KB)
└── shipment-engine.ts         (44KB)
```

> **Để modify E7.1–E7.3:** bắt buộc phải tạo ACR → Human Architect review. Xem [`docs/architecture/FREEZE_POLICY.md`](docs/architecture/FREEZE_POLICY.md).

---

## 🎓 EDUCATION OS {#education-os}

**Status:** 🟡 ACTIVE DEVELOPMENT

```
src/platform/education/
├── assessment/
├── attendance/
├── course/
├── enrollment/
├── student/
└── education-engine.service.ts
```

| Tài liệu | Mục đích |
|---|---|
| [`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`](docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md) | **BẮT BUỘC** — đọc trước khi code |

---

## 🏢 REAL ESTATE OS {#real-estate-os}

**Status:** 🟢 IMPLEMENTED

```
src/platform/real-estate/
├── contracts/
├── domain/
├── engines/
└── repositories/
```

---

## 📚 4 TẦNG TÀI LIỆU (Documentation Tiers)

Mọi tài liệu trong Bella thuộc một trong 4 tầng này:

### Tier 1 — MAP (Định hướng)
*Dùng để biết bắt đầu từ đâu*

| File | Mô tả |
|---|---|
| **`BELLA_SYSTEM_INDEX.md`** (file này) | Điểm vào duy nhất |
| [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) | Trạng thái thực tế hiện tại |
| [`docs/DOCUMENT_REGISTRY.md`](docs/DOCUMENT_REGISTRY.md) | Danh mục toàn bộ tài liệu theo tier |
| [`docs/architecture/BELLA_PLATFORM_ARCHITECTURE_TREE_2026_08_10.md`](docs/architecture/BELLA_PLATFORM_ARCHITECTURE_TREE_2026_08_10.md) | Architecture map |
| [`docs/ROADMAP_2026-2027.md`](docs/ROADMAP_2026-2027.md) | Roadmap |

### Tier 2 — GOVERNANCE (Quy tắc)
*Dùng để biết quy tắc nào đang chi phối*

| File | Mô tả |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Hard rules cho AI agents |
| [`docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`](docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md) | Healthcare laws |
| [`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`](docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md) | Education laws |
| [`docs/architecture/FINANCE_OS_ARCHITECTURE_CONSTITUTION.md`](docs/architecture/FINANCE_OS_ARCHITECTURE_CONSTITUTION.md) | Finance laws |
| [`docs/architecture/FREEZE_POLICY.md`](docs/architecture/FREEZE_POLICY.md) | Freeze & change governance |
| [`docs/governance/BELLA_DEPLOYMENT_GOVERNANCE_FRAMEWORK.md`](docs/governance/BELLA_DEPLOYMENT_GOVERNANCE_FRAMEWORK.md) | Deployment governance (BDGF) |

### Tier 3 — SPECIFICATION (Đặc tả)
*Dùng để biết hệ thống phải hoạt động thế nào*

| Area | Location |
|---|---|
| Healthcare Kernel specs | `docs/architecture/H1_2_*.md` |
| Finance OS specs | `docs/architecture/FINANCE_OS_*.md`, `docs/architecture/F5_*.md` |
| Logistics OS specs | `docs/LOGISTICS_OS_*.md` |
| API specs | `docs/api/`, `openapi/` |
| Database schemas | `docs/architecture/`, `supabase/migrations/` |

### Tier 4 — EVIDENCE (Bằng chứng)
*Dùng để chứng minh hệ thống thực sự hoạt động như vậy*

| Area | Location |
|---|---|
| Source code | `src/platform/` |
| Test files | `src/platform/*/\_\_tests\_\_/` |
| Database migrations | `supabase/migrations/` |
| Architecture gate results | `docs/architecture/ARCHITECTURE_GATE_RESULT*.md` |
| Evidence logs | `evidence/`, `evidence-logs/` |
| Implementation artifacts | `implementation-artifacts/` |

---

## 🔍 AUDIT WORKFLOW {#audit-workflow}

### Muốn audit một Kernel/Engine:

```
1. docs/CURRENT_STATE.md
      └── Chọn OS → Chọn Engine
              └── Xem Status

2. Nếu status có dấu hiệu drift → xem "Known Drift" section

3. Drill down theo thứ tự:
      Specification → Code → Tests → Evidence

4. Specification:
      Healthcare: docs/architecture/H1_2_*.md
      Finance:    docs/architecture/F5_*.md
      Logistics:  docs/LOGISTICS_OS_*.md

5. Code:
      src/platform/<os>/engines/<engine-name>/

6. Tests:
      src/platform/<os>/__tests__/

7. Evidence / Gate Results:
      docs/architecture/ARCHITECTURE_GATE_RESULT*.md
      evidence/
      evidence-logs/
```

### Phát hiện Architecture Drift:

Khi phát hiện mâu thuẫn giữa specification và implementation:

```
⚠️ ARCHITECTURE DRIFT DETECTED

Component: <OS> / <Engine>
Specification says: ...
Implementation does: ...
Evidence: ...
Status: NEEDS_RECONCILIATION

→ Báo cáo với Human Architect trước khi sửa
→ KHÔNG tự ý modify frozen artifacts
```

---

## ⚠️ NGUYÊN TẮC BẤT BIẾN

> **1.** Tài liệu KHÔNG phải nguồn sự thật duy nhất. Code + DB + Tests + Evidence mới là nguồn sự thật.

> **2.** Khi có mâu thuẫn giữa tài liệu và code → **báo cáo drift**, không tự sửa tài liệu cho khớp với code.

> **3.** Frozen artifacts (H1–H12, E7.1–E7.3, F5.0–F5.5) không được sửa nếu không có ACR được duyệt.

> **4.** `BELLA_SYSTEM_INDEX.md` (file này) và `docs/CURRENT_STATE.md` phải được cập nhật mỗi khi có thay đổi lớn về architecture.

---

## 📋 GOVERNANCE QUICK REFERENCE

| Cần làm gì | Quy trình |
|---|---|
| Code Healthcare vertical mới | Đọc [`AGENTS.md`](AGENTS.md) + [`docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`](docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md) → Pass 11 Gates |
| Modify frozen Logistics E7 | Tạo ACR → Human Architect review → [`docs/architecture/FREEZE_POLICY.md`](docs/architecture/FREEZE_POLICY.md) |
| Code Finance F5.6 | Chờ Human Architect cung cấp semantic spec → [`docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md`](docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md) |
| Deploy production | BDGF process → [`docs/BDGF_PRODUCTION_DEPLOYMENT_GUIDE.md`](docs/BDGF_PRODUCTION_DEPLOYMENT_GUIDE.md) |
| Tạo OS mới | [`docs/VERTICAL_CREATION_FRAMEWORK.md`](docs/VERTICAL_CREATION_FRAMEWORK.md) |

---

*File này là điểm vào duy nhất của Bella ERP. Nếu bạn không biết bắt đầu từ đâu — bắt đầu từ đây.*  
*Mọi thay đổi về architecture phải được phản ánh vào [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) và file này.*
