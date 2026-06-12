<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Knowledge Entry Points
- Trước khi làm việc diện rộng, bắt đầu từ `docs/index.md`.
- Với AI agent onboarding và lưu trữ context, làm theo `docs/AI_AGENT_ONBOARDING.md` và `docs/KNOWLEDGE_STORAGE_PROCESS.md`.
- Khi khởi tạo, mở rộng, sửa lỗi hoặc thương mại hóa phân hệ ngành mới như Beauty Spa, bắt buộc đọc và cập nhật `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` để không lặp lại lỗi tenant/module/brand/demo data/accounting/UI đã gặp.

# CRITICAL BELLA ERP DEVELOPMENT & TESTING RULES

You must strictly adhere to the following rules when working on this codebase to prevent regression bugs:

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
## 8. Package-Based KTV Session Multipliers
- **Dynamic Session quy đổi**: The system calculates the total completed sessions count dynamically based on the package coefficients:
  - **Combo Mẹ & Bé Tiết Kiệm (and basic packages)**: `1.0` multiplier.
  - **Combo Mẹ & Bé Hạnh Phúc**: `1.5` multiplier.
  - **Combo Mẹ & Bé VIP Toàn Diện**: `2.0` multiplier.
- **Decimal Counts**: The sessions count in `salary_records` (represented by `total_sessions`) is typed as `NUMERIC(5,2)` in PostgreSQL and `number` in TypeScript to accurately hold decimal values (e.g. `14.5` ca).
- **Rule alignment**: Any calculate, query, or report module (including the central `recalculateAndSaveSalaryRecord` engine, `getSalaryData` frontend fetch, and database RPCs like `calculate_ktv_salary_sheet`) **MUST** fetch package details from the `packages` table and sum sessions using `session_multiplier` coefficients, instead of using raw record counts (e.g., `sessions.length`).
- **Tests Mocking**: When mocking salary calculations in Jest integration pipelines, the mocks must respect the package session multiplier mapping and keep the mock `salary_records` store fully updated to prevent regression.

## 9. Static Analysis and Security Gate Integrity
- **Static analysis findings are blocking by default.** Do not bypass Semgrep, Trivy, Gitleaks, secret scans, or audit gates with broad ignore patterns. Any ignore must be scoped to non-runtime artifacts such as docs, archives, generated reports, screenshots, or tests.
- **Dependency vulnerability exceptions require a written rationale.** If a dependency has no patched npm release or is constrained by export/test compatibility, document the reason in the audit allowlist or `.trivyignore`, keep the ignore narrow to the exact CVE/GHSA, and revisit it before upgrading or replacing the package.
- **Server/runtime logs must use constant format strings.** Prefer `console.error('Context: %s', value)` or structured fields over template-string log messages for user-controlled or external values. This prevents unsafe format-string findings and reduces accidental log leakage.
- **Security gate changes must be verified locally before push.** At minimum run the relevant combination of `npm.cmd run security:audit`, `npm.cmd run security:secrets`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:critical`, and `git diff --check`.
