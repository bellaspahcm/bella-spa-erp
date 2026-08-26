# BELLA OS — AI & DEVELOPER ENTRY POINT (CONSTITUTIONAL RULES)

Before doing any work, you MUST read the following local documentation. They represent the current state and strict invariants of the repository:

## 1. Context & Baseline Status
- **Current Baseline Status:** [docs/execution/CURRENT_BASELINE.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/execution/CURRENT_BASELINE.md) (H1 complete, K1 in-progress)
- **H1 Verification Evidence:** [docs/execution/HOSPITAL_H1_EVIDENCE.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/execution/HOSPITAL_H1_EVIDENCE.md) (11/11 DB integration tests passed)
- **Healthcare Kernel Map:** [docs/architecture/HEALTHCARE_KERNEL.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/architecture/HEALTHCARE_KERNEL.md) (Full classification of all 27 engines)

## 2. Invariants & Rules
- **Coding Conventions:** [docs/rules/CODING_RULES.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/rules/CODING_RULES.md) (Strict typing, no `any`, frontend-backend boundary)
- **Healthcare Laws:** [docs/rules/HEALTHCARE_RULES.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/rules/HEALTHCARE_RULES.md) (Encounter aggregate, zero-duplication rules, 11 gates)
- **Database Schema & RLS:** [docs/rules/DATABASE_RULES.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/rules/DATABASE_RULES.md) (Additive migrations only, RLS query filter)

## 3. Strict Non-Negotiable Laws
1. **KERNEL FREEZE:** Core engines (H1-H12, mpi-engine, encounter-engine) are frozen. Modify only via ACR.
2. **PRODUCT VERTICAL LAYER ONLY:** All product-specific logic goes to `src/products/`.
3. **CONTRACT ACCESS ONLY:** Product interacts with Kernel only via contracts. No direct query on core internal tables.
4. **ZERO ENTITY DUPLICATION:** Do not recreate `Patient`, `Doctor`, or `Encounter` tables in vertical modules.
5. **CLEAN DEPENDENCY FLOW:** Kernel engines must never import from vertical/hospital extensions.
6. **NO MOCK RUNTIME:** Production and test execution paths must never use mock fallback state on failure.

## 4. Verification
Before completing any task, you MUST run:
- Architecture check: `npm run healthcare:guard`
- Full platform verification: `npm run healthcare:verify`
