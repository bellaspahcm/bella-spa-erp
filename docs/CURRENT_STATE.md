---
tier: MAP
domain: platform
status: ACTIVE
last_verified: "2026-10-07"
description: "Dashboard trạng thái thực tế của Bella — Kernel-level granularity"
maintainer: "Platform Architecture Team"
update_trigger: "Sau mỗi architecture milestone"
---

# BELLA PLATFORM — CURRENT STATE
### Trạng thái kiến trúc thực tế (không phải kế hoạch)

> **Last Verified:** 2026-10-07 18:10 ICT
> **Source of Truth:** Code + DB migrations + committed evidence docs + targeted test results
> **⚠️ Nguyên tắc:** File này phản ánh thực tế codebase, không phải tài liệu mong muốn.
> Mọi mục có dấu `?` hoặc `⚠️` là **chưa được xác minh tự động** và cần kiểm tra lại.

> **2026-10-07 audit boundary:** The product identity map was refreshed from source/doc evidence. English Center is the targeted exception in this update: HQ runtime proof was executed and sealed at commit `7004f8349`. Whole-repo CI, production deployment checks, and unrelated product gates were not rerun by this file update.

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

## 🧭 PRODUCT IDENTITY RUNTIME — CURRENT CANONICAL MAP

```
Canonical Product Identity Contract
────────────────────────────────────────────────────────────
tenant.product_key
  → src/platform/registry/product-registry.ts
  → ProductResolver
  → UserProvider.product / PWA / dashboard consumers
```

`enabled_modules` is capability entitlement only. It is not canonical Product Identity.

### Canonical Product Registry

| Product key | Display name | Required module(s) | Default route | Current evidence status |
|---|---|---|---|---|
| `bella_spa` | Bella Beauty Spa v2 | `beauty_spa` | `/dashboard/beauty-spa-v2` | Registered runtime identity. Multiple bounded Beauty V2 proofs exist, but full customer-chain/go-live readiness must not be claimed without fresh targeted evidence. |
| `bella_babycare` | Bella Mommy Baby Care | `babycare` | `/dashboard` | Registered runtime identity. 2026-10-06 BabyCare post-repair audit is PASS for customer/booking/calendar mapping scope only. |
| `bella_haircut` | Bella Haircut Shop | `beauty_spa` | `/dashboard` | Registered runtime identity. Haircut chain seal is SEALED; focused Real DB integration boundary set is PROVEN. Production go-live status is not changed by that evidence. |
| `bella_nail` | Bella Nail Shop | `beauty_spa` | `/dashboard/nail` | Registered runtime identity. Nail chain seal is SEALED by product-specific Real DB proof. Payroll/finance/go-live remain separate scopes. |
| `bella_preschool` | Bella Preschool | `bella_education` | `/dashboard/education` | Registered runtime identity. Preschool Chain Real DB proof is sealed in current evidence history; broader Education architecture debt remains separate. |
| `bella_english_center` | Bella English Center | `bella_education` | `/dashboard/english-center` | ✅ GO-LIVE READY for current canonical boundary: identity, operational chain, Real DB, browser E2E, HQ onboarding, HQ runtime create flow, HQ → branch → product, and tuition finance contract proven. Evidence commit: `7004f8349`. |

### Product / Vertical Surfaces Not In ProductRegistry

These areas have code, routes, manifests, or vertical services, but are not canonical `tenant.product_key` products in the current `ProductRegistry` audit:

| Surface | Code / route evidence | Current classification |
|---|---|---|
| Bella Medical Clinic | `src/products/bella-medical`, `/dashboard/medical` | Healthcare product vertical surface. Not registered as canonical Product Identity in `ProductRegistry`. |
| Bella Dental Clinic | `src/products/bella-dental`, `/dashboard/dental` | Healthcare product vertical surface. Historical docs say Phase 1 architecture completed / Phase 2 pending review; not registered as canonical Product Identity. |
| Bella Hospital | `src/products/bella-hospital`, `/dashboard/hospital` | Healthcare product vertical surface. Not registered as canonical Product Identity. |
| Bella Land / Real Estate | `src/products/bella-land`, `/dashboard/real-estate` | Real Estate product/vertical surface with evidence docs, but not registered as canonical Product Identity. |
| Bella Auto | `/dashboard/bella-auto`, `bella_auto` module routing | Module/route surface. Not registered as canonical Product Identity. |

### HQ Onboarding Product Selection

Current HQ registration UI and server action support product setup for:

```text
bella_spa
bella_haircut
bella_nail
bella_babycare
bella_preschool
bella_english_center
```

`bella_english_center` is registered in `ProductRegistry` and exposed in HQ tenant registration selection/onboarding product map. Focused HQ runtime proof at commit `7004f8349` verifies HQ login → English Center selection → tenant creation → `tenant.product_key = bella_english_center` → default branch → English admin branch access.

---

## 🏥 HEALTHCARE OS

```
HEALTHCARE OS KERNEL — H1–H12
────────────────────────────────────────────────────────────
Status:        🔒 FROZEN (Kernel Candidate Freeze)
Constitution:  docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md
Test Suite:    52/52 Suites (17 integration test files verified)
Last Verified: 2026-08-17 (H1.2 PROVEN FROZEN)
Compliance:    20 Laws mandatory
```

### Healthcare Engines (Kernel H1–H12)

| Engine | Code Path | Freeze Status | Tests |
|---|---|---|---|
| MPI Engine (H1 — Person/Identity) | `engines/mpi-engine/` | 🔒 FROZEN | ✅ H1.2 14/14 PASS |
| Encounter Engine (H2) | `engines/encounter-engine/` | 🔒 FROZEN | ✅ |
| Clinical Engine (H3) | `engines/clinical-engine/` | 🔒 FROZEN | ✅ |
| Order Engine (H4) | `engines/order-engine/` | 🔒 FROZEN | ✅ |
| Pharmacy Engine (H5) | `engines/pharmacy-engine/` | 🔒 FROZEN | ✅ |
| Laboratory Engine (H6) | `engines/laboratory-engine/` | 🔒 FROZEN | ✅ |
| Imaging Engine (H7) | `engines/imaging-engine/` | 🔒 FROZEN | ⚠️ unverified |
| CDS Engine (H8) | `engines/cds-engine/` | 🔒 FROZEN | ✅ |
| Temporal Engine (H9) | `engines/temporal-engine/` | 🔒 FROZEN | ✅ |
| Rule Engine (H10) | `engines/rule-engine/` | 🔒 FROZEN | ✅ |
| Audit Compliance (H11) | `engines/audit-compliance-engine/` | 🔒 FROZEN | ✅ |
| Scheduling Engine (H12) | `engines/scheduling-engine/` | 🔒 FROZEN | ⚠️ unverified |

> All engines under: `src/platform/healthcare/engines/`

### Healthcare — Additional Engines (Extended)

> Healthcare platform có 27 engine directories, gồm cả specialty engines:

| Engine | Path | Status |
|---|---|---|
| Admission Engine | `engines/admission-engine/` | ✅ |
| Anesthesia Engine | `engines/anesthesia-engine/` | ✅ |
| Bed Engine | `engines/bed-engine/` | ✅ |
| Billing Engine | `engines/billing-engine/` | ✅ |
| Blood Bank Engine | `engines/blood-bank-engine/` | ✅ |
| CSSD Engine | `engines/cssd-engine/` | ✅ |
| Emergency Engine | `engines/emergency-engine/` | ✅ |
| ICU Engine | `engines/icu-engine/` | ✅ |
| Insurance Engine | `engines/insurance-engine/` | ✅ |
| Nursing Engine | `engines/nursing-engine/` | ✅ |
| OR Engine | `engines/or-engine/` | ✅ |
| OR Readiness Engine | `engines/or-readiness-engine/` | ✅ |
| PACU Engine | `engines/pacu-engine/` | ✅ |
| Queue Engine | `engines/queue-engine/` | ✅ |
| Surgical Engine | `engines/surgical-engine/` | ✅ |

### Healthcare — Test Evidence

| Test File | Coverage | Status |
|---|---|---|
| `audit-compliance.integration.test.ts` | H11 | ✅ |
| `blood-bank-engine.integration.test.ts` | Blood Bank | ✅ |
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

### Healthcare — Known Gaps / Drift

```
⚠️ UNVERIFIED: imaging-engine, scheduling-engine — test coverage not confirmed
⚠️ H1.2: Frozen 2026-08-17. H1.3 Performance Optimization is UNLOCKED for planning.
```

### Healthcare — Governance Links

- Constitution: [`docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`](docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md)
- H1.2 Freeze: [`docs/architecture/H1_2_PROVEN_FROZEN.md`](docs/architecture/H1_2_PROVEN_FROZEN.md)
- Architecture Review: [`docs/architecture/H1_2_ARCHITECTURE_REVIEW.md`](docs/architecture/H1_2_ARCHITECTURE_REVIEW.md)

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
F5.6 Cash+Prep:   🔴 BLOCKED — awaiting Human Architect semantic spec
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
| **F5.6** Cash+Prepayment | — | — | 🔴 BLOCKED |

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

### Finance — F5.6 Blocker (Action Required)

> **Status:** 🔴 BLOCKED — Human Architect action required

Human Architect cần cung cấp:
1. F2 Cash Contract Specification (`finance_cash_facts_as_of()`)
2. F4 Prepayment Contract Specification (`finance_prepayment_facts_as_of()`)
3. GL Account Mapping (Cash: acc 111?, Prepayment: acc 331PP/234/132?)
4. Reconstruction Formulas (inflow/outflow semantics)
5. Temporal Semantics (temporal column cho F2 cash movements)

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

### Education Product — Bella English Center

```
BELLA ENGLISH CENTER
────────────────────────────────────────────────────────────
Canonical Product:       bella_english_center
Product Identity:        ✅ PROVEN
Operational Chain:       ✅ PROVEN
Real Database:           ✅ PASS
Browser E2E:             ✅ PROVEN
Tenant Isolation:        ✅ PROVEN for tested boundary
HQ Onboarding Code:      ✅ PROVEN
HQ Runtime Create Flow:  ✅ PROVEN
HQ → Branch → Product:   ✅ PROVEN
Finance Tuition:         ✅ PASS for current tuition contract
Overall:                 ✅ GO-LIVE READY
Last Verified:           2026-10-07
Evidence Commit:         7004f8349
```

#### English Center — Current Evidence

| Boundary | Status | Evidence |
|---|---|---|
| Product registry/resolver | ✅ PROVEN | Focused registry/resolver tests: 73/73 |
| Operational chain | ✅ PROVEN | English Center post-RC chain evidence baseline |
| Real DB | ✅ PASS | `test:english-center-post-rc-real-db` |
| Browser E2E | ✅ PROVEN | English Center post-RC browser validation: 2/2 |
| HQ onboarding code | ✅ PROVEN | `onboarding.test.ts`: 11/11 |
| HQ runtime create flow | ✅ PROVEN | `e2e/tests/32-english-center-hq-runtime.spec.ts`: 1/1 |
| HQ → Branch → Product | ✅ PROVEN | HQ creates English tenant, `product_key=bella_english_center`, default `org_units` branch, admin `user_org_unit_access`, command-center HTTP 200 |
| Finance tuition contract | ✅ PASS | Tuition billing contract test: 8/8 |

#### English Center — Non-Claims

```
Legal Accounting: NOT_REQUIRED / no blocker identified for current tuition contract
Backup / Restore: NOT English-specific blocker identified
Healthcare / Logistics Kernel: NOT TOUCHED
```

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
│  BELLA PLATFORM — ARCHITECTURE STATUS (2026-10-07 18:10 ICT)     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Platform Core     ✅ OPERATIONAL                                │
│                                                                  │
│  Product Identity  ✅ 6 canonical registry products              │
│                    ✅ English Center HQ onboarding/runtime proven │
│                    ⚠️ Medical/Dental/Hospital/Land/Auto are      │
│                    code/route surfaces, not ProductRegistry keys │
│                                                                  │
│  Healthcare OS     🔒 FROZEN      52/52 Suites GREEN             │
│                    H1–H12 all engines present                    │
│                    ⚠️ imaging + scheduling coverage unverified   │
│                                                                  │
│  Healthcare Verticals                                            │
│    → Bella Dental  🔒 PHASE 1 COMPLETE (5/5 docs, 2365+ lines)  │
│                    ⏸️ PHASE 2 PENDING REVIEW                     │
│                                                                  │
│  Finance OS        🟡 IN PROGRESS                               │
│                    F1–F4 + F5.0–F5.5 ✅ FROZEN                  │
│                    F5.6 🔴 BLOCKED (semantic spec needed)        │
│                    F5.7–F5.8 ⏳ LOCKED                          │
│                                                                  │
│  Logistics OS      🔒 SEALED      547/547 tests                  │
│                    ⚠️ Layer 3 (git hook) + Layer 4 (CI) TODO    │
│                                                                  │
│  Education OS      🟡 ACTIVE DEVELOPMENT                        │
│    → English Center ✅ GO-LIVE READY                             │
│                    Identity/Chain/Real DB/Browser/HQ runtime     │
│                    proven at commit 7004f8349                    │
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
│  ⚠️ VERIFY:   Fresh product gates before claiming current green  │
│  ⚠️ CLASSIFY: Vertical surfaces vs canonical product identities │
│  🔴 BLOCKED:  F5.6 — Human Architect provides semantic spec     │
│  🟡 REVIEW:   Dental Phase 1 — Human Architect approval gate    │
│  ⚠️ TODO:     Logistics Layer 3 (git hook) implementation       │
│  ⚠️ TODO:     Logistics Layer 4 (CI gate) implementation        │
│  ⚠️ VERIFY:   Healthcare imaging-engine, scheduling-engine test  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚨 KNOWN DRIFT REGISTER

| ID | Component | Specification | Current State | Risk | Owner |
|---|---|---|---|---|---|
| DRIFT-001 | Logistics — Layer 3 | Git pre-commit hook active | TODO (not implemented) | Medium | Platform Team |
| DRIFT-002 | Logistics — Layer 4 | CI architecture gate active | TODO (not implemented) | Medium | Platform Team |
| DRIFT-003 | Healthcare — Imaging | Coverage confirmed | Unverified | Low | HC Team |
| DRIFT-004 | Healthcare — Scheduling | Coverage confirmed | Unverified | Low | HC Team |
| DRIFT-005 | Finance F5 | 36/36 gates verified | 16/36 verified (44.4%) | Medium | Finance Team |
| DRIFT-006 | Product identity vs vertical surfaces | Every runtime product should resolve through `tenant.product_key -> ProductRegistry` | Medical, Dental, Hospital, Land, Auto have routes/code surfaces but no ProductRegistry key | Medium | Platform/Product Architecture |
| DRIFT-008 | Current verification artifact | Current dashboard should not imply fresh whole-repo green | Existing `test-results.json` is old and failed: 318 suites, 303 passed, 7 failed, 3 runtime-error, 8 pending; fresh gates not run for 2026-10-07 doc update | Medium | Platform QA |

> ⚠️ Drift register là **tự khai báo** — cần được verify định kỳ với codebase thực tế.

---

## 📁 CURRENT CODEBASE STRUCTURE (Top-level)

```
src/platform/
├── healthcare/        ← H1–H12 Kernel (FROZEN)
│   ├── engines/       ← 27 engine directories
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

src/products/
├── beauty-spa-v2/        ← Canonical key: bella_spa
├── nail/                 ← Canonical key: bella_nail
├── bella-education/      ← Canonical key: bella_preschool uses /dashboard/education
├── bella-english-center/ ← Canonical key: bella_english_center
├── bella-medical/        ← Vertical surface; not ProductRegistry key
├── bella-dental/         ← Vertical surface; not ProductRegistry key
├── bella-hospital/       ← Vertical surface; not ProductRegistry key
└── bella-land/           ← Vertical surface; not ProductRegistry key
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
| 2026-10-07 18:10 ICT | English Center HQ runtime proof sealed: HQ creates English tenant, product_key, branch, admin access, and command-center runtime; current state updated to GO-LIVE READY for current canonical boundary | AI Agent |
| 2026-10-07 00:00 ICT | Read-only product identity/runtime state refresh: 6 canonical ProductRegistry products; vertical surface drift and English Center onboarding drift recorded; no fresh runtime gates executed | AI Agent |
| 2026-08-23 21:30 ICT | Bella Dental Phase 1 COMPLETE (5/5 documents, 2365+ lines) | AI Agent + Architecture Team |
| 2026-08-23 20:15 ICT | Documentation Control Plane Phase 1–3 complete | AI Agent |
| 2026-08-23 | F5.5 AR_GL_BALANCE FROZEN (8/8 tests PASS) | Architecture Review |
| 2026-08-22 | E7.3 Logistics SEALED (108 tests) | Architecture Review |
| 2026-08-17 | H1.2 PROVEN FROZEN (14/14 tests) | Architecture Review |

---

*File này phản ánh trạng thái thực tế được xác minh từ codebase tại 2026-10-07; English Center has targeted runtime proof at commit `7004f8349`.*
*Cập nhật file này sau mỗi milestone kiến trúc quan trọng.*  
*Nếu file này lỗi thời so với code → đó là architecture drift cần báo cáo.*
