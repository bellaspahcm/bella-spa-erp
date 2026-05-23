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
