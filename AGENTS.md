<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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



