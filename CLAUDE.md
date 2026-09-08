# BELLA OS — AI & DEVELOPER ENTRY POINT

**BEFORE CODING ON BELLA:**

1. **Read [AI_CODING_CONTRACT.md](AI_CODING_CONTRACT.md) FIRST** — Canonical repository-wide coding contract, governance workflow, and safety rules
2. **Read [AGENTS.md](AGENTS.md)** — Bella architecture principles (Kernel-first, reuse before rebuild, minimal complexity)
3. **⚠️ CREATING NEW OS/PRODUCT? Read [New Product Creation Policy](docs/architecture/NEW_PRODUCT_CREATION_POLICY.md)** — 5 Mandatory Gates, mandatory reading
4. Read relevant architecture/governance documentation below
5. Inspect current repository state and applicable gates
6. Do NOT modify code before ownership/evidence is clear

---

## Repository Documentation

The following documents represent the current state and strict invariants of the repository:

---

## Governance & Verification

**Phase 1 Regression Protection:** Active (field-tested)
- **Closure Document:** [docs/architecture/PHASE1_REGRESSION_PROTECTION_CLOSURE.md](docs/architecture/PHASE1_REGRESSION_PROTECTION_CLOSURE.md)
- **Governance Policy:** [docs/architecture/GOVERNANCE_REGRESSION_GATE_POLICY.md](docs/architecture/GOVERNANCE_REGRESSION_GATE_POLICY.md)

**Commands:**
```bash
# Gate B — TypeScript compliance (44 scopes)
npm run governance:typecheck

# Regression check (exit 0 = ALLOW, 1 = BLOCK)
npm run governance:check-regression

# Architecture Guard
npm run arch:guard

# Healthcare-specific verification
npm run healthcare:verify
```

---

## Current Baseline Status & Evidence

- **Current Baseline Status:** [docs/execution/CURRENT_BASELINE.md](docs/execution/CURRENT_BASELINE.md) (H1 complete, K1 in-progress)
- **H1 Verification Evidence:** [docs/execution/HOSPITAL_H1_EVIDENCE.md](docs/execution/HOSPITAL_H1_EVIDENCE.md) (11/11 DB integration tests passed)
- **Healthcare Kernel Map:** [docs/architecture/HEALTHCARE_KERNEL.md](docs/architecture/HEALTHCARE_KERNEL.md) (Full classification of all 27 engines)

---

## Manufacturing & Factory Capabilities

**Manufacturing Phase 3.5:** ✅ COMPLETE (Factory qualified for controlled Product production)
- **Closure Document:** [docs/architecture/MANUFACTURING_PHASE_3_5_CLOSURE.md](docs/architecture/MANUFACTURING_PHASE_3_5_CLOSURE.md)

**Factory Capabilities Available:**
- **P1 Schema Generation:** Deterministic SQL generation with Bella patterns (21/21 tests PASS)
  - Contract: `.factory/schema-spec-contract.ts`
  - Generator: `.factory/schema-generator.ts`
  - 89.5% effort reduction (pilot evidence)
- **P2 Evidence Collection:** Automated evidence aggregation (23/23 tests PASS)
  - Contract: `.factory/evidence-contract.ts`
  - Adapters: `.factory/evidence-adapters.ts`
  - Collector: `.factory/evidence-collector.ts`
  - 72.5% effort reduction (pilot evidence)

**Deferred Capabilities:**
- P3 Kernel Binding (awaiting bottleneck evidence)
- P4 Test Scaffolding (awaiting bottleneck evidence)

**⚠️ Creating New OS/Product?**
- **MUST READ:** [New Product Creation Policy](docs/architecture/NEW_PRODUCT_CREATION_POLICY.md)
- 5 Mandatory Gates (Definition, Architecture, Verification, Evidence, Qualification)
- Decision Rules (reuse-first, minimal capability, additive extension)
- Factory usage optional (P1/P2 assist, not mandatory)

---

## Invariants & Rules

- **Coding Conventions:** [docs/rules/CODING_RULES.md](docs/rules/CODING_RULES.md) (Strict typing, no `any`, frontend-backend boundary)
- **Healthcare Laws:** [docs/rules/HEALTHCARE_RULES.md](docs/rules/HEALTHCARE_RULES.md) (Encounter aggregate, zero-duplication rules, 11 gates)
- **Database Schema & RLS:** [docs/rules/DATABASE_RULES.md](docs/rules/DATABASE_RULES.md) (Additive migrations only, RLS query filter)

---

## Strict Non-Negotiable Laws
1. **KERNEL FREEZE:** Core engines (H1-H12, mpi-engine, encounter-engine) are frozen. Modify only via ACR.
2. **PRODUCT VERTICAL LAYER ONLY:** All product-specific logic goes to `src/products/`.
3. **CONTRACT ACCESS ONLY:** Product interacts with Kernel only via contracts. No direct query on core internal tables.
4. **ZERO ENTITY DUPLICATION:** Do not recreate `Patient`, `Doctor`, or `Encounter` tables in vertical modules.
5. **CLEAN DEPENDENCY FLOW:** Kernel engines must never import from vertical/hospital extensions.
6. **NO MOCK RUNTIME:** Production and test execution paths must never use mock fallback state on failure.

---

## Key Principle

> **AI_CODING_CONTRACT.md is the single canonical entry point for governance, workflow, and safety rules.**

All AI agents working on Bella must follow the contract's evidence-based workflow:
```
Inventory → Evidence → Ownership → Minimal Fix → Gates → Commit
```

When ownership is unclear: Document the ambiguity. Do NOT guess. Wait for human decision.
