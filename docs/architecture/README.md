# Bella Architecture Documentation

**Purpose:** Central index for Bella Platform architecture, governance, and manufacturing documentation

---

## 🚨 MANDATORY READING FOR NEW OS/PRODUCT DEVELOPMENT

**[NEW_PRODUCT_CREATION_POLICY.md](NEW_PRODUCT_CREATION_POLICY.md)** — **READ THIS FIRST**

**Before creating any new Industry OS or Product:**
1. Read the New Product Creation Policy (5 Mandatory Gates)
2. Understand Decision Rules (reuse-first, minimal capability)
3. Know Factory capabilities (P1/P2 optional assistance)
4. Follow verification workflow (G1 → G5)

**Key principle:** Ít gate, invariant mạnh, automation hỗ trợ, human giữ judgment

---

## Manufacturing & Factory

**Manufacturing Phase 3.5:** ✅ COMPLETE (2026-09-05)

### Phase 3.5 Documents
- [MANUFACTURING_PHASE_3_5_CLOSURE.md](MANUFACTURING_PHASE_3_5_CLOSURE.md) — **Phase closure & qualification decision**
- [MANUFACTURING_PHASE_3_5_SUMMARY.md](MANUFACTURING_PHASE_3_5_SUMMARY.md) — Complete phase overview
- [MANUFACTURING_PHASE_3_5_CHECKPOINT.md](MANUFACTURING_PHASE_3_5_CHECKPOINT.md) — Mid-phase checkpoint
- [MANUFACTURING_PHASE_3_5_CAPABILITY_AUDIT.md](MANUFACTURING_PHASE_3_5_CAPABILITY_AUDIT.md) — Initial gap analysis

### P1: Schema Generation
- [MANUFACTURING_P1_COMPLETE.md](MANUFACTURING_P1_COMPLETE.md) — P1 evidence (21/21 tests, 89.5% effort reduction)
- Implementation: `.factory/schema-spec-contract.ts`, `.factory/schema-generator.ts`
- Tests: `src/__tests__/factory-schema-generator.test.ts`

### P2: Evidence Collection
- [MANUFACTURING_P2_COMPLETE.md](MANUFACTURING_P2_COMPLETE.md) — P2 evidence (23/23 tests, 72.5% effort reduction)
- [MANUFACTURING_P2_CONTRACT.md](MANUFACTURING_P2_CONTRACT.md) — Contract design
- [MANUFACTURING_P2_CONTRACT_REVIEW.md](MANUFACTURING_P2_CONTRACT_REVIEW.md) — Contract trim audit
- Implementation: `.factory/evidence-contract.ts`, `.factory/evidence-adapters.ts`, `.factory/evidence-collector.ts`
- Tests: `src/__tests__/factory-evidence-collector.test.ts`

### Deferred Capabilities
- **P3 Kernel Binding:** Awaiting bottleneck evidence (3+ Products needed)
- **P4 Test Scaffolding:** Awaiting bottleneck evidence (3+ Products needed)

---

## Governance & Verification

### Active Governance
- [PHASE1_REGRESSION_PROTECTION_CLOSURE.md](PHASE1_REGRESSION_PROTECTION_CLOSURE.md) — Phase 1 governance closure
- [GOVERNANCE_REGRESSION_GATE_POLICY.md](GOVERNANCE_REGRESSION_GATE_POLICY.md) — Regression gate policy
- [KNOWN_PATTERN_RULE_ADOPTION.md](KNOWN_PATTERN_RULE_ADOPTION.md) — Known Pattern workflow

### Platform Status
- **Gate B (TypeScript):** 43 PASS / 0 FAIL / 1 HOTSPOT
- **Regression Protection:** ACTIVE (field-tested)
- **Architecture Guard:** ENFORCED (frozen Kernel protection)

### Commands
```bash
# Gate B — TypeScript compliance (44 scopes)
npm run governance:typecheck

# Regression check (exit 0 = ALLOW, 1 = BLOCK)
npm run governance:check-regression

# Architecture Guard
npm run arch:guard
```

---

## Healthcare Kernel

### Healthcare Architecture
- [HEALTHCARE_KERNEL.md](HEALTHCARE_KERNEL.md) — Full Kernel classification (27 engines)
- [HEALTHCARE_VERTICAL_CONFORMANCE_AUDIT.md](HEALTHCARE_VERTICAL_CONFORMANCE_AUDIT.md) — Conformance audit
- [HEALTHCARE_PRODUCT_CONFORMANCE_MATRIX.md](HEALTHCARE_PRODUCT_CONFORMANCE_MATRIX.md) — Product conformance matrix

### Healthcare Kernel Status
- **H1-H12:** FROZEN (Architecture Guard enforced)
- **Healthcare Constitution:** Active compliance required
- **11 Verification Gates:** Mandatory for Healthcare Products

---

## Product Evidence

### Healthcare Products
- **bella-medical (Medical/Clinic OS):** Production
  - Schema: `supabase/migrations/20260806030000_healthcare_kernel_schema.sql`
  - Code: `src/products/bella-medical/`
  - Tests: 11 Verification Gates + Architecture Guard
  
- **bella-dental (Dental OS):** Production
  - Schema: Same migration (den_odontograms table)
  - Code: `src/products/bella-dental/`
  - Tests: 11 Verification Gates + Architecture Guard
  - Docs: `docs/products/dental/PRODUCT_MANIFEST.md` (comprehensive spec)

- **bella-hospital (Hospital OS):** Production
  - Schema: Healthcare Kernel H1-H12
  - Code: `src/products/bella-hospital/`
  - Tests: 11 Verification Gates

---

## Migration & Remediation

### Closed Remediation
- [REMEDIATION_20260510_CLOSURE.md](REMEDIATION_20260510_CLOSURE.md) — Migration remediation closure
- [REMEDIATION_20260510_FINAL_STATUS.md](REMEDIATION_20260510_FINAL_STATUS.md) — Final status
- Status: 🟡 PARTIALLY RUNTIME-VALIDATED

### Archived Analysis
- [STEP3_INTERMEDIATE_STATE_AUDIT.md](STEP3_INTERMEDIATE_STATE_AUDIT.md)
- [STEP5_FRESH_DB_TEST_FAILURE.md](STEP5_FRESH_DB_TEST_FAILURE.md)
- [STEP5_FRESH_DB_TEST_PARTIAL_VALIDATION.md](STEP5_FRESH_DB_TEST_PARTIAL_VALIDATION.md)
- [GATE5_PAUSE_SUMMARY.md](GATE5_PAUSE_SUMMARY.md)

---

## Logistics Kernel

### E7 Logistics Kernel
- **Status:** SEALED (frozen domain layer, persistence not implemented)
- **Scope:** Item, Inventory, Movement, Traceability
- **Location:** `src/platform/logistics/domain/`
- **Guard:** Active (frozen manifest + hash verification)

### Logistics Analysis
- [LOGISTICS_HOTSPOT_ANALYSIS.md](LOGISTICS_HOTSPOT_ANALYSIS.md) — Compilation timeout analysis
- **Status:** DEFERRED (test product, high architectural value, >180s timeout)
- **Decision:** Preserve assets, defer investigation until prioritized

---

## Key Architectural Documents

### Entry Points (Read First)
1. **[AI_CODING_CONTRACT.md](../../AI_CODING_CONTRACT.md)** — Canonical coding contract & governance workflow
2. **[AGENTS.md](../../AGENTS.md)** — Bella development principles
3. **[CLAUDE.md](../../CLAUDE.md)** — AI & developer entry point
4. **[NEW_PRODUCT_CREATION_POLICY.md](NEW_PRODUCT_CREATION_POLICY.md)** — New OS/Product policy (MANDATORY)

### Core Principles
- **Kernel-First, Not Kernel-Perfect** (AGENTS.md §1)
- **Reuse Before Rebuild** (AGENTS.md §4)
- **Minimal Complexity** (AGENTS.md §7)
- **Automate Repetition, Not Judgment** (Manufacturing Phase 3.5)

---

## Document Status Legend

- ✅ **COMPLETE** — Evidence complete, closed
- 🎯 **ACTIVE** — Current work/enforcement
- ⏸️ **DEFERRED** — Not blocking, awaiting evidence
- 🔒 **FROZEN** — Immutable baseline
- 🟡 **PARTIAL** — Incomplete but acceptable
- 🔥 **HOTSPOT** — Known issue, deferred

---

## Quick Reference

**Creating new OS/Product?**
→ Read [NEW_PRODUCT_CREATION_POLICY.md](NEW_PRODUCT_CREATION_POLICY.md)

**Need schema generation?**
→ Use P1 Schema Generator (`.factory/schema-generator.ts`) or write manual SQL

**Need evidence bundle?**
→ Use P2 Evidence Collector (`.factory/evidence-collector.ts`) or capture manually

**Modifying Healthcare Kernel?**
→ Read Healthcare Constitution, create Architecture Change Request (ACR)

**TypeScript errors?**
→ Run `npm run governance:typecheck`, check Known Patterns

**Architecture boundary violation?**
→ Run `npm run arch:guard`, review contract-only access rule

---

**Last Updated:** 2026-09-05  
**Maintained By:** Bella Platform Team
