---
tier: MAP
domain: platform
status: ACTIVE
last_verified: "2026-08-23"
description: "Danh mục toàn bộ tài liệu Bella phân loại theo 4 tầng — nguồn thật để tìm kiếm"
maintainer: "Platform Architecture Team"
---

# BELLA DOCUMENT REGISTRY
### Danh mục tài liệu theo 4 tầng — 2026-08-23

> **Mục đích:** File này là catalog phân loại tất cả tài liệu quan trọng theo tier.  
> Dùng khi bạn không biết tài liệu nào thuộc tier nào, hoặc muốn audit coverage của documentation.  
>
> **Để điều hướng:** dùng [`BELLA_SYSTEM_INDEX.md`](../BELLA_SYSTEM_INDEX.md)  
> **Để xem trạng thái hệ thống:** dùng [`docs/CURRENT_STATE.md`](CURRENT_STATE.md)

---

## Tier Schema

```yaml
# YAML frontmatter mỗi tài liệu chính nên có:
tier:         MAP | GOVERNANCE | SPECIFICATION | EVIDENCE | LEGACY | OPERATIONAL
domain:       platform | healthcare | finance | logistics | education | real-estate
status:       ACTIVE | SUPERSEDED | DRAFT | ARCHIVED | BLOCKED
last_verified: "YYYY-MM-DD"
description:  "Mô tả ngắn gọn mục đích tài liệu"
```

---

## 📌 Tier 1 — MAP
*Tài liệu định hướng và điều hướng — mở đầu tiên*

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`BELLA_SYSTEM_INDEX.md`](../BELLA_SYSTEM_INDEX.md) | platform | ✅ ACTIVE | ✅ |
| [`docs/CURRENT_STATE.md`](CURRENT_STATE.md) | platform | ✅ ACTIVE | ✅ |
| [`docs/DOCUMENT_REGISTRY.md`](DOCUMENT_REGISTRY.md) | platform | ✅ ACTIVE | ✅ |
| [`docs/architecture/BELLA_PLATFORM_ARCHITECTURE_TREE_2026_08_10.md`](architecture/BELLA_PLATFORM_ARCHITECTURE_TREE_2026_08_10.md) | platform | ACTIVE | ⬜ |
| [`docs/architecture/BELLA_PLATFORM_VISION.md`](architecture/BELLA_PLATFORM_VISION.md) | platform | ACTIVE | ⬜ |
| [`docs/ROADMAP_2026-2027.md`](ROADMAP_2026-2027.md) | platform | ACTIVE | ⬜ |
| [`docs/BELLA_90_DAY_PLAN.md`](BELLA_90_DAY_PLAN.md) | platform | ACTIVE | ⬜ |
| [`docs/FEATURES.md`](FEATURES.md) | platform | ACTIVE | ⬜ |
| [`docs/index.md`](index.md) | platform | SUPERSEDED → dùng BELLA_SYSTEM_INDEX.md | ⬜ |
| [`README.md`](../README.md) | platform | ACTIVE | ⬜ |

---

## 🔒 Tier 2 — GOVERNANCE
*Quy tắc bắt buộc, constitutions, freeze policies — chi phối mọi hoạt động*

### Platform Governance

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`AGENTS.md`](../AGENTS.md) | platform | ✅ ACTIVE (hard rules) | ⬜ |
| [`docs/architecture/FREEZE_POLICY.md`](architecture/FREEZE_POLICY.md) | platform | ✅ ACTIVE | ✅ |
| [`docs/architecture/BELLA_META_PLATFORM_CONSTITUTION.md`](architecture/BELLA_META_PLATFORM_CONSTITUTION.md) | platform | ACTIVE | ⬜ |
| [`docs/architecture/BELLA_ARCHITECTURE_CONSTITUTION.md`](BELLA_ARCHITECTURE_CONSTITUTION.md) | platform | ACTIVE | ⬜ |
| [`docs/governance/BELLA_DEPLOYMENT_GOVERNANCE_FRAMEWORK.md`](governance/BELLA_DEPLOYMENT_GOVERNANCE_FRAMEWORK.md) | platform | ACTIVE (BDGF) | ⬜ |
| [`docs/governance/BDGF_V1_0_CONSTITUTION_STAMP.md`](governance/BDGF_V1_0_CONSTITUTION_STAMP.md) | platform | ACTIVE | ⬜ |

### Healthcare Governance

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`](architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md) | healthcare | ✅ ACTIVE — 20 Laws | ✅ |
| [`docs/architecture/HEALTHCARE_ARCHITECTURE_PRINCIPLES.md`](architecture/HEALTHCARE_ARCHITECTURE_PRINCIPLES.md) | healthcare | ACTIVE | ⬜ |
| [`docs/architecture/HEALTHCARE_OS_EXECUTABLE_ARCHITECTURE_REFERENCE.md`](architecture/HEALTHCARE_OS_EXECUTABLE_ARCHITECTURE_REFERENCE.md) | healthcare | ACTIVE | ⬜ |
| [`docs/architecture/H1_2_CONSTITUTION.md`](architecture/H1_2_CONSTITUTION.md) | healthcare | ACTIVE | ⬜ |

### Finance Governance

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/architecture/FINANCE_OS_ARCHITECTURE_CONSTITUTION.md`](architecture/FINANCE_OS_ARCHITECTURE_CONSTITUTION.md) | finance | ✅ ACTIVE | ✅ |
| [`docs/architecture/FINANCE_OS_INHERITANCE_CONSTITUTION.md`](architecture/FINANCE_OS_INHERITANCE_CONSTITUTION.md) | finance | ACTIVE | ⬜ |
| [`docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md`](architecture/F5_PRE_CODING_GATE_PROTOCOL.md) | finance | ACTIVE | ⬜ |
| [`docs/architecture/F5_S0_GOVERNANCE_GATES.md`](architecture/F5_S0_GOVERNANCE_GATES.md) | finance | ACTIVE | ⬜ |
| [`docs/governance/F1_LEDGER_FREEZE.md`](governance/F1_LEDGER_FREEZE.md) | finance | ACTIVE | ⬜ |

### Education Governance

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`](architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md) | education | ACTIVE | ⬜ |

### Logistics Governance

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/LOGISTICS_OS_BOUNDARY_DEFINITION.md`](LOGISTICS_OS_BOUNDARY_DEFINITION.md) | logistics | ACTIVE | ⬜ |
| [`docs/LOGISTICS_KERNEL_QUICK_REFERENCE.md`](LOGISTICS_KERNEL_QUICK_REFERENCE.md) | logistics | ACTIVE | ⬜ |

---

## 📋 Tier 3 — SPECIFICATION
*Đặc tả kỹ thuật — hệ thống phải hoạt động thế nào*

### Healthcare Specification

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/architecture/H1_2_IMPLEMENTATION_PLAN.md`](architecture/H1_2_IMPLEMENTATION_PLAN.md) | healthcare | ACTIVE | ⬜ |
| [`docs/architecture/H1_2_ARCHITECTURE_REVIEW.md`](architecture/H1_2_ARCHITECTURE_REVIEW.md) | healthcare | ACTIVE | ⬜ |
| [`docs/architecture/N1_FAILURE_ISOLATION_IMPLEMENTATION.md`](architecture/N1_FAILURE_ISOLATION_IMPLEMENTATION.md) | healthcare | ACTIVE | ⬜ |
| [`docs/architecture/BELLA_HOSPITAL_ENTERPRISE_ARCHITECTURE.md`](architecture/BELLA_HOSPITAL_ENTERPRISE_ARCHITECTURE.md) | healthcare | ACTIVE | ⬜ |
| `docs/architecture/HEALTHCARE_KERNEL_MATURITY_REVIEW.md` | healthcare | ACTIVE | ⬜ |

### Finance Specification

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/architecture/F5_S0_REGULATORY_AGILITY_ARCHITECTURE.md`](architecture/F5_S0_REGULATORY_AGILITY_ARCHITECTURE.md) | finance | ACTIVE | ⬜ |
| [`docs/architecture/F5_6_CASH_PREPAYMENT_SEMANTIC_SPEC.md`](architecture/F5_6_CASH_PREPAYMENT_SEMANTIC_SPEC.md) | finance | 🔴 BLOCKED | ⬜ |
| [`docs/architecture/F5_6_A3_CANONICAL_SEMANTIC_MODEL.md`](architecture/F5_6_A3_CANONICAL_SEMANTIC_MODEL.md) | finance | ACTIVE | ⬜ |
| [`docs/architecture/F3_ACCOUNTS_RECEIVABLE_CONSTITUTION.md`](architecture/F3_ACCOUNTS_RECEIVABLE_CONSTITUTION.md) | finance | ACTIVE | ⬜ |
| [`docs/architecture/F1.3_LEDGER_DOMAIN_SERVICE_DESIGN.md`](architecture/F1.3_LEDGER_DOMAIN_SERVICE_DESIGN.md) | finance | ACTIVE | ⬜ |
| `docs/architecture/FINANCE_OS_GATE_ROADMAP.md` | finance | ACTIVE | ⬜ |

### Logistics Specification

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/LOGISTICS_OS_CAPABILITY_EXTRACTION_ANALYSIS.md`](LOGISTICS_OS_CAPABILITY_EXTRACTION_ANALYSIS.md) | logistics | ACTIVE | ⬜ |
| [`docs/LOGISTICS_OS_FINANCE_INTEGRATION_CONTRACT.md`](LOGISTICS_OS_FINANCE_INTEGRATION_CONTRACT.md) | logistics | ACTIVE | ⬜ |
| [`docs/E7_LOGISTICS_OS_CONSTRUCTION_PLAN.md`](E7_LOGISTICS_OS_CONSTRUCTION_PLAN.md) | logistics | ACTIVE | ⬜ |

### Platform Specification

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/architecture/BELLA_COMMON_INTEGRATION_PRIMITIVES_V1.md`](architecture/BELLA_COMMON_INTEGRATION_PRIMITIVES_V1.md) | platform | ACTIVE | ⬜ |
| [`docs/architecture/BELLA_COMMON_INTEGRATION_RUNTIME_ARCHITECTURE_V1.md`](architecture/BELLA_COMMON_INTEGRATION_RUNTIME_ARCHITECTURE_V1.md) | platform | ACTIVE | ⬜ |
| [`docs/architecture/BELLA_META_PLATFORM_BOUNDARY.md`](architecture/BELLA_META_PLATFORM_BOUNDARY.md) | platform | ACTIVE | ⬜ |
| [`docs/architecture/BELLA_INDUSTRY_INTEGRATION_FRAMEWORK_CONSTITUTION_V1.md`](architecture/BELLA_INDUSTRY_INTEGRATION_FRAMEWORK_CONSTITUTION_V1.md) | platform | ACTIVE | ⬜ |
| `docs/architecture/VERTICAL_CREATION_FRAMEWORK.md` | platform | ACTIVE | ⬜ |

### API Specification

| File | Domain | Status | Tagged |
|---|---|---|---|
| `docs/api/` | platform | ACTIVE | ⬜ |
| `openapi/` | platform | ACTIVE | ⬜ |

---

## 🔬 Tier 4 — EVIDENCE
*Bằng chứng kiến trúc — hệ thống thực sự hoạt động như vậy*

### Architecture Gate Results

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/architecture/ARCHITECTURE_GATE_RESULT_F2.md`](architecture/ARCHITECTURE_GATE_RESULT_F2.md) | finance | EVIDENCE | ⬜ |
| [`docs/architecture/ARCHITECTURE_GATE_RESULT_F3.md`](architecture/ARCHITECTURE_GATE_RESULT_F3.md) | finance | EVIDENCE | ⬜ |
| [`docs/architecture/ARCHITECTURE_GATE_RESULT_F5.md`](architecture/ARCHITECTURE_GATE_RESULT_F5.md) | finance | EVIDENCE | ⬜ |
| [`docs/architecture/F2_1_CONFORMANCE_PASS.md`](architecture/F2_1_CONFORMANCE_PASS.md) | finance | EVIDENCE | ⬜ |
| [`ARCHITECTURE_GATE_RESULT.md`](../ARCHITECTURE_GATE_RESULT.md) | platform | EVIDENCE | ⬜ |

### Freeze & Proven Evidence

| File | Domain | Status | Tagged |
|---|---|---|---|
| [`docs/architecture/H1_2_PROVEN_FROZEN.md`](architecture/H1_2_PROVEN_FROZEN.md) | healthcare | ✅ EVIDENCE | ⬜ |
| [`docs/architecture/F5_CHECKPOINT_2026_08_23.md`](architecture/F5_CHECKPOINT_2026_08_23.md) | finance | ✅ EVIDENCE | ⬜ |
| [`docs/architecture/FINANCE_OS_F2_CASH_TREASURY_FREEZE.md`](architecture/FINANCE_OS_F2_CASH_TREASURY_FREEZE.md) | finance | EVIDENCE | ⬜ |
| [`docs/architecture/R4_1_CONTRACT_FROZEN.md`](architecture/R4_1_CONTRACT_FROZEN.md) | platform | EVIDENCE | ⬜ |
| [`docs/architecture/R4_3_CONTRACT_FROZEN.md`](architecture/R4_3_CONTRACT_FROZEN.md) | platform | EVIDENCE | ⬜ |
| [`E7_1_FROZEN_MANIFEST.json`](../E7_1_FROZEN_MANIFEST.json) | logistics | ✅ EVIDENCE | ⬜ |
| [`docs/architecture/frozen/`](architecture/frozen/) | platform | EVIDENCE | ⬜ |

### Test Evidence (Code)

| Location | Domain | Description |
|---|---|---|
| `src/platform/healthcare/__tests__/` | healthcare | 17 integration test suites |
| `src/platform/finance/__tests__/` | finance | 13 test files |
| `src/platform/logistics/__tests__/` | logistics | 547 tests total |
| `evidence/` | platform | Evidence logs |
| `evidence-logs/` | platform | Audit evidence |

### Proof Documentation

| Location | Domain | Description |
|---|---|---|
| `docs/architecture/F5_PROOF_RUNNER/` | finance | F5 proof runner docs |
| `docs/architecture/F3_PROOF_RUNNER/` | finance | F3 proof runner docs |
| `docs/architecture/F4_PROOF_RUNNER/` | finance | F4 proof runner docs |

---

## 🗂️ OPERATIONAL (Archived — không phải reference)
*Operational artifacts: deploy logs, session summaries, fix notes — đọc khi cần debug lịch sử*

> Đây là các file đã thực hiện xong, không còn là reference tài liệu.  
> Đã được di chuyển vào `docs/archive/operational/` trong Phase 3.

### Root Operational Files (đã archive)

Xem `docs/archive/operational/` cho các file như:
- DEPLOY_NOW.md, DEPLOYMENT_COMPLETE.md
- DAY_X_COMPLETE.md, WEEK_X_*.md (session logs)
- REACT_COMPILER_ERRORS_*.md (fix reports)
- KTV_DASHBOARD_*.md (feature fix reports)

---

## 🗃️ LEGACY
*Tài liệu cũ, không còn phản ánh trạng thái hiện tại*

| File | Reason |
|---|---|
| `docs/index.md` | Superseded by BELLA_SYSTEM_INDEX.md (nội dung lỗi thời từ July 2026) |
| `README_POST_BDGF.md` | Superseded bởi BDGF governance docs mới hơn |
| `docs/archive/` | Historical — không edit |

---

## 📊 Registry Statistics (2026-08-23)

| Tier | Count | Tagged (has frontmatter) | Coverage |
|---|---|---|---|
| Tier 1 MAP | 10 | 3 | 30% |
| Tier 2 GOVERNANCE | 17 | 4 | 24% |
| Tier 3 SPECIFICATION | 23 | 0 | 0% |
| Tier 4 EVIDENCE | 14 | 0 | 0% |
| OPERATIONAL | ~80 (root) | 0 | — |
| LEGACY | 3 | 0 | — |

> **Ưu tiên tag tiếp:** Tier 2 GOVERNANCE còn lại → Tier 3 SPECIFICATION quan trọng nhất  
> **Không cần tag:** Tier 4 EVIDENCE (code/tests tự là evidence), OPERATIONAL, LEGACY

---

## 🔄 Cách cập nhật Registry này

Khi tạo tài liệu mới:
1. Thêm entry vào đúng tier section
2. Thêm YAML frontmatter vào file mới (nếu là Tier 1–3)
3. Update "last_verified" date

Khi tài liệu bị superseded:
1. Đổi status → SUPERSEDED
2. Thêm `superseded_by:` trỏ đến file mới

Khi tài liệu là evidence của milestone:
1. Add vào Tier 4 EVIDENCE section
2. Không cần frontmatter (thường là freeze certs, gate results)

---

*Registry này không tự động cập nhật — cần human/agent maintenance sau mỗi documentation milestone.*
