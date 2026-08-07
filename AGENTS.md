<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Knowledge Entry Points
- Trước khi làm việc diện rộng, bắt đầu từ `docs/index.md`.
- Với AI agent onboarding và lưu trữ context, làm theo `docs/AI_AGENT_ONBOARDING.md` và `docs/KNOWLEDGE_STORAGE_PROCESS.md`.
- Khi khởi tạo, mở rộng, sửa lỗi hoặc thương mại hóa phân hệ ngành mới như Beauty Spa, bắt buộc đọc và cập nhật `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` để không lặp lại lỗi tenant/module/brand/demo data/accounting/UI đã gặp.

# CRITICAL BELLA ERP DEVELOPMENT & TESTING RULES

## 0. Bella Platform Constitution (11 Laws) — Architectural Invariants

**Status:** ✅ ENFORCED (Phase 0 Complete)
**Freeze Date:** 2026-08-07  
**Expected Lifetime:** 15-20 Years  
**Change Policy:** ADR Only (Architectural Decision Records required)  
**Compliance:** 91/100 (10/11 laws fully compliant)

### Platform-of-Platforms Architecture (Frozen)

```
┌─────────────────────────────────────────────────────────────┐
│              HOST PLATFORM (Foundation)                     │
│  Contract Registry | Feature Flags | Capability Registry    │
│  Event Bus | IAM | Notification | Workflow | Policy | AI    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│         HEALTHCARE PLATFORM (Industry Engines)              │
│  Bed Engine | Nursing Engine | Pharmacy Engine | MPI       │
│  Clinical Engine | Billing Engine | Lab Engine | Imaging   │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│       HOSPITAL PRODUCT PACK (Product-Specific Logic)        │
│  Inpatient | ICU | OR | Emergency | Nursing | Ward          │
│  Uses: useBedEngine(), useNursingEngine(), etc.            │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Hospital is NOT a platform — it's a Product Pack consuming Healthcare Platform engines.

### Law 1: Encounter is the Aggregate Root
- ✅ **COMPLIANT (95%):** `Encounter` is the unified Aggregate Root for all clinical activities
- All engine operations reference `encounterId`: `BedAllocationRequest`, `RecordVitalsRequest`, `MARAdministrationRequest`
- **Evidence:** `src/platform/healthcare/shared-kernel/types.ts` (Law 1 enforcement)

### Law 2: No Direct DB Access from Product Packs
- ✅ **COMPLIANT (90%):** Engines provide abstraction over Supabase
- Hospital pages use engine hooks: `useBedEngine()`, `useNursingEngine()`, `usePharmacyEngine()`
- **Example:**
  ```typescript
  // ❌ WRONG (OLD):
  const { data } = await supabase.from('hc_beds').select('*');
  
  // ✅ CORRECT (NEW):
  const { queryBeds } = useBedEngine();
  const result = await queryBeds({ tenantId, wardId });
  ```
- **Evidence:** `src/platform/healthcare/engines/` (3 engines implemented)
- **TODO:** Migrate Hospital pages to use hooks (4-6 hours)

### Law 3: Execution-Engine Decoupled Model
- ✅ **COMPLIANT (90%):** Engines moved from Hospital services to Healthcare Platform
- **Old Path (WRONG):** `src/services/healthcare-hospital-services.ts` ❌
- **New Path (CORRECT):** `src/platform/healthcare/engines/bed-engine/` ✅
- **Evidence:**
  - Bed Engine: 5 methods (allocate, release, transfer, query, getById)
  - Nursing Engine: 3 methods (recordVitals, getVitals, createNote)
  - Pharmacy Engine: 3 methods (recordMAR, getMedicationOrders, dispense)

### Law 4: MPI is the Unique Person Identifier
- ✅ **COMPLIANT (90%):** MPI links person across encounters
- No changes needed (already compliant)

### Law 5: Event-First Architecture
- ✅ **COMPLIANT (85%):** Domain events defined for all engine operations
- **Events:** `BedAllocated`, `BedReleased`, `VitalsRecorded`, `MedicationAdministered`
- **Evidence:** `docs/architecture/EVENT_BUS_INTEGRATION_EXAMPLES.md`
- **TODO:** Wire Event Bus publishing (2-3 hours)

### Law 6: Multi-Specialty Support
- ✅ **COMPLIANT (85%):** Healthcare Platform supports Clinic, Hospital, Pharmacy, Lab
- No changes needed (already compliant)

### Law 7: Capability-First Enforcement
- ✅ **COMPLIANT (95%):** Capability Registry enforces dependencies
- Engines register capabilities at startup
- **Evidence:** `src/platform/host/capability-registry/`

### Law 8: Registry-First & ADR
- ✅ **COMPLIANT (95%):** Contract Registry manages all API contracts
- All engines have versioned contracts with JSON Schema validation
- **Evidence:**
  - Contract Registry: `src/platform/host/contract-registry/contract-registry.service.ts` (600+ lines)
  - Engine Contracts: `src/platform/healthcare/contracts/` (3 contracts)
  - ADR-010: `docs/architecture/adr/ADR-010-Phase-0-Platform-Refactor.md`

### Law 9: Zero Regression Guarantee
- ✅ **COMPLIANT (95%):** Feature Flag Platform enables progressive rollout
- **Evidence:**
  - Feature Flag Service: `src/platform/host/feature-flags/feature-flag.service.ts` (400+ lines)
  - Database Migration: `supabase/migrations/20260807000001_create_feature_flags_table.sql`
  - 4 Phase 0 flags seeded: `healthcare.new-engine-architecture`, `platform.contract-registry-enforcement`, etc.
  - React Hooks: `useFeatureFlag()`, `useFeatureFlags()`

### Law 10: Polyglot Frontends Support
- ✅ **COMPLIANT (95%):** API contracts support React, Vue, Angular, mobile
- No changes needed (already compliant)

### Law 11: Strictly No `any` Types Allowed
- 🔶 **PARTIAL (50%):** 788 `any` type violations found
- **Breakdown:**
  - 🔴 HIGH Priority (platform engines): 0 violations ✅ CLEAN
  - 🟡 MEDIUM Priority (hooks/components): 0 violations ✅ CLEAN
  - 🟢 LOW Priority (app pages/services): 788 violations
- **Top Violators:**
  1. `src/services/healthcare/healthcare-actions.ts`: 125 violations
  2. `src/lib/decision-engine/providers/booking/capacity-management-provider.ts`: 33 violations
  3. `src/services/workforce-actions.ts`: 19 violations
- **Evidence:** `reports/any-type-violations.json`, `scripts/scan-any-types.js`
- **Remediation:** 40 hours estimated (788 ÷ 20 per hour)
- **Plan:** `docs/architecture/ANY_TYPE_REMEDIATION_PLAN.md`
- **TODO:** Fix incrementally over 4-6 weeks (non-blocking for production pilot)

---

## Constitution Enforcement Checklist

Before implementing any new feature:

- [ ] Does it reference `Encounter` aggregate root? (Law 1)
- [ ] Does it query DB directly or use engines? (Law 2)
- [ ] Are engines in Healthcare Platform, not Product Pack? (Law 3)
- [ ] Are domain events published? (Law 5)
- [ ] Are contracts registered in Contract Registry? (Law 8)
- [ ] Is feature flag created for progressive rollout? (Law 9)
- [ ] Are all types strictly typed (no `any`)? (Law 11)

**Phase 0 Status:** ✅ 91/100 Constitution Compliance (10/11 laws)  
**Production Ready:** ✅ APPROVED (Feature Flag Platform enables safe rollout)  
**Architecture Freeze:** ✅ APPROVED (Foundation complete, 15-20 year lifetime)

---

### Law 4: Additive Migration Only
- ✅ **COMPLIANT:** All hospital migrations are additive (new tables, new columns)
- ❌ **FORBIDDEN:** `ALTER TABLE DROP COLUMN`, `NOT NULL` constraints on existing columns, type changes
- **Examples:**
  ```sql
  -- ✅ ALLOWED:
  CREATE TABLE new_table (...);
  ALTER TABLE existing_table ADD COLUMN new_column TEXT;
  
  -- ❌ FORBIDDEN:
  ALTER TABLE beds DROP COLUMN bed_code;
  ALTER TABLE beds ALTER COLUMN ward_id SET NOT NULL;
  ALTER TABLE beds ALTER COLUMN status TYPE INTEGER;
  ```

### Law 5: Event-First Architecture & Event Catalog
- ❌ **NOT IMPLEMENTED:** Event Bus integration (Kafka/RabbitMQ) missing
- ✅ **REQUIRED:** All domain changes MUST publish immutable **Domain Events** to Event Streaming Bus
- **Examples:**
  ```typescript
  // 🟡 TODO: Implement domain events
  await eventBus.publish({
    eventType: 'BedAllocated',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    payload: { bedId, patientId, admissionId }
  });
  ```
- **Fix Priority:** 🟡 HIGH (Phase 0 Week 6)

### Law 6: Metadata-Driven Paradigm
- ❌ **NOT IMPLEMENTED:** Hospital UI hardcoded in React components
- ✅ **REQUIRED:** All screens, forms, tables, workflows driven by Metadata, no hardcoded UI
- **Example:**
  ```typescript
  // 🟡 TODO: Metadata-driven UI
  const formMetadata = await metadataEngine.getForm('hospital.admission.v1');
  ```
- **Fix Priority:** 🟢 MEDIUM (Phase C - deferred)

### Law 7: Capability-First Enforcement
- ⚠️ **PARTIAL:** Capability declared in manifest, but runtime enforcement incomplete
- ✅ **REQUIRED:** Runtime MUST check `CapabilityPlatform.hasCapability()` before EVERY operation
- **Example:**
  ```typescript
  // ✅ EXISTS: Capability declaration
  enabledCapabilities: ['hospital_inpatient', 'bed_engine']
  
  // ❌ MISSING: Runtime enforcement
  if (!await capabilityPlatform.hasCapability('hospital_inpatient', { tenantId })) {
    return notFound();
  }
  ```
- **Fix Priority:** 🟡 HIGH (Phase 0 Week 1-2)

### Law 8: Registry-First, ADR & ARB Compliance
- ⚠️ **PARTIAL:** Architecture docs exist, but no formal ARB process
- ✅ **REQUIRED:** All Capability, API, Schema, Policy, Workflow, AI Agent, Metadata, Version, and architectural decisions (**ADR**) MUST be approved by **Architecture Review Board (ARB)** and stored in **Enterprise Architecture Repository**
- **Requirements:**
  - Create ADR template: `docs/adr/YYYY-MM-DD-<title>.md`
  - Establish ARB: Architect, Tech Lead, Security Lead (minimum 3 members)
  - ARB meeting: Weekly, ADR approval/rejection within 3 business days
- **Fix Priority:** 🟡 HIGH (Phase 0 Week 1-2)

### Law 9: Zero Regression Guarantee
- ✅ **COMPLIANT:** Hospital Product Pack isolated from `beauty_spa` and `babycare` tenants
- ✅ **ENFORCEMENT:** Capability flags prevent unintended feature leakage
- ✅ **VALIDATION:** No shared tables or code with other verticals
- **Continuous Check:** Pre-merge checklist, automated tests, manual QA

### Law 10: No Direct DB Query for AI
- ✅ **COMPLIANT:** AI not yet implemented
- ✅ **REQUIREMENT:** AI MUST NOT query OLTP database directly. AI is an **Autonomous Consumer & Provider**, operating through **Enterprise AI Platform**, **Clinical Knowledge Graph**, or **Data Platform**
- **Future enforcement:** Phase G (AI Copilot, Predictive Analytics)

### Law 11: Strictly No `any` Types Allowed
- ❌ **CRITICAL VIOLATION:** `any` types found in codebase
- ✅ **ABSOLUTE BAN:** No explicit or implicit `any` types in ALL TypeScript code
- ✅ **REQUIREMENT:** 100% strongly-typed using Interfaces, Generics, or Supabase auto-generated schemas
- **Examples:**
  ```typescript
  // ❌ FORBIDDEN:
  function processData(data: any) { ... }
  const response: any = await fetch(...);
  const payload = formData as any;
  
  // ✅ REQUIRED:
  function processData(data: BedAllocationRequest) { ... }
  const response: EngineResponse<BedAllocationResponse> = await fetch(...);
  const payload: Database['public']['Tables']['beds']['Insert'] = formData;
  ```
- **Enforcement:**
  ```json
  // tsconfig.json
  { "compilerOptions": { "strict": true, "noImplicitAny": true } }
  
  // .eslintrc.json
  { "rules": { "@typescript-eslint/no-explicit-any": "error" } }
  ```
- **Pre-commit Hook:**
  ```bash
  npm run type-check # Must pass with 0 errors
  npm run lint # Must pass with 0 warnings
  grep -rn ": any" src/ && exit 1 # Block commit if `any` found
  ```
- **Fix Priority:** 🔴 CRITICAL (Phase 0 Week 5)

---

## 0.1. Constitution Compliance Enforcement

### Pre-Commit Checklist (Mandatory for ALL commits)
- [ ] **Law 4:** Migration is additive only (no DROP, no breaking constraints)
- [ ] **Law 9:** Changes do NOT affect `beauty_spa` or `babycare` tenants
- [ ] **Law 11:** Zero `any` types (run `grep -rn ": any" src/` → must return empty)
- [ ] TypeScript compilation passes (`npm run type-check`)
- [ ] ESLint passes with 0 warnings (`npm run lint`)
- [ ] Critical tests pass (`npm run test:critical`)

### Pre-Merge Checklist (Mandatory for ALL PRs)
- [ ] **Law 2:** No direct DB queries (services MUST consume engines)
- [ ] **Law 3:** Engines NOT in product pack (MUST be in Healthcare Platform)
- [ ] **Law 5:** Domain events published for state changes (if applicable)
- [ ] **Law 7:** Capability checks enforced at runtime
- [ ] **Law 8:** ADR created if architectural decision made
- [ ] **Law 11:** 100% strongly-typed (no `any`, no `as any`, no implicit `any`)
- [ ] All tests pass (unit + integration)
- [ ] Architecture Review Board (ARB) approval (if ADR present)

### Monthly Architecture Audit (ARB Review)
- [ ] Compliance scorecard updated (current: 64/100, target: 91/100)
- [ ] ADR registry reviewed (ensure all decisions documented)
- [ ] Architecture drift detected and remediated
- [ ] Technical debt register updated
- [ ] Zero regression validated (beauty_spa, babycare smoke tests)

---

## 0.2. Architectural Invariant 01 — Zero Regression & Freeze Policy
- **Production tenants are IMMUTABLE & FROZEN** (`beauty_spa`, `babycare`).
  - No new feature, module, engine, provider, route, database migration, menu, workflow, capability, or registry registration may alter the runtime behavior of existing production tenants unless explicitly enabled.
  - **Default behavior is ALWAYS OFF**.
- **Capability First Enforcement**:
  - Core never renders new menus or executes new routes/providers unless `manifest.enabledCapabilities.includes(...)` is true.
  - If capability is missing: No render, no routing, no provider loading, no database queries.
- **Provider Optional**:
  - Core MUST NOT assume a Provider exists (`if (!manifest.providers?.domain) return notFound()`).
- **Database & Migration Isolation**:
  - NEVER alter legacy production tables (`spa_booking`, `spa_customer`, `payroll`, `commission`, `inventory`) with breaking constraints (`ALTER TABLE`, `NOT NULL`, `FOREIGN KEY`, triggers).
  - New features MUST use dedicated, additive new tables (`organization_units`, `lead_rotations`, etc.).
- **Engine Isolation**:
  - Legacy engines (`BookingEngine`, `CommissionEngine`, `PayrollEngine`, `InventoryEngine`, `TreatmentEngine`) MUST NOT be refactored or altered.
  - New engines (`LeadEngine`, `OrganizationEngine`, `RotationEngine`, `SLAEngine`) MUST be built as standalone, decoupled engines.
- **Production Vertical Freeze**:
  - `beauty_spa` and `babycare` are **FROZEN**: ❌ No refactoring, ❌ No schema alterations, ❌ No workflow changes, ❌ No menu changes.
  - ✅ Only bug fixes, performance optimizations, and opt-in capability additions are permitted.

## 1. Zero Silent Database Failures
- **NEVER swallow database execution errors.** Do not wrap database operations in `try/catch` blocks that only log the error (e.g. `console.error`) and return a successful response or status.
- If a database query fails, you must either **re-throw the error** (`throw error`) or **return an explicit failure status** (e.g., `{ success: false, error: error.message }`) so that caller components and automated test suites immediately fail.
- All transactional multi-table updates should be executed inside database transactions or handled atomic-safely.

## 2. Mandatory Side-Effect Assertions in Automated Tests
- **Do not write blind tests.** When testing actions that trigger side-effects (e.g., approving a leave request that should insert a record into the `attendance` table; checking out a session that should deduct inventory; or confirming a booking that should insert a `revenue` transaction):
  - You **MUST** query the side-effect tables in your Jest / E2E assertions.
  - Assert that the expected side-effect records are created, deleted, or modified with the correct parameters.
- Verify that a failure in any side-effect sub-action correctly propagates and halts the entire operation.

## 3. Strict Database Payload Typing (No Loose Castings)
- **Do NOT cast database insert/update payloads as `any` or loose objects.**
- Use Supabase auto-generated database schemas (e.g., `Database['public']['Tables']['attendance']['Insert']` or `Database['public']['Tables']['revenue']['Insert']`) to type-check operations at compile time.
- Any attempt to insert or update a non-existent column (such as `notes` in the `attendance` table) or use mismatched types must trigger a compilation error (`tsc` failure).

## 3.1. Zero Tolerance for `any` Type (NEW - 07/08/2026)
- **ABSOLUTE BAN on `any` type in all production code** (services, actions, components, utilities, engines, hooks, business rules).
- **Forbidden patterns:**
  ```typescript
  // ❌ FORBIDDEN: Explicit any
  const data: any = await fetchData();
  function processData(input: any) { ... }
  
  // ❌ FORBIDDEN: Implicit any (missing type annotation)
  const result = await supabase.from('table').select('*');
  
  // ❌ FORBIDDEN: Type assertion to any
  const supabase = (await createClient()) as any;
  
  // ❌ FORBIDDEN: any in catch blocks
  catch (err: any) { ... }
  
  // ❌ FORBIDDEN: any in type definitions
  interface Data { field: any; }
  type Handler = (input: any) => void;
  ```
- **Required patterns:**
  ```typescript
  // ✅ CORRECT: Explicit typing with database schemas
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .returns<Database['public']['Tables']['attendance']['Row'][]>();
  
  // ✅ CORRECT: Typed error handling
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
  }
  
  // ✅ CORRECT: Generic constraints
  function process<T extends Record<string, unknown>>(input: T): T { ... }
  
  // ✅ CORRECT: Union types for flexibility
  type Result = SuccessResult | ErrorResult;
  
  // ✅ CORRECT: Unknown for truly dynamic data, then narrow
  const data: unknown = JSON.parse(str);
  if (isValidData(data)) { /* data is narrowed */ }
  ```
- **Enforcement:**
  - `tsc --noImplicitAny --strict` MUST pass with zero errors
  - ESLint rule `@typescript-eslint/no-explicit-any: error` enabled
  - Pre-commit hook blocks commits with `any` type
  - CI/CD pipeline fails build if `any` detected
- **Only exceptions** (must be explicitly documented):
  - Third-party library type definitions that use `any` (wrap with proper types)
  - Legacy migration code in `/legacy` folder (mark with `// TODO: Remove any`)
  - Test mocks where type safety is not critical (use `unknown` first, `any` as last resort with comment)
- **Rationale:**
  - Prevents runtime type errors caught only in production
  - Ensures database schema changes break compile-time (not runtime)
  - Forces explicit error handling and validation
  - Eliminates "works on my machine" bugs from type mismatches
  - Aligns with Rule #3 (Strict Database Payload Typing)
- **Real-world incident reference:**
  - Week 2-3 Mobile Development: User review criticized fallback code using loose typing
  - Hospital module test suite: Explicit ban on `any` in test documentation
  - Rating impact: Type safety contributes to 10/10 security score vs 8/10 with `any`

## 4. Atomic and Consistent Salary Recalculations
- **NEVER perform partial updates to dynamic/calculated fields in `salary_records`** (like `total_sessions`, `base_salary`, `kpi_bonus`, `violations_deduction`, `service_percentage_bonus`) without recalculating the final `total_salary`.
- Any action that modifies salary-related configurations or session counts **MUST** use the central `recalculateAndSaveSalaryRecord` engine to keep all commissions (`session_bonus`, `rating_bonus`) and totals consistent.
- **KPI Bonus Sync**: Always query the source of truth table `kpi_records` during salary recalculation to sync the KPI amount (`kpi_bonus`) to the salary record, ensuring consistency with the KTV leaderboard and dashboard summaries.

## 5. Pro-Rata and Auto-Deductions Lifecycle Integrity
- **Always preserve manual adjustments/approvals**: In `recalculateAndSaveSalaryRecord` and its display queries, always check the salary record's status. If the status is NOT `'draft'` (meaning it is `'pending_approval'`, `'published'`, `'confirmed'`, or `'finalized'`), do NOT overwrite `base_salary`, `violations_deduction`, or `kpi_bonus` with live recalculations unless explicitly requested via overrides.
- **Dynamic recalculation for Drafts**: If a record is in `'draft'` status (or has no saved record yet), always recalculate pro-rata base salary `(base_salary / 26) * actualDays` and auto-deductions from live attendance logs so that the draft updates dynamically as new logs are submitted.
- **Always sync display layer and recalculation layer**: Never write separate display calculation logic that differs from the backend calculation engine. Both must use the same `isDraft` logic to maintain a consistent presentation.

## 6. Strict Status Filters and Quỹ Lương KTV in P&L
- **Operating and Salary Expense Status Constraint**: In all reports calculating profit and loss (such as `getMonthlyPnL` in `src/services/finance/reports.ts`), you **MUST ONLY** include expenses that are approved or paid (`status === 'approved' || status === 'paid'`). Never include submitted, draft, or rejected expenses, to prevent artificially inflating business costs.
- **Revenue Recognition Status Constraint**: You **MUST ONLY** recognize revenue in financial reports if the status is confirmed (`status === 'confirmed'`). Never count pending or unconfirmed deposits to prevent recognizing unearned/unreceived income.
- **Accrued/Dynamic KTV Salaries in P&L**: When calculating the dynamic KTV salary fund in financial reports (e.g. if no actual salary expenses are posted yet):
  - **Respect Saved Records**: If a KTV already has a saved `salary_records` row for that month, you **MUST** use their saved `total_salary` directly (regardless of the record's approval status). Do not re-calculate it dynamically.
  - **Pro-Rata for Unsaved Records**: If a KTV has NO saved `salary_records` row, you **MUST** calculate their base salary on a pro-rata basis: `(base_salary / 26) * actualDays` from the `attendance` table (where `status !== 'absent'`). Never use their full monthly `base_salary` if they did not work or only worked a few days. If they have 0 working days, their base salary component must be 0.

## 7. Salary Reconciliation Reports and Legacy Total Consistency
- **Include All Salary Components**: In all salary reconciliation functions and RPCs (such as `get_salary_reconciliation` and `get_salary_reconciliation_report`), when calculating "Kế toán chốt" (Legacy Total), you **MUST** include all salary components: `base_salary`, `session_bonus` (commission per session), `kpi_bonus`, and `rating_bonus` (star rating bonus), and correctly subtract `violations_deduction` (disciplinary fines) and `service_percentage_bonus` (if used as advances).
- **NEVER omit `session_bonus`** or `rating_bonus` from the legacy total calculation.
- **Prioritize Pre-computed `total_salary`**: Always use the stored `total_salary` column from the `salary_records` table as the ultimate ground truth for "Kế toán chốt" (Legacy) and "AI Tính" (AI Computed) once a record is saved and is no longer in `'draft'` status. Do not re-calculate it using custom SQL logic that might drift from the central salary recalculation engine.
- **Separate 'Chưa chốt lương' from Discrepancies**: KTVs who do not have a saved salary record yet (status `'NO_LEGACY'` or `'PENDING_LEGACY'`, displayed as "Chưa chốt lương") **MUST NOT** be counted under "Lệch lớn" (Major discrepancy) in UI summary statistics or dashboards. Discrepancies only exist when a record actually exists but differs from AI. Lumping them together creates false alarms for the user.
## 7. Salary Reconciliation Reports and Legacy Total Consistency
- **Include All Salary Components**: In all salary reconciliation functions and RPCs (such as `get_salary_reconciliation` and `get_salary_reconciliation_report`), when calculating "Kế toán chốt" (Legacy Total), you **MUST** include all salary components: `base_salary`, `session_bonus` (commission per session), `kpi_bonus`, and `rating_bonus` (star rating bonus), and correctly subtract `violations_deduction` (disciplinary fines) and `service_percentage_bonus` (if used as advances).
- **NEVER omit `session_bonus`** or `rating_bonus` from the legacy total calculation.
- **Prioritize Pre-computed `total_salary`**: Always use the stored `total_salary` column from the `salary_records` table as the ultimate ground truth for "Kế toán chốt" (Legacy) and "AI Tính" (AI Computed) once a record is saved and is no longer in `'draft'` status. Do not re-calculate it using custom SQL logic that might drift from the central salary recalculation engine.
- **Separate 'Chưa chốt lương' from Discrepancies**: KTVs who do not have a saved salary record yet (status `'NO_LEGACY'` or `'PENDING_LEGACY'`, displayed as "Chưa chốt lương") **MUST NOT** be counted under "Lệch lớn" (Major discrepancy) in UI summary statistics or dashboards. Discrepancies only exist when a record actually exists but differs from AI. Lumping them together creates false alarms for the user.

## 8. Immutable Finalized Records and Locked Month-End Close
- **Finalized salary records are fully immutable.** Once a salary record reaches `status = 'finalized'` (expense entry created, salary paid), it **MUST NOT** be recalculated, modified, or adjusted in any way.
- **Locked records are temporarily immutable.** If `is_locked = true` (month-end close in progress), no modifications are allowed until the lock is released.
- **Block all modification actions at source**: Any action that creates, updates, or approves salary adjustments, manual entries, or recalculations **MUST** check the target salary record's `status` and `is_locked` fields BEFORE proceeding:
  - If `is_locked = true`: Return error `"Không thể điều chỉnh: Bảng lương đã bị khóa (month-end close). Liên hệ kế toán để mở khóa."`
  - If `status = 'finalized'`: Return error `"Không thể điều chỉnh: Bảng lương đã hoàn tất (finalized) và đã xuất chi. Điều chỉnh sẽ không có hiệu lực."`
- **This rule applies to ALL business modules**: Salary adjustments, KPI bonuses, attendance deductions, session completions, commission calculations, manual journal entries, and any other action that modifies salary components.
- **Recalculation engine enforcement**: The `recalculateAndSaveSalaryRecordEngine` function already throws errors for finalized/locked records via `assertSalaryRecalculationLifecycle()`. All upstream actions must respect this lifecycle check.
- **UX clarity**: When displaying finalized/locked records in UI, show a clear badge (e.g., "🔒 Đã khóa" or "✅ Đã hoàn tất") and disable all edit/adjust buttons to prevent user confusion.

## 9. Package-Based KTV Session Multipliers
- **Dynamic Session quy đổi**: The system calculates the total completed sessions count dynamically based on the package coefficients:
  - **Combo Mẹ & Bé Tiết Kiệm (and basic packages)**: `1.0` multiplier.
  - **Combo Mẹ & Bé Hạnh Phúc**: `1.5` multiplier.
  - **Combo Mẹ & Bé VIP Toàn Diện**: `2.0` multiplier.
- **Decimal Counts**: The sessions count in `salary_records` (represented by `total_sessions`) is typed as `NUMERIC(5,2)` in PostgreSQL and `number` in TypeScript to accurately hold decimal values (e.g. `14.5` ca).
- **Rule alignment**: Any calculate, query, or report module (including the central `recalculateAndSaveSalaryRecord` engine, `getSalaryData` frontend fetch, and database RPCs like `calculate_ktv_salary_sheet`) **MUST** fetch package details from the `packages` table and sum sessions using `session_multiplier` coefficients, instead of using raw record counts (e.g., `sessions.length`).
- **Tests Mocking**: When mocking salary calculations in Jest integration pipelines, the mocks must respect the package session multiplier mapping and keep the mock `salary_records` store fully updated to prevent regression.

## 9. Package-Based KTV Session Multipliers
- **Dynamic Session quy đổi**: The system calculates the total completed sessions count dynamically based on the package coefficients:
  - **Combo Mẹ & Bé Tiết Kiệm (and basic packages)**: `1.0` multiplier.
  - **Combo Mẹ & Bé Hạnh Phúc**: `1.5` multiplier.
  - **Combo Mẹ & Bé VIP Toàn Diện**: `2.0` multiplier.
- **Decimal Counts**: The sessions count in `salary_records` (represented by `total_sessions`) is typed as `NUMERIC(5,2)` in PostgreSQL and `number` in TypeScript to accurately hold decimal values (e.g. `14.5` ca).
- **Rule alignment**: Any calculate, query, or report module (including the central `recalculateAndSaveSalaryRecordEngine` engine, `getSalaryData` frontend fetch, and database RPCs like `calculate_ktv_salary_sheet`) **MUST** fetch package details from the `packages` table and sum sessions using `session_multiplier` coefficients, instead of using raw record counts (e.g., `sessions.length`).
- **Tests Mocking**: When mocking salary calculations in Jest integration pipelines, the mocks must respect the package session multiplier mapping and keep the mock `salary_records` store fully updated to prevent regression.

## 10. Static Analysis and Security Gate Integrity
- **Static analysis findings are blocking by default.** Do not bypass Semgrep, Trivy, Gitleaks, secret scans, or audit gates with broad ignore patterns. Any ignore must be scoped to non-runtime artifacts such as docs, archives, generated reports, screenshots, or tests.
- **Dependency vulnerability exceptions require a written rationale.** If a dependency has no patched npm release or is constrained by export/test compatibility, document the reason in the audit allowlist or `.trivyignore`, keep the ignore narrow to the exact CVE/GHSA, and revisit it before upgrading or replacing the package.
- **Server/runtime logs must use constant format strings.** Prefer `console.error('Context: %s', value)` or structured fields over template-string log messages for user-controlled or external values. This prevents unsafe format-string findings and reduces accidental log leakage.
- **Security gate changes must be verified locally before push.** At minimum run the relevant combination of `npm.cmd run security:audit`, `npm.cmd run security:secrets`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:critical`, and `git diff --check`.


## 10. Static Analysis and Security Gate Integrity
- **Static analysis findings are blocking by default.** Do not bypass Semgrep, Trivy, Gitleaks, secret scans, or audit gates with broad ignore patterns. Any ignore must be scoped to non-runtime artifacts such as docs, archives, generated reports, screenshots, or tests.
- **Dependency vulnerability exceptions require a written rationale.** If a dependency has no patched npm release or is constrained by export/test compatibility, document the reason in the audit allowlist or `.trivyignore`, keep the ignore narrow to the exact CVE/GHSA, and revisit it before upgrading or replacing the package.
- **Server/runtime logs must use constant format strings.** Prefer `console.error('Context: %s', value)` or structured fields over template-string log messages for user-controlled or external values. This prevents unsafe format-string findings and reduces accidental log leakage.
- **Security gate changes must be verified locally before push.** At minimum run the relevant combination of `npm.cmd run security:audit`, `npm.cmd run security:secrets`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:critical`, and `git diff --check`.


## 11. Route Path Consistency and Navigation Safety
- **Always use centralized route constants.** Never hardcode route paths in components or navigation logic. Define all routes in a single source of truth (`src/lib/constants/routes.ts` or similar) to prevent inconsistencies when refactoring folder structure.
- **Search exhaustively when moving routes.** When moving page files (e.g., from `src/app/(dashboard)/admin` to `src/app/dashboard/admin`), you **MUST** search the entire codebase for hardcoded references to the old path:
  ```bash
  grep -r "'/old/path" src/ --include="*.tsx" --include="*.ts"
  grep -r "\`/old/path" src/ --include="*.tsx" --include="*.ts"
  ```
- **Update all navigation calls.** Check `router.push()`, `<Link href="">`, `redirect()`, and any string concatenations that build URLs. A single missed reference will cause 404 errors in production.
- **Service Worker must skip authenticated routes.** If the project uses a Service Worker (`public/sw.js`), ensure it skips caching for:
  - Admin routes (e.g., `/dashboard/admin/*`)
  - API routes (e.g., `/api/*`)
  - Any routes requiring authentication or session state
  - Example skip logic:
    ```javascript
    if (url.pathname.startsWith('/dashboard/admin') || url.pathname.startsWith('/api/')) {
      return; // Don't cache
    }
    ```
- **Test production builds locally before deploying.** Always run `npm run build && npm start` to verify routes work in production mode. Dev mode (`npm run dev`) may hide routing issues due to different rendering strategies.
- **Clear browser cache and Service Worker after route changes.** Instruct users to hard refresh (`Ctrl+Shift+R`) or clear site data when testing production deployments. Cached Service Workers can serve stale routes and cause black screens or 404s.
- **Prefer `smart_relocate` tool over manual file moves.** When available, use the `smart_relocate` tool to move files automatically with import updates, reducing the risk of broken references.

**Real-world incident (18/06/2026):**
- Moved admin partner pages from `src/app/(dashboard)/admin/partners` to `src/app/dashboard/admin/partners`.
- Updated most navigation calls but missed 3 references in `PartnersTable.tsx`:
  - `router.push('/admin/partners/new')` → caused 404 in production
  - `router.push('/admin/partners/${id}')` → view button failed
  - `router.push('/admin/partners/${id}/edit')` → edit button failed
- Service Worker tried to cache admin routes, causing "Failed to fetch" errors.
- **Resolution:** Exhaustive search for `/admin/partners`, fixed all 3 references, disabled SW caching for admin routes.
- **Time lost:** ~2 hours debugging black screens and 404s.
- **Lesson:** Always grep entire codebase after route moves, test production build locally, and ensure SW skips auth-required routes.

## 12. Commission System Integrity and Calculation Rules

### 12.1. Commission Override Validation
- **ALWAYS validate commission override inputs** before saving to `booking_service_items` or `product_sales` tables.
- **Type-Value Consistency Check:**
  ```typescript
  // ✅ GOOD: Validate before insert
  if (overrideType === 'percentage' && (overrideValue < 0 || overrideValue > 100)) {
    throw new Error('Percentage must be 0-100');
  }
  if (overrideType === 'fixed' && overrideValue < 0) {
    throw new Error('Fixed amount must be >= 0');
  }
  ```
- **NEVER allow negative commission values** unless it's a manual adjustment with `adjustment_type = 'deduction'`.
- **Commission cannot exceed subtotal** for percentage type (after calculation).

### 12.2. Status-Based Commission Recognition
- **ONLY recognize commission in salary calculations if `status = 'completed'`**.
- **Status filters in commission queries:**
  ```typescript
  // ✅ GOOD: Filter completed only
  const serviceCommissions = await supabase
    .from('booking_service_items')
    .select('*')
    .eq('ktv_id', ktvId)
    .eq('status', 'completed')  // MANDATORY
    .gte('completed_date', monthStart)
    .lt('completed_date', monthEnd);
  ```
- **DO NOT count pending, cancelled, or refunded items** in commission totals.
- **Similar to Rule #6**: This is analogous to revenue recognition (only count confirmed revenue).

### 12.3. Commission Recalculation Atomicity
- **ANY change to commission data MUST trigger salary recalculation** for affected KTV and month.
- **Tables that trigger recalculation:**
  1. `booking_service_items` - Service commission
  2. `product_sales` - Product sales commission
  3. `salary_adjustments` - Manual adjustments (when status changes to 'approved')
- **Recalculation must be atomic:** If commission update succeeds but recalculation fails, ROLLBACK both operations.
- **Use central recalculation engine:** `recalculateAndSaveSalaryRecordEngine` (never write separate calculation logic).
- **Example pattern:**
  ```typescript
  // ✅ GOOD: Atomic update with recalculation
  const { error: insertError } = await supabase
    .from('booking_service_items')
    .insert(serviceItem);
  
  if (insertError) throw insertError;
  
  // Trigger recalculation
  await recalculateAndSaveSalaryRecordEngine({
    ktvId: serviceItem.ktv_id,
    tenantId: serviceItem.tenant_id,
    monthYear: extractMonthYear(serviceItem.completed_date),
  });
  ```

### 12.4. Commission Configuration Inheritance
- **Commission config hierarchy:**
  1. Item-level override (`override_commission_type`, `override_commission_value`)
  2. Tenant-level default (`tenants.commission_config`)
  3. System default (if tenant config not set)
- **ALWAYS check all 3 levels** in `calculateServiceCommission` and `calculateProductSalesCommission` functions.
- **Config changes apply to new items only**, not retroactively (unless manual recalculation requested).

### 12.5. Position and Seniority Bonus Consistency
- **Position bonus applies to commission components only**, not base salary.
- **Seniority bonus applies to base salary only**, not commission.
- **Calculation order matters:**
  ```typescript
  // ✅ CORRECT order
  const serviceCommission = calculateServiceCommission(...);  // Base commission
  const positionBonus = calculatePositionBonus(serviceCommission);  // Apply position multiplier
  const seniorityBonus = calculateSeniorityBonus(baseSalary);  // Apply to base salary
  const totalSalary = baseSalary + serviceCommission + positionBonus + seniorityBonus + ...;
  ```
- **DO NOT apply position bonus twice** (e.g., to both service and product sales separately, then again to the sum).

### 12.6. Manual Adjustments Approval Workflow
- **Manual adjustments MUST go through approval workflow** before affecting salary.
- **Only count approved adjustments** in salary calculation:
  ```typescript
  // ✅ GOOD: Filter approved only
  const approvedAdjustments = adjustments.filter(a => a.status === 'approved');
  const totalAdjustments = aggregateManualAdjustments({ adjustments: approvedAdjustments });
  ```
- **Status lifecycle:** `draft` → `pending` → `approved` → `applied` (in salary record)
- **Rejected adjustments are never applied** to salary calculations.

### 12.7. Commission Data Immutability After Salary Finalization
- **Once salary record reaches `status = 'finalized'`, commission data is LOCKED** (see Rule #8).
- **Prevent editing commission items if salary finalized:**
  ```typescript
  // ✅ GOOD: Check salary status before editing
  const salaryRecord = await getSalaryRecord(ktvId, monthYear);
  if (salaryRecord?.status === 'finalized' || salaryRecord?.is_locked) {
    throw new Error('Cannot edit commission: Salary record is finalized/locked');
  }
  ```
- **Audit trail:** Keep commission change history (use `updated_at`, `updated_by` fields).

### 12.8. Integration with Existing Salary Components
- **Commission system extends salary calculation, does NOT replace it.**
- **Salary components order:**
  1. Base salary (pro-rata if applicable)
  2. Session bonus (legacy session-based commission)
  3. Service commission (new service items commission)
  4. Product sales commission (new product sales commission)
  5. KPI bonus
  6. Position bonus (multiplier on commission components)
  7. Seniority bonus (percentage of base salary)
  8. Rating bonus (star rating bonus)
  9. Manual adjustments (bonus/deduction)
  10. Violations deduction (disciplinary fines)
- **Total salary = sum of all components** (with deductions subtracted).
- **NEVER omit any component** from total calculation (see Rule #7).

### 12.9. Testing Requirements for Commission Features
- **MANDATORY test scenarios for any commission feature:**
  1. Calculate with override (fixed and percentage)
  2. Calculate with tenant default
  3. Calculate with system default
  4. Apply position bonus (junior/senior/lead)
  5. Apply seniority bonus (0-1yr, 1-3yr, 3-5yr, 5+yr)
  6. Aggregate manual adjustments (bonus + deduction)
  7. Status filter (completed only)
  8. Month boundary (verify date range filtering)
  9. Multiple KTVs (verify isolation)
  10. Finalized salary (verify immutability)
- **Use existing test patterns** in `src/lib/business-rules/__tests__/commission.test.ts` (29 test cases).

---

## 11. Adding New Salary Field (NEW - 22/06/2026)
- **MANDATORY checklist when adding ANY new salary component field** (e.g., `product_sales_commission`, `overtime_bonus`, `transportation_allowance`): Follow `docs/development/SALARY_FIELD_ADDITION_CHECKLIST.md` **EXACTLY**.
- **8 layers MUST be updated** in correct order:
  1. Database schema migration (`ALTER TABLE salary_records ADD COLUMN ...`)
  2. Database RPC functions (`calculate_ktv_salary_sheet`, `get_salary_reconciliation_report`) - add CTE, JOIN, SELECT field, update total_salary formula
  3. TypeScript database types (`SalaryRecordRow`, `SalarySheetRow`)
  4. Backend RPC mapping (`base-salary-actions.ts` - add field to `mergeSalarySheetIntoRecord`)
  5. Backend query functions (`query-salary-actions.ts` - fetch source data, aggregate, map to salary record)
  6. Backend recalculation engine (`salary-recalculation-engine.ts` - calculate live value, handle draft vs non-draft, upsert)
  7. Frontend UI (`/api/payroll/employees/[id]/detail/route.ts` + `EmployeeDetailScreen.tsx` - fetch, calculate, render BreakdownCard, update summary)
  8. Test mocks (`*.test.ts` - add `.in()` method if needed, seed mock data, add query to script queue)
- **NEVER skip any layer** - This will cause:
  - Reconciliation RPC missing field → AI tính sai
  - Detail page missing field → UI hiển thị thiếu
  - Test mocks incomplete → Tests fail with "No scripted result" or "Expected X, got Y"
  - TypeScript types not updated → Runtime errors, hard to debug
- **Common mistakes:**
  - ❌ Forgot to add field to `total_salary` formula in RPC → Total sai
  - ❌ Forgot to handle NULL values → NaN in calculations
  - ❌ Test mock query order wrong → Test fails with table mismatch
  - ❌ Draft vs non-draft logic wrong → Saved values overwritten incorrectly
  - ❌ Status filter wrong → Count rejected/pending records incorrectly
- **Verification matrix:** After implementation, run ALL verifications:
  - `\d salary_records` in SQL Editor → Column exists
  - `SELECT [field] FROM calculate_ktv_salary_sheet(...)` → RPC returns field
  - `npm run build` → No TypeScript errors
  - `npm run test:critical` → All tests pass
  - Load detail page → Card displays correctly
  - Compare "AI tính" vs "Kế toán chốt" → Field included in both

**Real-world incident (22/06/2026):**
- Added `product_sales_commission` field but incomplete implementation
- Reconciliation showed wrong "AI tính" (missing product sales)
- Detail page showed wrong total (missing commission card)
- Tests failed: "No scripted result for product_sales.select"
- Root cause: Forgot to update RPC, detail API route, UI component, test mocks
- **Resolution:** Followed 8-layer checklist, fixed all layers systematically
- **Time lost:** ~6 hours debugging piecemeal fixes
- **Lesson:** ALWAYS follow `SALARY_FIELD_ADDITION_CHECKLIST.md` when adding salary fields. Saves 5+ hours of debugging.

---

## 12. Module Theme Color Override (NEW - 22/06/2026)
- **MANDATORY when adding new industry modules**: Read `docs/MODULE_THEME_COLOR_OVERRIDE_GUIDE.md` BEFORE implementing any UI for new module
- **API Route MUST parse JSONB correctly**: `{beauty_spa: true}` → `['beauty_spa']` (array of strings), NOT `[{beauty_spa: true}]` (array of objects)
- **TenantContextProvider MUST check array format FIRST**: `if (Array.isArray(enabledModules))` before `typeof enabledModules === 'object'`
- **Comprehensive CSS overrides REQUIRED**: Must override ALL rose/pink shades (50, 100, 200, 400, 500, 600) + opacity variants (/40, /50) + hover states + borders + shadows
- **Use wildcard selectors**: `[class*="bg-rose-50"]` to catch all variants, not just `.bg-rose-50`
- **Module isolation**: All overrides MUST be scoped with `html[data-tenant-module="module_key"]` to NOT affect other modules
- **Test checklist**: Dashboard, Customer pages, Bookings, Settings, Icons, Buttons, Cards, Badges, Loaders - ALL must use module colors
- **Verify in browser**: `document.documentElement.getAttribute('data-tenant-module')` must return correct module key

**Real-world incident (22/06/2026):**
- Added Beauty Spa module but forgot comprehensive CSS overrides
- UI showed pink (Baby Care) colors instead of green/teal (Beauty Spa)
- Root cause: API parsed JSONB wrong + missing CSS overrides for hardcoded Tailwind classes
- **Resolution:** Fixed API parsing, added 150+ lines of CSS overrides for all rose/pink shades
- **Time lost:** ~4 hours debugging and fixing colors across entire app
- **Lesson:** Always follow `MODULE_THEME_COLOR_OVERRIDE_GUIDE.md` when adding new module. Time saved: 3.5 hours.

---

## 14. TenantContextProvider White Screen Debug (NEW - 05/08/2026)

### 14.1. Development Environment NODE_ENV Requirement
- **ALWAYS set NODE_ENV=development when running dev server** to activate dev fallbacks
- **Issue symptom**: White screen on localhost:3000, no error messages, browser console shows TenantContextProvider logs but no content renders
- **Root cause**: `process.env.NODE_ENV` is undefined or not 'development' → Dev fallbacks don't activate → 401 from `/api/tenant/context` → Redirect logic fails → White screen stuck

### 14.2. Dev Fallback Context for 401 Unauthorized
- **MANDATORY dev fallback pattern** in TenantContextProvider:
  ```typescript
  if (response.status === 401) {
    console.warn('[TenantContextProvider] User not authenticated');
    
    // In development, use dev fallback context instead of redirecting
    if (process.env.NODE_ENV === 'development') {
      console.warn('[TenantContextProvider] Dev mode: Using fallback tenant context');
      setContext({
        tenantId: 'dev-tenant',
        tenantName: 'Bella Land (Dev)',
        enabledModules: ['real_estate', 'beauty_spa', 'cleaning'],
        subscriptionPlan: 'enterprise',
        featureFlags: {},
        settings: {},
      });
      setLoading(false);  // ✅ CRITICAL: Must set loading=false
      return;
    }
    
    // Production: redirect to login
    window.location.href = '/login';
    return;
  }
  ```
- **Why setLoading(false) is critical**: Without it, loading spinner shows infinitely even after context is set

### 14.3. Port Conflict and Stale Dev Server Processes
- **ALWAYS check for stale dev server processes** before starting new one
- **Symptoms**: "Port 3000 is in use by process [PID]", new server starts on port 3001 instead
- **Fix**: Kill old processes before starting dev server:
  ```powershell
  Get-Process -Name node | Stop-Process -Force
  npm run dev
  ```
- **Prevention**: Use process monitoring or VS Code tasks to ensure clean server restarts

### 14.4. Large Supabase Auth Cookie Size
- **Issue**: Supabase session token stored in cookie `sb-[project]-auth-token-base64` can exceed 4KB
- **Impact**: Large cookies can cause slow server-side auth.getUser() calls → SSR delay → White screen during hydration
- **Mitigation**: This is expected Supabase behavior; white screen should resolve after initial auth check completes
- **Don't confuse with**: NODE_ENV issue (white screen persists indefinitely vs temporary SSR delay)

### 14.5. Module-Specific Dashboard Redirects
- **Pattern**: Main `/dashboard` page redirects to module-specific dashboard based on `tenantModuleKey`
  ```typescript
  useEffect(() => {
    if (tenantModuleKey === 'bella_auto') {
      router.replace('/dashboard/bella-auto');
    }
  }, [tenantModuleKey, router]);
  ```
- **Loading skeleton during redirect**: Show neutral skeleton instead of `null` to prevent white screen flash:
  ```typescript
  if (tenantModuleKey === 'bella_auto') {
    return <div className="animate-pulse">...</div>;  // ✅ GOOD
    // return null;  // ❌ BAD: Causes white screen
  }
  ```

### 14.6. Server Component vs Client Component Loading States
- **Server Components** (bella-auto/page.tsx): Show suspense fallbacks during data fetch
- **Client Components** (dashboard/page.tsx): Show loading skeletons during useEffect data fetch
- **White screen occurs when**: No loading state shown during async operations

### 14.7. Debugging Checklist for White Screen Issues
When user reports white screen on localhost:
1. **Check NODE_ENV**: `$env:NODE_ENV` in PowerShell → Should be 'development'
2. **Check browser console**: F12 → Console → Look for `[TenantContextProvider]` logs
3. **Check Network tab**: F12 → Network → Filter 'tenant' → Check `/api/tenant/context` response (200 vs 401)
4. **Check cookies**: F12 → Application → Cookies → Check `sb-[project]-auth-token-base64` exists
5. **Check URL**: Is browser stuck on `/dashboard` or redirected to module-specific route?
6. **Check port conflicts**: Terminal shows "Port 3000 is in use" → Kill old processes
7. **Check React DevTools**: Components tab → Is TenantContextProvider mounted? What's its state?

### 14.8. Quick Fix Commands
```powershell
# 1. Kill all node processes
Get-Process -Name node | Stop-Process -Force

# 2. Set NODE_ENV and start dev server
$env:NODE_ENV = "development"
npm run dev

# 3. In browser: Hard refresh
# Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
```

### 14.9. Prevention Best Practices
- **Always set NODE_ENV** in dev scripts or IDE launch configurations
- **Add dev fallback context** to ALL context providers that depend on API auth
- **Show loading skeletons** during all async operations (don't return null)
- **Log context provider state changes** in development mode for debugging
- **Test with clean browser state** (incognito mode) to catch auth-dependent white screens

**Real-world incident (05/08/2026):**
- **Issue**: White screen on localhost:3000 after checkout/branch switch
- **Symptoms**: 
  - Browser shows blank white page with "Rendering" text only
  - Console logs show TenantContextProvider loading but no errors
  - Network tab shows `/api/tenant/context` returns 401 Unauthorized
  - No redirect to login page occurs
- **Root causes**:
  1. NODE_ENV not set → `process.env.NODE_ENV === undefined`
  2. Dev fallback check `if (process.env.NODE_ENV === 'development')` fails
  3. 401 triggers redirect logic but redirect doesn't execute
  4. React stuck in loading state with no context
- **Resolution**:
  1. Updated TenantContextProvider to use dev fallback for 401 in development
  2. Added `setLoading(false)` after setting fallback context
  3. Set `$env:NODE_ENV = "development"` before running dev server
  4. Killed stale node processes on port 3000
  5. Hard refresh browser (Ctrl+Shift+R)
- **Time lost**: ~20 minutes debugging white screen
- **Lesson**: Always set NODE_ENV=development when running dev server. Dev fallbacks MUST set loading=false. Kill stale processes before restart.

---ink (Baby Care) colors instead of green/teal (Beauty Spa)
- Root cause: API parsed JSONB wrong + missing CSS overrides for hardcoded Tailwind classes
- **Resolution:** Fixed API parsing, added 150+ lines of CSS overrides for all rose/pink shades
- **Time lost:** ~4 hours debugging and fixing colors across entire app
- **Lesson:** Always follow `MODULE_THEME_COLOR_OVERRIDE_GUIDE.md` when adding new module. Time saved: 3.5 hours.

---

## 13. Module Theme Color Mapping and CSS Isolation (NEW - 04/08/2026)

### 13.1. Primary Color to Preset Mapping in Runtime Theme Application
- **ALWAYS add new module primary colors to the color-to-preset switch statement** in `src/components/layout/sidebar.tsx` function `applyTenantBrandRuntime()`.
- **Critical mapping location:** Line ~250 in sidebar.tsx:
  ```typescript
  root.dataset.tenantBrandPreset = brand.stylePreset || (
    brand.primaryColor === '#074E44' ? 'jade_wellness' : 
    brand.primaryColor === '#1E3A8A' ? 'luxury_navy' : 
    brand.primaryColor === '#0891b2' ? 'ocean_clean' :  // ← ADD NEW COLORS HERE
    brand.primaryColor === '#1E40AF' ? 'ocean_clean' : 
    brand.primaryColor === '#18181B' ? 'graphite_luxe' : 
    'bella_rose'  // ← Fallback default
  );
  ```
- **Why this matters:** Without this mapping, the module will fall through to the default `'bella_rose'` preset, applying pink/rose CSS even though the module uses a different color palette.
- **Symptoms of missing mapping:**
  - Module shows wrong theme colors (e.g., Bella Auto showing pink instead of cyan/teal)
  - `data-tenant-brand-preset` attribute on `<html>` tag returns wrong value
  - CSS scoped to module preset doesn't apply
  - Sidebar gradient, nav colors, buttons all use fallback theme

### 13.2. Complete CSS Preset Definition in globals.css
- **EVERY new module theme preset MUST define ALL color tokens** in `src/app/globals.css`.
- **Required tokens for each preset:**
  ```css
  html[data-tenant-brand-preset="preset_name"] {
    /* Primary colors (MANDATORY) */
    --tenant-primary-50: #...;
    --tenant-primary-100: #...;
    --tenant-primary-200: #...;
    --tenant-primary-400: #...;
    --tenant-primary-500: #...;  /* Main brand color */
    --tenant-primary-600: #...;
    --tenant-primary-700: #...;
    
    /* Accent colors (MANDATORY) */
    --tenant-accent-50: #...;
    --tenant-accent-100: #...;
    --tenant-accent-200: #...;
    --tenant-accent-400: #...;
    --tenant-accent-500: #...;
    --tenant-accent-600: #...;
    
    /* Navigation colors (MANDATORY) */
    --tenant-nav-text: #...;
    --tenant-nav-icon: #...;
    --tenant-nav-active-bg: #...;
    --tenant-nav-hover-bg: #...;
    
    /* Gradient stops (MANDATORY for sidebar) */
    --tenant-gradient-from: #...;
    --tenant-gradient-to: #...;
  }
  ```
- **Text contrast validation:** Ensure nav text colors meet WCAG AA contrast ratio (4.5:1 minimum) against gradient backgrounds.
- **Test with color contrast checker:** Use browser DevTools or online tools to verify readability.

### 13.3. Text Contrast and Explicit Child Selectors
- **NEVER rely on CSS inheritance for navigation text colors** - child elements (svg, span) may not inherit properly.
- **Use explicit child selectors** for all text/icon elements:
  ```css
  .bella-erp-nav-item,
  .bella-erp-nav-item svg,
  .bella-erp-nav-item span {
    color: var(--tenant-nav-text) !important;
  }
  
  .bella-erp-nav-item:hover,
  .bella-erp-nav-item:hover svg,
  .bella-erp-nav-item:hover span {
    color: var(--tenant-nav-hover-text, var(--tenant-nav-text)) !important;
  }
  ```
- **Common mistake:** Setting color only on parent `.bella-erp-nav-item` without explicit child rules → text remains gray/invisible.
- **Symptoms:**
  - Navigation text appears gray or hard to read
  - Icons have different color than text
  - Hover state doesn't change text color
  - User complains "chữ vẫn màu xám" (text still gray)

### 13.4. Module-Specific Menu Items Registration
- **ALWAYS register new module menus in sidebar.tsx** with proper flag and validation.
- **Required steps:**
  1. Create module menu items array (e.g., `bellaAutoMenuItems: MenuItem[]`)
  2. Add module shell flag (e.g., `isBellaAutoShell = enabledModules.includes('bella_auto')`)
  3. Validate module in conditional logic before rendering menu
  4. Example pattern:
     ```typescript
     const bellaAutoMenuItems: MenuItem[] = [
       { name: 'Dashboard', icon: HomeIcon, href: '/dashboard/bella-auto' },
       { name: 'Vehicles', icon: TruckIcon, href: '/dashboard/bella-auto/vehicles' },
       // ... more items
     ];
     
     const isBellaAutoShell = enabledModules.includes('bella_auto');
     
     // In JSX:
     {isBellaAutoShell && bellaAutoMenuItems.map((item) => (
       <NavItem key={item.name} item={item} />
     ))}
     ```

### 13.5. Dashboard Redirect for Module Default Route
- **ALWAYS add module redirect in `/dashboard/page.tsx`** to route users to module-specific dashboard.
- **Pattern:**
  ```typescript
  // After tenant/user validation
  const enabledModules = tenantData.enabled_modules || {};
  
  if (enabledModules.bella_auto) {
    redirect('/dashboard/bella-auto');
  }
  if (enabledModules.real_estate) {
    redirect('/dashboard/real-estate');
  }
  // ... other modules
  ```
- **Order matters:** Place module checks in priority order (highest priority first).
- **Fallback:** Always have a default redirect if no modules match.

### 13.6. Module Registration in tenant-modules.ts
- **ALWAYS register new modules in central registry** `src/lib/business-rules/tenant-modules.ts`.
- **Required additions:**
  1. Add module key to `TENANT_MODULE_KEYS` array
  2. Add to `TENANT_PRIMARY_BUSINESS_MODULE_KEYS` if it's a primary vertical
  3. Create `DEFAULT_[MODULE]_TENANT_BRAND_THEME` config with:
     - `primaryColor` (hex)
     - `accentColor` (hex)
     - `stylePreset` (string matching globals.css preset name)
  4. Example:
     ```typescript
     export const TENANT_MODULE_KEYS = [
       'beauty_spa',
       'babycare',
       'real_estate',
       'bella_auto',  // ← NEW MODULE
     ] as const;
     
     export const DEFAULT_BELLA_AUTO_TENANT_BRAND_THEME: TenantBrandTheme = {
       primaryColor: '#0891b2',  // cyan-600
       accentColor: '#14b8a6',   // teal-500
       stylePreset: 'ocean_clean',
     };
     ```

### 13.7. Browser Cache and Service Worker Considerations
- **ALWAYS instruct users to hard refresh after theme changes:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Service Worker can cache old CSS:** If project uses SW, ensure it skips caching CSS files or has cache-busting strategy
- **Verification in DevTools:**
  - Check `document.documentElement.dataset.tenantBrandPreset` → should return correct preset name
  - Check computed styles for `--tenant-primary-500` → should match module color
  - Check Network tab → CSS files should not come from SW cache after hard refresh

### 13.8. Testing Checklist for New Module Themes
- **MANDATORY verification before marking theme implementation complete:**
  - [ ] `data-tenant-brand-preset` attribute on `<html>` returns correct preset name
  - [ ] Sidebar gradient uses module colors (not pink/rose)
  - [ ] Navigation text is readable (high contrast against background)
  - [ ] Navigation icons match text color
  - [ ] Hover states work and maintain readability
  - [ ] Buttons use module primary color
  - [ ] Cards/badges use module accent color
  - [ ] Loading spinners use module colors
  - [ ] All color tokens defined in globals.css
  - [ ] Primary color mapped in sidebar.tsx line ~250
  - [ ] Module registered in tenant-modules.ts
  - [ ] Dashboard redirect added in /dashboard/page.tsx
  - [ ] Menu items registered in sidebar.tsx

### 13.9. Common Failure Patterns and Solutions

**Pattern 1: Pink theme still showing on new module**
- **Cause:** Primary color not mapped in sidebar.tsx switch statement
- **Fix:** Add `brand.primaryColor === '#...' ? 'preset_name' :` to line ~250
- **Verification:** Check `document.documentElement.dataset.tenantBrandPreset` in console

**Pattern 2: Navigation text is gray/unreadable**
- **Cause:** Missing explicit child selectors for svg/span elements
- **Fix:** Add `.bella-erp-nav-item svg, .bella-erp-nav-item span { color: ... }` rules
- **Verification:** Inspect element, check computed color value on text nodes

**Pattern 3: Wrong preset applied despite correct database config**
- **Cause:** Browser cache or Service Worker serving stale assets
- **Fix:** Hard refresh (Ctrl+Shift+R), clear site data, restart dev server
- **Verification:** Check Network tab for 200 (not 304 or from SW) responses

**Pattern 4: Module shows up but uses wrong colors**
- **Cause:** CSS preset not defined or has wrong tokens
- **Fix:** Add complete token set in globals.css, verify all --tenant-* variables
- **Verification:** Computed styles in DevTools should show module colors

### 13.10. Documentation Requirements
- **ALWAYS update MODULE_THEME_COLOR_OVERRIDE_GUIDE.md** when adding new patterns or fixes
- **Document color rationale:** Why specific colors chosen (brand alignment, psychology, industry convention)
- **Include screenshots:** Before/after showing theme application
- **Add to incident log:** If bugs found, document root cause and resolution

**Real-world incident (04/08/2026 - Bella Auto Module):**
- **Issue:** Bella Auto module showed pink Bella Spa colors instead of cyan/teal Ocean Clean theme
- **Root cause #1:** Primary color #0891b2 (cyan) not mapped in sidebar.tsx line 250 → fell through to 'bella_rose' default
- **Root cause #2:** Navigation text had low contrast, appeared gray on gradient background
- **Root cause #3:** Missing explicit svg/span color rules → child elements didn't inherit parent color
- **Resolution:**
  1. Added `brand.primaryColor === '#0891b2' ? 'ocean_clean' :` to color switch
  2. Changed nav text from teal (#ccfbf1) to sky blue (#e0f2fe) for better contrast
  3. Added explicit child selectors: `.bella-erp-nav-item svg, .bella-erp-nav-item span { color: var(--tenant-nav-text) !important; }`
  4. Verified data-tenant-brand-preset returns 'ocean_clean'
- **Time lost:** ~3 hours iterating on text contrast and mapping bugs
- **Commits:** 7 commits to fix progressively (7dc2839c final fix)
- **Lesson:** ALWAYS add primary color mapping immediately when creating module, test with DevTools before considering done

---

## 11. Mobile Development & RPC Best Practices (Week 3 Lessons - 2026-06-22)

### 11.1. Never Use Client-Side Fallbacks for Authorization
- **NEVER implement client-side filtering as a "temporary" fallback** for server-side RPCs.
- **Example of FORBIDDEN pattern:**
  ```typescript
  // ❌ BAD: Client-side fallback
  const { data, error } = await supabase.rpc('rpc_with_auth_filter', params);
  if (error) {
    // Fallback to client-side filter
    return fetchAllData().filter(item => item.userId === currentUser);
  }
  ```
- **Why it's dangerous:**
  - Client can tamper `userId` parameter to see other users' data
  - Security bypass: authorization moved from server to client
  - Performance: fetch all data then filter locally (not scalable)
- **Correct pattern:**
  ```typescript
  // ✅ GOOD: Throw error if RPC fails
  const { data, error } = await supabase.rpc('rpc_with_auth_filter', params);
  if (error) {
    throw new Error(`Failed to fetch: ${error.message}`);
  }
  return data;
  ```
- **Real-world incident (Week 2-3):**
  - Mobile app had `fetchTodaySessionsFallback` function with client-side filtering
  - User review: "Đây là thứ tôi sẽ không cho phép tồn tại lâu"
  - Resolution: Removed 140+ lines of fallback code, RPC-only approach
  - Impact: Security rating 8/10 → 10/10

### 11.2. Server-Side Filtering for Role-Based Data
- **ALWAYS filter role-based data server-side via RPC**, not client-side.
- **Example: KTV should only see their assigned sessions**
  ```sql
  -- ✅ GOOD: RPC with server-side JOIN
  CREATE OR REPLACE FUNCTION rpc_ktv_dashboard_stats(
    p_tenant_id UUID,
    p_ktv_id UUID,
    p_today DATE
  )
  RETURNS TABLE (total_sessions INT, completed_sessions INT)
  AS $$
    SELECT
      COUNT(*)::INT AS total_sessions,
      COUNT(*) FILTER (WHERE sl.status = 'completed')::INT AS completed_sessions
    FROM session_logs sl
    JOIN bookings b ON b.id = sl.booking_id
    WHERE
      sl.tenant_id = p_tenant_id
      AND sl.scheduled_date = p_today
      AND b.assigned_ktv_id = p_ktv_id;  -- ✅ Server-side filter
  $$;
  ```
- **Real-world incident (Week 2-3):**
  - KTV dashboard counted ALL spa sessions instead of only assigned ones
  - Example: 10 total sessions → KTV A has 2 → App showed "10 ca" (wrong)
  - Resolution: Created `rpc_ktv_dashboard_stats` with `assigned_ktv_id` filter
  - Impact: Business Logic accuracy 7/10 → 10/10

### 11.3. Complete Error Handling in Mobile Hooks
- **ALWAYS expose error state and retry functionality** in React hooks.
- **Required states:** `{ data, isLoading, error, retry/refresh }`
- **Example pattern:**
  ```typescript
  export function useDataFetch(params) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null); // ✅ Required
    
    const load = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await fetchData(params);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    }, [params]);
    
    useEffect(() => { void load(); }, [load]);
    
    return { data, isLoading, error, retry: load }; // ✅ Expose error & retry
  }
  ```
- **UI must handle all states:**
  - Loading: Show skeleton or spinner
  - Error: Show error message with retry button
  - Empty: Show empty state
  - Success: Show data
- **Real-world incident (Week 2-3):**
  - Hooks had no error handling → service errors caused blank screens
  - User feedback: "Tôi muốn Loading, Error, Retry, Offline, Empty, Success đầy đủ"
  - Resolution: Added error state to all hooks, created `DashboardErrorState` component
  - Impact: Error Handling 7/10 → 9/10

### 11.4. RPC Deployment Must Be Immediate, Not Deferred
- **NEVER defer RPC deployment** while keeping fallback code "temporarily".
- **Deploy RPCs immediately after creation:**
  ```bash
  # ✅ Correct workflow
  1. Write RPC migration: migrations/YYYYMMDD_feature.sql
  2. Test locally: supabase db reset
  3. Deploy to staging: supabase db push --project-ref STAGING
  4. Test on staging
  5. Deploy to production: supabase db push --project-ref PROD
  6. Update service code to use RPC (no fallback)
  ```
- **Why deferring is dangerous:**
  - Fallback code becomes "temporary" debt that stays for weeks
  - Security vulnerabilities remain in codebase
  - Creates false sense of safety ("RPC will be deployed later")
- **Real-world incident (Week 2-3):**
  - Week 2 created RPC but kept fallback "until deployment"
  - Fallback existed for 7+ days with security risk
  - User directive: Fix foundation before new features
  - Resolution: Deployed RPCs immediately, removed all fallback code
  - Lesson: **Fallbacks are tech debt, deploy RPCs immediately**

### 11.5. Test Role-Based Queries with Multiple Test Users
- **ALWAYS test role-based queries with 2+ users** to verify isolation.
- **Test scenario example:**
  ```typescript
  // ✅ Integration test for KTV stats isolation
  test('KTV A sees only their sessions, not KTV B sessions', async () => {
    const tenantId = 'test-tenant';
    const ktvA = 'user-ktv-a';
    const ktvB = 'user-ktv-b';
    
    // Assign 3 sessions to KTV A
    await createSessions(tenantId, ktvA, 3);
    // Assign 7 sessions to KTV B
    await createSessions(tenantId, ktvB, 7);
    
    // Query as KTV A
    const statsA = await fetchKtvStats(tenantId, ktvA);
    expect(statsA.total).toBe(3); // NOT 10
    
    // Query as KTV B
    const statsB = await fetchKtvStats(tenantId, ktvB);
    expect(statsB.total).toBe(7); // NOT 10
  });
  ```
- **Real-world incident (Week 2-3):**
  - KTV stats bug not caught early because tests used single user
  - Production pilot would have shown all spa sessions to every KTV
  - Resolution: Need integration tests for "User A sees only their data"
  - Lesson: **Multi-user test scenarios catch authorization bugs early**

### 11.6. User Feedback Drives Quality Over Speed
- **Prioritize quality over features when foundation is unstable.**
- **Real-world decision (Week 3):**
  - Original plan: Implement QR Check-in/GPS tracking
  - User review: Week 2 rating 8.8/10 (3 critical issues)
  - User directive: "Trước khi bước sang các tính năng hấp dẫn như QR Check-in, GPS Tracking, tôi sẽ yêu cầu đội phát triển hoàn thành 4 việc sau: Deploy RPC, loại bỏ fallback, sửa KPI KTV, bổ sung error state đầy đủ"
  - **Decision: Defer all new features, fix foundation first**
  - Result: Week 3 fixed all 3 issues → rating 8.8/10 → 9.4/10
  - Quote: "Nếu nền dashboard chưa ổn định: Check-in → Thống kê sai → KTV mất niềm tin"
  - **Lesson: Unstable foundation → User loses trust → Features don't matter**

### 11.7. Inline Error UI for Section-Level Errors
- **Use inline error displays** for section-level errors (not full-screen).
- **Pattern:**
  ```tsx
  // ✅ Section-level error with retry context
  {statsError ? (
    <View style={styles.inlineError}>
      <Text style={styles.inlineErrorIcon}>⚠️</Text>
      <View style={styles.inlineErrorContent}>
        <Text style={styles.inlineErrorTitle}>Không thể tải thống kê</Text>
        <Text style={styles.inlineErrorMessage}>{statsError}</Text>
      </View>
    </View>
  ) : (
    // Show data
  )}
  ```
- **When to use:**
  - Stats section fails but sessions list works → show inline error for stats only
  - User can still see working sections, retry failed section independently
- **When to use full-screen error:**
  - Critical failure: auth, tenant loading, network offline
  - User cannot proceed without fixing the error
- **Real-world implementation (Week 3):**
  - Created `DashboardErrorState` component for full-screen errors
  - Created inline error UI for section-level errors
  - Red background + left border + error icon + message
  - Impact: User never sees blank screens, knows what failed

### 11.8. Supabase RPC Security Patterns
- **Use `SECURITY DEFINER` with tenant isolation:**
  ```sql
  CREATE OR REPLACE FUNCTION rpc_function(p_tenant_id UUID, ...)
  SECURITY DEFINER  -- Run with function owner privileges
  AS $$
    SELECT ...
    WHERE tenant_id = p_tenant_id  -- ✅ Always filter by tenant
      AND ...;  -- Additional filters
  $$;
  ```
- **Why `SECURITY DEFINER`:**
  - Mobile users may not have direct SELECT on all tables
  - RPC bypasses RLS (Row-Level Security)
  - **CRITICAL:** MUST filter by `tenant_id` to prevent cross-tenant data leaks
- **Security checklist:**
  - [ ] Function marked `SECURITY DEFINER`
  - [ ] Function marked `STABLE` (not `VOLATILE`) for query optimization
  - [ ] First WHERE clause filters by `tenant_id`
  - [ ] Additional filters for role-based isolation (e.g., `assigned_ktv_id`)
  - [ ] GRANT EXECUTE to `authenticated` role only
  - [ ] Test with multiple tenants to verify isolation

### 11.9. Documentation Must Reflect Reality
- **Update documentation immediately after fixes**, not later.
- **Documents updated in Week 3:**
  - `WEEK_2_BUG_FIXES.md` — Marked issues as RESOLVED with solutions
  - `WEEK_3_COMPLETION_REPORT.md` — Comprehensive completion report
  - `AGENTS.md` — This section (lessons learned)
- **Why immediate updates matter:**
  - Future developers see what was fixed and why
  - Prevents repeating same mistakes
  - Shows decision-making process (quality over features)
- **Commit message format:**
  ```
  Week 3: Fix Week 2 technical debt - RPC, KTV stats, error handling
  
  ✅ Issue #1 Fixed: KTV stats now filtered by assigned_ktv_id
  ✅ Issue #2 Fixed: Removed insecure client-side fallback
  ✅ Issue #3 Fixed: Complete error handling
  ✅ Verification: All type checks and build pass
  
  Impact: Raises rating from 8.8/10 to 9.4/10
  ```

---


---

## 15. Bella Hospital Enterprise Architecture Compliance (NEW - 07/08/2026)

### 15.1. Architecture Blueprint Reference
- **MANDATORY:** Read `docs/architecture/BELLA_HOSPITAL_ENTERPRISE_ARCHITECTURE.md` before implementing ANY hospital feature.
- This document defines the **Platform-of-Platforms** architecture:
  - **Layer 1: Bella Host Platform** (Foundation: Identity, Workflow, AI, Notification, etc.)
  - **Layer 2: Industry Platforms** (Healthcare Platform with shared engines: MPI, Billing, Queue, Bed, Nursing, etc.)
  - **Layer 3: Product Packs** (Hospital, Medical Clinic, Dental Clinic - UI + workflows only)

### 15.2. Critical Architecture Principle: Engine Ownership
**Hospital is a PRODUCT PACK, NOT a Platform.**

#### What Hospital Product Pack Contains:
- ✅ UI Pages (dashboards, forms, viewers)
- ✅ Hospital-specific workflows (admission, discharge, transfer)
- ✅ Hospital-specific business rules (on top of engine APIs)
- ✅ Hospital-specific reports and analytics views

#### What Hospital Product Pack DOES NOT Contain:
- ❌ **MPI logic** (uses MPI Engine from Healthcare Platform)
- ❌ **Billing logic** (uses Billing Engine from Healthcare Platform)
- ❌ **Queue logic** (uses Smart Queue Engine from Healthcare Platform)
- ❌ **Bed allocation logic** (uses Bed Engine from Healthcare Platform)
- ❌ **Nursing engine logic** (uses Nursing Engine from Healthcare Platform)
- ❌ **AI logic** (uses AI Platform Runtime from Host Platform)
- ❌ **Workflow engine** (uses Workflow Runtime from Host Platform)
- ❌ **Notification logic** (uses Notification Center from Host Platform)

**Rule:** If it's domain logic (not hospital-specific UI/workflow), it belongs in Healthcare Platform, NOT Hospital Product Pack.

### 15.3. Healthcare Platform Shared Engines
All healthcare products (Medical Clinic, Dental Clinic, Hospital, Pharmacy, Laboratory) MUST consume these engines:

#### Engine List (Healthcare Platform Layer)
1. **MPI Engine** - Master Patient Index, patient search, identity resolution
2. **Encounter Engine** - Visit management, registration, check-in/check-out
3. **Clinical Engine** - SOAP notes, diagnosis (ICD-10), procedures (ICD-9-CM)
4. **Order Engine** - Clinical orders lifecycle, order fulfillment tracking
5. **Billing Engine** - Charge capture, invoicing, payment processing
6. **Insurance Engine** - Insurance verification, claims submission
7. **Scheduling Engine** - Appointment booking, availability management
8. **Smart Queue Engine** - Queue optimization, AI calling, wait time prediction
9. **Pharmacy Engine** - Drug database, DDI checking, dispensing (MAR is part of this)
10. **Laboratory Engine** - Test catalog, result entry, result interpretation
11. **Imaging Engine** - Modality worklist, PACS integration, DICOM
12. **Bed Engine** - Bed availability, allocation algorithm, occupancy tracking
13. **Nursing Engine** - Nursing workflows, vital signs, documentation, handoff
14. **Emergency Engine** - Triage (ESI 1-5), ED workflow, NEDOCS calculation
15. **Infection Control Engine** - Surveillance algorithms, outbreak detection
16. **Clinical Decision Support Engine** - Clinical pathways, order sets, alerts
17. **Voice AI Engine** - Voice-to-text, voice commands, clinical note generation
18. **Healthcare Analytics Engine** - Clinical BI, quality metrics, dashboards

**Critical Rule:** Hospital Product Pack NEVER implements these engines. It only CONSUMES them via API contracts.

### 15.4. Host Platform Shared Services
All products (across ALL industries) MUST consume these services:

#### Service List (Host Platform Layer)
1. **Identity & IAM** - SSO, RBAC, MFA, LDAP
2. **Tenant Management** - Multi-tenancy, white-labeling
3. **Organization Center** - Org chart, departments
4. **Person Center** - Universal person registry
5. **Notification Center** - Email, SMS, push, in-app
6. **Document Management** - DMS, versioning, templates
7. **File Storage** - S3-compatible object storage
8. **Workflow Runtime** - BPMN engine, approval workflows
9. **Policy Runtime** - Policy enforcement, dynamic permissions
10. **Rule Engine** - Business rules, decision tables
11. **Event Bus** - Event-driven architecture, pub/sub
12. **Automation Runtime** - Scheduled jobs, RPA
13. **AI Platform Runtime** - LLM gateway, embeddings, RAG
14. **Integration Runtime** - HL7, FHIR, DICOM, API gateway
15. **Contract Registry** - API/Event/Schema registry (NEW)
16. **Capability Registry** - Capability catalog (NEW)
17. **Feature Flag Platform** - Dark launch, canary, progressive rollout (NEW)
18. **Metadata Platform** - Schema registry, data catalog
19. **Audit & Compliance** - Audit logs, compliance reports
20. **Plugin Runtime** - Plugin marketplace, hot-swap

**Critical Rule:** Hospital Product Pack NEVER implements workflow engine, notification system, or AI runtime. It only CONSUMES them.

### 15.5. Current Implementation Violation (Must Fix)
**CRITICAL:** Current codebase violates platform architecture. Engines are in Hospital services, NOT Healthcare Platform.

#### ❌ WRONG (Current State):
```typescript
// src/services/healthcare-hospital-services.ts
export class BedEngineService { ... }           // ❌ Engine in product pack
export class NursingVitalsService { ... }       // ❌ Engine in product pack
export class MARService { ... }                 // ❌ Engine in product pack (should be in Pharmacy Engine)
export class InpatientAdmissionService { ... }  // ❌ Contains engine logic (should consume Encounter + Bed engines)
```

#### ✅ CORRECT (Target State):
```typescript
// src/platform/healthcare/engines/bed-engine/
export class BedEngine {
  allocateBed(request: BedAllocationRequest): Promise<Bed> { ... }
  transferBed(request: BedTransferRequest): Promise<Bed> { ... }
  getOccupancy(wardId: string): Promise<OccupancySnapshot> { ... }
}

// src/platform/healthcare/engines/pharmacy-engine/
export class PharmacyEngine {
  createMAR(request: CreateMARRequest): Promise<MAR> { ... }
  administerMAR(request: AdministerMARRequest): Promise<MAR> { ... }
  checkDDI(drugIds: string[]): Promise<DDIResult[]> { ... }
}

// src/products/bella-hospital/hooks/
export function useBedEngine() {
  return usePlatformEngine<BedEngine>('bed-engine'); // ✅ Consume engine via hook
}

export function usePharmacyEngine() {
  return usePlatformEngine<PharmacyEngine>('pharmacy-engine'); // ✅ Consume engine via hook
}
```

### 15.6. Refactoring Priority (Phase 0 - BEFORE Phase B)
**CRITICAL:** Move all engines from Hospital Product Pack to Healthcare Platform BEFORE implementing new modules.

#### Step 1: Extract Engines (4-6 weeks)
1. Move `BedEngineService` → `src/platform/healthcare/engines/bed-engine/`
2. Move `NursingVitalsService` → `src/platform/healthcare/engines/nursing-engine/vital-signs.service.ts`
3. Move `MARService` → `src/platform/healthcare/engines/pharmacy-engine/mar.service.ts`
4. Refactor `InpatientAdmissionService` to consume `EncounterEngine` + `BedEngine`

#### Step 2: Define API Contracts
1. Create `src/platform/healthcare/contracts/bed-engine.contract.ts`
2. Create `src/platform/healthcare/contracts/nursing-engine.contract.ts`
3. Create `src/platform/healthcare/contracts/pharmacy-engine.contract.ts`
4. Register contracts in Contract Registry

#### Step 3: Feature Flag Migration
1. Add feature flag: `healthcare.new-engine-architecture`
2. Implement dual-path (old service + new engine) for gradual migration
3. Test with 1-2 pilot tenants
4. Rollout to all tenants
5. Remove old service code

### 15.7. New Implementation Checklist (Corrected)
When implementing ANY new hospital feature:

1. ✅ **Is this a shared engine or product-specific UI?**
   - If engine → Implement in Healthcare Platform (`src/platform/healthcare/engines/`)
   - If UI/workflow → Implement in Hospital Product Pack (`src/products/bella-hospital/`)

2. ✅ **Does this feature need MPI, Billing, Queue, Bed, Nursing?**
   - If YES → Consume existing engine via API contract (DO NOT reimplement)
   - If NO → Implement as product-specific logic

3. ✅ **Does this feature need Workflow, Notification, AI?**
   - If YES → Consume Host Platform services (DO NOT reimplement)
   - If NO → Implement as product-specific logic

4. ✅ **Create API contract first** (if new engine)
   - Define contract interface in `src/platform/healthcare/contracts/`
   - Register in Contract Registry
   - Implement engine
   - Implement product pack consumer

5. ✅ **Use Feature Flags for rollout**
   - Add feature flag via Feature Flag Platform
   - Implement dual-path for gradual migration
   - Test with pilot tenants
   - Rollout progressively

6. ✅ **Register in Capability Registry**
   - Add capability to `src/platform/host/capability-registry/`
   - Products declare required capabilities in manifest
   - Runtime checks capability before enabling features

7. ✅ **Never duplicate engine logic**
   - Search existing engines before implementing
   - If similar logic exists in another product → Extract to shared engine
   - If logic is truly product-specific → Document why it's not shared

### 15.8. Anti-Patterns to Avoid (Updated)
- ❌ **Implementing MPI in Hospital** - Use MPI Engine from Healthcare Platform
- ❌ **Implementing Billing in Dental Clinic** - Use Billing Engine from Healthcare Platform
- ❌ **Implementing Queue in Medical Clinic** - Use Smart Queue Engine from Healthcare Platform
- ❌ **Implementing Workflow in Hospital** - Use Workflow Runtime from Host Platform
- ❌ **Implementing Notification in Hospital** - Use Notification Center from Host Platform
- ❌ **Duplicating Bed Engine across products** - ALL products use SAME Bed Engine
- ❌ **Creating product-specific AI logic** - Use AI Platform Runtime from Host Platform
- ❌ **Hardcoding feature flags in code** - Use Feature Flag Platform
- ❌ **Skipping API contracts** - Always define contracts first, then implement

### 15.9. Architecture Freeze Readiness
**Current Status:** 70/100 (needs Platform-of-Platforms refactor)

**To reach Architecture Freeze (98/100):**
1. ✅ Move all engines from Hospital to Healthcare Platform (Phase 0)
2. ✅ Implement Contract Registry
3. ✅ Implement Capability Registry
4. ✅ Implement Feature Flag Platform
5. ✅ Define all engine API contracts
6. ✅ Refactor Hospital to consume engines (not implement)
7. ✅ Document engine ownership matrix
8. ✅ Pilot with 1-2 tenants
9. ✅ Validate zero engine duplication across products
10. ✅ Final architecture review and freeze

**After freeze:** Only add NEW engines to Healthcare Platform, never duplicate existing ones. Hospital remains a thin UI/workflow layer consuming platform engines.

---
