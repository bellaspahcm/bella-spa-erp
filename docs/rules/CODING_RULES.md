# Coding Rules & Coding Conventions

**Applicability:** All developers and AI Coding Agents  
**Scope:** Repository-wide  

---

## 1. Strict Typing (Law 14)

TypeScript strict mode is fully enforced.

*   ❌ **FORBIDDEN:** `any` type (e.g., `: any`, `as any`, `<any>`).
*   ✅ **MANDATORY:** Define precise interfaces, DTOs, or types. Use `unknown` with runtime type guarding if the type is truly dynamic.
*   **Enforcement:** Scanned automatically via `npm run healthcare:guard`.

---

## 2. Frontend-Backend Boundary

UI pages must not contain direct persistence logic.

*   ❌ **FORBIDDEN:** Direct calls to `supabase.from(...)` for mutations (INSERT/UPDATE/DELETE) or complex queries within UI pages (e.g. `beds/page.tsx`, `mar/page.tsx`).
*   ✅ **MANDATORY:** Delegate all DB operations to Hook Services or Service engines (e.g., `BedEngineService.updateBedStatus()`).
*   **Exception:** Setting up Supabase real-time channel subscriptions is permitted in UI files, but no mutations or business logic should be executed there.

---

## 3. No Mock Runtime In Production

Mock fallbacks mask database or configuration errors and are dangerous.

*   ❌ **FORBIDDEN:** Hardcoded in-memory arrays (e.g., `MOCK_BEDS`, `MOCK_ADMISSIONS`) used as fallbacks when a DB query fails.
*   ✅ **MANDATORY:** Bubble up the database error or display a clean, user-friendly error state. Do not return mocked data.
