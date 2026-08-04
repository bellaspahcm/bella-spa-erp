<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Knowledge Entry Points
- Trước khi làm việc diện rộng, bắt đầu từ `docs/index.md`.
- Với AI agent onboarding và lưu trữ context, làm theo `docs/AI_AGENT_ONBOARDING.md` và `docs/KNOWLEDGE_STORAGE_PROCESS.md`.
- Khi khởi tạo, mở rộng, sửa lỗi hoặc thương mại hóa phân hệ ngành mới như Beauty Spa, bắt buộc đọc và cập nhật `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` để không lặp lại lỗi tenant/module/brand/demo data/accounting/UI đã gặp.

# CRITICAL BELLA ERP DEVELOPMENT & TESTING RULES

## 0. Architectural Invariant 01 — Zero Regression & Freeze Policy
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