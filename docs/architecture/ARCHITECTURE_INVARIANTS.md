# Architecture Invariants

**Scope:** Repository-wide architecture limits and invariants.  
**Audience:** All developers and AI coding tools.  

---

## 1. Dependency Invariants

*   **Rule:** Dependencies must only flow downwards: `Product → Contract → Kernel → Platform Core`.
*   ❌ **FORBIDDEN:** A Kernel engine importing a product file (e.g. `nursing-engine` importing `bella-hospital` files).
*   ❌ **FORBIDDEN:** A product direct importing a concrete kernel engine class (e.g. `mar/page.tsx` directly importing `NursingEngineService` rather than accessing it via contract or Hook service).
*   **Enforcement:** Verified statically by dependency check scripts.

---

## 2. Data Access Invariants

*   **Rule:** Products must never directly write or read the internal database tables of a Kernel engine.
*   ❌ **FORBIDDEN:** `supabase.from('hc_temporal_events').select('*')` from UI.
*   ✅ **MANDATORY:** Consume Kernel data via standard public contracts and APIs.

---

## 3. Tenant Boundary Invariants

*   **Rule:** Cross-tenant reads/updates are strictly forbidden.
*   ✅ **MANDATORY:** Every SQL query (unless global) must filter by `tenant_id = public.get_auth_tenant_id()`.
*   ✅ **MANDATORY:** All database tables containing client/tenant data must have RLS active.

---

## 4. Transactional Event Invariants

*   **Rule:** Commitment first, dispatch second.
*   ✅ **MANDATORY:** The database transaction must successfully commit before a domain event is sent to the event bus.
*   ❌ **FORBIDDEN:** Publishing events optimistically before the database transaction is confirmed.

---

## 5. Coding & Typing Invariants

*   **Rule:** Complete strict typing, no runtime mocks.
*   ❌ **FORBIDDEN:** Forbidden use of `any` types.
*   ❌ **FORBIDDEN:** Fallback mocks in execution paths (bubble up errors instead).
