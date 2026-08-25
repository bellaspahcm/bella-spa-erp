# BELLA — SYSTEM ARCHITECTURE TREE
**Phân tích codebase thực tế — 24/08/2026**  
**Nguồn:** Khám phá trực tiếp `src/`, `supabase/migrations/`, `src/app/`

---

## LAYER 0 — PROJECT ROOT

```
BELLA SPA ERP/
├── src/                          ← Application source code
├── supabase/migrations/          ← 432 SQL migration files (20260511→20260824)
├── apps/                         ← Multi-app workspace
├── packages/                     ← Shared packages
├── docs/                         ← Architecture & governance docs
├── scripts/                      ← Forensic, deployment, audit scripts
├── load-tests/                   ← k6 performance benchmarks
├── e2e/                          ← Playwright E2E tests
├── tests/                        ← Additional test suites
├── evidence/                     ← Architecture evidence logs
├── evidence-logs/
├── monitoring/                   ← Observability configs
├── openapi/                      ← API specs
├── postman/                      ← API collections
├── mcp-server/                   ← MCP server integration
├── database/                     ← DB helpers
├── .bdgf/                        ← BDGF Gate Framework config
├── .git-hooks/                   ← Architecture Guard git hooks
├── .github/                      ← CI/CD workflows
└── [config files]                ← next.config.ts, jest, playwright, vercel...
```

---

## LAYER 1 — APPLICATION LAYER (`src/app/`)

### 1.1 Frontend Routes (Next.js App Router)

```
src/app/
├── layout.tsx                    ← Root layout
├── page.tsx                      ← Landing / home (58 KB)
├── globals.css                   ← Global styles (235 KB)
│
├── (auth)/                       ← Auth group
├── (dashboard)/                  ← Dashboard group
│
├── dashboard/                    ← Main dashboard (45 sub-routes)
│   ├── page.tsx                  ← Dashboard home (58 KB)
│   ├── layout.tsx
│   ├── accounting/
│   ├── admin/
│   ├── ai-copilot/               ← AI assistant UI
│   ├── ai-platform/
│   ├── analytics/
│   ├── architecture/             ← Architecture viewer UI
│   ├── audit/
│   ├── automation/
│   ├── bella-auto/               ← Auto vertical UI
│   ├── bookings/
│   ├── chat/
│   ├── crm/
│   ├── customer/ & customers/    ← Customer 360 UI
│   ├── customer-intelligence/
│   ├── data-platform/
│   ├── decision-engine/
│   ├── demo-receipt/
│   ├── dental/                   ← Dental clinic UI
│   ├── executive/                ← Executive dashboard
│   ├── finance/                  ← Finance OS UI
│   ├── forecast/
│   ├── guides/
│   ├── healthcare/               ← Healthcare kernel UI
│   ├── hospital/                 ← Hospital HIS UI
│   ├── hr/
│   ├── inventory/
│   ├── marketing/
│   ├── marketplace/
│   ├── medical/
│   ├── operations/
│   ├── organization/
│   ├── payroll/
│   ├── product-sales/
│   ├── real-estate/              ← Real estate vertical UI
│   ├── recommendations/
│   ├── rules/
│   ├── salary/
│   ├── services/
│   ├── sessions/
│   ├── settings/
│   ├── support/
│   ├── system-monitor/
│   ├── training/
│   └── waitlist/
│
├── admin/                        ← Admin panel
├── api/                          ← REST API routes (28 groups)
│   ├── auth/
│   ├── admin/
│   ├── bella-auto/
│   ├── bookings/
│   ├── cron/
│   ├── customers/
│   ├── decision-engine/
│   ├── debug-redis/
│   ├── finance/
│   ├── gate3/
│   ├── health/
│   ├── intelligence/
│   ├── inventory/
│   ├── metrics/
│   ├── packages/
│   ├── partner/
│   ├── payroll/
│   ├── rule-management/
│   ├── rules/
│   ├── tenant/
│   ├── test/ & test-upcoming/
│   ├── tts/
│   ├── users/
│   ├── v1/
│   ├── waitlist/
│   ├── webhooks/
│   └── workflows/
│
├── bella-auto/                   ← Bella Auto standalone app
├── beauty-spa/ & bellaspa/       ← Spa booking portal
├── book/                         ← Public booking flow
├── hq/                           ← HQ management portal
├── ktv/                          ← KTV mobile experience
├── partner/                      ← Partner portal
├── portal/                       ← Customer portal
├── student/                      ← Education student portal
└── workforce/                    ← Workforce portal
```

---

## LAYER 2 — PLATFORM CORE (`src/platform/`)

### 2.0 Platform Index

```
src/platform/                     ← 46 platform modules
├── bootstrap.ts                  ← Platform boot sequence
├── index.ts                      ← Platform public API (15 KB)
├── industry-registry.ts          ← Multi-industry registration
```

### 2.1 Host Runtime (`src/platform/host/`)

```
host/
├── event-bus/                    ← Domain Event Bus
│   ├── event-bus.service.ts
│   ├── memory-adapter.ts
│   ├── types.ts                  ← Event type contracts (7.6 KB)
│   ├── initialize.ts
│   └── wiring/                   ← Event wiring configurations
├── ai-runtime/                   ← AI runtime host
├── analytics-engine/             ← Analytics host
├── capability-registry/          ← Capability registration
├── contract-registry/            ← Contract registry
├── feature-flags/                ← Feature flag service
├── iam/                          ← Identity & Access Management
├── integration/                  ← Integration host
├── metadata/                     ← Metadata engine
├── notification/                 ← Notification host
├── person/                       ← Person/party entity
├── policy/                       ← Policy host
├── rollback-engine/              ← Rollback coordination
├── rule-engine/                  ← Rule evaluation engine
├── rule-governance/              ← Rule governance layer
├── temporal-engine/              ← Temporal state engine
└── workflow/                     ← Workflow engine
```

### 2.2 Platform Core (`src/platform/core/`)

```
core/
├── audit/                        ← Audit log primitives
├── contracts/                    ← Core contracts
├── errors/                       ← Error primitives
├── events/                       ← Domain event primitives
├── idempotency/                  ← Idempotency guards
├── repository/                   ← Repository pattern
└── tenant/                       ← Tenant isolation primitives
```

### 2.3 Security (`src/platform/security/`)

```
security/
├── audit-ledger.ts               ← Immutable audit log
├── kms-secret-manager.ts         ← KMS integration
└── telemetry-tracer.ts           ← Distributed tracing
```

---

## LAYER 3 — INDUSTRY KERNELS

### 3.1 Finance OS (`src/platform/finance/`) 🟢

```
finance/
├── engines/
│   ├── ledger-engine/            ← F1: Double-entry ledger kernel
│   └── cash-engine/              ← F2: Cash temporal contract engine
├── contracts/
│   ├── ledger-engine.contract.ts ← F1 public contract
│   └── cash-engine.contract.ts   ← F2 public contract
├── shared-kernel/
│   ├── types.ts                  ← Finance domain types
│   ├── validators.ts             ← Domain validators
│   └── constants.ts
├── resolvers/                    ← Query resolvers
├── finance-event-handler.ts      ← Event handler (9.8 KB)
├── finance-event-handler.factory.ts
└── __tests__/                    ← 13 test files
    ├── ledger-engine.integration.test.ts
    ├── finance-f1-ledger-verification.test.ts
    ├── finance-f1-concurrency.test.ts
    ├── finance-f2-reconstruction.test.ts
    ├── finance-f2-concurrency.test.ts
    ├── finance-f2-db-rls.test.ts
    ├── finance-f2-projection-worker.test.ts
    ├── finance-f2-reporting-api.test.ts
    ├── finance-f3-invoice-lifecycle.test.ts
    ├── finance-f3-payment-allocation.test.ts
    ├── finance-f3-db-rls.test.ts
    ├── f3-proof-runner.test.ts
    └── f4-proof-runner.test.ts

Finance Domain Coverage (migrations):
  F1 Ledger       ← 20260815xxx (kernel v1, RPCs, reversal, constraints)
  F2 Cash         ← 20260816xxx (cash engine, projection, reconstruction)
  F3 AR           ← 20260817xxx (AR engine, invoice lifecycle, payment allocation)
  F4 AP           ← 20260818xxx (AP engine - 57 KB)
  F5 Reconcile    ← 20260819–20260823xxx (schema, read contracts, reconstruction)
  Finance Outbox  ← Event-after-persistence outbox pattern (src/platform/integration-hub/)
```

### 3.2 Healthcare OS (`src/platform/healthcare/`) 🟢

```
healthcare/
├── engines/                      ← 27 clinical domain engines (H1–H12+)
│   ├── admission-engine/         ← H: Patient admissions
│   ├── anesthesia-engine/        ← H: Anesthesia management
│   ├── audit-compliance-engine/  ← H: Clinical audit & compliance
│   ├── bed-engine/               ← H: Bed management
│   ├── billing-engine/           ← H: Healthcare billing
│   ├── blood-bank-engine/        ← H: Blood bank
│   ├── cds-engine/               ← H8: Clinical Decision Support
│   ├── clinical-engine/          ← H: Core clinical
│   ├── cssd-engine/              ← H: Sterilization (CSSD)
│   ├── emergency-engine/         ← H: Emergency dept (ED)
│   ├── encounter-engine/         ← H: Patient encounters
│   ├── icu-engine/               ← H: ICU management
│   ├── imaging-engine/           ← H: Radiology/imaging
│   ├── insurance-engine/         ← H: Insurance claims
│   ├── laboratory-engine/        ← H: Lab orders & results
│   ├── mpi-engine/               ← H: Master Patient Index
│   ├── nursing-engine/           ← H: Nursing workflows
│   ├── or-engine/                ← H: Operating room
│   ├── or-readiness-engine/      ← H: Pre-op readiness
│   ├── order-engine/             ← H: Clinical orders
│   ├── pacu-engine/              ← H: Post-anesthesia care
│   ├── pharmacy-engine/          ← H: Pharmacy
│   ├── queue-engine/             ← H: Queue management
│   ├── rule-engine/              ← H: Clinical rules
│   ├── scheduling-engine/        ← H: Appointment scheduling
│   ├── surgical-engine/          ← H: Surgical management
│   └── temporal-engine/          ← H9: Temporal state
├── contracts/                    ← 20 public engine contracts
│   ├── encounter-engine.contract.ts    (19 KB)
│   ├── order-engine.contract.ts        (24 KB)
│   ├── cds-engine.contract.ts          (10.8 KB)
│   ├── bed-engine.contract.ts          (13.5 KB)
│   ├── surgical-engine.contract.ts
│   ├── anesthesia-engine.contract.ts
│   ├── blood-bank-engine.contract.ts
│   ├── cssd-engine.contract.ts
│   ├── emergency-engine.contract.ts
│   ├── icu-engine.contract.ts
│   ├── laboratory-engine.contract.ts
│   ├── nursing-engine.contract.ts
│   ├── or-engine.contract.ts
│   ├── or-readiness-engine.contract.ts
│   ├── pacu-engine.contract.ts
│   ├── pharmacy-engine.contract.ts
│   ├── rule-governance.contract.ts
│   ├── temporal-engine.contract.ts
│   └── [+ 3 more]
├── shared-kernel/
│   └── types.ts                  ← Healthcare domain types (12 KB)
├── finance-integration/          ← HC ↔ Finance integration layer
├── service-locator.ts            ← Engine service locator (10.6 KB)
├── healthcare-platform.bootstrap.ts
└── __tests__/                    ← 17 test files
    ├── healthcare-platform.bootstrap.test.ts
    ├── inpatient-vertical-slice.integration.test.ts
    └── [15 more domain tests]
```

### 3.3 Logistics OS (`src/platform/logistics/`) 🟢

```
logistics/
├── domain/                       ← E7.1 Domain Kernel (FROZEN)
│   ├── inventory.domain.ts       ← Inventory aggregate (20 KB)
│   ├── movement.domain.ts        ← Movement aggregate (12 KB)
│   ├── location.domain.ts        ← Location aggregate (12 KB)
│   ├── item.domain.ts            ← Item aggregate (8.6 KB)
│   ├── uom.domain.ts             ← Unit of measure (9.4 KB)
│   ├── traceability.domain.ts    ← Traceability (9.4 KB)
│   ├── inventory-operations.domain.ts
│   └── rules/                    ← E7.3 Business rules (FROZEN)
├── engines/                      ← E7.2 Operational Kernel
│   ├── freight-audit-engine.ts   ← Freight audit (79 KB)
│   ├── route-engine.ts           ← Route optimization (45 KB)
│   └── shipment-engine.ts        ← Shipment tracking (44 KB)
├── contracts/                    ← E7 Public contracts
├── repositories/                 ← Data access layer
├── shared-kernel/                ← Shared types (12 KB)
├── types/                        ← Type definitions
├── warehouse/                    ← Warehouse management
├── extensions/                   ← Extension points
└── __tests__/                    ← 15 suites / 547 tests (VERIFIED)
```

### 3.4 Education OS (`src/platform/education/`) 🟡

```
education/
├── domain/                       ← Education domain model
├── student/                      ← Student management
├── course/                       ← Course catalog
├── enrollment/                   ← Enrollment engine
├── attendance/                   ← Attendance tracking
├── assessment/                   ← Assessment & results
├── contracts/                    ← Public contracts
├── repositories/
├── shared-kernel/
├── ports/
├── education-engine.service.ts   ← Service implementation (9.8 KB)
└── education-engine.registration.ts
```

### 3.5 Real Estate OS (`src/platform/real-estate/`) 🟢

```
real-estate/
├── domain/                       ← Property domain model
├── engines/                      ← Property engine
├── contracts/                    ← Public contracts
└── repositories/
```

---

## LAYER 4 — PLATFORM ENGINES & CAPABILITIES

```
src/platform/
├── accounting/                   ← Accounting engine
├── activity-stream/              ← Activity feed engine
├── ai-orchestrator/              ← AI orchestration (18 KB index)
├── asset/                        ← Asset management
├── capability-platform/          ← Capability registry platform
├── compatibility/                ← Compatibility layer
├── composition/                  ← Platform composition
├── config-center/                ← Config management
├── context/                      ← Request context
├── contract/ & contracts/        ← Contract framework
├── document-engine/              ← Document generation
├── events/                       ← Event definitions
├── extensions/                   ← Extension framework
├── iam-matrix/                   ← IAM permission matrix
├── integration-hub/              ← Finance outbox + integration (12 files)
│   ├── finance-event-publisher.ts
│   ├── finance-outbox-worker.ts
│   ├── finance-outbox-writer.ts
│   ├── finance-outbox-reconciliation.ts
│   └── [7 more outbox components]
├── integration-runtime/          ← Runtime integration
├── journey/                      ← Customer journey engine
├── knowledge/                    ← Knowledge base
├── kpi-engine/                   ← KPI calculation engine (10 KB)
├── lead-engine/                  ← Lead management
├── messaging/                    ← Messaging infrastructure
├── metadata-engine/              ← Metadata management
├── notification-hub/             ← Notification orchestration (13 KB)
├── party/                        ← Party/entity model
├── policy-engine/                ← Policy evaluation
├── projection-engine/            ← Read model projections
├── registry/                     ← Platform registry
├── resource-engine/              ← Resource management
├── runtime/                      ← Platform runtime
├── scheduler-registry/           ← Job scheduler
├── sdk/                          ← Platform SDK
├── search-engine/                ← Search infrastructure
├── specification/                ← Specification pattern
├── state-machine/                ← State machine framework
└── template-engine/              ← Template rendering
```

---

## LAYER 5 — PRODUCT VERTICALS (`src/products/`)

```
src/products/
├── bella-dental/                 ← Dental clinic product
├── bella-education/              ← Education product
├── bella-hospital/               ← Hospital HIS product
├── bella-land/                   ← Real estate product
└── bella-medical/                ← Medical clinic product
```

---

## LAYER 6 — BUSINESS MODULES (`src/modules/`)

```
src/modules/
├── beauty-spa/                   ← Spa & beauty operations
├── bella-auto/                   ← Auto dealership module
├── bella-healthcare/             ← Healthcare module
├── bella-healthcare-kernel/      ← HC kernel module
├── booking/ & bookings/          ← Booking modules
├── hr-salary/ & salary/          ← Salary management
├── product-sales/                ← Product retail
├── real_estate/                  ← Real estate module
├── spa/                          ← Spa operations
└── support/                      ← Customer support
```

---

## LAYER 7 — SHARED UI COMPONENTS (`src/components/`)

```
src/components/
├── ErrorBoundary.tsx
├── accounting/                   ← Accounting UI components
├── admin/                        ← Admin UI
├── automation/                   ← Automation UI
├── bella-auto/                   ← Auto vertical UI components
├── bookings/                     ← Booking UI
├── common/                       ← Shared common components
├── decision-engine/              ← Decision engine UI
├── error-boundary/
├── features/                     ← Feature-specific components
├── finance/                      ← Finance UI components
├── hospital/                     ← Hospital UI
├── intelligence/                 ← AI intelligence UI
├── layout/                       ← Layout shells
├── lead-engine/                  ← Lead management UI
├── partner/                      ← Partner portal components
├── payroll/                      ← Payroll UI
├── product-sales/                ← Product sales UI
├── providers/                    ← Context providers
├── rules/                        ← Rule management UI
├── salary/                       ← Salary UI
└── ui/                           ← Base UI primitives
```

---

## LAYER 8 — DATABASE LAYER (Supabase)

### 8.1 Migration Timeline

```
supabase/migrations/              ← 432 migration files
│
├── Phase 1: Core ERP (20260511–20260526)
│   ├── initial_schema             ← Tenants, users, bookings, revenue
│   ├── security_hardening         ← RLS policies, role separation
│   ├── accounting_core            ← COA, journals, periods
│   └── ai_agent_infrastructure    ← AI agent tables
│
├── Phase 2: Business Operations (20260526–20260707)
│   ├── subscription_engine        ← Subscription quota management
│   ├── franchise_royalty          ← Multi-branch royalty
│   ├── inter_branch_clearing      ← HQ inter-branch ledger
│   ├── marketing_campaigns        ← Campaign management
│   ├── materialized views (MV)    ← 20+ MVs for performance
│   ├── meta_ads_phase1            ← Meta Ads integration
│   ├── partner_management         ← API gateway + partner portal
│   └── decision_engine            ← Policy & decision system
│
├── Phase 3: Enterprise Platform (20260709–20260730)
│   ├── workflow_engine_foundation
│   ├── booking_engine_schema      ← Advanced booking engine v3
│   ├── rule_management_tables
│   ├── waitlist_tables
│   └── performance_optimization   ← Indexes, query optimization
│
├── Phase 4: Vertical Foundations (20260731–20260812)
│   ├── real_estate (20260731–20260802)
│   │   ├── real_estate_schema
│   │   ├── real_estate_foundation_tables
│   │   ├── reservation_engine
│   │   ├── partner_portal
│   │   └── real_estate_core_schema (23 KB)
│   ├── bella_auto (20260803–20260804)
│   │   ├── foundation → vehicles → customers → journeys
│   │   ├── phase5: NPS/CSI → phase6: service center
│   │   ├── phase7: trade-in → phase8: finance center
│   │   ├── phase9: AI center → phase10: mobile workforce
│   │   ├── phase11: rollback → phase12: temporal history
│   │   ├── phase13: rule engine → phase14: marketplace
│   │   ├── phase15: rollup analytics
│   │   └── brands seed + demo seed
│   ├── blueprint (20260806)        ← B2B platform core
│   └── foundation_org_people       ← Universal person/org model
│
├── Phase 5: Healthcare Kernel (20260806–20260813)
│   ├── healthcare_kernel_schema    ← H1–H12 foundation
│   ├── hospital_inpatient_his      ← Inpatient HIS baseline
│   ├── perioperative_platform      ← OR/surgery platform
│   ├── icu_ed_bloodbank_tables     ← ICU/ED/Blood bank
│   ├── cds_order_tables            ← H8 CDS + order management
│   ├── h8_cds_schema               ← CDS full schema (13 KB)
│   ├── temporal_engine_tables      ← H9 temporal
│   ├── rule_governance_tables      ← H10 governance
│   ├── clinical_audit_tables       ← H11 audit
│   └── education (20260810–20260813)
│       ├── students → courses → enrollments → attendances
│       └── assessments + enrollment RPC
│
├── Phase 6: Finance Kernel (20260815–20260820)
│   ├── F1 Ledger (20260815)        ← Kernel v1, RPCs, constraints
│   ├── F2 Cash Engine (20260816)   ← Cash engine, projection, reconstruction
│   ├── F3 AR Engine (20260817)     ← AR, invoice lifecycle, payment allocation
│   ├── F4 AP Engine (20260818)     ← AP engine (57 KB)
│   ├── Runtime Tables (20260818)   ← Runtime governance tables
│   └── F5 Reconciliation (20260819–20260820)
│       ├── f5_schema (20 KB)
│       ├── f5_read_contracts (18 KB)
│       ├── f5_reconstruction_engine (36 KB)
│       ├── f5_fx_integrity (14 KB)
│       └── f5_prepayment_reconciliation (27 KB)
│
├── Phase 7: Runtime Governance (20260819–20260820)
│   ├── runtime_migration_05a–05c   ← Tenant type migration
│   ├── runtime_migration_e3        ← Post-migration verification
│   └── R4 Governance (20260820)
│       ├── migration_governance_approvals
│       ├── database_role_separation
│       ├── fix_executor_privileges
│       ├── grant_executor_rls_bypass
│       ├── enable_rls_block_service_key
│       ├── r4_approval_contract
│       ├── r4_3_gate_tokens
│       └── r4_4_monitoring_audit
│
├── Phase 8: Logistics Kernel (20260821)
│   ├── logistics_schema
│   ├── carrier_rates_table
│   ├── accessorial_rates_table
│   ├── freight_audit_tables
│   └── discrepancies_table
│
└── Phase 9: Reconciliation & Cleanup (20260822–20260824)
    ├── f5_test_cleanup_rpc
    ├── f5_ar_reconciliation
    ├── f5_ar_reconciliation_fix
    ├── finance_test_cleanup_rpc     ← 🟡 NOT APPLIED (pending)
    └── [f2 provenance files 040000–070000] ← 🟠 conflict pending
```

### 8.2 Key Database Schemas

```
public schema (all tables):
├── Core: tenants, users, bookings, sessions, packages, services
├── Finance: finance_journal_entries, finance_cash_movements,
│            finance_cash_opening_balances, finance_ar_invoices,
│            finance_ap_bills, finance_reconciliation_*
├── Accounting: accounting_journal_entries, accounts, coa, periods
├── Healthcare: hc_patients, hc_encounters, hc_orders, hc_beds,
│               hc_surgeries, hc_prescriptions, hc_lab_orders,
│               hc_imaging_orders, hc_icu_stays, hc_blood_requests
├── Logistics: logistics_items, logistics_movements, logistics_locations,
│              logistics_shipments, freight_audit_results
├── Education: edu_students, edu_courses, edu_enrollments, edu_attendances
├── Real Estate: re_properties, re_units, re_reservations, re_contracts
├── Bella Auto: auto_vehicles, auto_customers, auto_service_orders,
│               auto_trade_ins, auto_finance_applications, auto_marketplace
├── Governance: migration_governance_approvals, gate_tokens, audit_logs
├── Platform: capabilities, feature_flags, policies, rules, workflows,
│             notification_logs, decision_audit_logs, waitlist
└── Marketing: campaigns, meta_ads_accounts, recommendations, forecast_results
```

---

## LAYER 9 — TESTING INFRASTRUCTURE

```
Tests distribution:
├── src/__tests__/                ← 219 integration/E2E test files
│   ├── Finance domain
│   ├── Healthcare domain
│   ├── Booking engine
│   ├── KTV performance
│   ├── Salary reconciliation
│   ├── Rate limiting / security
│   ├── Franchise royalty
│   ├── Inter-branch clearing
│   ├── Zalo CRM
│   ├── Meta Ads
│   ├── Partner API
│   ├── Subscription engine
│   ├── Bella Auto phases 1–15
│   ├── Real estate
│   └── Education
│
├── src/platform/logistics/domain/__tests__/
│   └── 15 suites → 547 tests (VERIFIED ✅)
│
├── src/platform/healthcare/__tests__/
│   └── 17 test files
│
├── src/platform/finance/__tests__/
│   └── 13 test files (F1–F4 coverage)
│
├── e2e/                          ← Playwright E2E
├── tests/                        ← Additional test suites
└── load-tests/                   ← k6 performance
    ├── spike-100vus
    ├── spike-200vus              ← avg ~468ms ✅
    ├── spike-1000vus             ← p95 ~43.86s ✅
    └── enterprise_benchmark_report.md
```

---

## LAYER 10 — GOVERNANCE & DEVOPS

```
Governance:
├── .bdgf/                        ← BDGF Gate Framework
│   └── P0 Tenant Isolation gates
├── .git-hooks/                   ← Pre-commit architecture guard
├── scripts/healthcare/
│   └── architecture-guard.ts     ← HC guard (52/52 regression tests)
├── scripts/architecture/
│   └── architecture-guard.ts     ← Logistics guard (547/547 tests)
├── E7_1_FROZEN_MANIFEST.json     ← E7.1 frozen artifact manifest
├── ARCHITECTURE_GATE_RESULT.md   ← Gate result documentation
└── AGENTS.md                     ← AI coding constraints

CI/CD:
├── .github/                      ← GitHub Actions workflows
├── vercel.json / vercel.staging.json / vercel.production.json
├── sonar-project.properties      ← SonarQube config
├── .eslintrc.architecture.js     ← Architecture ESLint rules
└── playwright.config.ts          ← E2E test config

Observability:
├── monitoring/                   ← Monitoring configs
├── instrumentation.ts            ← OpenTelemetry setup
├── sentry.server.config.ts       ← Sentry server
└── sentry.edge.config.ts         ← Sentry edge

Environment:
├── .env.local, .env.staging, .env.production
├── .env.test, .env.test.template
└── .env.example (3.6 KB)
```

---

## TỔNG KẾT KIẾN TRÚC

```
╔═══════════════════════════════════════════════════════════════╗
║                 BELLA ARCHITECTURE SUMMARY                    ║
╠═══════════════════════════════════════════════════════════════╣
║  FRONTEND        Next.js App Router (45+ dashboard routes)    ║
║  API LAYER       28 API route groups                          ║
║  PLATFORM        46 platform modules                          ║
║  KERNELS         Finance(F1-F5) · Healthcare(27 engines)      ║
║                  Logistics(E7) · Education · Real Estate      ║
║  VERTICALS       Spa · Auto · Hospital · Dental · Land        ║
║                  Medical · Education · Blueprint(B2B)         ║
║  DATABASE        432 migrations · Supabase/PostgreSQL         ║
║                  Multi-schema · RLS · Row-level isolation     ║
║  GOVERNANCE      Architecture Guard · BDGF P0 · R4 Runtime    ║
║                  Event-after-persistence · Outbox pattern     ║
║  TESTING         219 integration + 17 HC + 13 Finance +       ║
║                  547 Logistics + E2E + Load tests             ║
║  PATTERN         Event-driven · Domain-driven · Kernel-based  ║
║                  Multi-tenant · Contract-first                ║
╚═══════════════════════════════════════════════════════════════╝
```

---

*Document: BELLA_ARCHITECTURE_TREE_2026_08_24.md*  
*Source: Direct codebase analysis — 24/08/2026*  
*Scope: Full src/ tree + migrations/ + platform/ + governance*
