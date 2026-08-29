---
tier: MAP
domain: platform
status: ACTIVE
last_verified: "2026-08-23"
description: "Dashboard trạng thái thực tế của Bella — Kernel-level granularity"
maintainer: "Platform Architecture Team"
update_trigger: "Sau mỗi architecture milestone"
---

# BELLA PLATFORM — CURRENT STATE
### Trạng thái kiến trúc thực tế (không phải kế hoạch)

> **Last Verified:** 2026-08-23 21:30 ICT  
> **Source of Truth:** Code + DB migrations + Test results  
> **⚠️ Nguyên tắc:** File này phản ánh thực tế codebase, không phải tài liệu mong muốn.  
> Mọi mục có dấu `?` hoặc `⚠️` là **chưa được xác minh tự động** và cần kiểm tra lại.

---

## 🖥️ PLATFORM CORE

```
BELLA META-PLATFORM
─────────────────────────────────────────────────────
EIP  (Enterprise Integration Plane)    ✅ IMPLEMENTED
EOS  (Enterprise OS Shell)             ✅ IMPLEMENTED
BDGF (Deployment Governance Framework) ✅ OPERATIONAL
Runtime                                ✅ IMPLEMENTED
```

| Component | Code Location | Status |
|---|---|---|
| Platform Bootstrap | `src/platform/bootstrap.ts` | ✅ |
| Platform Index | `src/platform/index.ts` | ✅ |
| Integration Runtime | `src/platform/integration-runtime/` | ✅ |
| Notification Hub | `src/platform/notification-hub/` | ✅ |
| IAM Matrix | `src/platform/iam-matrix/` | ✅ |
| Policy Engine | `src/platform/policy-engine/` | ✅ |
| Registry | `src/platform/registry/` | ✅ |
| Security | `src/platform/security/` | ✅ |

---

## 🏥 HEALTHCARE OS

```
HEALTHCARE OS KERNEL — VERIFIED STATE
────────────────────────────────────────────────────────────
Status:        🔒 PARTIAL FREEZE (11 Active Exposed Engines; 9 Unexposed Implemented Engines)
Constitution:  docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md
Test Suite:    500/504 PASS (17 integration test files verified)
Last Verified: 2026-08-27 (Revision after Git Forensic Investigation)
Compliance:    20 Laws mandatory
```

### Healthcare Engine Inventory (Taxonomy Map)

Xem chi tiết tại [`docs/architecture/HEALTHCARE_CANONICAL_CAPABILITY_MAP.md`](architecture/HEALTHCARE_CANONICAL_CAPABILITY_MAP.md)

| Category | Engines | Description |
|---|---|---|
| **1. Active Exposed Engines** | `admission`, `encounter`, `bed`, `cds`, `nursing`, `order`, `pharmacy`, `laboratory`, `or`, `surgical`, `anesthesia` | Đã đăng ký trong Service Locator, hoạt động hoàn chỉnh. |
| **2. Implemented but Unexposed** | `blood-bank` (H7), `icu`, `emergency`, `cssd`, `pacu`, `or-readiness`, `rule` (H10), `temporal` (H9), `audit-compliance` (H11) | Có source code và test đầy đủ, chạy isolated nhưng chưa được register trong Service Locator. |
| **3. Placeholder / Pending** | `imaging`, `scheduling`, `billing`, `clinical`, `insurance`, `queue` (mpi: contract only) | Thư mục rỗng hoặc comment placeholder, chưa được code ở Kernel layer. |

### Healthcare — Key Milestones & Certification Gates (Layer 4 Index)

| H-ID | Canonical Meaning | Type | Status |
|---|---|---|---|
| **H1** | Patient Identity & Encounter Foundation | Kernel Engine | 🔒 Baseline |
| **H2** | Inpatient Clinical Workflow (Nursing + Bed) | Kernel Engine | 🔒 Baseline |
| **H3** | ICU & Critical Care Module | Kernel Engine | 🔒 Baseline |
| **H4** | Pharmacy & Medication Safety | Kernel Engine | 🔒 Baseline |
| **H5** | Laboratory Information System (LIS) | Kernel Engine | 🔒 Baseline |
| **H6** | Clinical Order Management | Kernel Engine | 🔒 Baseline |
| **H7** | Blood Bank & Transfusion Safety | Kernel Engine | 🔒 Baseline |
| **H8** | Clinical Decision Support (CDS) | Kernel Engine | 🔒 Baseline |
| **H9** | Temporal & Clinical History (Bitemporal) | Kernel Engine | 🔒 Baseline |
| **H10** | Clinical Governance & Rule Engine | Kernel Engine | 🔒 Baseline |
| **H11** | Clinical Audit & Compliance (Anti-False-Compliance) | Kernel Engine | 🔒 Baseline |
| **H12** | Platform Hardening & Certification Gate | Milestone/Gate | ✅ Passed |

### Healthcare — Test Evidence

| Test File | Coverage | Status |
|---|---|---|
| `audit-compliance.integration.test.ts` | H11 | ✅ |
| `blood-bank-engine.integration.test.ts` | Blood Bank (H7) | ✅ |
| `cds-engine.integration.test.ts` | H8 CDS | ✅ |
| `cross-engine-integration.test.ts` | Cross-engine | ✅ |
| `emergency-3-scenarios.integration.test.ts` | Emergency | ✅ |
| `engine-architecture-compliance.test.ts` | Architecture gates | ✅ |
| `healthcare-3-engine.integration.test.ts` | H1+H2+H3 | ✅ |
| `icu-h2-h3-h1-continuity.integration.test.ts` | ICU continuity | ✅ |
| `inpatient-core.integration.test.ts` | Inpatient | ✅ |
| `laboratory-engine.integration.test.ts` | H6 Lab | ✅ |
| `performance-slo-benchmark.test.ts` | SLO | ✅ |
| `pharmacy-engine.integration.test.ts` | H5 Pharmacy | ✅ |
| `platform-certification.integration.test.ts` | Platform cert | ✅ |
| `rule-engine.integration.test.ts` | H10 Rule | ✅ |
| `temporal-engine.integration.test.ts` | H9 Temporal | ✅ |

### Healthcare — Architecture Decisions & Gaps

```
⚠️ ADR PENDING: ADR-016 (Imaging capability) & ADR-017 (Scheduling capability)
   → Quyết định giữ ở Product layer hay nâng cấp lên Kernel. Hiện tại hoạt động ở Product/service layer.
⚠️ UNWIRED: ICU, Emergency, Blood Bank có implementation thật nhưng unexposed qua Service Locator.
```

### Healthcare — Governance Links

- Canonical Map: [`docs/architecture/HEALTHCARE_CANONICAL_CAPABILITY_MAP.md`](architecture/HEALTHCARE_CANONICAL_CAPABILITY_MAP.md)
- Constitution: [`docs/architecture/BELLA_ARCHITECTURE_CONSTITUTION.md`](BELLA_ARCHITECTURE_CONSTITUTION.md)
- Imaging ADR: [`docs/05-adr/ADR-016-h7-imaging-kernel-vs-product.md`](05-adr/ADR-016-h7-imaging-kernel-vs-product.md)
- Scheduling ADR: [`docs/05-adr/ADR-017-h12-scheduling-kernel-vs-platform-vs-product.md`](05-adr/ADR-017-h12-scheduling-kernel-vs-platform-vs-product.md)
- Verification Report: [`reports/HEALTHCARE_KERNEL_VERIFICATION_REPORT_2026_08_27.md`](../reports/HEALTHCARE_KERNEL_VERIFICATION_REPORT_2026_08_27.md)

---

## 🏥 HEALTHCARE PRODUCT VERTICALS

```
BELLA DENTAL — Product Vertical
────────────────────────────────────────────────────────────
Architecture Analysis:  ✅ PHASE 1 COMPLETE (5/5 documents)
Contracts Implementation: ⏸️ PHASE 2 PENDING REVIEW
Product Code:           ⏸️ PHASE 3 NOT STARTED
Status:                 🔒 LOCKED AT PHASE 1
Last Updated:           2026-08-23
```

### Dental Phase 1 — Architecture Analysis (COMPLETE)

| Document | Status | Commit |
|---|---|---|
| 1. Product Manifest | ✅ COMPLETE | [commit hash] |
| 2. Ownership Map | ✅ COMPLETE | [commit hash] |
| 3. Contract Dependency Map | ✅ COMPLETE | c7ee2a4a (569 lines) |
| 4. Database Migration Plan | ✅ COMPLETE | f20d45e5 (724 lines) |
| 5. 11 Verification Gates Test Plan | ✅ COMPLETE | c7ee2a4a (1072 lines) |

**Phase 1 Evidence:**
- 📁 Location: `docs/products/dental/`
- 📊 Total Lines: 2,365+ lines of architecture specification
- 🎯 Scope: 5 Product tables, 8 Kernel Contracts, 7 RLS policies, 27 indexes
- 🔒 Architecture Proof: Zero Kernel modifications required

### Dental Phase 1 — Key Metrics

```
Product Tables:      7 (dental_*)
Kernel Contracts:    8 (Person, Encounter, Clinical, CDS, Temporal, Governance, Audit, Finance)
Foreign Keys:        11 references to Kernel (hc_persons, hc_encounters)
RLS Policies:        7 (tenant isolation on all tables)
Performance Indexes: 27 (optimized query patterns)
Verification Gates:  11 (8 blocking, 3 warning)
Kernel Changes:      0 ✅
```

### Dental Phase 2 — Contracts Implementation (PENDING REVIEW)

**Status:** ⏸️ **NOT STARTED** — Awaiting Architecture Review of Phase 1

**Requirements before Phase 2:**
1. ✅ Phase 1 documents complete (5/5)
2. ⏳ Human Architect review of:
   - Contract Dependency Map (8 contracts)
   - Database Migration Plan (7 tables, RLS, indexes)
   - 11 Verification Gates specifications
3. ⏳ Architecture approval gate
4. ⏳ Phase 1 → Phase 2 authorization

**Phase 2 Scope (when authorized):**
- Implement 8 Public Contracts (TypeScript interfaces)
- Mock Kernel for Contract testing
- Gate 2 verification (Contract Boundary Test)
- No Product code yet (Phase 3 only)

### Dental — Governance

| Document | Purpose |
|---|---|
| [`docs/products/dental/PRODUCT_MANIFEST.md`](../products/dental/PRODUCT_MANIFEST.md) | Scope, features, user stories, metrics |
| [`docs/products/dental/OWNERSHIP_MAP.md`](../products/dental/OWNERSHIP_MAP.md) | Data ownership boundaries |
| [`docs/products/dental/CONTRACT_DEPENDENCY_MAP.md`](../products/dental/CONTRACT_DEPENDENCY_MAP.md) | Product → Contract → Kernel mappings |
| [`docs/products/dental/DB_MIGRATION_PLAN.md`](../products/dental/DB_MIGRATION_PLAN.md) | 7 tables, RLS, indexes (additive only) |
| [`docs/products/dental/VERIFICATION_GATES_TEST_PLAN.md`](../products/dental/VERIFICATION_GATES_TEST_PLAN.md) | 11 automated verification gates |

### Dental — Next Action (HUMAN DECISION REQUIRED)

```
🔒 DENTAL PHASE 1 LOCKED

Next Action: HUMAN ARCHITECT REVIEW

Review Checklist:
┌─────────────────────────────────────────────────────────┐
│ □ Contract Dependency Map correctness                   │
│ □ Database schema additive-only compliance              │
│ □ RLS policies sufficient for tenant isolation          │
│ □ Verification gates comprehensive                      │
│ □ Zero Kernel modification proof validated              │
│ □ No architectural gaps detected                        │
└─────────────────────────────────────────────────────────┘

If APPROVED → Authorize Phase 2 (Contracts Implementation)
If FEEDBACK → Address issues, update Phase 1 docs
If REJECTED → Document architectural gaps, reassess scope
```

---

## 💰 FINANCE OS

```
FINANCE OS — F1–F5
────────────────────────────────────────────────────────────
F1 Ledger:        ✅ FROZEN
F2 Cash:          ✅ FROZEN
F3 AR:            ✅ FROZEN
F4 AP:            ✅ FROZEN
F5.0–F5.5:        ✅ FROZEN (16/36 gates verified — 44.4%)
F5.6 Cash:        🟢 COMPLETE / VERIFIED / PUSHED
F5.6 PP Map:      🟢 CONFIGURABLE / VERIFIED
F5.6 PP Runner:   🟡 BLOCKED — position contract required
F5.7–F5.8:        ⏳ LOCKED (dependency chain)
F5 Full Freeze:   ⏳ When 36/36 gates verified
```

### Finance Modules

| Module | Code Path | Tests | Status |
|---|---|---|---|
| **F1** Ledger Engine | `src/platform/finance/engines/ledger-engine/` | `finance-f1-ledger-verification.test.ts` | ✅ FROZEN |
| **F2** Cash Engine | `src/platform/finance/engines/cash-engine/` | `finance-f2-*.test.ts` (5 files) | ✅ FROZEN |
| **F3** Accounts Receivable | (contracts) | `f3-proof-runner.test.ts`, `finance-f3-*.test.ts` | ✅ FROZEN |
| **F4** Accounts Payable | (contracts) | `f4-proof-runner.test.ts` | ✅ FROZEN |
| **F5.0** Constitution | SQL functions | — | 🔒 FROZEN |
| **F5.1** AP Schema | SQL functions | `f5-reconciliation.integration.test.ts` (8 PASS) | 🔒 FROZEN |
| **F5.2** AP_GL_BALANCE | SQL functions | included in F5.1 suite | 🔒 FROZEN |
| **F5.3** Variance Engine | SQL functions | included in F5.1 suite | 🔒 FROZEN |
| **F5.4** AP Hardening | SQL functions | adversarial tests | 🔒 FROZEN |
| **F5.5** AR_GL_BALANCE | SQL functions | `f5-ar-reconciliation.test.ts` (8 PASS) | 🔒 FROZEN |
| **F5.6-A** Cash GL Balance | e5833b96 | f5-cash-reconciliation.test.ts (7 PASS) | 🟢 COMPLETE / VERIFIED / PUSHED |
| **F5.6-B1** Prepayment GL Map | `20260824073000` + `20260824074000` | `finance-f4-prepayment-gl-map-contract.test.ts` (6 PASS) | 🟢 CONFIGURABLE / VERIFIED |
| **F5.6-B2** Prepayment Position + GL Balance | F4 position + GL map contracts | 30/30 boundary PASS | 🟢 VERIFIED |

### Finance — Test Evidence (F5)

```
Total F5 Tests:   16/16 PASS ✅
AP Domain:        8/8  PASS (proof-g1 through proof-g8)
AR Domain:        8/8  PASS (proof-ar-g1 through proof-ar-g8)
Constitutional:   16/36 gates verified (44.4%)
```

### Finance — Migrations (Frozen, DO NOT ROLLBACK)

```
20260817000000_f5_foundation.sql
20260818000000_f5_ap_reconstruction.sql
20260819000000_f5_ap_reconciliation.sql
20260819010000_f3_ar_facts_contract.sql
20260819020000_f5_ar_reconstruction.sql
20260822000000_f5_test_cleanup_rpc.sql
20260823010000_f5_ar_reconciliation_fix.sql
```

### Finance — F5.6 Status / Prepayment Gate

> **Status:** 🟢 VERIFIED — Position contract and runner implemented through approved contracts

Current verified contracts:
1. F2 Cash Contract Specification (`finance_cash_facts_as_of()`)
2. F4 Prepayment Contract Specification (`finance_prepayment_facts_as_of()`)
3. GL Account Mapping (Cash via F2 map; Prepayment via tenant-configured `F4_PREPAYMENT_GL_MAP:v1`)
4. F4 Prepayment Position (`finance_prepayment_position_as_of()` / `F4_PREPAYMENT_POSITION:v1`)
5. Temporal Semantics (temporal column cho F2 cash movements)

Runtime boundary:

- `PREPAYMENT_GL_BALANCE` runner consumes `F4_PREPAYMENT_POSITION:v1` + `F4_PREPAYMENT_GL_MAP:v1`; không đọc trực tiếp `finance_vendor_prepayments`.
- Missing `PREPAYMENT_CONTROL` config produces `QUARANTINED` evidence, with no fallback to `331P`/`242`.
- Official test/pre-production DB còn 17 legacy/orphan prepayment facts thiếu POSTED F1 transaction authority; position contract sẽ raise `F4_PREPAYMENT_POSITION_CURRENCY_AUTHORITY_MISSING` cho affected tenant/as-of thay vì infer currency.

> Ref: [`docs/architecture/F5_CHECKPOINT_2026_08_23.md`](docs/architecture/F5_CHECKPOINT_2026_08_23.md)  
> Checklist: [`docs/architecture/F5_6_CASH_PREPAYMENT_CHECKLIST.md`](docs/architecture/F5_6_CASH_PREPAYMENT_CHECKLIST.md)

### Finance — Governance Links

- Constitution: [`docs/architecture/FINANCE_OS_ARCHITECTURE_CONSTITUTION.md`](docs/architecture/FINANCE_OS_ARCHITECTURE_CONSTITUTION.md)
- Pre-coding Gate: [`docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md`](docs/architecture/F5_PRE_CODING_GATE_PROTOCOL.md)
- Checkpoint: [`docs/architecture/F5_CHECKPOINT_2026_08_23.md`](docs/architecture/F5_CHECKPOINT_2026_08_23.md)
- F1 Freeze: [`docs/governance/F1_LEDGER_FREEZE.md`](docs/governance/F1_LEDGER_FREEZE.md)

---

## 📦 LOGISTICS OS

```
LOGISTICS OS — E7.1 / E7.2 / E7.3
────────────────────────────────────────────────────────────
E7.1 Domain Kernel:      🔒 SEALED  — 12 artifacts, 366 tests
E7.2 Operational Kernel: 🔒 SEALED  —  4 artifacts,  73 tests
E7.3 Rules & Tracea.:    🔒 SEALED  —  9 artifacts, 108 tests
─────────────────────────────────────────────────
Total Frozen:            25 artifacts, 547/547 tests
Freeze Policy:           5-layer enforcement active
```

### Logistics — Kernel Layers

| Layer | Artifacts | Tests | Freeze Date | Status |
|---|---|---|---|---|
| E7.1 Domain Kernel | 12 | 366 | 2024-01-15 | 🔒 SEALED |
| E7.2 Operational Kernel | 4 | 73 | 2024-02-01 | 🔒 SEALED |
| E7.3 Rules & Traceability | 9 | 108 | 2026-08-22 | 🔒 SEALED |

### Logistics — Engines

| Engine | File | Size | Status |
|---|---|---|---|
| Freight Audit Engine | `src/platform/logistics/engines/freight-audit-engine.ts` | 79KB | ✅ |
| Route Engine | `src/platform/logistics/engines/route-engine.ts` | 45KB | ✅ |
| Shipment Engine | `src/platform/logistics/engines/shipment-engine.ts` | 44KB | ✅ |

### Logistics — 5-Layer Enforcement

```
Layer 1: Architecture Guard Script    → scripts/architecture/architecture-guard.ts
Layer 2: Pre-Tool-Use Hook            → .kiro/hooks/architecture-guard.json
Layer 3: Git Pre-Commit Hook          → .husky/pre-commit (TODO: implement)
Layer 4: CI Architecture Gate         → .github/workflows/architecture-gate.yml (TODO)
Layer 5: Regression Test Suite        → npm test -- src/platform/logistics/domain
```

> **⚠️ Layer 3 & 4 còn TODO** — git hook và CI gate chưa được implement đầy đủ.

### Logistics — To Modify (ACR Required)

```
1. Tạo ACR → docs/architecture/templates/ACR_TEMPLATE.md
2. Human Architect Review
3. ADR: docs/architecture/decisions/ADR-XXXX-*.md
4. Unlock manifest
5. Implement + 547/547 tests PASS
6. Re-seal
```

> Ref: [`docs/architecture/FREEZE_POLICY.md`](docs/architecture/FREEZE_POLICY.md)

---

## 🎓 EDUCATION OS

```
EDUCATION OS
────────────────────────────────────────────────────────────
Status:     🟡 ACTIVE DEVELOPMENT
Constitution: docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md
```

### Education — Modules

| Module | Path | Status |
|---|---|---|
| Assessment | `src/platform/education/assessment/` | 🟡 |
| Attendance | `src/platform/education/attendance/` | 🟡 |
| Course | `src/platform/education/course/` | 🟡 |
| Enrollment | `src/platform/education/enrollment/` | 🟡 |
| Student | `src/platform/education/student/` | 🟡 |
| Education Engine | `education-engine.service.ts` | 🟡 |

> Education OS đang active development — chưa có freeze milestone.

---

## 🏢 REAL ESTATE OS

```
REAL ESTATE OS
────────────────────────────────────────────────────────────
Status:     🟢 IMPLEMENTED
```

| Component | Path | Status |
|---|---|---|
| Domain | `src/platform/real-estate/domain/` | ✅ |
| Engines | `src/platform/real-estate/engines/` | ✅ |
| Contracts | `src/platform/real-estate/contracts/` | ✅ |
| Repositories | `src/platform/real-estate/repositories/` | ✅ |

---

## 📚 DOCUMENTATION CONTROL PLANE

```
DOCUMENTATION CONTROL PLANE — Phase 1–3 COMPLETE (2026-08-23)
────────────────────────────────────────────────────────────
Phase 1: Navigation Layer        ✅ COMPLETE
Phase 2: YAML Tier Classification ✅ COMPLETE
Phase 3: Root Reorganization     ✅ COMPLETE
Routine: CURRENT_STATE.md update ✅ ACTIVE
```

| Component | File | Status |
|---|---|---|
| Single Entry Point | `BELLA_SYSTEM_INDEX.md` | ✅ ACTIVE |
| Architecture Dashboard | `docs/CURRENT_STATE.md` (file này) | ✅ ACTIVE |
| Document Registry | `docs/DOCUMENT_REGISTRY.md` | ✅ ACTIVE |
| Operational Archive | `docs/archive/operational/` | ✅ 56 files archived |

### Tier Tagging Progress

| Tier | Files Tagged | Total Key Docs | Coverage |
|---|---|---|---|
| Tier 1 MAP | 3 | 10 | 30% |
| Tier 2 GOVERNANCE | 4 | 17 | 24% |
| Tier 3 SPECIFICATION | 0 | 23 | 0% |
| Tier 4 EVIDENCE | 0 | 14 | — |

> Remaining tagging: thêm frontmatter cho Tier 2–3 còn lại trong các sprint tiếp theo.

---

## 📊 ARCHITECTURE COMPLIANCE SUMMARY

```
┌──────────────────────────────────────────────────────────────────┐
│  BELLA PLATFORM — ARCHITECTURE STATUS (2026-08-27 14:09 ICT)     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Platform Core     ✅ OPERATIONAL                                │
│                                                                  │
│  Healthcare OS     🔒 PARTIAL FREEZE  500/504 PASS                   │
│                    11 Exposed Active Engines                         │
│                    9 Implemented but Unexposed internal engines      │
│                    ⚠️ Imaging / Scheduling ADR Pending (ADR-016/017)  │
│                                                                  │
│  Healthcare Verticals                                            │
│    → Bella Dental  🔒 PHASE 1 COMPLETE (5/5 docs, 2365+ lines)  │
│                    ⏸️ PHASE 2 PENDING REVIEW                     │
│                                                                  │
│  Finance OS        🟡 IN PROGRESS                               │
│                    F1–F4 + F5.0–F5.5 ✅ FROZEN                  │
│                    F5.6 Cash 🟢 DONE; Prepayment 🟡 GATED        │
│                    F5.7–F5.8 ⏳ LOCKED                          │
│                                                                  │
│  Logistics OS      🔒 SEALED      547/547 tests                  │
│                    ⚠️ Layer 3 (git hook) + Layer 4 (CI) TODO    │
│                                                                  │
│  Education OS      🟡 ACTIVE DEVELOPMENT                        │
│                                                                  │
│  Real Estate OS    🟢 IMPLEMENTED                               │
│                                                                  │
│  Doc Control Plane ✅ OPERATIONAL (Phase 1–3 complete)           │
│                    Root: 7 files (clean) | Archive: 56 files     │
│                    Tier tagging: 7 docs tagged                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  ACTIONS REQUIRED                                                │
│                                                                  │
│  🟢 VERIFIED: F5.6 Prepayment runner via approved contracts     │
│  🟡 REVIEW:   Dental Phase 1 — Human Architect approval gate    │
│  ⚠️ TODO:     Logistics Layer 3 (git hook) implementation       │
│  ⚠️ TODO:     Logistics Layer 4 (CI gate) implementation        │
│  ⚠️ ADR:      Healthcare ADR-016 / ADR-017 Sign-off             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚨 KNOWN DRIFT REGISTER

| ID | Component | Specification | Current State | Risk | Owner |
|---|---|---|---|---|---|
| DRIFT-001 | Logistics — Layer 3 | Git pre-commit hook active | TODO (not implemented) | Medium | Platform Team |
| DRIFT-002 | Logistics — Layer 4 | CI architecture gate active | TODO (not implemented) | Medium | Platform Team |
| DRIFT-003 | Healthcare — Imaging | Active exposed Kernel engine | ADR Pending (Product layer only) | Low | HC Team |
| DRIFT-004 | Healthcare — Scheduling | Active exposed Kernel engine | ADR Pending (Product layer only) | Low | HC Team |
| DRIFT-005 | Finance F5 | 36/36 gates verified | 16/36 verified (44.4%) | Medium | Finance Team |

> ⚠️ Drift register là **tự khai báo** — cần được verify định kỳ với codebase thực tế.

---

## 📁 CURRENT CODEBASE STRUCTURE (Top-level)

```
src/platform/
├── healthcare/        ← Healthcare OS (PARTIAL FREEZE)
│   ├── engines/       ← ~20 implemented + 7 placeholders
│   └── __tests__/     ← 17 integration test files
├── finance/           ← F1–F5 Finance OS
│   ├── engines/       ← ledger-engine/, cash-engine/
│   └── __tests__/     ← 13 test files
├── logistics/         ← E7.1–E7.3 (SEALED)
│   ├── engines/       ← 3 engine files
│   └── domain/
├── education/         ← Education OS (active dev)
├── real-estate/       ← Real Estate OS (implemented)
├── accounting/        ← Accounting layer
├── ai-orchestrator/   ← AI/Intelligence layer
├── integration-runtime/
├── notification-hub/
├── policy-engine/
└── [40+ other modules]
```

---

## 🔧 VERIFICATION COMMANDS

```bash
# Healthcare Kernel regression
npm run healthcare:verify
# OR:
npx jest src/platform/healthcare/ --runInBand

# Logistics Kernel regression
npm run logistics:verify
# OR:
npm test -- src/platform/logistics/domain

# Finance tests
npx jest src/platform/finance/__tests__/ --runInBand

# Architecture guard (Logistics)
npm run arch:guard
npm run arch:guard:verbose
```

---

## 📎 QUICK LINKS

| Need | Link |
|---|---|
| Single entry point | [`BELLA_SYSTEM_INDEX.md`](../BELLA_SYSTEM_INDEX.md) |
| Document catalog | [`docs/DOCUMENT_REGISTRY.md`](DOCUMENT_REGISTRY.md) |
| Healthcare Constitution | [`docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`](architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md) |
| Finance F5 Checkpoint | [`docs/architecture/F5_CHECKPOINT_2026_08_23.md`](architecture/F5_CHECKPOINT_2026_08_23.md) |
| Freeze Policy | [`docs/architecture/FREEZE_POLICY.md`](architecture/FREEZE_POLICY.md) |
| Agent Rules | [`AGENTS.md`](../AGENTS.md) |
| Deployment | [`docs/BDGF_PRODUCTION_DEPLOYMENT_GUIDE.md`](BDGF_PRODUCTION_DEPLOYMENT_GUIDE.md) |
| Operational Archive | [`docs/archive/operational/`](archive/operational/) |

---

## 📅 CHANGE LOG

| Date | Milestone | Changed By |
|---|---|---|
| 2026-08-23 21:30 ICT | Bella Dental Phase 1 COMPLETE (5/5 documents, 2365+ lines) | AI Agent + Architecture Team |
| 2026-08-23 20:15 ICT | Documentation Control Plane Phase 1–3 complete | AI Agent |
| 2026-08-23 | F5.5 AR_GL_BALANCE FROZEN (8/8 tests PASS) | Architecture Review |
| 2026-08-22 | E7.3 Logistics SEALED (108 tests) | Architecture Review |
| 2026-08-17 | H1.2 PROVEN FROZEN (14/14 tests) | Architecture Review |

---

*File này phản ánh trạng thái thực tế được xác minh từ codebase tại 2026-08-23.*  
*Cập nhật file này sau mỗi milestone kiến trúc quan trọng.*  
*Nếu file này lỗi thời so với code → đó là architecture drift cần báo cáo.*
